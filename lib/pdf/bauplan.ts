/**
 * Bauplan-PDF: maßstäbliche technische Zeichnung des Bauteils (A4 quer)
 * mit Maßketten, Anschluss-Beschriftungen, Bewehrungsangaben und Schriftkopf.
 *
 * Was gezeichnet wird, bestimmt allein das Bauteilmodul (lib/bauteile/): es
 * liefert eine oder mehrere abstrakte Ansichten, die zeichneAnsichten() auf
 * das Blatt bringt. Diese Datei kümmert sich nur noch um das Blattlayout.
 */

import { PDFDocument } from "pdf-lib";
import { nachGruppen } from "../gruppen";
import { Ergebnis, Projekt } from "../types";
import { bauteilModul } from "../bauteile";
import { zeichneAnsichten } from "./ansicht";
import { anNorm, regelwerkVon } from "../regelwerk";
import { GRAU, Zeichner, de, ladeFonts, mm, schriftkopf } from "./helpers";

export async function erzeugeBauplan(
  projekt: Projekt,
  ergebnis: Ergebnis,
  /** Herkunftsvermerk (Code-Stand, Zahlungsreferenz) für den Blattfuß */
  stempel?: string
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
  const SPALTE = 287 - ix - 2; // verfügbare Breite bis zum Planrahmen [mm]

  /**
   * Eine Zeile der Angabenspalte. Zu lange Zeilen werden an Leerzeichen
   * umbrochen und eingerückt fortgesetzt – Normbezeichnungen wie
   * "Betonstahl: B550B (ÖNORM B 4707)" liefen sonst über den Planrahmen
   * hinaus und standen halb außerhalb des Blattes.
   */
  const zeile = (t: string, fett = false) => {
    const woerter = t.split(" ");
    let puffer = "";
    let erste = true;
    for (const wort of woerter) {
      const versuch = puffer ? `${puffer} ${wort}` : wort;
      if (puffer && z.textBreite(erste ? versuch : `  ${versuch}`, 7.5) > SPALTE) {
        z.text(erste ? puffer : `  ${puffer}`, ix, iy, 7.5, { fett });
        iy -= 4.2;
        puffer = wort;
        erste = false;
      } else puffer = versuch;
    }
    if (puffer) {
      z.text(erste ? puffer : `  ${puffer}`, ix, iy, 7.5, { fett });
      iy -= 4.5;
    }
  };

  z.text("BEWEHRUNGSANGABEN", ix, iy, 8.5, { fett: true });
  iy -= 6;
  const par = projekt.parameter;
  const regelwerk = regelwerkVon(par.regelwerk);
  const k = ergebnis.kennwerte;
  zeile(`Bauteil: ${modul.name}`);
  // Die Maßangabe kann lang werden (Stützmauer). Sie wird an den Trennpunkten
  // umbrochen, damit die Teile zusammenbleiben.
  let puffer = "";
  for (const teil of modul.masseText(projekt).replace(`${modul.name} `, "").split(" · ")) {
    const versuch = puffer ? `${puffer} · ${teil}` : teil;
    if (puffer && z.textBreite(versuch, 7.5) > SPALTE) {
      zeile(puffer);
      puffer = teil;
    } else puffer = versuch;
  }
  if (puffer) zeile(puffer);
  iy -= 2;
  zeile(`Regelwerk: ${regelwerk.normKurz}`);
  iy -= 2;
  zeile(`Beton: ${par.betonklasse}`, true);
  zeile(`Exposition: ${par.expositionsklasse}`);
  zeile(`Betondeckung c_nom = ${par.betondeckung} mm`);
  zeile(`Betonstahl: ${par.stahlguete} (${regelwerk.betonstahlNorm})`);
  iy -= 2;
  zeile(`${k.wahlLabel}: ${k.gewaehlteMatte}`, true);
  zeile(`vorh. as = ${de(k.asVorhanden)} ${k.hauptEinheit}`);
  zeile(`As,min = ${de(k.asMinHaupt)} ${k.hauptEinheit}`);
  iy -= 2;
  zeile(`Stahl gesamt: ${de(ergebnis.gesamtgewicht, 1)} kg`, true);
  zeile(`davon Matten: ${de(ergebnis.mattenGewicht, 1)} kg`);
  zeile(`davon Stabstahl: ${de(ergebnis.stabstahlGewicht, 1)} kg`);
  iy -= 2;
  // Aufteilung nach Gruppen: zeigt auf einen Blick, was ein Anschluss kostet
  // und ob eine Öffnung die Menge treibt. Dieselbe Gliederung wie in der
  // Stückliste, damit Plan und Liste nebeneinander lesbar sind.
  zeile("Aufteilung:", true);
  for (const g of nachGruppen(ergebnis.positionen)) {
    z.text(`${g.name}`, ix + 1, iy, 6.5, { farbe: GRAU });
    z.text(`${de(g.gewicht, 1)} kg`, 285.5, iy, 6.5, {
      ausrichtung: "rechts",
      farbe: GRAU,
    });
    iy -= 3.6;
  }
  iy -= 3;
  // Betonmenge: Wer die Bewehrung bestellt, bestellt den Beton gleich mit.
  zeile(`Beton netto: ${de(ergebnis.beton.volumen)} m³`, true);
  zeile(`Bestellmenge: ${de(ergebnis.beton.bestellmenge)} m³`);
  zeile(`Eigengewicht: ${de(ergebnis.beton.gewicht)} t`);
  zeile(`Bewehrungsgrad: ${ergebnis.beton.bewehrungsgrad} kg/m³`);

  /* ---------- Hinweisblock ---------- */
  z.text(
    anNorm(
      modul.planHinweis ??
        "HINWEIS: Mengenermittlung auf Basis Mindestbewehrung EC2/ÖNORM B 1992-1-1. Keine statische Bemessung!",
      regelwerk
    ),
    14,
    16,
    6.5,
    { farbe: GRAU }
  );
  z.text("Vor Ausführung durch Tragwerksplaner:in prüfen und freigeben.", 14, 13, 6.5, {
    farbe: GRAU,
  });
  // Herkunftsvermerk: macht ein ausgedrucktes Blatt einer Berechnung zuordenbar
  if (stempel) z.text(stempel, 14, 10.5, 5.5, { farbe: GRAU });

  /* ---------- Schriftkopf ---------- */
  await schriftkopf(doc, z, 165, 12, {
    firmendaten: projekt.firmendaten,
    planinhalt: modul.planinhalt,
    massstab: `M 1:${massstab}`,
    blatt: "1/1",
  });

  return doc.save();
}
