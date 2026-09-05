/**
 * Erzeugt alle drei PDF-Dokumente mit Beispieldaten zur Sichtprüfung.
 * Aufruf: npx tsx scripts/test-pdf.ts
 */
import { writeFileSync } from "fs";
import { berechneBewehrung } from "../lib/bewehrung";
import { erzeugeBauplan } from "../lib/pdf/bauplan";
import { erzeugeBiegeliste } from "../lib/pdf/biegeliste";
import { erzeugeStueckliste } from "../lib/pdf/stueckliste";
import { Projekt } from "../lib/types";

const projekt: Projekt = {
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
  firmendaten: {
    firma: "Muster Bau GmbH",
    planersteller: "L. Rößler",
    bauvorhaben: "EFH Familie Muster – Kellerwand W1",
    adresse: "Mustergasse 12, 1100 Wien",
    datum: "2026-08-16",
  },
};

async function main() {
  const ergebnis = berechneBewehrung(projekt);
  writeFileSync("/tmp/Bauplan.pdf", await erzeugeBauplan(projekt, ergebnis));
  writeFileSync("/tmp/Biegeliste.pdf", await erzeugeBiegeliste(projekt, ergebnis));
  writeFileSync("/tmp/Stueckliste.pdf", await erzeugeStueckliste(projekt, ergebnis));
  console.log("PDFs erzeugt: /tmp/Bauplan.pdf, /tmp/Biegeliste.pdf, /tmp/Stueckliste.pdf");
}
main();
