/**
 * Schneller Konsistenztest des Berechnungskerns (kein Unit-Test-Framework,
 * bewusst einfach gehalten). Aufruf: npx tsx scripts/test-berechnung.ts
 *
 * Prüft je Bauteil die Kennwerte gegen von Hand nachgerechnete Normwerte
 * und sichert die Wand als Regressionsfall ab: An ihrem Ergebnis darf sich
 * beim Hinzufügen neuer Bauteile nichts ändern.
 */
import { berechneBewehrung, oeffnungsDetails } from "../lib/bewehrung";
import { projektZuMetadata, metadataZuProjekt } from "../lib/payload";
import { pruefeProjekt } from "../lib/validierung";
import { BAUTEILE, bauteilModul, standardDetails, standardMasse } from "../lib/bauteile";
import { Projekt } from "../lib/types";

const firmendaten = {
  firma: "Test GmbH",
  planersteller: "L. Rößler",
  bauvorhaben: "EFH Muster",
  adresse: "1010 Wien",
  datum: "2026-08-16",
};
const parameter = {
  betonklasse: "C25/30",
  expositionsklasse: "XC2",
  betondeckung: 30,
  stahlguete: "B550B" as const,
  lagen: 2 as const,
  matte: "auto",
  stababstand: 250,
};

const zeige = (titel: string, e: ReturnType<typeof berechneBewehrung>) => {
  console.log(`\n=== ${titel} ===`);
  console.log("Kennwerte:", e.kennwerte);
  for (const p of e.positionen)
    console.log(
      `Pos ${p.pos}: ${p.art} ${p.bezeichnung} ${p.form ?? ""} L=${p.laenge} m × ${p.stueck} Stk = ${p.gewichtGesamt} kg – ${p.verwendung}`
    );
  console.log(
    "Gewicht gesamt:",
    e.gesamtgewicht,
    "kg (Matten",
    e.mattenGewicht,
    "/ Stäbe",
    e.stabstahlGewicht,
    ")"
  );
};

/* ------------------------------------------------------------------ */
/* 1) Wand – Regressionsfall                                           */
/* ------------------------------------------------------------------ */

const wand: Projekt = {
  bauteil: "wand",
  masse: { laenge: 8.0, hoehe: 2.75, dicke: 0.25 },
  oeffnungen: [
    { id: "1", typ: "fenster", x: 1.5, y: 0.9, breite: 1.5, hoehe: 1.4 },
    { id: "2", typ: "tuer", x: 5.0, y: 0, breite: 1.0, hoehe: 2.1 },
  ],
  details: { unten: "bodenplatte", oben: "decke_ueber", links: "ecke", rechts: "frei" },
  parameter,
  firmendaten,
};

const e = berechneBewehrung(wand);
zeige("WAND 8,00 × 2,75 × 0,25 m, 2-lagig", e);
console.log("Hinweise:", e.hinweise.length);
e.hinweise.forEach((h) => console.log(" -", h));

// As,min vertikal gesamt = 0,002 · 25 · 100 · 100 = 5 cm²/m → je Lage 2,5 → Q257A
if (e.kennwerte.asMinHaupt !== 2.5)
  throw new Error("As,min Wand falsch: " + e.kennwerte.asMinHaupt);
if (e.kennwerte.gewaehlteMatte !== "Q257A")
  throw new Error("Mattenwahl falsch: " + e.kennwerte.gewaehlteMatte);
// Regression: Ergebnis der Wand darf sich durch neue Bauteile nicht ändern
if (e.positionen.length !== 12)
  throw new Error("Positionszahl Wand geändert: " + e.positionen.length);
if (Math.abs(e.gesamtgewicht - 446.7) > 0.05)
  throw new Error("Gesamtgewicht Wand geändert: " + e.gesamtgewicht);

console.log("\n=== Öffnungsdetails Wand ===");
console.log(JSON.stringify(oeffnungsDetails(wand), null, 1));

/* ------------------------------------------------------------------ */
/* 2) Deckenplatte                                                     */
/* ------------------------------------------------------------------ */

const decke: Projekt = {
  ...wand,
  bauteil: "deckenplatte",
  masse: { laenge: 6.0, hoehe: 4.5, dicke: 0.2 },
  oeffnungen: [{ id: "1", typ: "aussparung", x: 2, y: 2, breite: 0.6, hoehe: 0.6 }],
  details: standardDetails(bauteilModul("deckenplatte")),
  parameter: { ...parameter, lagen: 1, expositionsklasse: "XC1", betondeckung: 25 },
};
const ed = berechneBewehrung(decke);
zeige("DECKENPLATTE 6,00 × 4,50 × 0,20 m", ed);
// As,min Platte: d = 20 − 2,5 − 0,4 = 17,1 cm →
// max(0,26·2,6/550·100·17,1 = 2,10; 0,0013·100·17,1 = 2,22) = 2,22 cm²/m → Q257A
if (Math.abs(ed.kennwerte.asMinHaupt - 2.22) > 0.05)
  throw new Error("As,min Decke falsch: " + ed.kennwerte.asMinHaupt);

/* ------------------------------------------------------------------ */
/* 3) Bodenplatte                                                      */
/* ------------------------------------------------------------------ */

const boden: Projekt = {
  ...wand,
  bauteil: "bodenplatte",
  masse: { laenge: 10.0, hoehe: 8.0, dicke: 0.25 },
  oeffnungen: [],
  details: standardDetails(bauteilModul("bodenplatte")),
};
const eb = berechneBewehrung(boden);
zeige("BODENPLATTE 10,00 × 8,00 × 0,25 m", eb);
if (eb.positionen.filter((p) => p.art === "matte").length !== 1)
  throw new Error("Bodenplatte: es muss genau eine Mattenposition geben.");

/* ------------------------------------------------------------------ */
/* 4) Stütze                                                           */
/* ------------------------------------------------------------------ */

const stuetze: Projekt = {
  ...wand,
  bauteil: "stuetze",
  masse: { breite: 0.3, tiefe: 0.3, hoehe: 3.0 },
  oeffnungen: [],
  details: { fuss: "fundament", kopf: "decke_ueber" },
};
const es = berechneBewehrung(stuetze);
zeige("STÜTZE 30/30 cm, h = 3,00 m", es);
es.hinweise.forEach((h) => console.log(" -", h));

// 30/30 cm: Ac = 900 cm²; 0,002·Ac = 1,8 cm², aber 4 Ø12 = 4,52 cm² sind Pflicht
if (Math.abs(es.kennwerte.asMinHaupt - 4.52) > 0.02)
  throw new Error("As,min Stütze falsch: " + es.kennwerte.asMinHaupt);
if (es.kennwerte.gewaehlteMatte !== "4 Ø12")
  throw new Error("Stabwahl Stütze falsch: " + es.kennwerte.gewaehlteMatte);
if (es.mattenGewicht !== 0) throw new Error("Stütze darf keine Matten enthalten.");
const buegel = es.positionen.find((p) => p.form === "buegel_rechteck");
if (!buegel) throw new Error("Stütze ohne Bügel.");
// s = min(20·12 = 240; 300; 400) = 240 → auf 225 mm abgerundet, Enden 0,6·240 = 144 → 125
console.log("Bügel:", buegel.stueck, "Stück, Schnittlänge", buegel.laenge, "m");

// größerer Querschnitt: mehr Stäbe wegen Stababstand ≤ 30 cm
const stuetzeGross: Projekt = { ...stuetze, masse: { breite: 0.6, tiefe: 0.4, hoehe: 4.0 } };
const esg = berechneBewehrung(stuetzeGross);
console.log("\nStütze 60/40, h = 4,00 m →", esg.kennwerte.gewaehlteMatte, "·", esg.gesamtgewicht, "kg");
if (esg.kennwerte.gewaehlteMatte !== "8 Ø12")
  throw new Error("Stabbild 60/40 falsch: " + esg.kennwerte.gewaehlteMatte);

// Prüfung: scheibenartiger Querschnitt muss eine Warnung erzeugen
const scheibe: Projekt = { ...stuetze, masse: { breite: 1.5, tiefe: 0.2, hoehe: 3.0 } };
if (!pruefeProjekt(scheibe).some((m) => m.text.includes("Wandscheibe")))
  throw new Error("Warnung „Wandscheibe“ fehlt.");

/* ------------------------------------------------------------------ */
/* 5) Träger                                                           */
/* ------------------------------------------------------------------ */

const traeger: Projekt = {
  ...wand,
  bauteil: "traeger",
  masse: { laenge: 5.0, breite: 0.25, hoehe: 0.5 },
  oeffnungen: [],
  details: { system: "einfeld", auflager: "wand", lage: "unterzug" },
};
const et = berechneBewehrung(traeger);
zeige("TRÄGER 25/50 cm, L = 5,00 m, Einfeldträger", et);
et.hinweise.forEach((h) => console.log(" -", h));

// As,min = max(0,26·fctm/fyk·b·d ; 0,0013·b·d)
// c = 30 + 8 + 6 = 44 mm → d = 45,6 cm
// → max(0,26·2,6/550·25·45,6 = 1,40 ; 0,0013·25·45,6 = 1,48) = 1,48 cm²
if (Math.abs(et.kennwerte.asMinHaupt - 1.48) > 0.03)
  throw new Error("As,min Träger falsch: " + et.kennwerte.asMinHaupt);
if (et.kennwerte.gewaehlteMatte !== "2 Ø12")
  throw new Error("Stabwahl Träger falsch: " + et.kennwerte.gewaehlteMatte);
if (et.mattenGewicht !== 0) throw new Error("Träger darf keine Matten enthalten.");
// Bügelabstand: s_l,max = 0,75 · 45,6 = 34,2 cm → auf 30 cm abgerundet
const tBuegel = et.positionen.find((p) => p.form === "buegel_rechteck");
if (!tBuegel) throw new Error("Träger ohne Bügel.");
console.log("Bügel:", tBuegel.stueck, "Stück, Schnittlänge", tBuegel.laenge, "m");
if (tBuegel.stueck !== 21)
  throw new Error("Bügelzahl Träger falsch (erwartet 21): " + tBuegel.stueck);

// hoher Träger: Hautbewehrung nach EC2 9.7 muss dazukommen
const hoch: Projekt = { ...traeger, masse: { laenge: 8.0, breite: 0.3, hoehe: 0.9 } };
const eh = berechneBewehrung(hoch);
console.log("\nTräger 30/90, L = 8,00 m →", eh.kennwerte.gewaehlteMatte, "·", eh.gesamtgewicht, "kg");
if (!eh.positionen.some((p) => p.verwendung.startsWith("Hautbewehrung")))
  throw new Error("Hautbewehrung fehlt bei h = 0,90 m.");

// Kragträger: Hauptbewehrung liegt oben
const krag: Projekt = {
  ...traeger,
  masse: { laenge: 2.0, breite: 0.25, hoehe: 0.4 },
  details: { system: "kragarm", auflager: "eingespannt", lage: "frei" },
};
const ek = berechneBewehrung(krag);
console.log("Kragträger 25/40, L = 2,00 m →", ek.kennwerte.wahlLabel, ek.kennwerte.gewaehlteMatte);
if (ek.kennwerte.wahlLabel !== "Bewehrung oben")
  throw new Error("Kragträger: Hauptbewehrung müsste oben liegen.");
if (!ek.positionen.some((p) => p.kurz === "Kragarm oben"))
  throw new Error("Kragträger ohne verankerte obere Bewehrung.");

// wandartiger Träger muss gewarnt werden
const wandartig: Projekt = { ...traeger, masse: { laenge: 2.0, breite: 0.3, hoehe: 1.2 } };
if (!pruefeProjekt(wandartig).some((m) => m.text.includes("wandartiger Träger")))
  throw new Error("Warnung „wandartiger Träger“ fehlt.");

/* ------------------------------------------------------------------ */
/* 6) Register: jedes Bauteil rechnet und zeichnet mit Standardwerten   */
/* ------------------------------------------------------------------ */

console.log("\n=== Register ===");
for (const modul of BAUTEILE) {
  const p: Projekt = {
    ...wand,
    bauteil: modul.id,
    masse: standardMasse(modul),
    details: standardDetails(modul),
    oeffnungen: [],
  };
  const erg = berechneBewehrung(p);
  const ansichten = modul.zeichnung(p);
  const fehler = pruefeProjekt(p).filter((m) => m.schwere === "fehler");
  if (erg.positionen.length === 0)
    throw new Error(`${modul.id}: keine Bewehrungspositionen.`);
  if (ansichten.length === 0) throw new Error(`${modul.id}: keine Ansicht.`);
  if (fehler.length) throw new Error(`${modul.id}: Standardwerte sind fehlerhaft.`);
  console.log(
    `${modul.id.padEnd(13)} ${String(erg.positionen.length).padStart(2)} Pos · ` +
      `${String(erg.gesamtgewicht).padStart(7)} kg · ${ansichten.length} Ansicht(en) · ${modul.masseText(p)}`
  );
}

/* ------------------------------------------------------------------ */
/* 7) Payload-Roundtrip für jedes Bauteil                              */
/* ------------------------------------------------------------------ */

for (const p of [wand, decke, boden, stuetze, traeger]) {
  const meta = projektZuMetadata(p);
  const zurueck = metadataZuProjekt(meta);
  const erwartet = { ...p, firmendaten: { ...p.firmendaten, logoDataUrl: undefined } };
  if (JSON.stringify(erwartet) !== JSON.stringify(zurueck))
    throw new Error(`Payload-Roundtrip fehlgeschlagen für ${p.bauteil}`);
}
console.log("\nPayload-Roundtrip OK für alle Bauteile");
console.log("\nALLE TESTS OK");
