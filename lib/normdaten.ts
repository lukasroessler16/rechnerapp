/**
 * Normbezogene Kennwerte und Sortimente.
 *
 * Grundlagen: Eurocode 2 (EN 1992-1-1) mit österreichischem Nationalen
 * Anhang ÖNORM B 1992-1-1 sowie das übliche österreichische/deutsche
 * Lagermatten-Programm (Q-Matten) und Betonstahl B550.
 *
 * WICHTIG: Die Werte dienen der Mengenermittlung und konstruktiven
 * Mindestbewehrung. Sie ersetzen keine statische Bemessung!
 */

/* ------------------------------------------------------------------ */
/* Betonklassen (EN 206 / EC2 Tab. 3.1)                                */
/* ------------------------------------------------------------------ */

export interface Betonklasse {
  name: string;
  /** charakteristische Zylinderdruckfestigkeit fck [N/mm²] */
  fck: number;
  /** mittlere Zugfestigkeit fctm [N/mm²] (EC2 Tab. 3.1) */
  fctm: number;
}

export const BETONKLASSEN: Betonklasse[] = [
  { name: "C20/25", fck: 20, fctm: 2.2 },
  { name: "C25/30", fck: 25, fctm: 2.6 },
  { name: "C30/37", fck: 30, fctm: 2.9 },
  { name: "C35/45", fck: 35, fctm: 3.2 },
  { name: "C40/50", fck: 40, fctm: 3.5 },
];

/* ------------------------------------------------------------------ */
/* Betondeckung und Betonstahlsorte                                    */
/* ------------------------------------------------------------------ */

/**
 * Expositionsklassen, Vorhaltemaß, Betonstahlsorten und die Streckgrenze
 * hängen vom Nationalen Anhang ab und stehen deshalb in lib/regelwerk.ts.
 * Von dort kommen auch cnomAusExposition() und fykVon().
 */
export type { Expositionsklasse } from "./regelwerk";
export { cnomAusExposition, fykVon } from "./regelwerk";

/* ------------------------------------------------------------------ */
/* Betonstahl                                                          */
/* ------------------------------------------------------------------ */

/** Dichte Stahl [kg/m³] */
export const DICHTE_STAHL = 7850;

/** Metergewicht eines Stabes [kg/m], d in [mm]: g = d²·π/4 · 7850·10⁻⁶ */
export function metergewicht(d: number): number {
  return (Math.PI / 4) * d * d * 7850e-6;
}

/** Querschnittsfläche eines Stabes [cm²], d in [mm] */
export function stabflaeche(d: number): number {
  return (Math.PI / 4) * (d / 10) * (d / 10);
}

/** verfügbare Stabdurchmesser [mm] */
export const STABDURCHMESSER = [8, 10, 12, 14, 16, 20];

/**
 * Biegerollendurchmesser D_min nach EC2 Tab. 8.1N:
 * d ≤ 16 mm → 4·d, d > 16 mm → 7·d
 */
export function biegerolle(d: number): number {
  return d <= 16 ? 4 * d : 7 * d;
}

/**
 * Vereinfachte Übergreifungs-/Verankerungslänge l_s ≈ 50·d [m].
 * (Praxiswert für gute Verbundbedingungen, B550, C25/30;
 *  genauer Nachweis nach EC2 8.4/8.7 bleibt dem Statiker vorbehalten.)
 */
export function uebergreifung(d: number): number {
  return Math.ceil((50 * d) / 10) / 100; // auf cm gerundet, in m
}

/* ------------------------------------------------------------------ */
/* Lagermatten (österr./dt. Standardprogramm)                          */
/* ------------------------------------------------------------------ */

export interface Lagermatte {
  name: string;
  /** Stabdurchmesser längs/quer [mm] */
  d: number;
  /** Stababstand [mm] */
  abstand: number;
  /** Querschnitt je Richtung [cm²/m] */
  as: number;
  /** Liefermaß Länge × Breite [m] */
  laenge: number;
  breite: number;
  /** Gewicht [kg/m²] (Katalogwert inkl. Überstände) */
  gewicht: number;
}

/**
 * Q-Lagermatten (Quadratmatten, gleiche Bewehrung in beiden Richtungen).
 * Liefermaß einheitlich 6,00 × 2,30 m.
 */
export const LAGERMATTEN: Lagermatte[] = [
  { name: "Q188A", d: 6.0, abstand: 150, as: 1.88, laenge: 6.0, breite: 2.3, gewicht: 3.02 },
  { name: "Q257A", d: 7.0, abstand: 150, as: 2.57, laenge: 6.0, breite: 2.3, gewicht: 4.13 },
  { name: "Q335A", d: 8.0, abstand: 150, as: 3.35, laenge: 6.0, breite: 2.3, gewicht: 5.39 },
  { name: "Q424A", d: 9.0, abstand: 150, as: 4.24, laenge: 6.0, breite: 2.3, gewicht: 6.82 },
  { name: "Q524A", d: 10.0, abstand: 150, as: 5.24, laenge: 6.0, breite: 2.3, gewicht: 8.43 },
  { name: "Q636A", d: 11.0, abstand: 150, as: 6.36, laenge: 6.0, breite: 2.3, gewicht: 10.23 },
];

/** wirtschaftlichste Matte, die as_erf [cm²/m] abdeckt (oder null) */
export function matteWaehlen(asErf: number): Lagermatte | null {
  for (const m of LAGERMATTEN) if (m.as >= asErf) return m;
  return null;
}

/** Übergreifungsstoß von Lagermatten [m] (Praxiswert: 2 Maschen + 5 cm ≥ 35 cm) */
export const MATTEN_STOSS = 0.35;

/** Verschnittzuschlag Matten (Zuschnitt an Rändern/Öffnungen) */
export const VERSCHNITT_FAKTOR = 1.1;
