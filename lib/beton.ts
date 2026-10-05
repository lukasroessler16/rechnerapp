/**
 * Betonmenge und Eigengewicht.
 *
 * WOZU: Wer die Bewehrung bestellt, bestellt im selben Atemzug den Beton.
 * Die Menge steht ohnehin in den Maßen – sie auszurechnen, abzuschreiben und
 * dabei die Öffnungen zu vergessen, ist unnötige Arbeit und eine beliebte
 * Fehlerquelle. Deshalb rechnet das Werkzeug sie mit und schreibt sie auf
 * Plan und Stückliste.
 *
 * WIE DAS GEWICHT ENTSTEHT: Üblich ist der pauschale Ansatz 25 kN/m³ für
 * Stahlbeton (EC1/ÖNORM EN 1991-1-1, Tab. A.1) – der unterstellt rund
 * 100 kg Bewehrung je m³. Hier ist die Bewehrung aber bereits auf das
 * Kilogramm ermittelt, also wird genauer gerechnet:
 *
 *   Stahlvolumen   = Stahlmasse / 7.850 kg/m³
 *   Betonmasse     = (Bauteilvolumen − Stahlvolumen) · 2.400 kg/m³
 *   Eigengewicht   = Betonmasse + Stahlmasse
 *
 * Das Ergebnis liegt erwartungsgemäß nahe am pauschalen Wert, ist aber für
 * das konkrete Bauteil belegbar – und es liefert nebenbei den
 * Bewehrungsgrad, die nützlichste Plausibilitätsprüfung überhaupt: Übliche
 * Hochbauteile liegen bei 60–120 kg/m³. Wer dort 15 oder 300 liest, hat sich
 * bei den Maßen vertan.
 *
 * ACHTUNG, WAS DIE MENGE NICHT IST: Sie ist das reine Bauteilvolumen, netto,
 * mit abgezogenen Öffnungen. Verluste beim Einbau, Pumpenreste, Überprofil
 * einer Schalung und Sauberkeitsschichten sind NICHT enthalten; dafür gibt
 * es den ausgewiesenen Zuschlag.
 */

import { DICHTE_STAHL } from "./normdaten";

/** Rohdichte des erhärteten Normalbetons ohne Bewehrung [kg/m³] */
export const DICHTE_BETON = 2400;

/**
 * Zuschlag auf die Bestellmenge [-]. Beton wird selten exakt abgerufen:
 * Schalungstoleranzen, Reste in Pumpe und Leitung, kleine Überprofile.
 * 5 % ist der gängige, zurückhaltende Ansatz – dieselbe Größenordnung wie
 * beim Stahl.
 */
export const BETON_ZUSCHLAG = 0.05;

export interface Betonmenge {
  /** Bauteilvolumen netto, Öffnungen abgezogen [m³] */
  volumen: number;
  /** empfohlene Bestellmenge inkl. Zuschlag, auf 0,1 m³ aufgerundet [m³] */
  bestellmenge: number;
  /** Eigengewicht des fertigen Stahlbetonbauteils [t] */
  gewicht: number;
  /** ermittelte Bewehrung je m³ Beton [kg/m³] */
  bewehrungsgrad: number;
}

/**
 * Betonmenge und Eigengewicht aus Bauteilvolumen und ermittelter Stahlmasse.
 *
 * @param volumen   Bauteilvolumen netto [m³]
 * @param stahlKg   gesamte ermittelte Bewehrung [kg]
 */
export function betonmenge(volumen: number, stahlKg: number): Betonmenge {
  const v = Math.max(0, volumen);
  const stahlVolumen = stahlKg / DICHTE_STAHL;
  const betonMasse = Math.max(0, v - stahlVolumen) * DICHTE_BETON;
  const gesamtKg = betonMasse + stahlKg;

  return {
    volumen: Math.round(v * 100) / 100,
    // aufgerundet, nie abgerundet: zu wenig Beton auf der Baustelle ist
    // teurer als ein halber Kubikmeter zu viel
    bestellmenge: Math.ceil(v * (1 + BETON_ZUSCHLAG) * 10) / 10,
    gewicht: Math.round((gesamtKg / 1000) * 100) / 100,
    bewehrungsgrad: v > 0 ? Math.round(stahlKg / v) : 0,
  };
}
