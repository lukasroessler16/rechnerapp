/**
 * Positionen nach Gruppen aufbereiten.
 *
 * Stückliste, Bauplan und die Ergebnisvorschau zeigen dieselbe Gliederung:
 * zusammengehörige Bewehrung unter einer Überschrift, mit Zwischensumme.
 * Damit die drei nie auseinanderlaufen, entsteht die Gliederung hier an
 * einer Stelle und nicht dreimal nebeneinander.
 */

import { Position } from "./types";

export interface Positionsgruppe {
  /**
   * Nummer der Gruppe, 1-basiert. Die Positionen darin heißen "2.1", "2.2" …
   * Vergeben wird sie beim Zusammenstellen der Positionen
   * (lib/bauteile/sammler.ts, `fertig()`) – hier wird sie nur übernommen,
   * damit Überschrift und Positionsnummern nicht auseinanderlaufen können.
   */
  nummer: number;
  /** Überschrift, z. B. "Anschluss oben" */
  name: string;
  positionen: Position[];
  /** Summe der Positionsgewichte dieser Gruppe [kg] */
  gewicht: number;
  /** Anteil am Gesamtgewicht [%], gerundet */
  anteil: number;
}

/**
 * Positionen in ihre Gruppen zerlegen. Die Reihenfolge der Gruppen folgt der
 * Positionsnummer – die hat der Sammler bereits gruppenweise vergeben.
 */
export function nachGruppen(positionen: Position[]): Positionsgruppe[] {
  const gesamt = positionen.reduce((a, p) => a + p.gewichtGesamt, 0);
  const gruppen: Positionsgruppe[] = [];

  for (const p of positionen) {
    let g = gruppen.find((x) => x.name === p.gruppe);
    if (!g) {
      g = { nummer: p.gruppeNr, name: p.gruppe, positionen: [], gewicht: 0, anteil: 0 };
      gruppen.push(g);
    }
    g.positionen.push(p);
    // Unterwegs NICHT runden: Bei vielen kleinen Gruppen summierten sich die
    // Rundungsfehler sonst so weit auf, dass die Zwischensummen nicht mehr
    // das Gesamtgewicht ergaben – auf einer Bestellliste ein echter Mangel.
    g.gewicht += p.gewichtGesamt;
  }

  for (const g of gruppen) {
    g.anteil = gesamt > 0 ? Math.round((g.gewicht / gesamt) * 100) : 0;
    g.gewicht = Math.round(g.gewicht * 10) / 10;
  }
  return gruppen;
}
