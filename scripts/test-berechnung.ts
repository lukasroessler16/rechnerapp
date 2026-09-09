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
