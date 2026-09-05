/**
 * Bauplan-PDF: maßstäbliche technische Zeichnung des Bauteils
 * (A4 quer) mit Maßketten, Öffnungen, Anschluss-Beschriftungen,
 * Bewehrungsangaben und Schriftkopf.
 */

import { PDFDocument, rgb } from "pdf-lib";

const WEISS = rgb(1, 1, 1);
import { Projekt, Ergebnis } from "../types";
import {
  Zeichner,
  ladeFonts,
  schriftkopf,
  mm,
  de,
  SCHWARZ,
  GRAU,
  HELLGRAU,
  ORANGE,
} from "./helpers";

/** übliche Planmaßstäbe */
const MASSSTAEBE = [10, 20, 25, 50, 75, 100, 125, 150, 200, 250];

export async function erzeugeBauplan(
  projekt: Projekt,
  ergebnis: Ergebnis
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle("Bauplan – Bewehrungsrechner");
  const seite = doc.addPage([mm(297), mm(210)]); // A4 quer
  const z = new Zeichner(seite, await ladeFonts(doc));

  // Planrahmen
  z.rechteck(10, 10, 277, 190, { dicke: 0.8 });

  /* ---------- Maßstab bestimmen ---------- */
  // Zeichenfläche: links vom Schriftkopf, Platz für Maßketten einplanen
  const zeichenB = 200; // mm auf Papier
  const zeichenH = 120;
  const { laenge, hoehe } = projekt.masse;
  const noetig = Math.max((laenge * 1000) / zeichenB, (hoehe * 1000) / zeichenH);
  const massstab = MASSSTAEBE.find((s) => s >= noetig) ?? 500;
  const f = 1000 / massstab; // m → mm Papier

  // Ursprung der Zeichnung (linke untere Bauteilecke)
  const ox = 35;
  const oy = 68; // Unterkante über dem Schriftkopf (40 mm) + Maßketten-Platz
  const B = laenge * f;
  const H = hoehe * f;

  /* ---------- Bauteil ---------- */
  z.rechteck(ox, oy, B, H, { fuellung: HELLGRAU });
  z.rechteck(ox, oy, B, H, { dicke: 0.9 });

  /* ---------- Öffnungen ---------- */
  projekt.oeffnungen.forEach((o, i) => {
    const x = ox + o.x * f;
    const y = oy + o.y * f;
    const b = o.breite * f;
    const h = o.hoehe * f;
    z.rechteck(x, y, b, h, { fuellung: WEISS });
    z.rechteck(x, y, b, h, { dicke: 0.6 });
    // Diagonalkreuz (außer Türen)
    if (o.typ !== "tuer") {
      z.linie(x, y, x + b, y + h, 0.25, GRAU);
      z.linie(x + b, y, x, y + h, 0.25, GRAU);
    }
    const label = (o.typ === "fenster" ? "F" : o.typ === "tuer" ? "T" : "A") + (i + 1);
    z.text(label, x + b / 2, y + h / 2 - 1.5, 9, { ausrichtung: "mitte", fett: true, farbe: ORANGE });
    z.text(
      `${label}: ${de(o.breite)} × ${de(o.hoehe)} m`,
      x + b / 2,
      y - 4 < oy ? y + h + 1.5 : y - 4,
      6,
      { ausrichtung: "mitte", farbe: GRAU }
    );
  });

  /* ---------- Maßketten ---------- */
  const xWerte = [
    ...new Set(
      [0, laenge, ...projekt.oeffnungen.flatMap((o) => [o.x, o.x + o.breite])].map(
        (v) => Math.round(v * 1000) / 1000
      )
    ),
  ].sort((a, b) => a - b);
  const yWerte = [
    ...new Set(
      [0, hoehe, ...projekt.oeffnungen.flatMap((o) => [o.y, o.y + o.hoehe])].map(
        (v) => Math.round(v * 1000) / 1000
      )
    ),
  ].sort((a, b) => a - b);

  // horizontale Kette unter dem Bauteil
  const my = oy - 12;
  z.linie(ox + xWerte[0] * f, my, ox + xWerte[xWerte.length - 1] * f, my, 0.35);
  for (const x of xWerte) {
    z.linie(ox + x * f, my - 2, ox + x * f, my + 2, 0.35);
    z.linie(ox + x * f - 1.2, my - 1.2, ox + x * f + 1.2, my + 1.2, 0.5);
    z.linie(ox + x * f, my + 2, ox + x * f, oy, 0.15, GRAU); // Maßhilfslinie
  }
  xWerte.slice(0, -1).forEach((x, i) => {
    const b = xWerte[i + 1] - x;
    z.text(de(b), ox + (x + b / 2) * f, my + 1.2, 6.5, { ausrichtung: "mitte" });
  });

  // vertikale Kette links
  const mx = ox - 12;
  z.linie(mx, oy + yWerte[0] * f, mx, oy + yWerte[yWerte.length - 1] * f, 0.35);
  for (const y of yWerte) {
    z.linie(mx - 2, oy + y * f, mx + 2, oy + y * f, 0.35);
    z.linie(mx - 1.2, oy + y * f - 1.2, mx + 1.2, oy + y * f + 1.2, 0.5);
    z.linie(mx + 2, oy + y * f, ox, oy + y * f, 0.15, GRAU);
  }
  yWerte.slice(0, -1).forEach((y, i) => {
    const b = yWerte[i + 1] - y;
    z.text(de(b), mx - 1.5, oy + (y + b / 2) * f - 1, 6.5, { drehung: 90 });
  });

  /* ---------- Anschluss-Beschriftungen ---------- */
  const namen: Record<string, string> = {
    bodenplatte: "Anschluss Bodenplatte",
    streifenfundament: "Anschluss Streifenfundament",
    decke_unter: "Anschluss Decke unten",
    decke_ueber: "Anschluss Decke oben",
    wand_weiter: "Wand läuft weiter (Arbeitsfuge)",
    ecke: "Eckausbildung",
    wandstoss: "Wandstoß",
    frei: "freier Rand (Steckbügel)",
    wand_auflager: "Auflager Wand",
  };
  if (projekt.bauteil === "wand") {
    const a = projekt.anschluesse;
    z.text(namen[a.unten], ox + B / 2, oy - 20, 7, { ausrichtung: "mitte", farbe: ORANGE });
    z.text(namen[a.oben], ox + B / 2, oy + H + 3, 7, { ausrichtung: "mitte", farbe: ORANGE });
    z.text(namen[a.links], ox - 17, oy + H / 2, 7, { drehung: 90, farbe: ORANGE });
    z.text(namen[a.rechts], ox + B + 5, oy + H / 2, 7, { drehung: 90, farbe: ORANGE });
  } else {
    const r = projekt.deckenRaender;
    z.text(namen[r.unten], ox + B / 2, oy - 20, 7, { ausrichtung: "mitte", farbe: ORANGE });
    z.text(namen[r.oben], ox + B / 2, oy + H + 3, 7, { ausrichtung: "mitte", farbe: ORANGE });
    z.text(namen[r.links], ox - 17, oy + H / 2, 7, { drehung: 90, farbe: ORANGE });
    z.text(namen[r.rechts], ox + B + 5, oy + H / 2, 7, { drehung: 90, farbe: ORANGE });
  }

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
  zeile(`Bauteil: ${projekt.bauteil === "wand" ? "Wand" : "Decke/Bodenplatte"}`);
  zeile(`${de(laenge)} × ${de(hoehe)} × ${de(projekt.masse.dicke)} m`);
  iy -= 2;
  zeile(`Beton: ${par.betonklasse}`, true);
  zeile(`Exposition: ${par.expositionsklasse}`);
  zeile(`Betondeckung c_nom = ${par.betondeckung} mm`);
  zeile(`Betonstahl: ${par.stahlguete}`);
  iy -= 2;
  zeile(`Flächenbew.: ${k.gewaehlteMatte}`, true);
  zeile(`${par.lagen}-lagig, as = ${de(k.asVorhanden)} cm²/m`);
  zeile(`As,min = ${de(k.asMinHaupt)} cm²/m je Lage`);
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
  z.text("Vor Ausführung durch Tragwerksplaner:in prüfen und freigeben.", 14, 13, 6.5, { farbe: GRAU });

  /* ---------- Schriftkopf ---------- */
  await schriftkopf(doc, z, 165, 12, {
    firmendaten: projekt.firmendaten,
    planinhalt:
      projekt.bauteil === "wand"
        ? "Bewehrungsplan Wand (Ansicht)"
        : "Bewehrungsplan Decke (Draufsicht)",
    massstab: `M 1:${massstab}`,
    blatt: "1/1",
  });

  return doc.save();
}
