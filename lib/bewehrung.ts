/**
 * Berechnungskern der Bewehrungsermittlung.
 *
 * Der Kern selbst kennt kein einzelnes Bauteil mehr: Er stellt die
 * gemeinsame Arbeitsumgebung bereit (Betonkennwerte, Betondeckung, Lagen,
 * Positions-Sammler) und übergibt an das Bauteilmodul aus lib/bauteile/.
 * Dort liegen die bauteilspezifischen Regeln.
 *
 * HINWEIS: Dieses Modul liefert eine Mengen- und Konstruktionsermittlung
 * auf Basis von Mindestbewehrung und anerkannten Konstruktionsregeln.
 * Es ersetzt KEINE statische Bemessung (Biegung, Querkraft, Knicken,
 * Durchstanzen, Erdbeben). Entsprechende Hinweise werden im Ergebnis
 * ausgegeben und müssen dem Nutzer angezeigt werden.
 */

import { Ergebnis, Projekt } from "./types";
import { BETONKLASSEN } from "./normdaten";
import { bauteilModul } from "./bauteile";
import { Kontext } from "./bauteile/typen";
import { Sammler } from "./bauteile/sammler";

export { Sammler } from "./bauteile/sammler";

/* ------------------------------------------------------------------ */
/* Detailvorschläge für Öffnungen (Schritt 3 des Wizards)              */
/* ------------------------------------------------------------------ */

export interface OeffnungsDetail {
  oeffnungId: string;
  details: string[];
}

/**
 * Ermittelt je Öffnung automatisch die erforderlichen Verstärkungsdetails
 * (wird im Wizard als Vorschlag angezeigt und in der Berechnung umgesetzt).
 */
export function oeffnungsDetails(projekt: Projekt): OeffnungsDetail[] {
  const modul = bauteilModul(projekt.bauteil);
  if (!modul.hatOeffnungen || !modul.oeffnungsHinweise) return [];
  return projekt.oeffnungen.map((o, i) => ({
    oeffnungId: o.id,
    details: modul.oeffnungsHinweise!(projekt, i),
  }));
}

/* ------------------------------------------------------------------ */
/* Hauptberechnung                                                     */
/* ------------------------------------------------------------------ */

export function berechneBewehrung(projekt: Projekt): Ergebnis {
  const modul = bauteilModul(projekt.bauteil);
  const parameter = projekt.parameter;

  const kontext: Kontext = {
    projekt,
    s: new Sammler(),
    hinweise: [],
    beton: BETONKLASSEN.find((b) => b.name === parameter.betonklasse) ?? BETONKLASSEN[1],
    cnom: parameter.betondeckung,
    lagen: parameter.lagen,
    abst: parameter.stababstand,
  };

  // Das Bauteilmodul erzeugt alle Positionen und liefert die Kennwerte
  const kennwerte = modul.bewehrung(kontext);

  // Abschließender Hinweis: Standardtext, sofern das Bauteil keinen eigenen
  // mitbringt (die Stützmauer rechnet eine Vorbemessung und braucht einen
  // anderen Schlusssatz).
  kontext.hinweise.push(
    modul.abschlussHinweis ??
      "Diese Ermittlung basiert auf Mindestbewehrung nach EC2/ÖNORM B 1992-1-1 und anerkannten Konstruktionsregeln. Lastabhängige Bewehrung (Biegung, Querkraft, Knicksicherheit, Erdbeben, Durchstanzen) ist NICHT enthalten und muss von einer Statikerin/einem Statiker nachgewiesen werden."
  );

  const positionen = kontext.s.fertig();
  const summe = (art: "matte" | "stab") =>
    Math.round(
      positionen.filter((p) => p.art === art).reduce((a, p) => a + p.gewichtGesamt, 0) * 10
    ) / 10;
  const mattenGewicht = summe("matte");
  const stabstahlGewicht = summe("stab");

  return {
    positionen,
    gesamtgewicht: Math.round((mattenGewicht + stabstahlGewicht) * 10) / 10,
    mattenGewicht,
    stabstahlGewicht,
    kennwerte,
    hinweise: kontext.hinweise,
  };
}
