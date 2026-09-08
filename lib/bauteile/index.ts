/**
 * Bauteil-Register.
 *
 * Einziger Ort, an dem die verfügbaren Bauteile aufgelistet werden. Ein neues
 * Bauteil wird als eigenes Modul geschrieben und hier eingetragen – Wizard,
 * Validierung, Zeichnung und PDF-Erzeugung ziehen alles Weitere automatisch
 * aus der Modulbeschreibung.
 *
 * Die Reihenfolge bestimmt die Anzeige in der Bauteilwahl.
 */

import { Bauteilmodul } from "./typen";
import { wand } from "./wand";
import { bodenplatte, deckenplatte } from "./platte";
import { stuetze } from "./stuetze";
import { traeger } from "./traeger";

export const BAUTEILE: Bauteilmodul[] = [
  wand,
  deckenplatte,
  bodenplatte,
  stuetze,
  traeger,
];

/** Standard-Bauteil eines neuen Projekts */
export const STANDARD_BAUTEIL = wand.id;

/** Modul zu einer Bauteilkennung; fällt auf das Standard-Bauteil zurück */
export function bauteilModul(id: string): Bauteilmodul {
  return BAUTEILE.find((b) => b.id === id) ?? wand;
}

/** Gibt es diese Bauteilkennung? */
export function istBauteil(id: unknown): boolean {
  return typeof id === "string" && BAUTEILE.some((b) => b.id === id);
}

/** Startwerte der Maße eines Bauteils */
export function standardMasse(modul: Bauteilmodul): Record<string, number> {
  const m: Record<string, number> = {};
  for (const f of modul.masse) m[f.schluessel] = f.standard;
  return m;
}

/** Startwerte der Detailauswahlen eines Bauteils */
export function standardDetails(modul: Bauteilmodul): Record<string, string> {
  const d: Record<string, string> = {};
  for (const f of modul.details) d[f.schluessel] = f.standard;
  return d;
}

export type { Bauteilmodul } from "./typen";
