/**
 * Schneller Konsistenztest des Berechnungskerns (kein Unit-Test-Framework,
 * bewusst einfach gehalten). Aufruf: npx tsx scripts/test-berechnung.ts
 */
import { berechneBewehrung, oeffnungsDetails } from "../lib/bewehrung";
import { projektZuMetadata, metadataZuProjekt } from "../lib/payload";
import { Projekt } from "../lib/types";

const wand: Projekt = {
  bauteil: "wand",
  masse: { laenge: 8.0, hoehe: 2.75, dicke: 0.25 },
  oeffnungen: [
    { id: "1", typ: "fenster", x: 1.5, y: 0.9, breite: 1.5, hoehe: 1.4 },
    { id: "2", typ: "tuer", x: 5.0, y: 0, breite: 1.0, hoehe: 2.1 },
  ],
  anschluesse: { unten: "bodenplatte", oben: "decke_ueber", links: "ecke", rechts: "frei" },
  deckenRaender: { links: "wand_auflager", rechts: "wand_auflager", oben: "wand_auflager", unten: "wand_auflager" },
  parameter: {
    betonklasse: "C25/30",
    expositionsklasse: "XC2",
    betondeckung: 30,
    stahlguete: "B550B",
    lagen: 2,
    matte: "auto",
    stababstand: 250,
  },
  firmendaten: { firma: "Test GmbH", planersteller: "L. Rößler", bauvorhaben: "EFH Muster", adresse: "1010 Wien", datum: "2026-08-16" },
};

const e = berechneBewehrung(wand);
console.log("=== WAND 8,00 × 2,75 × 0,25 m, 2-lagig ===");
console.log("Kennwerte:", e.kennwerte);
for (const p of e.positionen)
  console.log(
    `Pos ${p.pos}: ${p.art} ${p.bezeichnung} ${p.form ?? ""} L=${p.laenge} m × ${p.stueck} Stk = ${p.gewichtGesamt} kg – ${p.verwendung}`
  );
console.log("Gewicht gesamt:", e.gesamtgewicht, "kg (Matten", e.mattenGewicht, "/ Stäbe", e.stabstahlGewicht, ")");
console.log("Hinweise:", e.hinweise.length);
e.hinweise.forEach((h) => console.log(" -", h));

// Plausibilität: As,min vertikal gesamt = 0,002·25·100·100/... = 5 cm²/m → je Lage 2,5 → Q257A
if (e.kennwerte.asMinHaupt !== 2.5) throw new Error("As,min Wand falsch: " + e.kennwerte.asMinHaupt);
if (e.kennwerte.gewaehlteMatte !== "Q257A") throw new Error("Mattenwahl falsch: " + e.kennwerte.gewaehlteMatte);

console.log("\n=== Öffnungsdetails ===");
console.log(JSON.stringify(oeffnungsDetails(wand), null, 1));

// Decke
const decke: Projekt = {
  ...wand,
  bauteil: "decke",
  masse: { laenge: 6.0, hoehe: 4.5, dicke: 0.2 },
  oeffnungen: [{ id: "1", typ: "aussparung", x: 2, y: 2, breite: 0.6, hoehe: 0.6 }],
  parameter: { ...wand.parameter, lagen: 1, expositionsklasse: "XC1", betondeckung: 25 },
};
const ed = berechneBewehrung(decke);
console.log("\n=== DECKE 6,00 × 4,50 × 0,20 m ===");
console.log("Kennwerte:", ed.kennwerte);
console.log("Gewicht gesamt:", ed.gesamtgewicht, "kg");
// As,min Platte: d = 20 − 2,5 − 0,4 = 17,1 cm →
// max(0,26·2,6/550·100·17,1 = 2,10; 0,0013·100·17,1 = 2,22) = 2,22 cm²/m → Q257A
if (Math.abs(ed.kennwerte.asMinHaupt - 2.22) > 0.05)
  throw new Error("As,min Decke falsch: " + ed.kennwerte.asMinHaupt);

// Roundtrip Payload
const meta = projektZuMetadata(wand);
const zurueck = metadataZuProjekt(meta);
if (JSON.stringify({ ...wand, firmendaten: { ...wand.firmendaten, logoDataUrl: undefined } }) !== JSON.stringify(zurueck))
  throw new Error("Payload-Roundtrip fehlgeschlagen");
console.log("\nPayload-Roundtrip OK, Metadata-Chunks:", meta["n"]);
console.log("\nALLE TESTS OK");
