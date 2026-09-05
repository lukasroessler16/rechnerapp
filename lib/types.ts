/**
 * Zentrale Typdefinitionen des Bewehrungsrechners.
 *
 * Alle Längenangaben in Metern [m], sofern nicht anders angegeben.
 * Durchmesser in Millimetern [mm], Querschnitte in [cm²/m], Gewichte in [kg].
 */

/** Bauteiltyp: Wand oder Decke/Bodenplatte */
export type Bauteil = "wand" | "decke";

/** Öffnung (Fenster, Tür, Aussparung) in Wand oder Decke */
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

/** Grundmaße des Bauteils */
export interface Grundmasse {
  /** Länge (horizontal) [m] */
  laenge: number;
  /** Wandhöhe bzw. Deckenbreite [m] */
  hoehe: number;
  /** Bauteildicke [m] */
  dicke: number;
}

/** Anschlussdetail-Typen für die vier Bauteilränder */
export type AnschlussUnten = "bodenplatte" | "streifenfundament" | "decke_unter" | "frei";
export type AnschlussOben = "decke_ueber" | "wand_weiter" | "frei";
export type AnschlussSeite = "ecke" | "wandstoss" | "frei";

/** Anschlussdetails einer Wand (bei Decken: Auflagersituation der Ränder) */
export interface Anschluesse {
  unten: AnschlussUnten;
  oben: AnschlussOben;
  links: AnschlussSeite;
  rechts: AnschlussSeite;
}

/** Auflagersituation eines Deckenrandes */
export type DeckenRand = "wand_auflager" | "frei";
export interface DeckenRaender {
  links: DeckenRand;
  rechts: DeckenRand;
  oben: DeckenRand;
  unten: DeckenRand;
}

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
  bauteil: Bauteil;
  masse: Grundmasse;
  oeffnungen: Oeffnung[];
  anschluesse: Anschluesse;
  deckenRaender: DeckenRaender;
  parameter: Parameter;
  firmendaten: Firmendaten;
}

/* ------------------------------------------------------------------ */
/* Ergebnis-Typen                                                      */
/* ------------------------------------------------------------------ */

/** Biegeform eines Stabes (vereinfachte Formcodes, angelehnt an ÖNORM/BVBS) */
export type Biegeform =
  | "gerade" // gerader Stab
  | "winkel" // L-Form (ein Abbug 90°)
  | "buegel_u" // U-Form / Steckbügel (zwei Abbüge 90°)
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
}

/** Nachvollziehbare Kennwerte der Berechnung */
export interface Kennwerte {
  /** Bruttoquerschnitt Ac [cm²/m] */
  ac: number;
  /** statische Nutzhöhe d [cm] (Decke) */
  nutzhoehe?: number;
  /** erforderliche Mindestbewehrung vertikal/Haupt [cm²/m] je Seite */
  asMinHaupt: number;
  /** erforderliche Mindestbewehrung horizontal/Quer [cm²/m] je Seite */
  asMinQuer: number;
  /** gewählte Matte */
  gewaehlteMatte: string;
  /** vorhandene Bewehrung der Matte [cm²/m] */
  asVorhanden: number;
  /** Nennmaß Betondeckung c_nom [mm] */
  cnom: number;
  /** Bewehrungsfläche netto (abzügl. Öffnungen) [m²], je Lage */
  flaecheNetto: number;
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
