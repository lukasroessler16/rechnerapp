/**
 * Wände in Abschnitten.
 *
 * WARUM: Eine 40 m lange Kellerwand plant niemand als ein Stück. Sie wird in
 * Betonierabschnitte geteilt – nach Schalungslänge, Tagesleistung oder
 * Arbeitsfugen. Jeder Abschnitt ist ein eigener Plan mit eigenen Maßen,
 * eigenen Öffnungen und eigenen Rändern; nur die bautechnischen Vorgaben und
 * die Firmendaten gelten für alle gemeinsam.
 *
 * MODELL: Ein Bauvorhaben ist schlicht eine Liste von Projekten. Der
 * Berechnungskern, die Bauteilmodule, die Zeichnungen und die Prüfung bleiben
 * dadurch vollständig unberührt – sie rechnen weiterhin genau einen
 * Abschnitt. Alles, was mehrere Abschnitte betrifft, steht hier.
 *
 * NUR DIE WAND: Ein Fundament oder eine Stütze in Abschnitte zu zerlegen
 * ergäbe keinen Sinn; welches Bauteil teilbar ist, sagt sein Modul.
 */

import { Projekt } from "./types";
import { bauteilModul } from "./bauteile";

/** Ein Bauvorhaben: mindestens ein Abschnitt, sonst mehrere */
export type Bauvorhaben = Projekt[];

/**
 * Obergrenze. Nicht technisch begründet (die Daten passen auch bei mehr
 * bequem in die Stripe-Metadata), sondern praktisch: Wer mehr als acht
 * Abschnitte braucht, hat ein Bauvorhaben, das eine Tragwerksplanung
 * verdient und keinen Mengenrechner.
 */
export const MAX_ABSCHNITTE = 8;

/** Darf dieses Bauteil in Abschnitte geteilt werden? */
export function teilbar(bauteilId: string): boolean {
  return bauteilModul(bauteilId).teilbar === true;
}

/**
 * Bezeichnung eines Abschnitts für Pläne, Listen und Dateinamen.
 * Bei nur einem Abschnitt bleibt sie leer – dann gibt es nichts zu benennen.
 */
export function abschnittKurz(nr: number, von: number): string {
  return von > 1 ? `Abschnitt ${nr} von ${von}` : "";
}

/**
 * Gemeinsame Angaben aus dem ersten Abschnitt auf alle übrigen ziehen.
 *
 * Bauteil, bautechnische Parameter und Firmendaten gehören dem Bauvorhaben,
 * nicht dem einzelnen Abschnitt: Es wäre sinnlos, Abschnitt 1 nach ÖNORM und
 * Abschnitt 2 nach DIN zu rechnen, und der Schriftkopf soll überall gleich
 * aussehen. Wird hier und nicht nur in der Oberfläche durchgesetzt, damit
 * auch eine manipulierte Anfrage nichts Gemischtes erzeugen kann.
 */
export function vereinheitliche(bv: Bauvorhaben): Bauvorhaben {
  if (bv.length === 0) return bv;
  const erster = bv[0];
  return bv.map((p, i) =>
    i === 0
      ? p
      : {
          ...p,
          bauteil: erster.bauteil,
          parameter: { ...erster.parameter },
          firmendaten: { ...erster.firmendaten },
        }
  );
}

/**
 * Auf die zulässige Zahl von Abschnitten stutzen.
 * Nicht teilbare Bauteile behalten genau einen.
 */
export function begrenzeAbschnitte(bv: Bauvorhaben): Bauvorhaben {
  if (bv.length === 0) return bv;
  const hoechstens = teilbar(bv[0].bauteil) ? MAX_ABSCHNITTE : 1;
  return bv.slice(0, Math.max(1, hoechstens));
}

/* ------------------------------------------------------------------ */
/* Übersichtsgrafik „Abschnitt 2 von 4“                                */
/* ------------------------------------------------------------------ */

export interface Streifen {
  /** Nummer des Abschnitts, 1-basiert */
  nr: number;
  /** linke Kante im Zeichenbereich */
  x: number;
  /** Breite im Zeichenbereich, proportional zur Abschnittslänge */
  breite: number;
  /** Länge des Abschnitts [m] */
  laenge: number;
  /** ist das der gerade betrachtete Abschnitt? */
  aktiv: boolean;
}

/**
 * Teilt eine Zeichenbreite proportional zu den Abschnittslängen auf.
 *
 * Proportional und nicht in gleich große Kästchen: Der Nutzen der Grafik ist,
 * dass man auf einen Blick sieht, ob die Abschnitte gleichmäßig geteilt sind
 * oder ob einer dreimal so lang ist wie der nächste. Gleich breite Kästchen
 * würden genau diese Information verstecken.
 *
 * Wird zweimal verwendet: auf dem Bildschirm (components/AbschnittSVG.tsx)
 * und im PDF (lib/pdf/abschnittsgrafik.ts). Die Geometrie entsteht deshalb
 * hier, damit beide dasselbe zeigen.
 *
 * @param laengen      Länge je Abschnitt [m]
 * @param aktiv        Index des aktuellen Abschnitts (0-basiert)
 * @param gesamtBreite verfügbare Breite im Zeichenbereich
 * @param fuge         Lücke zwischen zwei Abschnitten im Zeichenbereich
 */
export function abschnittsStreifen(
  laengen: number[],
  aktiv: number,
  gesamtBreite: number,
  fuge = 2
): Streifen[] {
  const n = laengen.length;
  if (n === 0) return [];
  const summe = laengen.reduce((a, b) => a + b, 0);
  const nutzbar = Math.max(0, gesamtBreite - fuge * (n - 1));
  // Bei unsinnigen Längen (0 m) gleichmäßig aufteilen, statt NaN zu zeichnen
  const anteil = (l: number) => (summe > 0 ? l / summe : 1 / n);

  const streifen: Streifen[] = [];
  let x = 0;
  for (let i = 0; i < n; i++) {
    const breite = nutzbar * anteil(laengen[i]);
    streifen.push({ nr: i + 1, x, breite, laenge: laengen[i], aktiv: i === aktiv });
    x += breite + fuge;
  }
  return streifen;
}

/** Gesamtlänge aller Abschnitte [m] – nur sinnvoll bei teilbaren Bauteilen */
export function gesamtLaenge(bv: Bauvorhaben): number {
  return bv.reduce((a, p) => a + (p.masse.laenge ?? 0), 0);
}
