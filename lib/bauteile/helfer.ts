/**
 * Gemeinsame Bewehrungs- und Zeichenbausteine für alle Bauteilmodule.
 *
 * Hier liegt, was mehrere Bauteile gleich machen: Stabraster, Randeinfassung,
 * Anschluss- und Stoßeisen, Mattenwahl samt Mengenermittlung sowie die
 * Standard-Zeichnung eines rechteckigen Flächenbauteils mit Öffnungen.
 *
 * Fachliche Grundlage durchgehend EC2 / ÖNORM B 1992-1-1; alle Ansätze sind
 * Mindestbewehrung und anerkannte Konstruktionsregeln, KEINE Bemessung.
 */

import { Oeffnung, Projekt } from "../types";
import {
  LAGERMATTEN,
  Lagermatte,
  MATTEN_STOSS,
  VERSCHNITT_FAKTOR,
  matteWaehlen,
  stabflaeche,
  uebergreifung,
} from "../normdaten";
import { Ansicht, Kontext, Zeichenelement } from "./typen";

/* ------------------------------------------------------------------ */
/* Bewehrungsbausteine                                                 */
/* ------------------------------------------------------------------ */

/** Stückzahl von Stäben im Raster über eine Strecke (immer mindestens 2) */
export const stueckImRaster = (strecke: number, abstandMm: number) =>
  Math.max(2, Math.ceil(strecke / (abstandMm / 1000)) + 1);

/** lichter Steg eines U-Bügels bei gegebener Bauteildicke [m] */
export const stegBreite = (dicke: number, cnomMm: number) =>
  Math.max(0.05, dicke - (2 * cnomMm) / 1000);

/** Steckbügel (U-Form Ø8/25) entlang eines freien Randes */
export function randeinfassung(k: Kontext, strecke: number, wo: string, dicke: number) {
  const steg = stegBreite(dicke, k.cnom);
  k.s.stab(
    8,
    "buegel_u",
    [0.5, steg, 0.5],
    stueckImRaster(strecke, 250),
    `Randeinfassung ${wo} (Steckbügel Ø8/25)`,
    `Rand ${wo}`
  );
}

/** L-förmige Anschlusseisen entlang eines Randes (je Lage) */
export function anschlusseisen(k: Kontext, strecke: number, wo: string, kurz: string) {
  k.s.stab(
    10,
    "winkel",
    [0.8, 0.8],
    stueckImRaster(strecke, k.abst) * k.lagen,
    `Anschlussbewehrung ${wo} (Ø10/${k.abst / 10})`,
    kurz
  );
}

/** gerade Übergreifungseisen (Bauteil läuft weiter / Stoß) */
export function stossEisen(k: Kontext, strecke: number, wo: string, kurz: string) {
  k.s.stab(
    10,
    "gerade",
    [2 * uebergreifung(10)],
    stueckImRaster(strecke, k.abst) * k.lagen,
    `Übergreifungsstoß ${wo} (Ø10/${k.abst / 10})`,
    kurz
  );
}

/**
 * Wählt die Lagermatte und ermittelt die Stückzahl für eine Bewehrungsfläche.
 *
 * @param asErf   erforderliche Bewehrung je Richtung [cm²/m]
 * @param flaeche zu bewehrende Nettofläche je Lage [m²]
 */
export function flaechenbewehrung(
  k: Kontext,
  opts: { asErf: number; flaeche: number; verwendung: string; kurz: string }
): Lagermatte | null {
  const vorgabe = k.projekt.parameter.matte;
  const matte =
    vorgabe === "auto"
      ? matteWaehlen(opts.asErf)
      : LAGERMATTEN.find((m) => m.name === vorgabe) ?? matteWaehlen(opts.asErf);

  if (!matte) {
    k.hinweise.push(
      "⚠ Erforderliche Bewehrung übersteigt das Lagermatten-Programm – Stabstahlbewehrung durch Statiker festlegen."
    );
    return null;
  }
  if (matte.as < opts.asErf)
    k.hinweise.push(
      `⚠ Gewählte Matte ${matte.name} (${matte.as} cm²/m) liegt unter der Mindestbewehrung von ${opts.asErf.toFixed(
        2
      )} cm²/m – Auswahl prüfen!`
    );

  // Nutzbare Mattenfläche: Liefermaß abzüglich Übergreifungsstoß
  const effektiv = (matte.laenge - MATTEN_STOSS) * (matte.breite - MATTEN_STOSS);
  const bedarf = opts.flaeche * k.lagen * VERSCHNITT_FAKTOR;
  const anzahl = Math.max(1, Math.ceil(bedarf / effektiv));
  k.s.matte(
    matte.name,
    matte.laenge,
    matte.breite,
    anzahl,
    matte.gewicht,
    opts.verwendung,
    opts.kurz
  );
  return matte;
}

/* ------------------------------------------------------------------ */
/* Geometrie von Stabbauteilen (Stütze, Träger, Fundamentbalken)       */
/* ------------------------------------------------------------------ */

/**
 * n gleichmäßig verteilte Achspositionen zwischen a und b (jeweils inklusive).
 * Bei n = 1 liegt der Stab in der Mitte.
 */
export function verteile(a: number, b: number, n: number): number[] {
  if (n <= 1) return [(a + b) / 2];
  const d = (b - a) / (n - 1);
  return Array.from({ length: n }, (_, i) => a + i * d);
}

/**
 * Auf ein Raster abrunden, mindestens auf den Rasterwert selbst.
 * Für baustellentaugliche Bügelabstände (5-cm-Werte statt 22,5 cm).
 */
export const abrunden = (wert: number, raster: number) =>
  Math.max(raster, Math.floor(wert / raster) * raster);

/**
 * Höhenlagen bzw. Achspositionen von Bügeln entlang eines Stabbauteils:
 * an beiden Enden verdichtet (Abstand sv über die Länge lv), dazwischen im
 * Regelabstand s. Liefert die Positionen von der ersten bis zur letzten Lage.
 *
 * @param laenge Gesamtlänge des Bauteils [m]
 * @param c      Randabstand der ersten/letzten Lage [m]
 */
export function buegelLagen(
  laenge: number,
  c: number,
  s: number,
  sv: number,
  lv: number
): number[] {
  const lagen: number[] = [];
  const ende = laenge - c;
  const grenzeA = Math.min(lv, laenge / 2);
  const grenzeE = Math.max(laenge - lv, laenge / 2);
  for (let x = c; x <= grenzeA + 1e-6 && lagen.length < 400; x += sv) lagen.push(x);
  for (let x = grenzeA + s; x < grenzeE - 1e-6 && lagen.length < 400; x += s) lagen.push(x);
  for (let x = grenzeE; x <= ende + 1e-6 && lagen.length < 400; x += sv) lagen.push(x);
  if (lagen.length === 0) lagen.push(laenge / 2);
  return lagen;
}

/* ------------------------------------------------------------------ */
/* Fundamente: Betondeckung und Stabraster                             */
/* ------------------------------------------------------------------ */

/**
 * Mindestbetondeckung von Fundamenten nach EC2 4.4.1.3(4) [mm].
 * Gilt an der Sohle und an den Seitenflächen und überschreibt den aus der
 * Expositionsklasse ermittelten Wert, wenn sie größer ist.
 */
export const C_MIN_UNTERGRUND: Record<string, number> = {
  sauberkeitsschicht: 40,
  erdreich: 75,
};

/**
 * Konstruktive Bewehrung gedrungener Fundamente [cm²/m].
 * Entspricht etwa Ø8/25 und deckt Zwang, Schwinden und die Transportlasten
 * des Bewehrungskorbs ab. Ein biegesteifes Fundament (Kragarm ≤ Höhe) trägt
 * den Sohldruck über Druckstreben ab und braucht nach EC2 12 keine
 * Biege-Mindestbewehrung.
 */
export const AS_KONSTRUKTIV_FUNDAMENT = 2.0;

export interface Fundamentdeckung {
  /** Betondeckung an Sohle und Seitenflächen [m] */
  cU: number;
  /** Betondeckung an der Oberseite [m] */
  cO: number;
  /** Sohldeckung in Millimetern (für Beschriftungen) */
  cUmm: number;
  /** Hinweis, falls die Deckung gegenüber der Expositionsklasse angehoben wurde */
  hinweis?: string;
}

/** Ermittelt die Betondeckung eines Fundaments aus Untergrund und Parametern */
export function fundamentDeckung(projekt: Projekt): Fundamentdeckung {
  const cnom = projekt.parameter.betondeckung; // [mm]
  const untergrund = projekt.details.untergrund;
  const cMin = C_MIN_UNTERGRUND[untergrund] ?? 40;
  const cUmm = Math.max(cnom, cMin);
  return {
    cU: cUmm / 1000,
    cO: cnom / 1000,
    cUmm,
    hinweis:
      cUmm > cnom
        ? `Betondeckung an Sohle und Seitenflächen auf ${cUmm} mm erhöht: Beim Betonieren ${
            untergrund === "erdreich"
              ? "unmittelbar gegen Erdreich"
              : "gegen eine Sauberkeitsschicht"
          } fordert EC2 4.4.1.3(4) mindestens ${cMin} mm – der Wert aus der Expositionsklasse (${cnom} mm) reicht dafür nicht.`
        : undefined,
  };
}

export interface Stabraster {
  /** Stabdurchmesser [mm] */
  ds: number;
  /** Achsabstand [m] */
  s: number;
  /** vorhandene Bewehrung [cm²/m] */
  as: number;
}

/**
 * Wählt die wirtschaftlichste Kombination aus Stabdurchmesser und Abstand,
 * die die geforderte Bewehrung [cm²/m] abdeckt. Reicht keine Kombination,
 * wird die stärkste geliefert – der Aufrufer meldet das als Warnung.
 */
export function stabRaster(
  asErf: number,
  durchmesser: number[],
  abstaendeCm: number[]
): Stabraster {
  const kombis = durchmesser
    .flatMap((ds) => abstaendeCm.map((sCm) => ({ ds, sCm, as: (stabflaeche(ds) * 100) / sCm })))
    .sort((a, b) => a.as - b.as);
  const wahl = kombis.find((k) => k.as >= asErf) ?? kombis[kombis.length - 1];
  return { ds: wahl.ds, s: wahl.sCm / 100, as: Math.round(wahl.as * 100) / 100 };
}

/** Stückzahl in einem gleichmäßigen Raster über eine Strecke (mindestens 2) */
export const imRaster = (strecke: number, abstand: number) =>
  Math.max(2, Math.floor(strecke / abstand) + 1);

/* ------------------------------------------------------------------ */
/* Vereinfachte Biegebemessung (nur für Bauteile mit bekannter Last)   */
/* ------------------------------------------------------------------ */

/** Bemessungswert der Stahlspannung f_yd = f_yk / 1,15 [kN/cm²] */
export const fydVon = (fyk: number) => fyk / 1.15 / 10;
/** Teilsicherheitsbeiwert Beton */
const GAMMA_C = 1.5;
/** bezogenes Moment, ab dem ohne Druckbewehrung nicht mehr bemessen wird */
const MU_GRENZE = 0.296;

export interface Bemessung {
  /** statische Nutzhöhe [m] */
  d: number;
  /** innerer Hebelarm [m] */
  z: number;
  /** bezogenes Moment */
  mu: number;
  /** erforderliche Bewehrung [cm²/m] */
  asErf: number;
  /** Druckzone überlastet – Querschnitt zu klein */
  ueberlastet: boolean;
}

/**
 * Biegebemessung eines Rechteckquerschnitts je laufendem Meter, ohne
 * Druckbewehrung. Bewusst das übliche Handverfahren: bezogenes Moment µ,
 * daraus die Druckzonenhöhe und der innere Hebelarm.
 *
 * Nur dort verwenden, wo die Einwirkung tatsächlich bekannt ist (Erddruck
 * einer Stützmauer). Für Bauteile mit unbekannter Last bleibt es bei der
 * Mindestbewehrung – eine Bemessung mit geratenen Lasten wäre wertlos.
 *
 * @param mEd  Bemessungsmoment [kNm je m Bauteilbreite]
 * @param h    Bauteildicke [m]
 * @param c    Betondeckung auf der Zugseite [m]
 * @param ds   angenommener Stabdurchmesser [mm]
 * @param fck  Betondruckfestigkeit [N/mm²]
 * @param fyk  Streckgrenze des Betonstahls [N/mm²] (regelwerksabhängig)
 */
export function biegebemessung(
  mEd: number,
  h: number,
  c: number,
  ds: number,
  fck: number,
  fyk: number
): Bemessung {
  const d = Math.max(0.02, h - c - ds / 2000);
  const fcd = fck / GAMMA_C; // [N/mm²]
  // µ = M / (b · d² · fcd), alles in N und mm, b = 1000 mm
  const mu = (mEd * 1e6) / (1000 * Math.pow(d * 1000, 2) * fcd);
  const ueberlastet = mu > MU_GRENZE;
  const begrenzt = Math.min(mu, MU_GRENZE);
  // Druckzonenhöhe ξ = x/d und Hebelarm z = d · (1 − 0,4 ξ), gedeckelt auf 0,95 d
  const xi = 1.25 * (1 - Math.sqrt(Math.max(0, 1 - 2 * begrenzt)));
  const z = Math.min(0.95 * d, d * (1 - 0.4 * xi));
  // As = M / (z · f_yd), M in kNcm, z in cm
  const asErf = (mEd * 100) / (z * 100 * fydVon(fyk));
  return { d, z, mu, asErf: Math.round(asErf * 100) / 100, ueberlastet };
}

/* ------------------------------------------------------------------ */
/* Zeichenbausteine                                                    */
/* ------------------------------------------------------------------ */

/** Zahl im Planformat, z. B. 2,46 */
export const zahl = (m: number) => m.toFixed(2).replace(".", ",");

/** Planmarke einer Öffnung: F = Fenster, T = Tür, A = Aussparung */
export function oeffnungsMarke(o: Oeffnung, index: number): string {
  return (o.typ === "fenster" ? "F" : o.typ === "tuer" ? "T" : "A") + (index + 1);
}

/** Zeichenelemente einer Öffnung (Umriss, Kreuz bzw. Türanschlag, Marke) */
export function oeffnungsElemente(o: Oeffnung, index: number): Zeichenelement[] {
  const marke = oeffnungsMarke(o, index);
  const e: Zeichenelement[] = [
    { art: "flaeche", x: o.x, y: o.y, b: o.breite, h: o.hoehe, ton: "weiss" },
    { art: "rahmen", x: o.x, y: o.y, b: o.breite, h: o.hoehe, stil: "duenn" },
  ];
  if (o.typ === "tuer") {
    // Türanschlag als Viertelkreis (Polylinie, damit beide Renderer ihn können)
    const n = 8;
    const punkte: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const w = (Math.PI / 2) * (i / n);
      punkte.push([o.x + o.breite * Math.sin(w), o.y + o.breite * (1 - Math.cos(w))]);
    }
    e.push({ art: "polylinie", punkte, stil: "strich" });
  } else {
    e.push({ art: "linie", x1: o.x, y1: o.y, x2: o.x + o.breite, y2: o.y + o.hoehe, stil: "hilfslinie" });
    e.push({ art: "linie", x1: o.x + o.breite, y1: o.y, x2: o.x, y2: o.y + o.hoehe, stil: "hilfslinie" });
  }
  e.push({
    art: "text",
    x: o.x + o.breite / 2,
    y: o.y + o.hoehe / 2,
    text: marke,
    rolle: "marke",
    ausrichtung: "mitte",
  });
  return e;
}

/**
 * Standard-Ansicht eines rechteckigen Flächenbauteils (Wand, Platte):
 * Betonfläche, Öffnungen, Maßketten über alle Öffnungsränder.
 */
export function flaechenAnsicht(
  projekt: Projekt,
  opts: { id: string; titel: string; fuss?: string; mitOeffnungen?: boolean }
): Ansicht {
  const laenge = projekt.masse.laenge;
  const hoehe = projekt.masse.hoehe;
  const oeffnungen = opts.mitOeffnungen === false ? [] : projekt.oeffnungen;

  const elemente: Zeichenelement[] = [
    { art: "flaeche", x: 0, y: 0, b: laenge, h: hoehe, ton: "beton" },
    { art: "rahmen", x: 0, y: 0, b: laenge, h: hoehe, stil: "kante" },
  ];
  oeffnungen.forEach((o, i) => elemente.push(...oeffnungsElemente(o, i)));

  return {
    id: opts.id,
    titel: opts.titel,
    breite: laenge,
    hoehe,
    elemente,
    massketteX: [0, laenge, ...oeffnungen.flatMap((o) => [o.x, o.x + o.breite])],
    massketteY: [0, hoehe, ...oeffnungen.flatMap((o) => [o.y, o.y + o.hoehe])],
    fuss: opts.fuss,
  };
}
