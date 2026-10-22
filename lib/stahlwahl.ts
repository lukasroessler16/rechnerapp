/**
 * Bewehrungsstellen und die Stahlwahl des Kunden.
 *
 * WARUM ES DAS GIBT: Bisher hat das Programm jede Bewehrung selbst festgelegt –
 * Anschlusseisen Ø10/25, Öffnungszulagen Ø12, Fläche aus Lagermatten. Das ist
 * eine vernünftige Vorgabe, aber auf der Baustelle liegt oft schon anderer
 * Stahl, der Händler hat eine Position nicht lagernd, oder der Tragwerksplaner
 * gibt etwas anderes vor. Deshalb kann jede Stelle einzeln geändert werden.
 *
 * WAS DER KUNDE NICHT ÄNDERT: die Stückzahl. Sie folgt aus Durchmesser,
 * Abstand und Bauteilmaß und wird weiterhin gerechnet – genau das ist der
 * Zweck des Werkzeugs. Der Kunde sagt, WAS verlegt wird, das Programm sagt,
 * WIE VIEL davon.
 *
 * STELLE = GRUPPE: Eine Bewehrungsstelle ist dieselbe Einheit, nach der
 * Stückliste und Plan schon gegliedert sind ("Anschluss oben", "Öffnung F1").
 * Dadurch braucht es keine zweite Gliederung daneben, die auseinanderlaufen
 * könnte: Was der Kunde als Block auswählt, ist derselbe Block, den er auf
 * der Liste wiederfindet. Die Zuordnung läuft über die Kennung der Gruppe,
 * nicht über ihren Namen – Namen sind Anzeigetext und dürfen sich ändern.
 *
 * Dass die angebotenen Stellen genau die sind, die auch Bewehrung erzeugen,
 * prüft scripts/test-berechnung.ts für jedes Bauteil in vielen
 * Detailkombinationen. Eine angebotene Stelle ohne Wirkung wäre eine Lüge,
 * eine nicht angebotene Stelle wäre eine Einschränkung ohne Grund.
 */

import { STABDURCHMESSER } from "./normdaten";

/** Was an einer Stelle verlegt wird */
export interface Stahlwahl {
  /** nur an Flächen: Lagermatten oder Stabstahl */
  art?: "matte" | "stab";
  /** Stabdurchmesser [mm] */
  durchmesser: number;
  /** Verlegeabstand [mm] */
  abstand: number;
  /** Lagermatte: "auto" (kleinste ausreichende) oder fester Name */
  matte?: string;
  /** Übergreifungsstoß der Matten [mm] */
  stoss?: number;
}

/**
 * Eine Stelle, an der Bewehrung liegt – und die der Kunde einstellen kann.
 * Das Bauteilmodul liefert die Liste; sie hängt von den gewählten Details ab
 * (ein freier Rand bekommt Steckbügel, ein Deckenanschluss Anschlusseisen).
 */
export interface Bewehrungsstelle {
  /** stabile Kennung, zugleich Kennung der Positionsgruppe */
  id: string;
  /** Anzeigename, identisch mit der Gruppenüberschrift der Stückliste */
  titel: string;
  /** eine Zeile dazu, was an dieser Stelle liegt und warum */
  erklaerung: string;
  /** Vorgabe des Programms, solange der Kunde nichts anderes wählt */
  standard: Stahlwahl;
  /** Flächenbewehrung: hier ist zusätzlich Matte/Stab wählbar */
  flaeche?: boolean;
  /**
   * Erforderliche Bewehrung an dieser Stelle [cm²/m], falls es eine gibt.
   * Nur zur Rückmeldung in der Oberfläche – gerechnet wird im Bauteilmodul.
   */
  asErf?: number;
  /** Welche Durchmesser hier sinnvoll sind (Vorauswahl, keine Sperre) */
  durchmesser?: number[];
  /**
   * An dieser Stelle gibt es keinen Verlegeabstand: Die Stückzahl folgt aus
   * der erforderlichen Fläche oder aus der Geometrie (zwei Zulagen über einer
   * Öffnung, ein Steckeisen je Längsstab). Das Feld wird dann gar nicht erst
   * angeboten – ein Eingabefeld ohne Wirkung ist schlimmer als keines.
   */
  ohneAbstand?: boolean;
}

/** Die Wahl des Kunden je Stelle; fehlt eine, gilt die Vorgabe des Moduls */
export type Stahlwahlen = Record<string, Partial<Stahlwahl>>;

/* ------------------------------------------------------------------ */
/* Zulässige Werte                                                     */
/* ------------------------------------------------------------------ */

/** Verlegeabstände, die auf der Baustelle üblich sind [mm] */
export const ABSTAENDE = [100, 125, 150, 175, 200, 250, 300];

/**
 * Grenzen des Verlegeabstands [mm].
 *
 * Nach unten: Unter 5 cm lichtem Abstand lässt sich nicht mehr betonieren
 * (EC2 8.2). Nach oben: EC2 9.3.1.1 begrenzt den Stababstand der
 * Hauptbewehrung von Platten auf 250 bzw. 400 mm; 300 mm ist der Wert, der
 * mit den üblichen Mindestbewehrungen noch aufgeht.
 */
export const ABSTAND_MIN = 50;
export const ABSTAND_MAX = 400;

/** Durchmesser, die als Stabstahl angeboten werden [mm] */
export const DURCHMESSER = STABDURCHMESSER;

/** Übergreifungsstoß der Matten: Grenzen [mm] */
export const STOSS_MIN = 100;
export const STOSS_MAX = 800;

/* ------------------------------------------------------------------ */
/* Zusammenführen und Prüfen                                           */
/* ------------------------------------------------------------------ */

/** Wahl des Kunden über die Vorgabe der Stelle legen */
export function stahlwahlFuer(
  stelle: Bewehrungsstelle,
  wahlen: Stahlwahlen | undefined
): Stahlwahl {
  const gewaehlt = wahlen?.[stelle.id] ?? {};
  const art = stelle.flaeche ? (gewaehlt.art ?? stelle.standard.art ?? "matte") : undefined;
  return {
    art,
    durchmesser: gewaehlt.durchmesser ?? stelle.standard.durchmesser,
    abstand: gewaehlt.abstand ?? stelle.standard.abstand,
    matte: gewaehlt.matte ?? stelle.standard.matte ?? "auto",
    stoss: gewaehlt.stoss ?? stelle.standard.stoss,
  };
}

/** Hat der Kunde an dieser Stelle etwas von der Vorgabe abweichend gewählt? */
export function abweichend(stelle: Bewehrungsstelle, wahlen: Stahlwahlen | undefined): boolean {
  const w = wahlen?.[stelle.id];
  if (!w) return false;
  const s = stahlwahlFuer(stelle, wahlen);
  return (
    s.durchmesser !== stelle.standard.durchmesser ||
    s.abstand !== stelle.standard.abstand ||
    (!!stelle.flaeche &&
      (s.art !== (stelle.standard.art ?? "matte") ||
        s.matte !== (stelle.standard.matte ?? "auto") ||
        s.stoss !== stelle.standard.stoss))
  );
}

/**
 * Eine Kundenwahl auf zulässige Werte bringen.
 *
 * Läuft serverseitig beim Checkout genauso wie in der Oberfläche: Ein
 * Durchmesser, den es nicht gibt, oder ein Abstand von 2 mm darf nicht in
 * eine Biegeliste gelangen, auch nicht über eine veränderte Anfrage.
 */
export function bereinigeWahl(roh: unknown): Partial<Stahlwahl> {
  const q = (roh ?? {}) as Partial<Stahlwahl>;
  const sauber: Partial<Stahlwahl> = {};

  if (q.art === "matte" || q.art === "stab") sauber.art = q.art;

  const d = Number(q.durchmesser);
  if (DURCHMESSER.includes(d)) sauber.durchmesser = d;

  const a = Math.round(Number(q.abstand));
  if (isFinite(a) && a >= ABSTAND_MIN && a <= ABSTAND_MAX) sauber.abstand = a;

  if (typeof q.matte === "string" && q.matte.length <= 12) sauber.matte = q.matte;

  const s = Math.round(Number(q.stoss));
  if (isFinite(s) && s >= STOSS_MIN && s <= STOSS_MAX) sauber.stoss = s;

  return sauber;
}

/** Alle Wahlen eines Projekts bereinigen; unbekannte Stellen fallen weg */
export function bereinigeWahlen(roh: unknown, erlaubteIds: string[]): Stahlwahlen {
  if (!roh || typeof roh !== "object") return {};
  const sauber: Stahlwahlen = {};
  for (const [id, wert] of Object.entries(roh as Record<string, unknown>)) {
    if (!erlaubteIds.includes(id)) continue;
    const w = bereinigeWahl(wert);
    if (Object.keys(w).length > 0) sauber[id] = w;
  }
  return sauber;
}
