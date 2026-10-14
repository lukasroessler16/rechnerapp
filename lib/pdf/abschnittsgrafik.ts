/**
 * Abschnittsgrafik im PDF.
 *
 * Dasselbe Band wie auf dem Bildschirm (components/AbschnittSVG.tsx), nur mit
 * dem Zeichner statt mit SVG: die Wand als Ganzes, proportional in ihre
 * Abschnitte geteilt, der auf diesem Blatt gezeigte hervorgehoben.
 *
 * Wozu auf dem Papier: Auf der Baustelle liegen vier ähnliche Pläne
 * nebeneinander. Die Grafik beantwortet in einer halben Sekunde, welcher davon
 * gerade in der Hand ist – zuverlässiger als eine Zeile Text im Schriftkopf.
 */

import { abschnittsStreifen } from "../abschnitte";
import { GRAU, HELLGRAU, Zeichner, de } from "./helpers";

export interface AbschnittsgrafikOpts {
  /** Länge je Abschnitt [m] */
  laengen: number[];
  /**
   * Index des auf diesem Blatt gezeigten Abschnitts (0-basiert).
   * -1 auf Blättern, die für alle gelten (Gesamt-Stückliste): dann wird
   * keiner hervorgehoben.
   */
  aktiv: number;
  /** linke untere Ecke [mm] */
  x: number;
  y: number;
  /** Gesamtbreite der Grafik [mm] */
  breite: number;
}

/**
 * Zeichnet die Grafik und liefert ihre Höhe [mm] zurück, damit der Aufrufer
 * weiß, wie viel Platz sie gebraucht hat.
 */
export function zeichneAbschnitte(z: Zeichner, o: AbschnittsgrafikOpts): number {
  const BAND_H = 7;
  const streifen = abschnittsStreifen(o.laengen, o.aktiv, o.breite, 1.2);
  const gesamt = o.laengen.reduce((a, b) => a + b, 0);

  // Auf einem Blatt für alle Abschnitte wäre „Abschnitt 0 von 4" Unsinn.
  const titel =
    o.aktiv < 0
      ? `ALLE ${o.laengen.length} ABSCHNITTE`
      : `ABSCHNITT ${o.aktiv + 1} VON ${o.laengen.length}`;
  z.text(titel, o.x, o.y + BAND_H + 4.5, 7, { fett: true });
  z.text(`Wand gesamt ${de(gesamt)} m`, o.x + o.breite, o.y + BAND_H + 4.5, 6.5, {
    ausrichtung: "rechts",
    farbe: GRAU,
  });

  for (const s of streifen) {
    // Der aktive Abschnitt wird gefüllt und kräftig umrandet, die übrigen
    // bleiben hell – auf einem Schwarzweißausdruck immer noch unterscheidbar.
    if (s.aktiv) {
      z.rechteck(o.x + s.x, o.y, s.breite, BAND_H, { dicke: 1.1 });
    } else {
      z.rechteck(o.x + s.x, o.y, s.breite, BAND_H, { fuellung: HELLGRAU, rand: GRAU, dicke: 0.3 });
    }
    if (s.breite > 5)
      z.text(String(s.nr), o.x + s.x + s.breite / 2, o.y + 2.4, 6.5, {
        ausrichtung: "mitte",
        fett: s.aktiv,
        farbe: s.aktiv ? undefined : GRAU,
      });
    if (s.breite > 13)
      z.text(`${de(s.laenge)} m`, o.x + s.x + s.breite / 2, o.y - 3, 5.5, {
        ausrichtung: "mitte",
        farbe: GRAU,
      });
  }

  // Höhe: Maßzeile unter dem Band plus Band plus Überschrift darüber
  return BAND_H + 10;
}
