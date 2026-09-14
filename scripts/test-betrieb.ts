/**
 * Test der Betriebs-Absicherungen: Demo-Riegel, Rate-Limit, Payload-Version.
 * Aufruf: npx tsx scripts/test-betrieb.ts
 *
 * Diese drei Dinge schlagen im Alltag nie fehl und genau deshalb fällt es
 * nicht auf, wenn sie kaputtgehen. Der Test hält sie fest.
 */

import { NextRequest } from "next/server";
import {
  BetriebsFehler,
  demoErlaubt,
  kundenMeldung,
  stripeSchluessel,
} from "../lib/betrieb";
import { limitZuruecksetzen, pruefeLimit } from "../lib/ratelimit";
import { metadataHerkunft, metadataZuProjekt, projektZuMetadata } from "../lib/payload";
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

const meta = projektZuMetadata(MUSTERPROJEKT);
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
  metadataZuProjekt({ ...meta, v: String(PAYLOAD_VERSION + 1) });
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
const alt = metadataZuProjekt(ohneVersion);
if (alt.bauteil !== MUSTERPROJEKT.bauteil)
  throw new Error("Alte Sessions ohne Versionsfeld müssen weiterhin lesbar sein.");
if (metadataHerkunft(ohneVersion).codeStand !== "unbekannt")
  throw new Error("Fehlt der Code-Stand, muss das als 'unbekannt' erkennbar sein.");
console.log("Version und Code-Stand werden geschrieben, geprüft und bleiben lesbar");

console.log("\nBETRIEBSTESTS OK");
