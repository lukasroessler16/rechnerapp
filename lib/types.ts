/**
 * Zentrale Typdefinitionen des Bewehrungsrechners.
 *
 * Alle Längenangaben in Metern [m], sofern nicht anders angegeben.
 * Durchmesser in Millimetern [mm], Querschnitte in [cm²/m], Gewichte in [kg].
 *
 * Seit der Einführung des Bauteil-Registers (lib/bauteile/) sind Maße und
 * Detailauswahlen bewusst generisch gehalten: Welche Felder es gibt, welche
 * Grenzen gelten und wie sie heißen, bestimmt allein das jeweilige
 * Bauteilmodul. Dadurch kommt ein neues Bauteil ohne Änderung am Kern aus.
 */

/** Bauteilkennung, z. B. "wand" – gültige Werte liefert lib/bauteile */
export type Bauteil = string;

/** Öffnung (Fenster, Tür, Aussparung) in einem Bauteil mit Öffnungen */
export interface Oeffnung {
  id: string;
  typ: "fenster" | "tuer" | "aussparung";
  /** x-Koordinate der linken unteren Ecke, gemessen vom linken Bauteilrand [m] */
  x: number;
  /** y-Koordinate der linken unteren Ecke, gemessen vom unteren Bauteilrand [m] */
  y: number;
  /** lichte Breite [m] */
  breite: number;
  /** lichte Höhe [m] */
  hoehe: number;
}

/**
 * Grundmaße des Bauteils, Schlüssel je Bauteil verschieden.
 * Wand/Platten: laenge, hoehe, dicke · Stütze: breite, tiefe, hoehe
 * Alle Werte in Metern.
 */
export type Masse = Record<string, number>;

/**
 * Detailauswahlen (Anschlüsse, Auflager, Lagerung …), Schlüssel je Bauteil
 * verschieden. Werte sind die Options-Schlüssel des jeweiligen Detailfelds.
 */
export type Details = Record<string, string>;

/** Bautechnische Parameter (Eurocode 2 / ÖNORM B 1992-1-1) */
export interface Parameter {
  /** Betonfestigkeitsklasse, z. B. "C25/30" */
  betonklasse: string;
  /** Expositionsklasse, z. B. "XC2" */
  expositionsklasse: string;
  /**
   * Nennmaß der Betondeckung c_nom [mm].
   * Wird aus der Expositionsklasse vorgeschlagen, kann überschrieben werden.
   */
  betondeckung: number;
  /** Betonstahlsorte (Österreich: B550A/B550B) */
  stahlguete: "B550A" | "B550B";
  /** Anzahl Bewehrungslagen (1 = mittig/einlagig, 2 = beidseitig) */
  lagen: 1 | 2;
  /**
   * Mattenwahl: "auto" = wirtschaftlichste Lagermatte aus Mindestbewehrung,
   * sonst feste Vorgabe (z. B. "Q257A").
   */
  matte: string;
  /** Stababstand der Zulagen/Anschlüsse [mm], typ. 150/200/250 */
  stababstand: number;
}

/** Projekt-/Firmendaten für den Schriftkopf */
export interface Firmendaten {
  firma: string;
  planersteller: string;
  bauvorhaben: string;
  adresse: string;
  datum: string;
  /** Logo als Data-URL (PNG/JPEG), optional – wird nur clientseitig gehalten */
  logoDataUrl?: string;
}

/** Gesamter Eingabezustand des Wizards */
export interface Projekt {
  /** Bauteilkennung aus dem Register, z. B. "wand" oder "stuetze" */
  bauteil: Bauteil;
  masse: Masse;
  oeffnungen: Oeffnung[];
  details: Details;
  parameter: Parameter;
  firmendaten: Firmendaten;
}

/* ------------------------------------------------------------------ */
/* Prüfmeldungen                                                       */
/* ------------------------------------------------------------------ */

/**
 * Meldung der Plausibilitätsprüfung.
 * Liegt hier (und nicht in lib/validierung.ts), damit Bauteilmodule eigene
 * Prüfungen liefern können, ohne einen Import-Ring zu erzeugen.
 */
export interface Pruefmeldung {
  /** Feldschlüssel, z. B. "laenge" oder "oef:<id>:breite" */
  feld: string;
  schwere: "fehler" | "warnung";
  text: string;
}

/* ------------------------------------------------------------------ */
/* Ergebnis-Typen                                                      */
/* ------------------------------------------------------------------ */

/** Biegeform eines Stabes (vereinfachte Formcodes, angelehnt an ÖNORM/BVBS) */
export type Biegeform =
  | "gerade" // gerader Stab
  | "winkel" // L-Form (ein Abbug 90°)
  | "buegel_u" // U-Form / Steckbügel (zwei Abbüge 90°)
  | "buegel_rechteck" // geschlossener Rechteckbügel (Stütze, Träger, Fundament)
  | "schraegstab"; // gerader Stab, diagonal eingebaut (45°)

/** Eine Position der Stück-/Biegeliste */
export interface Position {
  /** Positionsnummer (fortlaufend) */
  pos: number;
  /** Art: Lagermatte oder Stabstahl */
  art: "matte" | "stab";
  /** Bezeichnung, z. B. "Q257A" oder "Ø12" */
  bezeichnung: string;
  /** Stabdurchmesser [mm] (nur bei Stabstahl) */
  durchmesser?: number;
  /** Biegeform (nur bei Stabstahl) */
  form?: Biegeform;
  /** Schenkellängen der Biegeform [m], Summe = Schnittlänge */
  segmente?: number[];
  /** Biegerollendurchmesser [mm] (nur bei gebogenen Stäben) */
  biegerolle?: number;
  /** Schnittlänge je Stück [m] – bei Matten: Mattenlänge */
  laenge: number;
  /** Mattenbreite [m] (nur bei Matten) */
  breite?: number;
  /** Stückzahl */
  stueck: number;
  /** Gewicht je Stück [kg] */
  gewichtJeStueck: number;
  /** Gesamtgewicht der Position [kg] */
  gewichtGesamt: number;
  /** Verwendungszweck, z. B. "Sturzbewehrung Öffnung 1" */
  verwendung: string;
  /**
   * Kurzform der Verwendung für enge Tabellenspalten (1–3 Wörter),
   * z. B. "Sturz F1" – F1/T2/A3 entsprechen den Marken im Bauplan.
   */
  kurz: string;
}

/** Nachvollziehbare Kennwerte der Berechnung */
export interface Kennwerte {
  /** Bruttoquerschnitt Ac [cm²/m] bzw. [cm²] (siehe hauptEinheit) */
  ac: number;
  /** statische Nutzhöhe d [cm] (Platten, Träger) */
  nutzhoehe?: number;
  /** erforderliche Mindestbewehrung vertikal/Haupt/längs */
  asMinHaupt: number;
  /** erforderliche Mindestbewehrung horizontal/Quer */
  asMinQuer: number;
  /**
   * Bezeichnung der gewählten Hauptbewehrung – bei Flächenbauteilen die
   * Lagermatte ("Q257A"), bei Stäben die Stabwahl ("8 Ø16").
   */
  gewaehlteMatte: string;
  /** vorhandene Hauptbewehrung [cm²/m] bzw. [cm²] */
  asVorhanden: number;
  /** Nennmaß Betondeckung c_nom [mm] */
  cnom: number;
  /** maßgebende Bewehrungsfläche netto [m²] bzw. Betonvolumen-Bezugsgröße */
  flaecheNetto: number;
  /** Beschriftung der Hauptkennzahl, z. B. "As,min je Lage" */
  hauptLabel: string;
  /** Einheit der Hauptkennzahl, z. B. "cm²/m" */
  hauptEinheit: string;
  /** Beschriftung der gewählten Bewehrung, z. B. "Lagermatte" */
  wahlLabel: string;
  /** Beschriftung von flaecheNetto, z. B. "Bewehrungsfläche netto" */
  flaecheLabel: string;
}

/** Gesamtergebnis der Bewehrungsermittlung */
export interface Ergebnis {
  positionen: Position[];
  gesamtgewicht: number;
  mattenGewicht: number;
  stabstahlGewicht: number;
  kennwerte: Kennwerte;
  /** Fachliche Hinweise, z. B. wo statische Prüfung erforderlich ist */
  hinweise: string[];
}
