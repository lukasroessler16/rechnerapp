/**
 * Test der Betriebs-Absicherungen: Demo-Riegel, Rate-Limit, Payload-Version.
 * Aufruf: npx tsx scripts/test-betrieb.ts
 *
 * Diese drei Dinge schlagen im Alltag nie fehl und genau deshalb fällt es
 * nicht auf, wenn sie kaputtgehen. Der Test hält sie fest.
 */

import { deflateSync } from "zlib";
import { NextRequest } from "next/server";
import {
  BetriebsFehler,
  alarmSperreZuruecksetzen,
  demoErlaubt,
  kundenMeldung,
  melde,
  stripeSchluessel,
} from "../lib/betrieb";
import { ereignis, statistikAktiv } from "../lib/statistik";
import { limitZuruecksetzen, pruefeLimit } from "../lib/ratelimit";
import {
  metadataHerkunft,
  metadataZuBauvorhaben,
  projektZuMetadata,
  validiereBauvorhaben,
} from "../lib/payload";
import { MAX_ABSCHNITTE, abschnittsStreifen, teilbar } from "../lib/abschnitte";
import { dokumentplan } from "../lib/dokumente";
import { PAYLOAD_VERSION } from "../lib/version";
import { MUSTERPROJEKT } from "../lib/muster";

/** Umgebung für einen Prüffall setzen und danach wiederherstellen */
function mitUmgebung(werte: Record<string, string | undefined>, fn: () => void) {
  const vorher: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(werte)) {
    vorher[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    fn();
  } finally {
    for (const [k, v] of Object.entries(vorher)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

/* ------------------------------------------------------------------ */
/* 1) Demo-Riegel                                                      */
/* ------------------------------------------------------------------ */

console.log("=== Demo-Riegel ===");

// Entwicklung ohne Stripe: Demo ist erlaubt, sonst könnte niemand testen.
mitUmgebung({ NODE_ENV: "development", STRIPE_SECRET_KEY: undefined, DEMO_MODUS: undefined }, () => {
  if (!demoErlaubt()) throw new Error("Lokal ohne Stripe muss der Demo-Modus laufen.");
  if (stripeSchluessel() !== null)
    throw new Error("Ohne Schlüssel muss stripeSchluessel() lokal null liefern.");
});

// DER entscheidende Fall: Produktion, Schlüssel fehlt (vergessen, vertippt,
// falsches Environment). Früher wurden hier Dokumente verschenkt.
mitUmgebung({ NODE_ENV: "production", STRIPE_SECRET_KEY: undefined, DEMO_MODUS: undefined }, () => {
  if (demoErlaubt())
    throw new Error("In Produktion darf ohne DEMO_MODUS niemals Demo laufen!");
  let geworfen = false;
  try {
    stripeSchluessel();
  } catch (e) {
    geworfen = true;
    if (!(e instanceof BetriebsFehler))
      throw new Error("Die Fehlkonfiguration muss einen BetriebsFehler werfen.");
  }
  if (!geworfen)
    throw new Error("Produktion ohne Stripe-Schlüssel muss hart fehlschlagen.");
});

// Bewusst eingeschaltet (z. B. für eine Vorführung) bleibt möglich.
mitUmgebung({ NODE_ENV: "production", STRIPE_SECRET_KEY: undefined, DEMO_MODUS: "1" }, () => {
  if (!demoErlaubt()) throw new Error("DEMO_MODUS=1 muss den Demo-Weg öffnen.");
});

// Produktion MIT Schlüssel: normaler Betrieb, kein Demo.
mitUmgebung({ NODE_ENV: "production", STRIPE_SECRET_KEY: "sk_test_xyz", DEMO_MODUS: undefined }, () => {
  if (demoErlaubt()) throw new Error("Mit Stripe-Schlüssel darf kein Demo laufen.");
  if (stripeSchluessel() !== "sk_test_xyz")
    throw new Error("Der gesetzte Schlüssel muss durchgereicht werden.");
});
console.log("Demo-Riegel greift in allen vier Fällen");

/* ------------------------------------------------------------------ */
/* 2) Fehlermeldungen verraten nichts nach außen                       */
/* ------------------------------------------------------------------ */

console.log("\n=== Fehlermeldungen ===");

const intern = new Error("connect ECONNREFUSED 10.0.0.7:5432 – secret sk_live_abc");
const nachAussen = kundenMeldung(intern, true);
if (nachAussen.text.includes("sk_live") || nachAussen.text.includes("ECONNREFUSED"))
  throw new Error("Interne Fehlertexte dürfen nicht zum Kunden gelangen!");
if (nachAussen.status !== 500)
  throw new Error("Unerwartete Fehler müssen 500 liefern, nicht 400.");
if (!nachAussen.text.includes("Zahlung"))
  throw new Error("Nach einer Zahlung muss die Meldung darauf eingehen.");

const gewollt = kundenMeldung(new BetriebsFehler("Zahlung noch nicht abgeschlossen.", "intern", 402));
if (gewollt.text !== "Zahlung noch nicht abgeschlossen." || gewollt.status !== 402)
  throw new Error("Beabsichtigte Meldungen müssen unverändert durchgehen.");
console.log("Interne Texte bleiben intern, beabsichtigte Meldungen kommen durch");

/* ------------------------------------------------------------------ */
/* 3) Rate-Limit                                                       */
/* ------------------------------------------------------------------ */

console.log("\n=== Rate-Limit ===");

const anfrage = (ip: string) =>
  new NextRequest("http://localhost/api/muster", { headers: { "x-forwarded-for": ip } });

limitZuruecksetzen();
for (let i = 0; i < 5; i++) {
  const r = pruefeLimit(anfrage("1.2.3.4"), "test", 5, 60);
  if (!r.erlaubt) throw new Error(`Aufruf ${i + 1} von 5 wurde zu früh gesperrt.`);
}
const zuViel = pruefeLimit(anfrage("1.2.3.4"), "test", 5, 60);
if (zuViel.erlaubt) throw new Error("Der sechste Aufruf muss gesperrt werden.");
if (zuViel.wartenSek < 1) throw new Error("Retry-After muss eine Wartezeit nennen.");

// Andere Adresse und anderer Bereich haben eigene Töpfe
if (!pruefeLimit(anfrage("9.9.9.9"), "test", 5, 60).erlaubt)
  throw new Error("Ein anderer Anfragender darf nicht mitgesperrt werden.");
if (!pruefeLimit(anfrage("1.2.3.4"), "anderer", 5, 60).erlaubt)
  throw new Error("Ein anderer Bereich hat einen eigenen Zähler.");

// Nach Ablauf des Fensters wieder frei
limitZuruecksetzen();
if (!pruefeLimit(anfrage("1.2.3.4"), "test", 1, 1).erlaubt)
  throw new Error("Nach dem Zurücksetzen muss wieder gezählt werden.");
console.log("Rate-Limit sperrt, trennt nach Adresse und Bereich, gibt wieder frei");

/* ------------------------------------------------------------------ */
/* 4) Payload-Version                                                  */
/* ------------------------------------------------------------------ */

console.log("\n=== Payload-Version ===");

const meta = projektZuMetadata([MUSTERPROJEKT]);
if (meta["v"] !== String(PAYLOAD_VERSION))
  throw new Error("Jede Zahlung muss die Formatversion mitschreiben.");
if (!meta["b"]) throw new Error("Jede Zahlung muss den Code-Stand mitschreiben.");

const herkunft = metadataHerkunft(meta);
if (herkunft.version !== PAYLOAD_VERSION)
  throw new Error("Die Herkunft muss die geschriebene Version zurückliefern.");

// Eine Session aus einer künftigen Programmversion darf nicht stillschweigend
// falsch gelesen werden.
let abgewiesen = false;
try {
  metadataZuBauvorhaben({ ...meta, v: String(PAYLOAD_VERSION + 1) });
} catch {
  abgewiesen = true;
}
if (!abgewiesen)
  throw new Error("Eine neuere Formatversion muss abgewiesen werden, nicht geraten.");

// Sessions aus der Zeit vor der Versionierung gelten als Version 1 und
// müssen weiterhin lesbar bleiben.
const ohneVersion = { ...meta };
delete ohneVersion["v"];
delete ohneVersion["b"];
const alt = metadataZuBauvorhaben(ohneVersion)[0];
if (alt.bauteil !== MUSTERPROJEKT.bauteil)
  throw new Error("Alte Sessions ohne Versionsfeld müssen weiterhin lesbar sein.");
if (metadataHerkunft(ohneVersion).codeStand !== "unbekannt")
  throw new Error("Fehlt der Code-Stand, muss das als 'unbekannt' erkennbar sein.");
console.log("Version und Code-Stand werden geschrieben, geprüft und bleiben lesbar");

/*
 * Echte Version-1-Daten: ein EINZELNES Projekt, kein Array.
 * Genau so liegen die Zahlungen in der Welt, die vor der Aufteilung in
 * Abschnitte getätigt wurden. Ihre Links bleiben dauerhaft gültig – wenn
 * diese Migration bricht, bekommt ein Kunde Monate später statt seiner
 * Unterlagen eine Fehlermeldung, und niemand merkt es vorher.
 */
const v1Roh = deflateSync(Buffer.from(JSON.stringify(MUSTERPROJEKT), "utf8")).toString(
  "base64url"
);
const v1Meta: Record<string, string> = { v: "1", b: "test", n: "0" };
{
  const chunks = Math.ceil(v1Roh.length / 450);
  v1Meta["n"] = String(chunks);
  for (let i = 0; i < chunks; i++) v1Meta[`p${i}`] = v1Roh.slice(i * 450, (i + 1) * 450);
}
const gewandert = metadataZuBauvorhaben(v1Meta);
if (!Array.isArray(gewandert) || gewandert.length !== 1)
  throw new Error("Eine Version-1-Zahlung muss zu genau einem Abschnitt werden.");
if (gewandert[0].bauteil !== MUSTERPROJEKT.bauteil)
  throw new Error("Die Migration 1 → 2 darf das Projekt nicht verändern.");
console.log("Zahlungen aus der Zeit vor den Abschnitten bleiben einlösbar");

/* ------------------------------------------------------------------ */
/* 4b) Abschnitte                                                      */
/* ------------------------------------------------------------------ */

console.log("\n=== Abschnitte ===");

// Gemeinsame Angaben gehören dem Bauvorhaben: Ein manipulierter zweiter
// Abschnitt darf sich nicht sein eigenes Regelwerk oder seinen eigenen
// Schriftkopf geben – sonst wären zwei Blätter desselben Pakets nach
// verschiedenen Normen gerechnet.
const gemischt = validiereBauvorhaben([
  MUSTERPROJEKT,
  {
    ...MUSTERPROJEKT,
    masse: { ...MUSTERPROJEKT.masse, laenge: 4 },
    parameter: { ...MUSTERPROJEKT.parameter, regelwerk: "de", betondeckung: 45 },
    firmendaten: { ...MUSTERPROJEKT.firmendaten, firma: "Fremde Firma" },
  },
]);
if (gemischt[1].parameter.regelwerk !== gemischt[0].parameter.regelwerk)
  throw new Error("Alle Abschnitte müssen nach demselben Regelwerk gerechnet werden.");
if (gemischt[1].firmendaten.firma !== gemischt[0].firmendaten.firma)
  throw new Error("Alle Abschnitte müssen denselben Schriftkopf tragen.");
if (gemischt[1].masse.laenge !== 4)
  throw new Error("Die Maße eines Abschnitts sind sein eigenes – sie dürfen nicht angeglichen werden.");

// Die Zahl der Abschnitte bestimmt den Preis. Sie wird deshalb serverseitig
// begrenzt, nicht nur in der Oberfläche.
let zuViele = false;
try {
  validiereBauvorhaben(new Array(MAX_ABSCHNITTE + 1).fill(MUSTERPROJEKT));
} catch {
  zuViele = true;
}
if (!zuViele) throw new Error(`Mehr als ${MAX_ABSCHNITTE} Abschnitte müssen abgewiesen werden.`);

// Ein nicht teilbares Bauteil behält genau einen Abschnitt, auch wenn jemand
// mehrere schickt – sonst ließe sich ein Fundament vervierfacht verkaufen.
const stuetze = {
  ...MUSTERPROJEKT,
  bauteil: "stuetze",
  masse: { breite: 0.4, tiefe: 0.3, hoehe: 3.2 },
  oeffnungen: [],
  details: { fuss: "fundament", kopf: "decke_ueber" },
};
if (validiereBauvorhaben([stuetze, stuetze, stuetze]).length !== 1)
  throw new Error("Nicht teilbare Bauteile dürfen nur einen Abschnitt haben.");
if (!teilbar("wand")) throw new Error("Die Wand muss teilbar sein.");
if (teilbar("stuetze")) throw new Error("Eine Stütze in Abschnitte zu teilen ergibt keinen Sinn.");

// Acht sehr ähnliche Abschnitte dürfen die Stripe-Metadata nicht sprengen –
// darauf beruht die ganze zustandslose Bauweise.
const achtMeta = projektZuMetadata(
  new Array(MAX_ABSCHNITTE).fill(0).map((_, i) => ({
    ...MUSTERPROJEKT,
    masse: { ...MUSTERPROJEKT.masse, laenge: 5 + i },
  }))
);
if (parseInt(achtMeta["n"], 10) > 40)
  throw new Error("Acht Abschnitte passen nicht mehr in die Stripe-Metadata.");
if (metadataZuBauvorhaben(achtMeta).length !== MAX_ABSCHNITTE)
  throw new Error("Acht Abschnitte müssen vollständig zurückgelesen werden.");
console.log(
  `${MAX_ABSCHNITTE} Abschnitte brauchen ${achtMeta["n"]} Metadata-Felder (einer braucht ${meta["n"]})`
);

// Die Grafik teilt proportional, nicht in gleich große Kästchen – das ist ihr
// ganzer Inhalt.
const streifen = abschnittsStreifen([10, 5, 5], 1, 200, 0);
if (streifen.length !== 3) throw new Error("Es muss ein Streifen je Abschnitt entstehen.");
if (Math.abs(streifen[0].breite - 100) > 0.01)
  throw new Error("Ein doppelt so langer Abschnitt muss doppelt so breit gezeichnet werden.");
if (!streifen[1].aktiv || streifen[0].aktiv)
  throw new Error("Genau der aktive Abschnitt muss hervorgehoben sein.");
// Längen von 0 m (noch nicht ausgefüllt) dürfen keine NaN-Geometrie ergeben.
if (abschnittsStreifen([0, 0], 0, 100, 0).some((s) => !isFinite(s.breite)))
  throw new Error("Unausgefüllte Längen dürfen keine ungültige Zeichnung ergeben.");

/* ---------- Welche Dateien bekommt der Kunde? ---------- */
const planEiner = dokumentplan([MUSTERPROJEKT]);
if (planEiner.length !== 3)
  throw new Error("Ein Abschnitt bringt genau drei Blätter hervor.");
if (planEiner.some((d) => d.name.includes("Abschnitt")))
  throw new Error("Bei einem Abschnitt darf keine Abschnittsnummer im Dateinamen stehen.");

const vier = new Array(4).fill(0).map((_, i) => ({
  ...MUSTERPROJEKT,
  masse: { ...MUSTERPROJEKT.masse, laenge: 6 + i },
}));
const planVier = dokumentplan(vier);
if (planVier.length !== 13)
  throw new Error(`Vier Abschnitte bringen 4 × 3 + 1 = 13 Blätter hervor, nicht ${planVier.length}.`);
if (planVier.filter((d) => d.typ === "gesamtliste").length !== 1)
  throw new Error("Es muss genau eine Gesamt-Stückliste geben.");
// Verwechslungsschutz: Vier gleich benannte Baupläne im Download-Ordner sind
// der sichere Weg, auf der Baustelle den falschen auszudrucken.
if (new Set(planVier.map((d) => d.name)).size !== planVier.length)
  throw new Error("Alle Dateinamen müssen eindeutig sein.");
if (!planVier[0].name.startsWith("Abschnitt-01-"))
  throw new Error("Die Abschnittsnummer muss vorne stehen, damit die Dateien sortiert liegen.");
console.log("Dateiplan: 1 Abschnitt → 3 Blätter, 4 Abschnitte → 13 Blätter, Namen eindeutig");

/* ------------------------------------------------------------------ */
/* 5) Alarmierung und Statistik (asynchron)                            */
/* ------------------------------------------------------------------ */

/**
 * Der Alarmversand läuft absichtlich ohne await – deshalb muss dieser Teil
 * kurz warten, bevor er zählt. Während der Prüfung werden console.error und
 * console.warn abgefangen: Die Meldungen sind hier erwünscht und sollen die
 * Testausgabe nicht wie einen Absturz aussehen lassen.
 */
async function alarmUndStatistik() {
  console.log("\n=== Alarmierung ===");

  const echtesError = console.error;
  const echtesWarn = console.warn;
  let versandVersuche = 0;
  const abfangen = (...args: unknown[]) => {
    const erste = String(args[0] ?? "");
    if (erste.includes("[Alarm]") || erste.includes("[E-Mail]")) versandVersuche++;
  };
  console.error = abfangen;
  console.warn = abfangen;

  try {
    // Ohne Mailkonfiguration darf melde() trotzdem nie werfen – sonst risse
    // ein fehlender Resend-Schlüssel den Vorgang mit, den er melden soll.
    process.env.RESEND_API_KEY = "";
    process.env.MAIL_ABSENDER = "";
    delete process.env.ALARM_MAIL;
    process.env.NEXT_PUBLIC_KONTAKT_MAIL = "betreiber@example.at";

    alarmSperreZuruecksetzen();
    // Fünfmal derselbe Defekt, einmal ein anderer an derselben Stelle.
    for (let i = 0; i < 5; i++) {
      melde("test-sperre", new Error("immer derselbe Defekt"), { bezahlt: true }, "kritisch");
    }
    melde("test-sperre", new Error("ein anderer Defekt"), { bezahlt: true }, "kritisch");

    // dem Versand Zeit geben (dynamischer Import + Promise)
    await new Promise((r) => setTimeout(r, 120));
  } finally {
    console.error = echtesError;
    console.warn = echtesWarn;
  }

  if (versandVersuche !== 2)
    throw new Error(
      `Sperrfrist: erwartet 2 Versandversuche (ein Defekt + ein anderer), gezählt ${versandVersuche}.`
    );
  console.log("melde() wirft nie, und die Sperrfrist fasst gleiche Meldungen zusammen");

  /* ---------------- Statistik ---------------- */

  console.log("\n=== Statistik ===");

  mitUmgebung(
    { NEXT_PUBLIC_STATISTIK_URL: undefined, NEXT_PUBLIC_STATISTIK_DOMAIN: undefined },
    () => {
      if (statistikAktiv()) throw new Error("Ohne Konfiguration darf keine Statistik aktiv sein.");
    }
  );
  mitUmgebung(
    {
      NEXT_PUBLIC_STATISTIK_URL: "https://zaehler.example/js/script.js",
      NEXT_PUBLIC_STATISTIK_DOMAIN: "beispiel.at",
    },
    () => {
      if (!statistikAktiv()) throw new Error("Mit beiden Variablen muss die Statistik aktiv sein.");
    }
  );
  // Auf dem Server (kein window) darf ereignis() nie werfen
  ereignis("test", { a: "b" });
  console.log("Statistik ist ohne Einrichtung folgenlos und wirft nie");

  console.log("\nBETRIEBSTESTS OK");
}

alarmUndStatistik().catch((e) => {
  console.error(e);
  process.exit(1);
});
