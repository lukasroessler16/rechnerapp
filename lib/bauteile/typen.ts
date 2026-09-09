/**
 * Bauteil-Register: Schnittstelle eines Bauteilmoduls.
 *
 * Ein Bauteil (Wand, Bodenplatte, Stütze …) bringt alles Eigene selbst mit:
 *   – welche Maße es hat            → `masse`
 *   – welche Details wählbar sind   → `details`
 *   – wie es gezeichnet wird        → `zeichnung()`
 *   – wie es bewehrt wird           → `bewehrung()`
 *   – welche Sonderprüfungen gelten → `pruefe()`
 *
 * Der Kern (Wizard, Validierung, PDF-Erzeugung, Checkout-Validierung) kennt
 * nur diese Schnittstelle. Ein neues Bauteil ist damit reines Hinzufügen –
 * bestehende Bauteile können dabei nicht kaputtgehen.
 *
 * Wichtig: Dieses Modul und alle Bauteilmodule bleiben frei von React, damit
 * sie auch serverseitig (PDF-Erzeugung, Payload-Prüfung) laufen. Detailbilder
 * werden deshalb nur über eine `bildId` referenziert; die Zuordnung zu echten
 * SVG-Komponenten passiert in components/DetailBilder.tsx.
 */

import { Kennwerte, Projekt, Pruefmeldung } from "../types";
import { Betonklasse } from "../normdaten";
import { Sammler } from "./sammler";

/* ------------------------------------------------------------------ */
/* Eingabefelder                                                       */
/* ------------------------------------------------------------------ */

/**
 * Ein Zahlenfeld des Bauteils – Grundmaß oder Kennwert.
 *
 * Längen werden IMMER in Metern gespeichert und je nach `einheit` umgerechnet
 * angezeigt. Für Größen, die keine Längen sind (Reibungswinkel, Wichte,
 * Verkehrslast), wird der gespeicherte Wert unverändert angezeigt.
 */
export interface Massfeld {
  /** Schlüssel in `Projekt.masse` */
  schluessel: string;
  label: string;
  /** Anzeige-Einheit, z. B. "m", "cm", "kN/m³", "°" */
  einheit: string;
  /**
   * Anzeigewert = gespeicherter Wert × Faktor.
   * Ohne Angabe: 100 bei "cm", sonst 1.
   */
  anzeigeFaktor?: number;
  /** zulässiger Bereich in der SPEICHER-Einheit (gilt auch serverseitig) */
  min: number;
  max: number;
  /** Schrittweite in der Anzeige-Einheit */
  schritt?: number;
  /** Startwert in der Speicher-Einheit */
  standard: number;
  hinweis?: string;
}

/** Umrechnungsfaktor Speicher- → Anzeigewert eines Feldes */
export const feldFaktor = (f: Massfeld) =>
  f.anzeigeFaktor ?? (f.einheit === "cm" ? 100 : 1);

/** Eine Wahlmöglichkeit eines Detailfelds */
export interface Detailoption {
  wert: string;
  titel: string;
  /** Schlüssel des Vorschaubildes (siehe components/DetailBilder.tsx) */
  bildId: string;
}

/** Ein Auswahlfeld der Anschluss-/Detailseite */
export interface Detailfeld {
  /** Schlüssel in `Projekt.details` */
  schluessel: string;
  label: string;
  optionen: Detailoption[];
  /** Startwert */
  standard: string;
}

/* ------------------------------------------------------------------ */
/* Zeichnung: abstrakte Ansichten                                      */
/* ------------------------------------------------------------------ */

/**
 * Linienstile. Die konkrete Strichstärke bestimmt der jeweilige Renderer
 * (Bildschirm-SVG bzw. PDF), damit beide Ausgaben eigenständig sauber wirken.
 */
export type Stil =
  | "kante" // Bauteilkante, kräftig
  | "duenn" // Innenkante, Öffnungsumriss
  | "hilfslinie" // graue Hilfs-/Maßhilfslinie
  | "strich" // gestrichelt (verdeckte Kante, Türanschlag)
  | "stahl"; // Bewehrung, orange

/** Textrolle – bestimmt Größe, Farbe und Fettschrift */
export type Textrolle =
  | "marke" // Öffnungsmarke F1/T2, orange fett
  | "normal" // normale Beschriftung
  | "klein"; // Kleinschrift (Maßangaben an Öffnungen)

/**
 * Ein Zeichenelement. Alle Koordinaten in METERN im Bauteil-Koordinatensystem
 * der jeweiligen Ansicht: Ursprung links unten, y nach oben (Bauwesen).
 */
export type Zeichenelement =
  | { art: "flaeche"; x: number; y: number; b: number; h: number; ton: "beton" | "weiss" }
  | { art: "rahmen"; x: number; y: number; b: number; h: number; stil?: Stil }
  | { art: "linie"; x1: number; y1: number; x2: number; y2: number; stil?: Stil }
  | { art: "polylinie"; punkte: [number, number][]; stil?: Stil; geschlossen?: boolean }
  | {
      /** Kreis, z. B. Bewehrungsstab im Querschnitt. r in Metern; die Renderer
       *  erzwingen eine sichtbare Mindestgröße. */
      art: "kreis";
      x: number;
      y: number;
      r: number;
      ton?: "stahl" | "kante";
    }
  | {
      art: "text";
      x: number;
      y: number;
      text: string;
      rolle?: Textrolle;
      ausrichtung?: "links" | "mitte" | "rechts";
      /** Drehung in Grad gegen den Uhrzeigersinn */
      drehung?: number;
    };

/** Beschriftung außerhalb der Zeichenfläche (Anschlüsse, Auflager) */
export interface Randtext {
  seite: "unten" | "oben" | "links" | "rechts";
  text: string;
}

/**
 * Eine Ansicht des Bauteils (Ansicht, Draufsicht, Längs-/Querschnitt).
 * Ein Bauteil kann mehrere Ansichten liefern – die Stütze etwa Längs- und
 * Querschnitt. Alle Ansichten eines Bauteils werden im selben Maßstab
 * nebeneinander gezeichnet.
 */
export interface Ansicht {
  id: string;
  /** Überschrift, z. B. "Ansicht" oder "Querschnitt A–A" */
  titel: string;
  /** Ausdehnung der Ansicht in x [m] */
  breite: number;
  /** Ausdehnung der Ansicht in y [m] */
  hoehe: number;
  elemente: Zeichenelement[];
  /** Stützpunkte der waagrechten Maßkette [m] */
  massketteX?: number[];
  /** Stützpunkte der senkrechten Maßkette [m] */
  massketteY?: number[];
  randtexte?: Randtext[];
  /** Zusatzzeile unter der Ansicht, z. B. "d = 0,25 m" */
  fuss?: string;
  /**
   * Eigener, größerer Maßstab statt des gemeinsamen Planmaßstabs. Für
   * Detailschnitte üblich: ein Stützenquerschnitt wäre im Maßstab der
   * Ansicht nur wenige Millimeter groß und damit unlesbar. Der abweichende
   * Maßstab wird an der Ansicht angeschrieben.
   */
  eigenerMassstab?: boolean;
}

/* ------------------------------------------------------------------ */
/* Bewehrung                                                           */
/* ------------------------------------------------------------------ */

/** Arbeitsumgebung, die der Kern jedem Bauteilmodul bereitstellt */
export interface Kontext {
  projekt: Projekt;
  /** sammelt alle Positionen der Stück-/Biegeliste */
  s: Sammler;
  /** fachliche Hinweise; das Modul ergänzt hier eigene */
  hinweise: string[];
  /** aufgelöste Betonklasse */
  beton: Betonklasse;
  /** Nennmaß der Betondeckung [mm] */
  cnom: number;
  /** Bewehrungslagen (1 oder 2) */
  lagen: 1 | 2;
  /** Raster der Anschlussbewehrung [mm] */
  abst: number;
}

/* ------------------------------------------------------------------ */
/* Das Bauteilmodul                                                    */
/* ------------------------------------------------------------------ */

export interface Bauteilmodul {
  /** eindeutige Kennung, wird gespeichert und über Stripe transportiert */
  id: string;
  /** Anzeigename, z. B. "Wand" */
  name: string;
  /** ein Satz zur Erklärung in der Bauteilwahl */
  beschreibung: string;
  /** Schlüssel des Icons in der Bauteilwahl (components/DetailBilder.tsx) */
  bildId: string;
  /** Hat dieses Bauteil Öffnungen (Schritt 3 des Wizards)? */
  hatOeffnungen: boolean;
  /**
   * Wird das Bauteil flächig mit Lagermatten bewehrt? Nur dann sind Lagen,
   * Mattenwahl und das Raster der Anschlussbewehrung sinnvolle Eingaben.
   * Stabbauteile (Stütze, Träger) wählen ihre Bewehrung selbst.
   */
  flaechenbewehrt: boolean;
  /** zulässige Öffnungstypen (nur relevant, wenn hatOeffnungen) */
  oeffnungsTypen?: ("fenster" | "tuer" | "aussparung")[];
  /** Überschrift des Detailschritts, z. B. "Anschlussdetails" */
  detailTitel: string;
  /** Hilfetext des Detailschritts */
  detailHilfe: string;
  /** Planinhalt im Schriftkopf, z. B. "Bewehrungsplan Wand (Ansicht)" */
  planinhalt: string;

  /**
   * Abschließender fachlicher Hinweis. Ohne Angabe gilt der Standardtext des
   * Kerns (Mindestbewehrung, keine lastabhängige Bewehrung). Bauteile, die
   * anders rechnen – etwa die Stützmauer mit ihrer Vorbemessung –, setzen
   * hier einen passenden Text, damit das Ergebnis sich nicht selbst
   * widerspricht.
   */
  abschlussHinweis?: string;

  /**
   * Kurzhinweis im Fußbereich des Bauplans. Ohne Angabe steht dort der
   * Standardsatz zur Mindestbewehrung.
   */
  planHinweis?: string;

  masse: Massfeld[];
  details: Detailfeld[];

  /**
   * Weitere Zahleneingaben, die keine Grundmaße sind – etwa Bodenkennwerte
   * einer Stützmauer. Sie werden im Detailschritt unter eigener Überschrift
   * angezeigt, landen aber im selben Speicher wie die Maße und werden ebenso
   * geprüft.
   */
  zusatz?: {
    titel: string;
    hilfe?: string;
    felder: Massfeld[];
  };

  /** Kurzbeschreibung der Abmessungen für Listenköpfe, z. B. "8,00 × 2,75 × 0,25 m" */
  masseText(projekt: Projekt): string;

  /** eine oder mehrere Ansichten für Live-Skizze und Bauplan */
  zeichnung(projekt: Projekt): Ansicht[];

  /** ermittelt alle Bewehrungspositionen und liefert die Kennwerte */
  bewehrung(k: Kontext): Kennwerte;

  /** bauteilspezifische Plausibilitätsprüfungen (optional) */
  pruefe?(projekt: Projekt): Pruefmeldung[];

  /**
   * Automatisch berücksichtigte Verstärkungen je Öffnung – wird im Wizard
   * als Vorschlagsliste angezeigt (optional, nur bei hatOeffnungen).
   */
  oeffnungsHinweise?(projekt: Projekt, index: number): string[];
}
