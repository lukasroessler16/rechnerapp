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
      g = { name: p.gruppe, positionen: [], gewicht: 0, anteil: 0 };
      gruppen.push(g);
    }
    g.positionen.push(p);
    g.gewicht = Math.round((g.gewicht + p.gewichtGesamt) * 10) / 10;
  }

  for (const g of gruppen) {
    g.anteil = gesamt > 0 ? Math.round((g.gewicht / gesamt) * 100) : 0;
  }
  return gruppen;
}
