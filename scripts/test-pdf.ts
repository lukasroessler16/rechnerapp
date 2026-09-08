/**
 * Erzeugt für jedes Bauteil alle drei PDF-Dokumente zur Sichtprüfung.
 * Aufruf: npx tsx scripts/test-pdf.ts
 * Ergebnis: /tmp/pdf/<bauteil>-{Bauplan,Biegeliste,Stueckliste}.pdf
 */
import { mkdirSync, writeFileSync } from "fs";
import { berechneBewehrung } from "../lib/bewehrung";
import { erzeugeBauplan } from "../lib/pdf/bauplan";
import { erzeugeBiegeliste } from "../lib/pdf/biegeliste";
import { erzeugeStueckliste } from "../lib/pdf/stueckliste";
import { bauteilModul, standardDetails } from "../lib/bauteile";
import { Projekt } from "../lib/types";

const basis = {
  parameter: {
    betonklasse: "C25/30",
    expositionsklasse: "XC2",
    betondeckung: 30,
    stahlguete: "B550B" as const,
    lagen: 2 as const,
    matte: "auto",
    stababstand: 250,
  },
  firmendaten: {
    firma: "Muster Bau GmbH",
    planersteller: "L. Rößler",
    bauvorhaben: "EFH Familie Muster",
    adresse: "Mustergasse 12, 1100 Wien",
    datum: "2026-08-16",
  },
};

const faelle: Projekt[] = [
  {
    ...basis,
    bauteil: "wand",
    masse: { laenge: 8.0, hoehe: 2.75, dicke: 0.25 },
    oeffnungen: [
      { id: "1", typ: "fenster", x: 1.5, y: 0.9, breite: 1.5, hoehe: 1.4 },
      { id: "2", typ: "tuer", x: 5.0, y: 0, breite: 1.0, hoehe: 2.1 },
    ],
    details: { unten: "bodenplatte", oben: "decke_ueber", links: "ecke", rechts: "frei" },
  },
  {
    ...basis,
    bauteil: "deckenplatte",
    masse: { laenge: 6.0, hoehe: 4.5, dicke: 0.2 },
    oeffnungen: [{ id: "1", typ: "aussparung", x: 2.0, y: 1.5, breite: 0.8, hoehe: 0.8 }],
    details: standardDetails(bauteilModul("deckenplatte")),
  },
  {
    ...basis,
    bauteil: "bodenplatte",
    masse: { laenge: 10.0, hoehe: 8.0, dicke: 0.25 },
    oeffnungen: [],
    details: standardDetails(bauteilModul("bodenplatte")),
  },
  {
    ...basis,
    bauteil: "traeger",
    masse: { laenge: 6.0, breite: 0.3, hoehe: 0.7 },
    oeffnungen: [],
    details: { system: "einfeld", auflager: "stuetze", lage: "unterzug" },
  },
  {
    ...basis,
    bauteil: "stuetze",
    masse: { breite: 0.4, tiefe: 0.3, hoehe: 3.2 },
    oeffnungen: [],
    details: { fuss: "fundament", kopf: "decke_ueber" },
  },
];

async function main() {
  mkdirSync("/tmp/pdf", { recursive: true });
  for (const projekt of faelle) {
    const ergebnis = berechneBewehrung(projekt);
    const p = `/tmp/pdf/${projekt.bauteil}`;
    writeFileSync(`${p}-Bauplan.pdf`, await erzeugeBauplan(projekt, ergebnis));
    writeFileSync(`${p}-Biegeliste.pdf`, await erzeugeBiegeliste(projekt, ergebnis));
    writeFileSync(`${p}-Stueckliste.pdf`, await erzeugeStueckliste(projekt, ergebnis));
    console.log(
      `${projekt.bauteil.padEnd(13)} → ${ergebnis.positionen.length} Positionen, ${ergebnis.gesamtgewicht} kg`
    );
  }
  console.log("PDFs unter /tmp/pdf/");
}
main();
