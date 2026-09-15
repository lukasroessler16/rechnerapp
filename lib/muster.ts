/**
 * Beispielprojekt für die Startseite und die Musterdokumente.
 *
 * Bewusst ein realistischer Alltagsfall: Kellerwand mit einem Fenster und
 * einer Tür. Dieselben Daten speisen die Live-Skizze auf der Startseite und
 * die drei Muster-PDFs unter /api/muster – die Beispiele können dadurch nie
 * veralten, weil sie mit demselben Code entstehen wie die Kundendokumente.
 */

import { Projekt } from "./types";
import { bauteilModul, standardDetails, standardMasse } from "./bauteile";

export const MUSTERPROJEKT: Projekt = {
  bauteil: "wand",
  masse: { laenge: 8.0, hoehe: 2.75, dicke: 0.25 },
  oeffnungen: [
    { id: "m1", typ: "fenster", x: 1.5, y: 0.9, breite: 1.5, hoehe: 1.4 },
    { id: "m2", typ: "tuer", x: 5.0, y: 0, breite: 1.0, hoehe: 2.1 },
  ],
  details: {
    unten: "bodenplatte",
    oben: "decke_ueber",
    links: "ecke",
    rechts: "ecke",
  },
  parameter: {
    regelwerk: "at",
    betonklasse: "C25/30",
    expositionsklasse: "XC2",
    betondeckung: 30,
    stahlguete: "B550B",
    lagen: 2,
    matte: "auto",
    stababstand: 250,
  },
  firmendaten: {
    firma: "Musterbau GmbH",
    planersteller: "M. Muster",
    bauvorhaben: "Musterprojekt – Kellerwand W1",
    adresse: "Mustergasse 1, 1010 Wien",
    datum: "2026-01-15",
  },
};

/**
 * Bauvorhaben-Bezeichnungen der Muster je Bauteil.
 *
 * Realistische Bezeichnungen statt „Beispiel 1“: Wer ein Muster öffnet, soll
 * ein Blatt sehen, wie es auf einer Baustelle liegen könnte.
 */
const MUSTER_VORHABEN: Record<string, string> = {
  wand: "Musterprojekt – Kellerwand W1",
  deckenplatte: "Musterprojekt – Decke über EG, Feld D3",
  bodenplatte: "Musterprojekt – Bodenplatte Keller",
  stuetze: "Musterprojekt – Stütze S2, Erdgeschoss",
  traeger: "Musterprojekt – Unterzug U1 über Wohnraum",
  streifenfundament: "Musterprojekt – Streifenfundament Außenwand",
  einzelfundament: "Musterprojekt – Einzelfundament unter Stütze S2",
  stuetzmauer: "Musterprojekt – Stützmauer Grundstücksgrenze",
};

/**
 * Musterprojekt zu einem beliebigen Bauteil.
 *
 * Für die Wand ist das MUSTERPROJEKT mit seinen Öffnungen; alle anderen
 * Bauteile werden aus ihren eigenen Standardwerten aufgebaut. Dadurch zeigen
 * die Muster immer genau das, was jemand sieht, der den Rechner öffnet und
 * nichts verstellt – und sie können nie veralten, weil sie aus demselben
 * Register stammen wie der Wizard.
 */
export function musterProjekt(bauteilId: string): Projekt {
  if (bauteilId === MUSTERPROJEKT.bauteil) return MUSTERPROJEKT;
  const modul = bauteilModul(bauteilId);
  return {
    ...MUSTERPROJEKT,
    bauteil: modul.id,
    masse: standardMasse(modul),
    details: standardDetails(modul),
    oeffnungen: [],
    firmendaten: {
      ...MUSTERPROJEKT.firmendaten,
      bauvorhaben: MUSTER_VORHABEN[modul.id] ?? `Musterprojekt – ${modul.name}`,
    },
  };
}
