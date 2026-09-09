/**
 * Standard-Startwerte für ein neues Projekt (clientseitig) und die
 * Wiederherstellung eines gespeicherten Zustands.
 */
import { Projekt } from "./types";
import { cnomAusExposition } from "./normdaten";
import {
  alleMassfelder,
  bauteilModul,
  istBauteil,
  standardDetails,
  standardMasse,
  STANDARD_BAUTEIL,
} from "./bauteile";

export function neuesProjekt(): Projekt {
  const heute = new Date().toISOString().slice(0, 10);
  const modul = bauteilModul(STANDARD_BAUTEIL);
  return {
    bauteil: modul.id,
    masse: standardMasse(modul),
    oeffnungen: [],
    details: standardDetails(modul),
    parameter: {
      betonklasse: "C25/30",
      expositionsklasse: "XC2",
      betondeckung: cnomAusExposition("XC2"),
      stahlguete: "B550B",
      lagen: 2,
      matte: "auto",
      stababstand: 250,
    },
    firmendaten: {
      firma: "",
      planersteller: "",
      bauvorhaben: "",
      adresse: "",
      datum: heute,
    },
  };
}

/**
 * Bringt einen gespeicherten (oder aus einer älteren Version stammenden)
 * Zustand auf die aktuelle Form: unbekanntes Bauteil → Standardbauteil,
 * fehlende Maß- oder Detailschlüssel → Standardwerte des Bauteils,
 * unbekannte Schlüssel werden verworfen.
 */
export function normalisiereProjekt(roh: unknown): Projekt {
  const basis = neuesProjekt();
  const p = (roh ?? {}) as Partial<Projekt>;
  const bauteil = istBauteil(p.bauteil) ? (p.bauteil as string) : basis.bauteil;
  const modul = bauteilModul(bauteil);

  const masse: Record<string, number> = {};
  for (const f of alleMassfelder(modul)) {
    const wert = Number(p.masse?.[f.schluessel]);
    masse[f.schluessel] = isFinite(wert) && wert >= f.min ? wert : f.standard;
  }

  const details: Record<string, string> = {};
  for (const f of modul.details) {
    const wert = String(p.details?.[f.schluessel] ?? "");
    details[f.schluessel] = f.optionen.some((o) => o.wert === wert) ? wert : f.standard;
  }

  return {
    bauteil,
    masse,
    details,
    oeffnungen: modul.hatOeffnungen && Array.isArray(p.oeffnungen) ? p.oeffnungen : [],
    parameter: { ...basis.parameter, ...(p.parameter ?? {}) },
    firmendaten: { ...basis.firmendaten, ...(p.firmendaten ?? {}) },
  };
}
