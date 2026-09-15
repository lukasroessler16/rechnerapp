/**
 * Betriebsmodus, Fehlerbehandlung und Alarmierung.
 *
 * Hier liegen die Entscheidungen, die im laufenden Betrieb Geld kosten, wenn
 * sie falsch getroffen werden:
 *
 *  1. WANN DARF OHNE ZAHLUNG AUSGELIEFERT WERDEN?
 *     Früher galt: kein STRIPE_SECRET_KEY → Demo-Modus → Dokumente gratis.
 *     Das ist bequem beim Entwickeln und fatal in Produktion: Fehlt die
 *     Variable dort einmal (Tippfehler, falsche Environment-Auswahl, nach
 *     einem Schlüsseltausch), verschenkt die App lautlos das Produkt.
 *     Jetzt gilt: In Produktion gibt es Demo NUR, wenn er mit DEMO_MODUS=1
 *     ausdrücklich eingeschaltet wurde. Sonst schlägt die Route hart fehl –
 *     ein sichtbarer Ausfall ist allemal besser als ein unsichtbarer Verlust.
 *
 *  2. WAS ERFÄHRT DER KUNDE, WAS ERFÄHRT DER BETREIBER?
 *     Der Kunde bekommt einen verständlichen Satz und eine Kontaktadresse,
 *     nie eine interne Fehlermeldung. Der Betreiber bekommt alles, inklusive
 *     Zahlungsreferenz – über melde(), das an einen Fehlerdienst angebunden
 *     werden kann (siehe unten).
 */

/** Läuft die App als öffentliches Produktivsystem? */
export function istProduktion(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Darf ohne Zahlung ausgeliefert werden?
 * Außerhalb der Produktion: ja, solange kein Stripe-Schlüssel gesetzt ist.
 * In Produktion: nur mit ausdrücklichem DEMO_MODUS=1.
 */
export function demoErlaubt(): boolean {
  if (process.env.DEMO_MODUS === "1") return true;
  return !istProduktion() && !process.env.STRIPE_SECRET_KEY;
}

/**
 * Stripe-Schlüssel holen und dabei die Fehlkonfiguration abfangen, die am
 * meisten kostet: Produktivbetrieb ohne Zahlungsanbindung.
 * Gibt null zurück, wenn stattdessen zulässigerweise der Demo-Weg gilt.
 */
export function stripeSchluessel(): string | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (key) return key;
  if (demoErlaubt()) return null;
  throw new BetriebsFehler(
    "Die Zahlungsabwicklung ist derzeit nicht verfügbar. Bitte versuchen Sie es " +
      "später erneut oder wenden Sie sich an den Betreiber.",
    "STRIPE_SECRET_KEY fehlt, obwohl die App in Produktion läuft und DEMO_MODUS nicht gesetzt ist."
  );
}

/**
 * Fehler mit einer Nachricht, die dem Kunden gezeigt werden darf.
 * Alles andere wird nach außen zu einer neutralen Meldung – interne Texte
 * (Stripe-Fehler, Stacktraces, Dateipfade) gehören nicht zum Kunden.
 */
export class BetriebsFehler extends Error {
  /** interner Text für Log und Alarm */
  readonly intern: string;
  readonly status: number;

  constructor(kundenText: string, intern?: string, status = 400) {
    super(kundenText);
    this.name = "BetriebsFehler";
    this.intern = intern ?? kundenText;
    this.status = status;
  }
}

/** Kontaktadresse für Fehlerfälle, im Text der Meldungen verwendet */
export function kontaktAdresse(): string {
  return process.env.NEXT_PUBLIC_KONTAKT_MAIL || "";
}

/**
 * Sperrfrist je Fehlerart, damit ein kaputtes Deployment nicht hundert
 * Alarmmails auslöst. Ein zweiter Alarm derselben Art geht erst nach Ablauf
 * hinaus; protokolliert wird trotzdem jeder einzelne Fall.
 */
const ALARM_SPERRE_MS = 10 * 60 * 1000;
const letzterAlarm = new Map<string, number>();

function alarmFaellig(signatur: string): boolean {
  const jetzt = Date.now();
  const vorher = letzterAlarm.get(signatur);
  if (vorher && jetzt - vorher < ALARM_SPERRE_MS) return false;
  letzterAlarm.set(signatur, jetzt);
  // Die Map bleibt klein; bei Bedarf Abgelaufenes wegräumen.
  if (letzterAlarm.size > 200) {
    for (const [k, t] of letzterAlarm) if (jetzt - t > ALARM_SPERRE_MS) letzterAlarm.delete(k);
  }
  return true;
}

/** Nur für Tests: Sperrfristen zurücksetzen */
export function alarmSperreZuruecksetzen() {
  letzterAlarm.clear();
}

/**
 * Zentrale Fehlermeldung an den Betreiber.
 *
 * Zwei Wege:
 *  1. Immer eine strukturierte Zeile auf stderr – in den Vercel-Logs sichtbar
 *     und dort filterbar ("schwere":"kritisch").
 *  2. Bei `schwere: "kritisch"` zusätzlich eine E-Mail. Das sind die Fälle,
 *     in denen bereits Geld geflossen ist: Jemand hat bezahlt und keine
 *     Unterlagen bekommen. Darauf muss jemand reagieren, und zwar heute –
 *     ein Protokolleintrag, den niemand liest, genügt dafür nicht.
 *
 * Die Mail wird bewusst nicht abgewartet: Sie darf den Vorgang, aus dem
 * heraus sie ausgelöst wurde, weder verzögern noch zum Scheitern bringen.
 *
 * Wächst das Aufkommen, kann hier zusätzlich ein Fehlerdienst angebunden
 * werden (z. B. Sentry) – alle Aufrufstellen bleiben davon unberührt.
 */
export function melde(
  stelle: string,
  fehler: unknown,
  zusatz: Record<string, unknown> = {},
  schwere: "warnung" | "fehler" | "kritisch" = "fehler"
): void {
  const text =
    fehler instanceof BetriebsFehler
      ? fehler.intern
      : fehler instanceof Error
        ? `${fehler.name}: ${fehler.message}`
        : String(fehler);

  const eintrag = {
    zeit: new Date().toISOString(),
    schwere,
    stelle,
    meldung: text,
    ...zusatz,
  };

  // Einzeiliges JSON: in Vercel gut filterbar ("schwere":"kritisch")
  console.error(`[${schwere.toUpperCase()}] ${JSON.stringify(eintrag)}`);
  const spur = fehler instanceof Error ? fehler.stack : undefined;
  if (spur && schwere !== "warnung") console.error(spur);

  if (schwere !== "kritisch") return;

  // Signatur ohne die wechselnden Anteile (Session-Kennung, Zeit), damit
  // derselbe Defekt als derselbe erkannt wird.
  if (!alarmFaellig(`${stelle}|${text.slice(0, 120)}`)) return;

  // Absichtlich ohne await – siehe oben.
  void import("./email")
    .then(({ sendeAlarmMail }) =>
      sendeAlarmMail({
        stelle,
        meldung: text,
        sessionId: typeof zusatz.sessionId === "string" ? zusatz.sessionId : undefined,
        bezahlt: zusatz.bezahlt === true,
        spur: spur?.split("\n").slice(0, 12).join("\n"),
      })
    )
    .catch((e) => console.error("[Alarm] Konnte nicht versendet werden:", e));
}

/**
 * Wandelt einen beliebigen Fehler in das um, was der Kunde sehen darf.
 * Interne Fehler werden bewusst zu einem neutralen Text – mit Kontaktadresse,
 * damit niemand mit einem bezahlten, aber leeren Ergebnis alleine dasteht.
 */
export function kundenMeldung(fehler: unknown, bezahlt = false): {
  text: string;
  status: number;
} {
  if (fehler instanceof BetriebsFehler) {
    return { text: fehler.message, status: fehler.status };
  }
  const kontakt = kontaktAdresse();
  const hilfe = kontakt
    ? ` Bitte wenden Sie sich an ${kontakt}${bezahlt ? " – Ihre Zahlung ist dokumentiert und wir kümmern uns darum." : "."}`
    : bezahlt
      ? " Ihre Zahlung ist dokumentiert; bitte wenden Sie sich an den Betreiber."
      : "";
  return {
    text: `Bei der Verarbeitung ist ein unerwarteter Fehler aufgetreten.${hilfe}`,
    status: 500,
  };
}
