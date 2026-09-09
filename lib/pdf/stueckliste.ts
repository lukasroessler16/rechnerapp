/**
 * Stückliste-PDF (A4 hoch): exakte Aufschlüsselung aller Baustahlteile
 * mit Positionsnummer, Mini-Skizze, Abmessungen, Stückzahl und Gewicht –
 * inklusive Summenblock und Bestellhinweisen.
 */

import { PDFDocument } from "pdf-lib";
import { Projekt, Ergebnis } from "../types";
import { bauteilModul } from "../bauteile";
import { regelwerkVon } from "../regelwerk";
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

const ZEILE_H = 15;
const START_Y = 250;
const ENDE_Y = 30;

export async function erzeugeStueckliste(
  projekt: Projekt,
  ergebnis: Ergebnis
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle("Stückliste – Bewehrungsrechner");
  const fonts: Fonts = await ladeFonts(doc);


  let seiteNr = 0;
  let z!: Zeichner;
  let y = 0;

  const spalten = [
    { x: 15, b: 11, t: "Pos." },
    { x: 26, b: 29, t: "Bezeichnung" },
    { x: 55, b: 32, t: "Skizze" },
    { x: 87, b: 27, t: "Abmessung [m]" },
    { x: 114, b: 12, t: "Stk." },
    { x: 126, b: 17, t: "kg/Stk." },
    { x: 143, b: 17, t: "kg ges." },
    { x: 160, b: 35, t: "Verwendung" },
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
    await listenKopf(doc, z, "STÜCKLISTE BAUSTAHL", projekt.firmendaten, seiteNr);
    z.text(
      `${bauteilModul(projekt.bauteil).masseText(projekt)} · ${projekt.parameter.stahlguete} · ${projekt.parameter.betonklasse} · ${regelwerkVon(projekt.parameter.regelwerk).normKurz}`,
      15,
      258,
      8,
      { farbe: GRAU }
    );
    y = START_Y;
    kopfzeile();
  };

  await neueSeite();

  for (const p of ergebnis.positionen) {
    if (y < ENDE_Y + ZEILE_H) await neueSeite();
    const bez =
      p.art === "matte"
        ? `Matte ${p.bezeichnung}`
        : `Stab ${p.bezeichnung} ${p.form === "gerade" || p.form === "schraegstab" ? "" : "gebogen"}`;
    const abm =
      p.art === "matte"
        ? `${de(p.laenge)} × ${de(p.breite ?? 0)}`
        : p.segmente && p.segmente.length > 1
          ? p.segmente.map((s) => de(s)).join(" / ")
          : `L = ${de(p.laenge)}`;
    z.text(String(p.pos), spalten[0].x + 1, y - 5.5, 8, { fett: true });
    z.text(bez, spalten[1].x + 1, y - 5.5, 7.5);
    formSkizze(z, p, spalten[2].x + 1, y - ZEILE_H + 3, spalten[2].b - 4, ZEILE_H - 5);
    z.text(abm, spalten[3].x + 1, y - 5.5, 7.5);
    z.text(String(p.stueck), spalten[4].x + 1, y - 5.5, 8);
    z.text(de(p.gewichtJeStueck), spalten[5].x + 1, y - 5.5, 8);
    z.text(de(p.gewichtGesamt, 1), spalten[6].x + 1, y - 5.5, 8, { fett: true });
    // Kurzform (1–3 Wörter) – der vollständige Text steht in der Biegeliste
    z.text(p.kurz, spalten[7].x + 1, y - 5.5, 7, { farbe: GRAU });
    z.linie(15, y - ZEILE_H + 1, 195, y - ZEILE_H + 1, 0.2, GRAU);
    y -= ZEILE_H;
  }

  /* ---------- Summenblock ---------- */
  if (y < ENDE_Y + 30) await neueSeite();
  y -= 4;
  z.linie(15, y, 195, y, 0.6);
  y -= 7;
  z.rechteck(15, y - 14, 180, 20, { fuellung: HELLGRAU });
  z.text(`Lagermatten: ${de(ergebnis.mattenGewicht, 1)} kg`, 18, y, 9);
  z.text(`Stabstahl: ${de(ergebnis.stabstahlGewicht, 1)} kg`, 78, y, 9);
  z.text(`GESAMT: ${de(ergebnis.gesamtgewicht, 1)} kg`, 138, y, 10, { fett: true });
  y -= 6;
  z.text(
    `empfohlene Bestellmenge inkl. 5 % Reserve: ${de(ergebnis.gesamtgewicht * 1.05, 0)} kg`,
    18,
    y,
    8,
    { farbe: GRAU }
  );
  y -= 10;
  z.text(
    "Gewichte gerundet. Mengenermittlung ohne statische Bemessung - vor Bestellung durch Tragwerksplaner:in freigeben.",
    15,
    y,
    6.5,
    { farbe: GRAU }
  );

  return doc.save();
}
