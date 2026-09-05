/**
 * Biegeliste-PDF (A4 hoch) für die Baustahlfirma:
 * je Stabstahl-Position eine Zeile mit Biegeform-Skizze, Schenkelmaßen,
 * Biegerollendurchmesser, Schnittlänge, Stückzahl und Gewicht.
 * Lagermatten werden in einem eigenen Block darunter aufgeführt.
 */

import { PDFDocument } from "pdf-lib";
import { Projekt, Ergebnis } from "../types";
import {
  Zeichner,
  Fonts,
  ladeFonts,
  listenKopf,
  mm,
  de,
  formSkizze,
  GRAU,
  HELLGRAU,
} from "./helpers";

const FORM_NAME: Record<string, string> = {
  gerade: "gerade",
  winkel: "Winkel (L)",
  buegel_u: "Steckbügel (U)",
  schraegstab: "Schrägstab",
};

const ZEILE_H = 16;
const START_Y = 250;
const ENDE_Y = 25;

export async function erzeugeBiegeliste(
  projekt: Projekt,
  ergebnis: Ergebnis
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle("Biegeliste – Bewehrungsrechner");
  const fonts: Fonts = await ladeFonts(doc);

  const staebe = ergebnis.positionen.filter((p) => p.art === "stab");
  const matten = ergebnis.positionen.filter((p) => p.art === "matte");


  let seiteNr = 0;
  let z!: Zeichner;
  let y = 0;

  const spalten = [
    { x: 15, b: 12, t: "Pos." },
    { x: 27, b: 12, t: "Ø [mm]" },
    { x: 39, b: 46, t: "Biegeform (Schenkel [m])" },
    { x: 85, b: 22, t: "Form" },
    { x: 107, b: 16, t: "dbr [mm]" },
    { x: 123, b: 18, t: "L [m]" },
    { x: 141, b: 14, t: "Stk." },
    { x: 155, b: 18, t: "kg/Stk." },
    { x: 173, b: 22, t: "kg ges." },
  ];

  const kopfzeile = () => {
    z.rechteck(15, y - 2, 180, 7, { fuellung: HELLGRAU });
    for (const s of spalten) z.text(s.t, s.x + 1, y, 7, { fett: true });
    y -= ZEILE_H * 0.6;
  };

  const neueSeite = async () => {
    seiteNr++;
    const seite = doc.addPage([mm(210), mm(297)]);
    z = new Zeichner(seite, fonts);
    await listenKopf(doc, z, "BIEGELISTE", projekt.firmendaten, seiteNr);
    z.text(
      `Betonstahl ${projekt.parameter.stahlguete} · Beton ${projekt.parameter.betonklasse} · c_nom ${projekt.parameter.betondeckung} mm`,
      15,
      258,
      8,
      { farbe: GRAU }
    );
    y = START_Y;
    kopfzeile();
  };

  await neueSeite();

  /* ---------- Stabstahl-Zeilen ---------- */
  for (const p of staebe) {
    if (y < ENDE_Y + ZEILE_H) await neueSeite();
    z.text(String(p.pos), spalten[0].x + 1, y - 6, 8, { fett: true });
    z.text(String(p.durchmesser), spalten[1].x + 1, y - 6, 8);
    formSkizze(z, p, spalten[2].x + 1, y - ZEILE_H + 3, spalten[2].b - 2, ZEILE_H - 5);
    z.text(FORM_NAME[p.form ?? "gerade"], spalten[3].x + 1, y - 6, 7);
    z.text(p.biegerolle ? String(p.biegerolle) : "—", spalten[4].x + 1, y - 6, 8);
    z.text(de(p.laenge), spalten[5].x + 1, y - 6, 8);
    z.text(String(p.stueck), spalten[6].x + 1, y - 6, 8);
    z.text(de(p.gewichtJeStueck), spalten[7].x + 1, y - 6, 8);
    z.text(de(p.gewichtGesamt, 1), spalten[8].x + 1, y - 6, 8, { fett: true });
    z.text(p.verwendung, spalten[2].x + 1, y - ZEILE_H + 2.5, 5.5, { farbe: GRAU });
    z.linie(15, y - ZEILE_H + 1, 195, y - ZEILE_H + 1, 0.2, GRAU);
    y -= ZEILE_H;
  }

  /* ---------- Matten-Block ---------- */
  if (matten.length > 0) {
    if (y < ENDE_Y + ZEILE_H * (matten.length + 1.5)) await neueSeite();
    y -= 4;
    z.text("LAGERMATTEN (Zuschnitt auf der Baustelle)", 15, y, 8.5, { fett: true });
    y -= 7;
    for (const p of matten) {
      z.text(String(p.pos), 16, y - 4, 8, { fett: true });
      formSkizze(z, p, 27, y - ZEILE_H + 4, 30, ZEILE_H - 6);
      z.text(
        `${p.bezeichnung} · ${de(p.laenge)} × ${de(p.breite ?? 0)} m · ${p.stueck} Stk. · ${de(p.gewichtGesamt, 1)} kg`,
        62,
        y - 5,
        8.5
      );
      z.text(p.verwendung, 62, y - 9.5, 6.5, { farbe: GRAU });
      y -= ZEILE_H;
    }
  }

  /* ---------- Summen ---------- */
  if (y < ENDE_Y + 20) await neueSeite();
  y -= 4;
  z.linie(15, y, 195, y, 0.6);
  y -= 6;
  z.text(`Stabstahl gesamt: ${de(ergebnis.stabstahlGewicht, 1)} kg`, 15, y, 9, { fett: true });
  y -= 5.5;
  z.text(`Lagermatten gesamt: ${de(ergebnis.mattenGewicht, 1)} kg`, 15, y, 9, { fett: true });
  y -= 5.5;
  z.text(`GESAMT: ${de(ergebnis.gesamtgewicht, 1)} kg`, 15, y, 10, { fett: true });
  y -= 8;
  z.text(
    "Biegerollendurchmesser dbr nach EC2 Tab. 8.1N. Maße = Außenmaße der Schenkel in m.",
    15,
    y,
    6.5,
    { farbe: GRAU }
  );
  y -= 4;
  z.text(
    "Mengenermittlung ohne statische Bemessung - vor Bestellung durch Tragwerksplaner:in freigeben.",
    15,
    y,
    6.5,
    { farbe: GRAU }
  );

  return doc.save();
}
