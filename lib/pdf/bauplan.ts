/**
 * Bauplan-PDF: maßstäbliche technische Zeichnung des Bauteils (A4 quer)
 * mit Maßketten, Anschluss-Beschriftungen, Bewehrungsangaben und Schriftkopf.
 *
 * Was gezeichnet wird, bestimmt allein das Bauteilmodul (lib/bauteile/): es
 * liefert eine oder mehrere abstrakte Ansichten, die zeichneAnsichten() auf
 * das Blatt bringt. Diese Datei kümmert sich nur noch um das Blattlayout.
 */

import { PDFDocument } from "pdf-lib";
import { Ergebnis, Projekt } from "../types";
import { bauteilModul } from "../bauteile";
import { zeichneAnsichten } from "./ansicht";
import { GRAU, Zeichner, de, ladeFonts, mm, schriftkopf } from "./helpers";

export async function erzeugeBauplan(
  projekt: Projekt,
  ergebnis: Ergebnis
): Promise<Uint8Array> {
  const modul = bauteilModul(projekt.bauteil);
  const doc = await PDFDocument.create();
  doc.setTitle("Bauplan – Bewehrungsrechner");
  const seite = doc.addPage([mm(297), mm(210)]); // A4 quer
  const z = new Zeichner(seite, await ladeFonts(doc));

  // Planrahmen
  z.rechteck(10, 10, 277, 190, { dicke: 0.8 });

  /* ---------- Zeichnung (Ansichten des Bauteils) ---------- */
  const { massstab } = zeichneAnsichten(z, modul.zeichnung(projekt));

  /* ---------- Bewehrungsangaben (rechte Spalte) ---------- */
  const ix = 245;
  let iy = 190;
  const zeile = (t: string, fett = false) => {
    z.text(t, ix, iy, 7.5, { fett });
    iy -= 4.5;
  };
  z.text("BEWEHRUNGSANGABEN", ix, iy, 8.5, { fett: true });
  iy -= 6;
  const par = projekt.parameter;
  const k = ergebnis.kennwerte;
  zeile(`Bauteil: ${modul.name}`);
  zeile(modul.masseText(projekt).replace(`${modul.name} `, ""));
  iy -= 2;
  zeile(`Beton: ${par.betonklasse}`, true);
  zeile(`Exposition: ${par.expositionsklasse}`);
  zeile(`Betondeckung c_nom = ${par.betondeckung} mm`);
  zeile(`Betonstahl: ${par.stahlguete}`);
  iy -= 2;
  zeile(`${k.wahlLabel}: ${k.gewaehlteMatte}`, true);
  zeile(`vorh. as = ${de(k.asVorhanden)} ${k.hauptEinheit}`);
  zeile(`As,min = ${de(k.asMinHaupt)} ${k.hauptEinheit}`);
  iy -= 2;
  zeile(`Stahl gesamt: ${de(ergebnis.gesamtgewicht, 1)} kg`, true);
  zeile(`davon Matten: ${de(ergebnis.mattenGewicht, 1)} kg`);
  zeile(`davon Stabstahl: ${de(ergebnis.stabstahlGewicht, 1)} kg`);

  /* ---------- Hinweisblock ---------- */
  z.text(
    "HINWEIS: Mengenermittlung auf Basis Mindestbewehrung EC2/ÖNORM B 1992-1-1. Keine statische Bemessung!",
    14,
    16,
    6.5,
    { farbe: GRAU }
  );
  z.text("Vor Ausführung durch Tragwerksplaner:in prüfen und freigeben.", 14, 13, 6.5, {
    farbe: GRAU,
  });

  /* ---------- Schriftkopf ---------- */
  await schriftkopf(doc, z, 165, 12, {
    firmendaten: projekt.firmendaten,
    planinhalt: modul.planinhalt,
    massstab: `M 1:${massstab}`,
    blatt: "1/1",
  });

  return doc.save();
}
