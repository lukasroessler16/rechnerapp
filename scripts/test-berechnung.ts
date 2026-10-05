/**
 * Schneller Konsistenztest des Berechnungskerns (kein Unit-Test-Framework,
 * bewusst einfach gehalten). Aufruf: npx tsx scripts/test-berechnung.ts
 *
 * Prüft je Bauteil die Kennwerte gegen von Hand nachgerechnete Normwerte
 * und sichert die Wand als Regressionsfall ab: An ihrem Ergebnis darf sich
 * beim Hinzufügen neuer Bauteile nichts ändern.
 */
import { berechneBewehrung, oeffnungsDetails } from "../lib/bewehrung";
import { MATTEN_STOESSE, MATTEN_STOSS_STANDARD } from "../lib/normdaten";
import { projektZuMetadata, metadataZuProjekt } from "../lib/payload";
import { pruefeProjekt } from "../lib/validierung";
import {
  BAUTEILE,
  KATEGORIEN,
  bauteilModul,
  bauteileDerKategorie,
  istKategorie,
  standardDetails,
  standardMasse,
} from "../lib/bauteile";
import { nachGruppen } from "../lib/gruppen";
import { STANDARD_GRUPPE } from "../lib/bauteile/sammler";
import { Projekt } from "../lib/types";
import {
  DEUTSCHLAND,
  OESTERREICH,
  cnomAusExposition,
  fykVon,
} from "../lib/regelwerk";

const firmendaten = {
  firma: "Test GmbH",
  planersteller: "L. Rößler",
  bauvorhaben: "EFH Muster",
  adresse: "1010 Wien",
  datum: "2026-08-16",
};
const parameter = {
  regelwerk: "at",
  betonklasse: "C25/30",
  expositionsklasse: "XC2",
  betondeckung: 30,
  stahlguete: "B550B" as const,
  lagen: 2 as const,
  matte: "auto",
  stababstand: 250,
  mattenstoss: MATTEN_STOSS_STANDARD,
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
/* 6) Streifenfundament                                                */
/* ------------------------------------------------------------------ */

const fundament: Projekt = {
  ...wand,
  bauteil: "streifenfundament",
  masse: { laenge: 10.0, breite: 0.6, hoehe: 0.4, wanddicke: 0.25 },
  oeffnungen: [],
  details: {
    untergrund: "sauberkeitsschicht",
    bewehrung: "unten",
    wandanschluss: "stahlbeton",
  },
};
const ef = berechneBewehrung(fundament);
zeige("STREIFENFUNDAMENT 60/40 cm, L = 10,00 m", ef);
ef.hinweise.forEach((h) => console.log(" -", h));

// EC2 4.4.1.3(4): auf Sauberkeitsschicht c_min = 40 mm > c_nom = 30 mm aus XC2
if (ef.kennwerte.cnom !== 40)
  throw new Error("Fundament-Betondeckung falsch (erwartet 40 mm): " + ef.kennwerte.cnom);
// Kragarm 17,5 cm < h = 40 cm → gedrungen, konstruktive Querbewehrung 2,0 cm²/m
if (ef.kennwerte.asMinHaupt !== 2)
  throw new Error("Gedrungenes Fundament: konstruktiver Ansatz erwartet, nicht " + ef.kennwerte.asMinHaupt);
if (ef.kennwerte.asVorhanden < ef.kennwerte.asMinHaupt)
  throw new Error("Gewählte Querbewehrung deckt As,min nicht ab.");
if (ef.mattenGewicht !== 0) throw new Error("Fundament darf keine Matten enthalten.");
// Querbewehrung als U-Stäbe mit aufgebogenen Enden
if (!ef.positionen.some((p) => p.form === "buegel_u" && p.kurz === "Quer unten"))
  throw new Error("Querbewehrung mit Aufbiegung fehlt.");
// Kragarm 17,5 cm ≤ h = 40 cm → gedrungenes Fundament, keine Biegewarnung
if (ef.hinweise.some((h) => h.includes("biegeweich")))
  throw new Error("Fundament 60/40 dürfte nicht als biegeweich gemeldet werden.");

// Betonieren gegen Erdreich: Deckung steigt auf 75 mm
const gegenErde: Projekt = {
  ...fundament,
  details: { ...fundament.details, untergrund: "erdreich" },
};
const efe = berechneBewehrung(gegenErde);
console.log("\nGegen Erdreich →  c =", efe.kennwerte.cnom, "mm, As,min =", efe.kennwerte.asMinHaupt);
if (efe.kennwerte.cnom !== 75)
  throw new Error("Deckung gegen Erdreich falsch: " + efe.kennwerte.cnom);
if (efe.kennwerte.asVorhanden !== ef.kennwerte.asVorhanden)
  throw new Error("Bei gedrungenem Fundament ändert die Deckung die Stabwahl nicht.");

// Bewehrungskorb: obere Längslage und geschlossene Bügel
const korb: Projekt = {
  ...fundament,
  details: { ...fundament.details, bewehrung: "korb" },
};
const efk = berechneBewehrung(korb);
console.log("Korb →", efk.positionen.length, "Positionen,", efk.gesamtgewicht, "kg");
if (!efk.positionen.some((p) => p.form === "buegel_rechteck"))
  throw new Error("Korb ohne geschlossene Bügel.");
if (!efk.positionen.some((p) => p.kurz === "Längs oben"))
  throw new Error("Korb ohne obere Längsbewehrung.");

// breites, flaches Fundament: Kragarm > Höhe → Biegewarnung
const breit: Projekt = {
  ...fundament,
  masse: { laenge: 10.0, breite: 1.6, hoehe: 0.3, wanddicke: 0.25 },
};
if (!berechneBewehrung(breit).hinweise.some((h) => h.includes("biegeweich")))
  throw new Error("Warnung „biegeweich“ fehlt beim breiten Fundament.");
if (!pruefeProjekt(breit).some((m) => m.text.includes("doppelt so lang")))
  throw new Error("Prüfmeldung zum langen Kragarm fehlt.");

// Wand breiter als Fundament → Fehler
const zuSchmal: Projekt = {
  ...fundament,
  masse: { laenge: 10.0, breite: 0.3, hoehe: 0.4, wanddicke: 0.3 },
};
if (!pruefeProjekt(zuSchmal).some((m) => m.schwere === "fehler"))
  throw new Error("Wand breiter als Fundament müsste ein Fehler sein.");

// lange Fundamente: Längsstäbe müssen gestoßen werden
const lang: Projekt = { ...fundament, masse: { ...fundament.masse, laenge: 26.0 } };
const efl = berechneBewehrung(lang);
const laengs = efl.positionen.find((p) => p.kurz === "Längs unten");
if (!laengs || laengs.laenge > 12)
  throw new Error("Längsstäbe über Lieferlänge wurden nicht gestoßen.");
console.log(
  "26 m lang →",
  laengs.stueck,
  "Stäbe à",
  laengs.laenge,
  "m (Stoß berücksichtigt)"
);

/* ------------------------------------------------------------------ */
/* 7) Einzelfundament                                                  */
/* ------------------------------------------------------------------ */

const einzel: Projekt = {
  ...wand,
  bauteil: "einzelfundament",
  masse: { laenge: 1.5, breite: 1.5, hoehe: 0.5, stuetzeX: 0.3, stuetzeY: 0.3 },
  oeffnungen: [],
  details: { untergrund: "sauberkeitsschicht", bewehrung: "unten", stuetze: "ortbeton" },
};
const ee = berechneBewehrung(einzel);
zeige("EINZELFUNDAMENT 150/150/50 cm, Stütze 30/30", ee);
ee.hinweise.forEach((h) => console.log(" -", h));

// Kragarm 60 cm > h = 50 cm → biegeweich, Biege-Mindestbewehrung maßgebend
if (ee.kennwerte.hauptLabel !== "erforderlich (As,min Biegung)")
  throw new Error("Kragarm > h müsste die Biegebewehrung maßgebend machen.");
if (!ee.hinweise.some((h) => h.includes("Durchstanz")))
  throw new Error("Durchstanzhinweis fehlt.");
// zwei untere Lagen, in beiden Richtungen, mit aufgebogenen Enden
const untenA = ee.positionen.find((p) => p.kurz === "Unten a");
const untenB = ee.positionen.find((p) => p.kurz === "Unten b");
if (!untenA || !untenB) throw new Error("Es fehlt eine der beiden unteren Bewehrungsrichtungen.");
if (untenA.form !== "buegel_u" || untenB.form !== "buegel_u")
  throw new Error("Fundamentstäbe müssen aufgebogene Enden haben (EC2 9.8.2.2).");
if (ee.mattenGewicht !== 0) throw new Error("Einzelfundament darf keine Matten enthalten.");

// gedrungenes Fundament: Kragarm ≤ h → konstruktiver Ansatz
const gedrungen: Projekt = {
  ...einzel,
  masse: { laenge: 1.2, breite: 1.2, hoehe: 0.6, stuetzeX: 0.3, stuetzeY: 0.3 },
};
const eg = berechneBewehrung(gedrungen);
console.log("\nGedrungen 120/120/60 →", eg.kennwerte.hauptLabel, eg.kennwerte.asMinHaupt, "cm²/m");
if (eg.kennwerte.asMinHaupt !== 2)
  throw new Error("Gedrungenes Einzelfundament: konstruktiver Ansatz erwartet.");

// rechteckiges Fundament: der längere Kragarm liegt unten
const rechteck: Projekt = {
  ...einzel,
  masse: { laenge: 2.4, breite: 1.4, hoehe: 0.5, stuetzeX: 0.4, stuetzeY: 0.3 },
};
const er = berechneBewehrung(rechteck);
console.log("Rechteckig 240/140 →", er.kennwerte.wahlLabel, "·", er.kennwerte.gewaehlteMatte);
if (er.kennwerte.wahlLabel !== "Untere Lage Richtung a")
  throw new Error("Bei längerem Kragarm in a muss diese Richtung unten liegen.");

// obere Lage
const mitOben: Projekt = {
  ...einzel,
  details: { ...einzel.details, bewehrung: "unten_oben" },
};
const eo = berechneBewehrung(mitOben);
if (eo.positionen.filter((p) => p.kurz.startsWith("Oben")).length !== 2)
  throw new Error("Obere Lage muss in beiden Richtungen vorhanden sein.");

// Stütze größer als Fundament → Fehler
const zuKlein: Projekt = {
  ...einzel,
  masse: { laenge: 0.4, breite: 1.5, hoehe: 0.5, stuetzeX: 0.4, stuetzeY: 0.3 },
};
if (!pruefeProjekt(zuKlein).some((m) => m.schwere === "fehler"))
  throw new Error("Stütze so groß wie das Fundament müsste ein Fehler sein.");

// sehr langgestreckt → Hinweis auf das Streifenfundament
const lang2: Projekt = {
  ...einzel,
  masse: { laenge: 5.0, breite: 1.0, hoehe: 0.5, stuetzeX: 0.3, stuetzeY: 0.3 },
};
if (!pruefeProjekt(lang2).some((m) => m.text.includes("Streifenfundament")))
  throw new Error("Hinweis auf das Streifenfundament fehlt.");

/* ------------------------------------------------------------------ */
/* 8) Stützmauer – einziges Bauteil mit Vorbemessung aus Erddruck      */
/* ------------------------------------------------------------------ */

const mauer: Projekt = {
  ...wand,
  bauteil: "stuetzmauer",
  masse: {
    laenge: 8.0,
    hoehe: 2.0,
    wanddicke: 0.25,
    fundamentBreite: 1.8,
    fundamentDicke: 0.4,
    zehe: 0.35,
    reibungswinkel: 32.5,
    wichte: 19,
    auflast: 5,
  },
  oeffnungen: [],
  details: { untergrund: "sauberkeitsschicht" },
};
const em = berechneBewehrung(mauer);
zeige("STÜTZMAUER H = 2,00 m, Fundament 180/40 cm, L = 8,00 m", em);
em.hinweise.forEach((h) => console.log(" -", h));

// Ka = tan²(45 − 16,25) = tan²(28,75°) = 0,3012
// M_Wand = 1,35 · 0,3012 · 19 · 2³/6 + 1,5 · 0,3012 · 5 · 2²/2 = 10,30 + 4,52 = 14,8 kNm/m
if (Math.abs(em.kennwerte.asMinHaupt - 2.5) > 0.6)
  throw new Error("Erf. Wandbewehrung unplausibel: " + em.kennwerte.asMinHaupt);
if (em.mattenGewicht !== 0) throw new Error("Stützmauer darf keine Matten enthalten.");
// Die Vorbemessung muss offengelegt werden
if (!em.hinweise.some((h) => h.startsWith("VORBEMESSUNG")))
  throw new Error("Der Vorbemessungs-Hinweis fehlt.");
if (!em.hinweise.some((h) => h.includes("Standsicherheit")))
  throw new Error("Die Standsicherheitswerte fehlen.");
if (!em.hinweise.some((h) => h.includes("Dränage")))
  throw new Error("Der Dränage-Hinweis fehlt.");
// alle sechs Positionsgruppen müssen vorkommen
for (const kurz of [
  "Wand erdseitig",
  "Wand luftseitig",
  "Wand waagrecht",
  "Fund. oben",
  "Fund. unten",
  "Fund. längs",
])
  if (!em.positionen.some((p) => p.kurz === kurz))
    throw new Error(`Position „${kurz}“ fehlt.`);

// Höhere Mauer → deutlich mehr Bewehrung (Erddruck wächst mit h³)
const hoheMauer: Projekt = {
  ...mauer,
  masse: { ...mauer.masse, hoehe: 3.0, fundamentBreite: 2.2, wanddicke: 0.3 },
};
const eh2 = berechneBewehrung(hoheMauer);
console.log(
  "\nH = 3,00 m →",
  eh2.kennwerte.gewaehlteMatte,
  "· erf.",
  eh2.kennwerte.asMinHaupt,
  "cm²/m ·",
  eh2.gesamtgewicht,
  "kg"
);
if (eh2.kennwerte.asMinHaupt <= em.kennwerte.asMinHaupt)
  throw new Error("Eine höhere Mauer muss mehr Wandbewehrung erfordern.");

// Bei 2,00 m Wandhöhe bleibt der Erddruck noch unter der Mindestbewehrung –
// das Modul muss das erkennen und benennen.
if (em.kennwerte.hauptLabel !== "erforderlich (Mindestbewehrung maßgebend)")
  throw new Error("Bei H = 2,00 m müsste die Mindestbewehrung maßgebend sein.");
if (eh2.kennwerte.hauptLabel !== "erforderlich (Wandfuß, aus Erddruck)")
  throw new Error("Bei H = 3,00 m müsste der Erddruck maßgebend sein.");

// Ohne Auflast muss die Bewehrung sinken (dort, wo der Erddruck maßgebend ist)
const ohneAuflast: Projekt = { ...hoheMauer, masse: { ...hoheMauer.masse, auflast: 0 } };
const eoa = berechneBewehrung(ohneAuflast);
if (eoa.kennwerte.asMinHaupt >= eh2.kennwerte.asMinHaupt)
  throw new Error("Ohne Auflast müsste weniger Bewehrung nötig sein.");

// Gegen Erdreich betoniert: bessere Sohlreibung → höhere Gleitsicherheit
const aufErde: Projekt = { ...mauer, details: { untergrund: "erdreich" } };
const gleitWert = (e: ReturnType<typeof berechneBewehrung>) =>
  Number(/Gleiten η = ([\d.]+)/.exec(e.hinweise.join(" "))?.[1] ?? "0");
if (gleitWert(berechneBewehrung(aufErde)) <= gleitWert(em))
  throw new Error("Betonieren gegen Erdreich müsste die Gleitsicherheit erhöhen.");

// Zu schmales Fundament: Kipp- bzw. Gleitsicherheit muss anschlagen
const schmal: Projekt = {
  ...mauer,
  masse: { ...mauer.masse, fundamentBreite: 0.9, zehe: 0.2 },
};
const es2 = berechneBewehrung(schmal);
if (!es2.hinweise.some((h) => h.includes("Gleitsicherheit") || h.includes("Kippsicherheit")))
  throw new Error("Bei schmalem Fundament fehlt die Standsicherheitswarnung.");
if (!pruefeProjekt(schmal).some((m) => m.schwere === "warnung"))
  throw new Error("Prüfmeldung zum schmalen Fundament fehlt.");

// Keine Ferse → Fehler
const ohneFerse: Projekt = {
  ...mauer,
  masse: { ...mauer.masse, fundamentBreite: 0.6, zehe: 0.3 },
};
if (!pruefeProjekt(ohneFerse).some((m) => m.schwere === "fehler"))
  throw new Error("Fehlende Ferse müsste ein Fehler sein.");

// Zusatzfelder müssen serverseitig begrenzt werden
const boeserWinkel: Projekt = {
  ...mauer,
  masse: { ...mauer.masse, reibungswinkel: 89 },
};
let abgefangen = false;
try {
  metadataZuProjekt(projektZuMetadata(boeserWinkel));
} catch {
  abgefangen = true;
}
if (!abgefangen)
  throw new Error("Ein unzulässiger Reibungswinkel muss serverseitig abgewiesen werden.");

/* ------------------------------------------------------------------ */
/* 9) Register: jedes Bauteil rechnet und zeichnet mit Standardwerten   */
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
/* 9b) Regelwerk: der deutsche Anhang muss wirklich anders rechnen      */
/* ------------------------------------------------------------------ */

console.log("\n=== Regelwerk AT / DE ===");

// Betondeckung: Δc_dev 10 mm (AT) gegen 15 mm (DE), XC1 in DE nur 10 mm
if (cnomAusExposition(OESTERREICH, "XC2") !== 30)
  throw new Error("AT/XC2: c_nom müsste 20 + 10 = 30 mm sein.");
if (cnomAusExposition(DEUTSCHLAND, "XC2") !== 35)
  throw new Error("DE/XC2: c_nom müsste 20 + 15 = 35 mm sein.");
if (cnomAusExposition(DEUTSCHLAND, "XC1") !== 20)
  throw new Error("DE/XC1: c_nom müsste 10 + 10 = 20 mm sein.");

// Streckgrenze aus der Sorte des jeweiligen Anhangs
if (fykVon(OESTERREICH, "B550B") !== 550 || fykVon(DEUTSCHLAND, "B500B") !== 500)
  throw new Error("f_yk wird nicht aus dem Regelwerk abgeleitet.");

/** Dasselbe Bauteil, einmal nach ÖNORM, einmal nach DIN gerechnet */
const nachDIN = (p: Projekt): Projekt => ({
  ...p,
  parameter: {
    ...p.parameter,
    regelwerk: "de",
    stahlguete: "B500B",
    betondeckung: cnomAusExposition(DEUTSCHLAND, p.parameter.expositionsklasse),
  },
});

// Wand: 0,0015·Ac statt 0,002·Ac → weniger Stahl, obwohl der Rest gleich bleibt
const wandAT = berechneBewehrung(wand);
const wandDE = berechneBewehrung(nachDIN(wand));
if (!(wandDE.kennwerte.asMinHaupt < wandAT.kennwerte.asMinHaupt))
  throw new Error(
    `Wand DE müsste weniger Mindestbewehrung fordern als AT (${wandDE.kennwerte.asMinHaupt} vs. ${wandAT.kennwerte.asMinHaupt} cm²/m).`
  );
const erwarteteWandDE = Math.round(0.0015 * 25 * 100 * 100) / 100 / 2; // je Seite, cm²/m
if (Math.abs(wandDE.kennwerte.asMinHaupt - erwarteteWandDE) > 0.02)
  throw new Error(
    `Wand DE: As,vmin je Seite müsste ${erwarteteWandDE} cm²/m sein, ist ${wandDE.kennwerte.asMinHaupt}.`
  );
console.log(
  `Wand   As,min je Seite: AT ${wandAT.kennwerte.asMinHaupt} / DE ${wandDE.kennwerte.asMinHaupt} cm²/m`
);

// Platte: As,min ∝ 1/f_yk → DE fordert wegen B500 rund 10 % mehr
const deckeAT = berechneBewehrung(decke);
const deckeDE = berechneBewehrung(nachDIN(decke));
if (!(deckeDE.kennwerte.asMinHaupt > deckeAT.kennwerte.asMinHaupt))
  throw new Error("Deckenplatte DE müsste wegen B500 mehr Mindestbewehrung fordern als AT.");
console.log(
  `Decke  As,min: AT ${deckeAT.kennwerte.asMinHaupt} / DE ${deckeDE.kennwerte.asMinHaupt} cm²/m` +
    ` (c_nom ${wand.parameter.betondeckung} / ${nachDIN(wand).parameter.betondeckung} mm)`
);

// Normzitate müssen in den Hinweisen mitübersetzt sein
if (wandDE.hinweise.some((h) => h.includes("ÖNORM")))
  throw new Error("Im DIN-Modus darf in den Hinweisen keine ÖNORM mehr stehen.");
if (!wandDE.hinweise.some((h) => h.includes("DIN EN 1992-1-1/NA")))
  throw new Error("Im DIN-Modus fehlt der Verweis auf DIN EN 1992-1-1/NA.");

// Jedes Bauteil muss auch im DIN-Modus rechnen und zeichnen
for (const modul of BAUTEILE) {
  const p = nachDIN({
    ...wand,
    bauteil: modul.id,
    masse: standardMasse(modul),
    details: standardDetails(modul),
    oeffnungen: [],
  });
  const erg = berechneBewehrung(p);
  if (erg.positionen.length === 0) throw new Error(`${modul.id} (DE): keine Positionen.`);
  if (modul.zeichnung(p).length === 0) throw new Error(`${modul.id} (DE): keine Ansicht.`);
  if (erg.hinweise.some((h) => h.includes("ÖNORM")))
    throw new Error(`${modul.id} (DE): Hinweis nennt noch die ÖNORM.`);
}
console.log("Alle Bauteile rechnen auch im DIN-Modus");

// Serverseitig darf keine Mischung aus zwei Anhängen durchkommen
const gemischt = metadataZuProjekt(
  projektZuMetadata({
    ...wand,
    parameter: { ...wand.parameter, regelwerk: "de", stahlguete: "B550B" },
  })
);
if (gemischt.parameter.stahlguete !== "B500A" && gemischt.parameter.stahlguete !== "B500B")
  throw new Error(
    `Eine im DIN-Modus unzulässige Stahlsorte muss ersetzt werden, blieb aber ${gemischt.parameter.stahlguete}.`
  );
const unsinn = metadataZuProjekt(
  projektZuMetadata({ ...wand, parameter: { ...wand.parameter, regelwerk: "ch" } })
);
if (unsinn.parameter.regelwerk !== "at")
  throw new Error("Ein unbekanntes Regelwerk muss auf den Standard zurückfallen.");
console.log("Serverseitige Prüfung des Regelwerks OK");

/* ------------------------------------------------------------------ */
/* 9c) Betonmenge und Eigengewicht                                      */
/* ------------------------------------------------------------------ */

console.log("\n=== Betonmenge ===");

/** Von Hand nachgerechnete Volumina zu den Standardmaßen [m³] */
const SOLL_VOLUMEN: Record<string, number> = {
  wand: 5.0 * 2.75 * 0.25,
  deckenplatte: 5.0 * 4.0 * 0.2,
  bodenplatte: 5.0 * 4.0 * 0.25,
  stuetze: 0.3 * 0.3 * 3.0,
  traeger: 0.25 * 0.5 * 5.0,
  streifenfundament: 0.6 * 0.4 * 10.0,
  einzelfundament: 1.5 * 1.5 * 0.5,
  // Wand über dem Fundament PLUS Fundamentplatte – nicht mit der Gesamthöhe
  stuetzmauer: 2.0 * 0.25 * 8.0 + 1.8 * 0.4 * 8.0,
};

for (const modul of BAUTEILE) {
  const p: Projekt = {
    ...wand,
    bauteil: modul.id,
    masse: standardMasse(modul),
    details: standardDetails(modul),
    oeffnungen: [],
  };
  const erg = berechneBewehrung(p);
  const soll = SOLL_VOLUMEN[modul.id];
  if (soll === undefined) throw new Error(`${modul.id}: kein Sollwert im Test hinterlegt.`);
  if (Math.abs(erg.beton.volumen - soll) > 0.011)
    throw new Error(
      `${modul.id}: Betonvolumen ${erg.beton.volumen} m³, erwartet ${soll.toFixed(2)} m³.`
    );
  if (!(erg.beton.bestellmenge >= erg.beton.volumen))
    throw new Error(`${modul.id}: Bestellmenge darf nie unter dem Volumen liegen.`);
  if (!(erg.beton.gewicht > 0)) throw new Error(`${modul.id}: Eigengewicht muss positiv sein.`);
  console.log(
    `${modul.id.padEnd(18)} ${String(erg.beton.volumen).padStart(6)} m³ · ` +
      `${String(erg.beton.bestellmenge).padStart(5)} m³ Bestellung · ` +
      `${String(erg.beton.gewicht).padStart(6)} t · ${erg.beton.bewehrungsgrad} kg/m³`
  );
}

// Öffnungen müssen abgezogen werden – sonst wird zu viel Beton bestellt.
const mitLoechern = berechneBewehrung(wand);
const ohneLoecher = berechneBewehrung({ ...wand, oeffnungen: [] });
if (!(mitLoechern.beton.volumen < ohneLoecher.beton.volumen))
  throw new Error("Öffnungen müssen das Betonvolumen verringern.");
const abzug = wand.oeffnungen.reduce((a, o) => a + o.breite * o.hoehe * wand.masse.dicke, 0);
if (Math.abs(ohneLoecher.beton.volumen - mitLoechern.beton.volumen - abzug) > 0.011)
  throw new Error("Der Abzug der Öffnungen stimmt nicht mit ihrer Größe überein.");
console.log(
  `Wand mit Öffnungen: ${mitLoechern.beton.volumen} m³ statt ${ohneLoecher.beton.volumen} m³ ` +
    `(Abzug ${abzug.toFixed(2)} m³)`
);

// Eigengewicht gegen den pauschalen Normansatz 25 kN/m³ (EC1 Tab. A.1):
// Die genauere Rechnung darf davon nur wenige Prozent abweichen.
for (const erg of [mitLoechern, ohneLoecher]) {
  const pauschal = (erg.beton.volumen * 2500) / 1000;
  const abw = Math.abs(erg.beton.gewicht - pauschal) / pauschal;
  if (abw > 0.05)
    throw new Error(
      `Eigengewicht ${erg.beton.gewicht} t weicht ${(abw * 100).toFixed(1)} % vom Normansatz ` +
        `${pauschal.toFixed(2)} t ab – das deutet auf einen Rechenfehler hin.`
    );
}
console.log("Eigengewicht liegt im Rahmen des pauschalen Normansatzes von 25 kN/m³");

/* ------------------------------------------------------------------ */
/* 9c2) Kategorien der Bauteilwahl                                      */
/* ------------------------------------------------------------------ */

console.log("\n=== Kategorien ===");

{
  // Jedes Bauteil muss in einer bekannten Kategorie liegen – sonst wäre es
  // in der Auswahl unsichtbar, obwohl es das Register kennt.
  const verwaist = BAUTEILE.filter((b) => !istKategorie(b.kategorie));
  if (verwaist.length)
    throw new Error(
      `Bauteile ohne gültige Kategorie: ${verwaist.map((b) => `${b.id} (${b.kategorie})`).join(", ")}`
    );

  // Keine leere Kategorie: eine Überschrift ohne Inhalt sieht nach Fehler aus.
  const leer = KATEGORIEN.filter((k) => bauteileDerKategorie(k.id).length === 0);
  if (leer.length)
    throw new Error(`Kategorien ohne Bauteile: ${leer.map((k) => k.id).join(", ")}`);

  // Die Kategorien müssen zusammen genau alle Bauteile ergeben
  const summe = KATEGORIEN.reduce((a, k) => a + bauteileDerKategorie(k.id).length, 0);
  if (summe !== BAUTEILE.length)
    throw new Error(`Kategorien decken ${summe} von ${BAUTEILE.length} Bauteilen ab.`);

  for (const k of KATEGORIEN)
    console.log(
      `${k.name.padEnd(20)} ${bauteileDerKategorie(k.id).map((b) => b.name).join(", ")}`
    );
}

/* ------------------------------------------------------------------ */
/* 9d) Positionsgruppen                                                 */
/* ------------------------------------------------------------------ */

console.log("\n=== Positionsgruppen ===");

for (const modul of BAUTEILE) {
  const p: Projekt = {
    ...wand,
    bauteil: modul.id,
    masse: standardMasse(modul),
    details: standardDetails(modul),
    oeffnungen: [],
  };
  const erg = berechneBewehrung(p);
  const gruppen = nachGruppen(erg.positionen);

  // Keine Position darf in der Auffanggruppe landen – sonst hat ein Modul
  // vergessen, seine Bewehrung einzuordnen.
  if (gruppen.some((g) => g.name === STANDARD_GRUPPE))
    throw new Error(`${modul.id}: Positionen ohne eigene Gruppe (${STANDARD_GRUPPE}).`);

  // Die Zwischensummen müssen das Gesamtgewicht ergeben, sonst stimmt eine
  // der beiden Zahlen auf der Stückliste nicht.
  const summe = Math.round(gruppen.reduce((a, g) => a + g.gewicht, 0) * 10) / 10;
  if (Math.abs(summe - erg.gesamtgewicht) > 0.15)
    throw new Error(
      `${modul.id}: Summe der Gruppen ${summe} kg ≠ Gesamtgewicht ${erg.gesamtgewicht} kg.`
    );

  // Positionsnummern laufen lückenlos durch und sind gruppenweise sortiert
  const nummern = gruppen.flatMap((g) => g.positionen.map((x) => x.pos));
  if (nummern.some((n, i) => n !== i + 1))
    throw new Error(`${modul.id}: Positionsnummern laufen nicht gruppenweise durch.`);

  console.log(`${modul.id.padEnd(18)} ${gruppen.map((g) => g.name).join(" · ")}`);
}

// Die Wand mit Öffnungen bekommt je Öffnung eine eigene Gruppe
const gruppenWand = nachGruppen(berechneBewehrung(wand).positionen).map((g) => g.name);
for (const erwartet of ["Flächenbewehrung", "Anschluss unten", "Anschluss oben"])
  if (!gruppenWand.includes(erwartet))
    throw new Error(`Der Wand fehlt die Gruppe "${erwartet}".`);
if (!gruppenWand.some((n) => n.startsWith("Öffnung")))
  throw new Error("Öffnungen müssen eine eigene Gruppe bekommen.");
console.log(`Wand mit Öffnungen: ${gruppenWand.join(" · ")}`);

/* ------------------------------------------------------------------ */
/* 9e) Seitlicher Anschluss an eine bestehende Wand                     */
/* ------------------------------------------------------------------ */

console.log("\n=== Wand an bestehende Wand ===");

const anBestand: Projekt = {
  ...wand,
  details: { ...wand.details, links: "wand_weiter", rechts: "wand_weiter" },
};
const ergBestand = berechneBewehrung(anBestand);
for (const seite of ["links", "rechts"]) {
  const g = nachGruppen(ergBestand.positionen).find((x) => x.name === `Anschluss ${seite}`);
  if (!g || g.positionen.length === 0)
    throw new Error(`Anschluss ${seite} an eine bestehende Wand erzeugt keine Bewehrung.`);
  // Es müssen Übergreifungsstöße sein, keine Randeinfassung: Ein nicht
  // behandelter Detailwert würde sonst still zum freien Rand werden.
  if (!g.positionen.some((p) => p.verwendung.includes("bestehende Wand")))
    throw new Error(
      `Anschluss ${seite}: erwartet Anschlusseisen an die bestehende Wand, gefunden ` +
        g.positionen.map((p) => p.verwendung).join(", ")
    );
}
if (!ergBestand.hinweise.some((h) => h.includes("Arbeitsfuge")))
  throw new Error("Der Anschluss an eine bestehende Wand braucht den Hinweis zur Arbeitsfuge.");
console.log("Beidseitiger Anschluss an Bestand erzeugt Übergreifungsstöße samt Hinweis");

/* ------------------------------------------------------------------ */
/* 9f) Übergreifungsstoß der Matten                                     */
/* ------------------------------------------------------------------ */

console.log("\n=== Mattenstoß ===");

// Eine große Fläche reagiert feiner als die Musterwand: Hier muss ein
// größerer Stoß zu mindestens ebenso vielen Matten führen.
const grossePlatte: Projekt = {
  ...wand,
  bauteil: "bodenplatte",
  masse: standardMasse(bauteilModul("bodenplatte")),
  details: standardDetails(bauteilModul("bodenplatte")),
  oeffnungen: [],
};
let vorher = 0;
for (const stoss of MATTEN_STOESSE) {
  const erg = berechneBewehrung({
    ...grossePlatte,
    parameter: { ...grossePlatte.parameter, mattenstoss: stoss.wert },
  });
  if (erg.mattenGewicht < vorher)
    throw new Error(
      `Ein größerer Stoß (${stoss.wert} mm) darf nie weniger Matten ergeben ` +
        `(${erg.mattenGewicht} kg nach ${vorher} kg).`
    );
  vorher = erg.mattenGewicht;
  console.log(`${String(stoss.wert / 10).padStart(3)} cm Stoß → ${erg.mattenGewicht} kg Matten`);
}

// Serverseitig darf kein beliebiger Stoß durchkommen – sonst ließe sich die
// Mattenzahl von außen kleinrechnen.
const gemogelt = metadataZuProjekt(
  projektZuMetadata({
    ...wand,
    parameter: { ...wand.parameter, mattenstoss: 5 },
  })
);
if (gemogelt.parameter.mattenstoss !== MATTEN_STOSS_STANDARD)
  throw new Error("Ein unzulässiger Mattenstoß muss auf den Standardwert zurückfallen.");
console.log("Unzulässiger Mattenstoß wird serverseitig verworfen");

/* ------------------------------------------------------------------ */
/* 10) Payload-Roundtrip für jedes Bauteil                             */
/* ------------------------------------------------------------------ */

for (const p of [wand, decke, boden, stuetze, traeger, fundament, einzel, mauer]) {
  const meta = projektZuMetadata(p);
  const zurueck = metadataZuProjekt(meta);
  const erwartet = { ...p, firmendaten: { ...p.firmendaten, logoDataUrl: undefined } };
  if (JSON.stringify(erwartet) !== JSON.stringify(zurueck))
    throw new Error(`Payload-Roundtrip fehlgeschlagen für ${p.bauteil}`);
}
console.log("\nPayload-Roundtrip OK für alle Bauteile");
console.log("\nALLE TESTS OK");
