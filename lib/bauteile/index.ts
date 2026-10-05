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
import { streifenfundament } from "./streifenfundament";
import { einzelfundament } from "./einzelfundament";
import { stuetzmauer } from "./stuetzmauer";

/**
 * Kategorien der Bauteilwahl.
 *
 * Acht Bauteile in einer Reihe sind eine Liste, die man lesen muss; in vier
 * Gruppen sind sie eine, die man überfliegt. Die Reihenfolge entspricht der
 * Bauabfolge – von unten nach oben, wie auf der Baustelle.
 *
 * Die Bodenplatte steht bewusst bei den Platten und nicht bei den
 * Fundamenten: Sie ist zwar eine Flachgründung, wird aber wie eine Platte
 * gesucht und gerechnet. Verschieben wäre eine Zeile im jeweiligen Modul.
 */
export interface Kategorie {
  id: string;
  name: string;
  /** ein Halbsatz, der die Gruppe einordnet */
  beschreibung: string;
}

export const KATEGORIEN: Kategorie[] = [
  {
    id: "fundamente",
    name: "Fundamente",
    beschreibung: "Gründung unter Wänden und Stützen",
  },
  {
    id: "platten",
    name: "Decken und Platten",
    beschreibung: "flächige Bauteile, liegend",
  },
  {
    id: "waende",
    name: "Wände",
    beschreibung: "flächige Bauteile, stehend",
  },
  {
    id: "staebe",
    name: "Stützen und Träger",
    beschreibung: "stabförmige Bauteile",
  },
];

/** Gibt es diese Kategorie? */
export function istKategorie(id: unknown): boolean {
  return typeof id === "string" && KATEGORIEN.some((k) => k.id === id);
}

/** Alle Bauteile einer Kategorie, in der Reihenfolge des Registers */
export function bauteileDerKategorie(id: string): Bauteilmodul[] {
  return BAUTEILE.filter((b) => b.kategorie === id);
}

export const BAUTEILE: Bauteilmodul[] = [
  wand,
  deckenplatte,
  bodenplatte,
  stuetze,
  traeger,
  streifenfundament,
  einzelfundament,
  stuetzmauer,
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

/**
 * Alle Zahlenfelder eines Bauteils: Grundmaße plus etwaige Zusatzkennwerte.
 * Validierung, Payload-Prüfung und Standardwerte arbeiten immer mit dieser
 * Liste, damit ein Zusatzfeld nirgends vergessen werden kann.
 */
export function alleMassfelder(modul: Bauteilmodul) {
  return [...modul.masse, ...(modul.zusatz?.felder ?? [])];
}

/** Startwerte der Maße und Kennwerte eines Bauteils */
export function standardMasse(modul: Bauteilmodul): Record<string, number> {
  const m: Record<string, number> = {};
  for (const f of alleMassfelder(modul)) m[f.schluessel] = f.standard;
  return m;
}

/** Startwerte der Detailauswahlen eines Bauteils */
export function standardDetails(modul: Bauteilmodul): Record<string, string> {
  const d: Record<string, string> = {};
  for (const f of modul.details) d[f.schluessel] = f.standard;
  return d;
}

export type { Bauteilmodul } from "./typen";
