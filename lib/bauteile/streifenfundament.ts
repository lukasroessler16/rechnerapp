/**
 * Bauteil: Streifenfundament unter einer aufgehenden Wand.
 *
 * Fachliche Grundlage (EC2 / ÖNORM B 1992-1-1):
 *
 *  Betondeckung (EC2 4.4.1.3(4))
 *   – gegen eine Sauberkeitsschicht betoniert:  c_min ≥ 40 mm
 *   – unmittelbar gegen Erdreich betoniert:     c_min ≥ 75 mm
 *     Diese Werte gelten unten und an den Seitenflächen und überschreiben
 *     die aus der Expositionsklasse ermittelte Deckung, wenn sie größer sind.
 *
 *  Querbewehrung unten – zwei Fälle, die sich fachlich deutlich unterscheiden:
 *   – Kragarm ≤ Fundamenthöhe: gedrungenes, biegesteifes Fundament. Die
 *     Momente aus dem Sohldruck bleiben klein; nach EC2 12 darf ein solches
 *     Fundament sogar unbewehrt ausgeführt werden. Angesetzt wird deshalb
 *     nur eine konstruktive Querbewehrung (2,0 cm²/m) – die Biege-
 *     Mindestbewehrung einer Platte wäre hier deutlich überzogen.
 *   – Kragarm > Fundamenthöhe: der Kragarm wirkt als Platte. Dann gilt
 *     As,min = max(0,26 · fctm/fyk · b · d ; 0,0013 · b · d) (EC2 9.2.1.1),
 *     und die tatsächliche Bewehrung folgt aus dem Sohldruck.
 *   – Längsbewehrung ≥ 20 % der Querbewehrung (EC2 9.3.1.1)
 *
 *  Bewehrungskorb (EC2 9.2.2, sinngemäß)
 *   – der Untergurt des geschlossenen Bügels IST die Querbewehrung; der
 *     Bügelabstand wird deshalb aus der erforderlichen Querbewehrung
 *     ermittelt und nicht getrennt davon.
 *
 * NICHT enthalten: Sohlspannungen, Grundbruch- und Setzungsnachweis,
 * Biegebemessung des Kragarms aus dem tatsächlichen Sohldruck, Frosttiefe.
 * Ohne Bodengutachten ist keine dieser Größen bestimmbar; das Ergebnis
 * enthält dazu ausdrückliche Hinweise.
 */

import { Kennwerte, Projekt, Pruefmeldung } from "../types";
import { BETONKLASSEN, FYK, stabflaeche, uebergreifung } from "../normdaten";
import { Ansicht, Bauteilmodul, Kontext, Zeichenelement } from "./typen";
import {
  AS_KONSTRUKTIV_FUNDAMENT,
  C_MIN_UNTERGRUND,
  fundamentDeckung,
  imRaster,
  stabRaster,
  verteile,
  zahl,
} from "./helfer";

/** Durchmesser der Querstäbe bzw. Bügel [mm] */
const QUER_DURCHMESSER = [10, 12, 14, 16];
const BUEGEL_DURCHMESSER = [8, 10, 12, 14];
/** Durchmesser der Längsbewehrung [mm] */
const LAENGS_DURCHMESSER = [10, 12, 14, 16];
/** wählbare Stababstände [cm] */
const ABSTAENDE = [25, 20, 15, 12.5, 10];
/** größter Achsabstand der Längsstäbe über die Fundamentbreite [m] */
const MAX_LAENGS_ABSTAND = 0.3;
/** Lieferlänge von Stabstahl [m] – längere Stäbe müssen gestoßen werden */
const LIEFERLAENGE = 12;
/** Höhe der Aufbiegung an den Enden der Querstäbe [m] */
const AUFBIEGUNG_MAX = 0.2;

/* ------------------------------------------------------------------ */
/* Bewehrungslayout                                                    */
/* ------------------------------------------------------------------ */

export interface FundamentLayout {
  /** Fundamentlänge, -breite und -höhe [m] */
  l: number;
  b: number;
  h: number;
  /** Dicke der aufgehenden Wand [m] */
  wand: number;
  /** Kragarmlänge je Seite [m] */
  krag: number;
  /** Betondeckung unten/seitlich bzw. oben [m] */
  cU: number;
  cO: number;
  /** statische Nutzhöhe [cm] */
  d: number;
  /** geschlossener Bewehrungskorb statt nur unterer Lage? */
  korb: boolean;
  /** Kragarm länger als die Fundamenthöhe → Biegung maßgebend */
  biegebeansprucht: boolean;
  /** Biege-Mindestbewehrung nach EC2 9.2.1.1 [cm²/m], auch wenn nicht maßgebend */
  asBiegung: number;
  /** Querbewehrung: Durchmesser [mm], Abstand [m], Stückzahl, vorhandene Fläche */
  dsQ: number;
  sQ: number;
  nQ: number;
  asQuerVorh: number;
  asQuerMin: number;
  /** Achspositionen der Querstäbe/Bügel entlang der Länge [m] */
  querX: number[];
  /** Innenmaße Bügel bzw. Länge des Querstabs und Aufbiegung [m] */
  querB: number;
  querH: number;
  aufbiegung: number;
  /** Längsbewehrung: Durchmesser [mm], Anzahl je Lage, Stücklänge, Teile je Stab */
  dsL: number;
  nL: number;
  laengsLaenge: number;
  teile: number;
  asLaengsVorh: number;
  asLaengsMin: number;
  /** Querschnittsfläche [cm²] */
  ac: number;
  warnungen: string[];
}

/**
 * Ermittelt Deckung, Stabwahl und Abstände. Reine Funktion – Skizze,
 * Bauplan und Stückliste zeigen dadurch garantiert dasselbe Bild.
 */
export function fundamentLayout(projekt: Projekt): FundamentLayout {
  const l = projekt.masse.laenge;
  const b = projekt.masse.breite;
  const h = projekt.masse.hoehe;
  const wand = projekt.masse.wanddicke;
  const korb = projekt.details.bewehrung === "korb";
  const warnungen: string[] = [];
  const beton =
    BETONKLASSEN.find((x) => x.name === projekt.parameter.betonklasse) ?? BETONKLASSEN[1];

  /* ---- Betondeckung: unten/seitlich gilt die Fundament-Mindestdeckung ---- */
  const deckung = fundamentDeckung(projekt);
  const cU = deckung.cU;
  const cO = deckung.cO;
  if (deckung.hinweis) warnungen.push(deckung.hinweis);

  const krag = Math.max(0, (b - wand) / 2);
  const ac = b * h * 10000; // [cm²]

  /* ---- Querbewehrung unten (Kragarm wirkt wie eine Platte) ---- */
  const durchmesser = korb ? BUEGEL_DURCHMESSER : QUER_DURCHMESSER;
  // Nutzhöhe mit einem mittleren Durchmesser vorschätzen und danach schärfen
  let dsQ = durchmesser[0];
  let sQ = ABSTAENDE[0] / 100;
  let d = 0;
  let asQuerMin = 0;
  let asQuerVorh = 0;

  // Gedrungene Fundamente (Kragarm ≤ Höhe) tragen den Sohldruck über
  // Druckstreben ab; nur der schlanke Kragarm wirkt als Platte.
  const biegebeansprucht = krag > h;
  let asBiegung = 0;

  for (let runde = 0; runde < 3; runde++) {
    d = (h - cU) * 100 - dsQ / 20; // [cm]
    asBiegung = Math.max((0.26 * beton.fctm * 100 * d) / FYK, 0.0013 * 100 * d);
    asQuerMin = biegebeansprucht ? asBiegung : AS_KONSTRUKTIV_FUNDAMENT;

    // wirtschaftlichste Kombination aus Durchmesser und Abstand
    const wahl = stabRaster(asQuerMin, durchmesser, ABSTAENDE);
    if (wahl.ds === dsQ && runde > 0) break;
    dsQ = wahl.ds;
    sQ = wahl.s;
    asQuerVorh = wahl.as;
  }
  if (asQuerVorh < asQuerMin)
    warnungen.push(
      "⚠ Die erforderliche Querbewehrung ist mit den üblichen Stabdurchmessern nicht abzudecken – Fundamentquerschnitt vergrößern oder Bewehrung statisch festlegen."
    );

  const querX = (() => {
    const rand = cU + dsQ / 2000;
    const strecke = Math.max(0, l - 2 * rand);
    const anzahl = imRaster(strecke, sQ);
    return verteile(rand, l - rand, anzahl);
  })();
  const nQ = querX.length;

  // Maße des Querstabs bzw. Bügels
  const querB = Math.max(0.05, b - 2 * cU - dsQ / 1000);
  const querH = Math.max(0.05, h - cU - cO - dsQ / 1000);
  const aufbiegung = korb ? querH : Math.max(0.1, Math.min(AUFBIEGUNG_MAX, querH));

  /* ---- Längsbewehrung (≥ 20 % der Querbewehrung, EC2 9.3.1.1) ---- */
  const asLaengsMin = 0.2 * asQuerVorh * b; // [cm²] über die ganze Breite
  const kernB = Math.max(0.05, b - 2 * cU - 2 * (dsQ / 1000));
  const nAusAbstand = Math.max(2, Math.ceil(kernB / MAX_LAENGS_ABSTAND) + 1);
  const wahlL =
    LAENGS_DURCHMESSER.map((ds) => ({
      ds,
      n: Math.max(4, nAusAbstand, Math.ceil(asLaengsMin / stabflaeche(ds))),
    })).find((k) => k.n <= 8) ??
    { ds: LAENGS_DURCHMESSER[LAENGS_DURCHMESSER.length - 1], n: 8 };
  const dsL = wahlL.ds;
  const nL = wahlL.n;
  const asLaengsVorh = nL * stabflaeche(dsL);

  // Stäbe über Lieferlänge müssen gestoßen werden
  const netto = Math.max(0.3, l - 2 * cU);
  const teile = Math.max(1, Math.ceil(netto / LIEFERLAENGE));
  const laengsLaenge =
    teile === 1 ? netto : Math.min(LIEFERLAENGE, netto / teile + uebergreifung(dsL));

  return {
    l, b, h, wand, krag, cU, cO,
    d: Math.round(d * 10) / 10,
    korb,
    biegebeansprucht,
    asBiegung: Math.round(asBiegung * 100) / 100,
    dsQ,
    sQ,
    nQ,
    asQuerVorh: Math.round(asQuerVorh * 100) / 100,
    asQuerMin: Math.round(asQuerMin * 100) / 100,
    querX,
    querB,
    querH,
    aufbiegung,
    dsL,
    nL,
    laengsLaenge,
    teile,
    asLaengsVorh: Math.round(asLaengsVorh * 100) / 100,
    asLaengsMin: Math.round(asLaengsMin * 100) / 100,
    ac,
    warnungen,
  };
}

/* ------------------------------------------------------------------ */
/* Klartexte                                                           */
/* ------------------------------------------------------------------ */

const UNTERGRUND_NAME: Record<string, string> = {
  sauberkeitsschicht: "Sauberkeitsschicht (c ≥ 40 mm)",
  erdreich: "gegen Erdreich betoniert (c ≥ 75 mm)",
};

const WAND_NAME: Record<string, string> = {
  stahlbeton: "Stahlbetonwand darüber",
  mauerwerk: "Mauerwerk darüber",
  keine: "ohne aufgehende Wand",
};

/* ------------------------------------------------------------------ */
/* Das Modul                                                           */
/* ------------------------------------------------------------------ */

export const streifenfundament: Bauteilmodul = {
  id: "streifenfundament",
  name: "Streifenfundament",
  beschreibung: "Fundamentstreifen unter einer durchgehenden Wand",
  bildId: "icon_streifenfundament",
  hatOeffnungen: false,
  flaechenbewehrt: false,
  detailTitel: "Untergrund und Aufbau",
  detailHilfe:
    "Wie wird betoniert und was steht darauf? Der Untergrund bestimmt die Mindestbetondeckung nach EC2 4.4.1.3, die Bewehrungsart die Form des Bewehrungskorbs.",
  planinhalt: "Bewehrungsplan Streifenfundament (Längs- und Querschnitt)",

  masse: [
    {
      schluessel: "laenge",
      label: "Fundamentlänge",
      einheit: "m",
      min: 0.5,
      max: 100,
      standard: 10.0,
    },
    {
      schluessel: "breite",
      label: "Fundamentbreite b",
      einheit: "cm",
      min: 0.2,
      max: 3.0,
      schritt: 5,
      standard: 0.6,
      hinweis: "üblich: 50–90 cm",
    },
    {
      schluessel: "hoehe",
      label: "Fundamenthöhe h",
      einheit: "cm",
      min: 0.15,
      max: 2.0,
      schritt: 5,
      standard: 0.4,
      hinweis: "üblich: 30–60 cm",
    },
    {
      schluessel: "wanddicke",
      label: "Dicke der Wand darüber",
      einheit: "cm",
      min: 0.05,
      max: 2.0,
      schritt: 5,
      standard: 0.25,
      hinweis: "bestimmt den Kragarm",
    },
  ],

  details: [
    {
      schluessel: "untergrund",
      label: "Betonieren gegen",
      standard: "sauberkeitsschicht",
      optionen: [
        {
          wert: "sauberkeitsschicht",
          titel: "Sauberkeitsschicht (Magerbeton)",
          bildId: "streifenfundament",
        },
        { wert: "erdreich", titel: "unmittelbar gegen Erdreich", bildId: "bodenplatte" },
      ],
    },
    {
      schluessel: "bewehrung",
      label: "Bewehrungsart",
      standard: "unten",
      optionen: [
        { wert: "unten", titel: "untere Lage mit aufgebogenen Enden", bildId: "auflager" },
        { wert: "korb", titel: "geschlossener Bewehrungskorb (Bügel)", bildId: "wandstoss" },
      ],
    },
    {
      schluessel: "wandanschluss",
      label: "Aufgehendes Bauteil",
      standard: "stahlbeton",
      optionen: [
        { wert: "stahlbeton", titel: "Stahlbetonwand", bildId: "decke_ueber" },
        { wert: "mauerwerk", titel: "Mauerwerk", bildId: "wand_weiter" },
        { wert: "keine", titel: "keines / später", bildId: "freier_rand" },
      ],
    },
  ],

  masseText: (p) =>
    `Streifenfundament ${Math.round(p.masse.breite * 100)}/${Math.round(
      p.masse.hoehe * 100
    )} cm · L = ${zahl(p.masse.laenge)} m`,

  /* ---------------- Zeichnung ---------------- */

  zeichnung(projekt: Projekt): Ansicht[] {
    const f = fundamentLayout(projekt);

    /* --- Längsansicht --- */
    const laengs: Zeichenelement[] = [
      { art: "flaeche", x: 0, y: 0, b: f.l, h: f.h, ton: "beton" },
      { art: "rahmen", x: 0, y: 0, b: f.l, h: f.h, stil: "kante" },
      // untere Längsbewehrung
      { art: "linie", x1: f.cU, y1: f.cU, x2: f.l - f.cU, y2: f.cU, stil: "stahl" },
    ];
    if (f.korb)
      laengs.push({
        art: "linie",
        x1: f.cU,
        y1: f.h - f.cO,
        x2: f.l - f.cU,
        y2: f.h - f.cO,
        stil: "stahl",
      });
    // Querstäbe bzw. Bügel in ihrer tatsächlichen Lage
    for (const x of f.querX)
      laengs.push({
        art: "linie",
        x1: x,
        y1: f.cU,
        x2: x,
        y2: f.korb ? f.h - f.cO : f.cU + f.aufbiegung,
        stil: "stahl",
      });

    const ansichtLaengs: Ansicht = {
      id: "laengsansicht",
      titel: "Längsansicht",
      breite: f.l,
      hoehe: f.h,
      elemente: laengs,
      massketteX: [0, f.l],
      massketteY: [0, f.h],
      randtexte: [
        { seite: "unten", text: UNTERGRUND_NAME[projekt.details.untergrund] ?? "" },
        { seite: "oben", text: WAND_NAME[projekt.details.wandanschluss] ?? "" },
      ],
      fuss: `${f.korb ? "Bügel" : "Querstäbe"} Ø${f.dsQ}/${Math.round(
        f.sQ * 100
      )} · Längs ${f.nL} Ø${f.dsL}`,
    };

    /* --- Querschnitt --- */
    const stumpf = Math.min(0.4, Math.max(0.25, f.h * 0.7)); // angedeutete Wand
    const quer: Zeichenelement[] = [
      { art: "flaeche", x: 0, y: 0, b: f.b, h: f.h, ton: "beton" },
      { art: "rahmen", x: 0, y: 0, b: f.b, h: f.h, stil: "kante" },
    ];
    // aufgehende Wand nur andeuten (gestrichelt, gehört nicht zum Bauteil)
    if (projekt.details.wandanschluss !== "keine" && f.wand > 0)
      quer.push({
        art: "rahmen",
        x: f.krag,
        y: f.h,
        b: f.wand,
        h: stumpf,
        stil: "strich",
      });

    // Querbewehrung: U-Form bzw. geschlossener Bügel
    const xa = f.cU + f.dsQ / 2000;
    const xe = f.b - f.cU - f.dsQ / 2000;
    const yu = f.cU + f.dsQ / 2000;
    const yo = f.h - f.cO - f.dsQ / 2000;
    quer.push(
      f.korb
        ? {
            art: "polylinie",
            geschlossen: true,
            stil: "stahl",
            punkte: [
              [xa, yu],
              [xe, yu],
              [xe, yo],
              [xa, yo],
            ],
          }
        : {
            art: "polylinie",
            stil: "stahl",
            punkte: [
              [xa, yu + f.aufbiegung],
              [xa, yu],
              [xe, yu],
              [xe, yu + f.aufbiegung],
            ],
          }
    );
    // Längsstäbe unten (und oben beim Korb)
    for (const x of verteile(xa, xe, f.nL))
      quer.push({ art: "kreis", x, y: yu, r: f.dsL / 2000, ton: "stahl" });
    if (f.korb)
      for (const x of verteile(xa, xe, f.nL))
        quer.push({ art: "kreis", x, y: yo, r: f.dsL / 2000, ton: "stahl" });

    const ansichtQuer: Ansicht = {
      id: "querschnitt",
      titel: "Querschnitt A–A",
      breite: f.b,
      hoehe: f.h + (projekt.details.wandanschluss !== "keine" ? stumpf : 0),
      elemente: quer,
      // Maßkette zeigt die beiden Kragarme und die Wanddicke
      massketteX:
        f.krag > 0.01 ? [0, f.krag, f.krag + f.wand, f.b] : [0, f.b],
      massketteY: [0, f.h],
      eigenerMassstab: true,
      fuss: `c_nom unten ${Math.round(f.cU * 1000)} mm · oben ${Math.round(f.cO * 1000)} mm`,
    };

    return [ansichtLaengs, ansichtQuer];
  },

  /* ---------------- Bewehrung ---------------- */

  bewehrung(k: Kontext): Kennwerte {
    const projekt = k.projekt;
    const f = fundamentLayout(projekt);
    for (const w of f.warnungen) k.hinweise.push(w);

    /* ---- 1) Querbewehrung: U-Stäbe bzw. geschlossene Bügel ---- */
    if (f.korb) {
      const haken = (2 * 10 * f.dsQ) / 1000;
      k.s.stab(
        f.dsQ,
        "buegel_rechteck",
        [f.querB, f.querH, f.querB, f.querH, haken],
        f.nQ,
        `Bügel Ø${f.dsQ}/${Math.round(f.sQ * 100)} cm (Untergurt = Querbewehrung)`,
        "Bügel"
      );
    } else {
      k.s.stab(
        f.dsQ,
        "buegel_u",
        [f.aufbiegung, f.querB, f.aufbiegung],
        f.nQ,
        `Querbewehrung unten Ø${f.dsQ}/${Math.round(f.sQ * 100)} cm, Enden aufgebogen`,
        "Quer unten"
      );
    }

    /* ---- 2) Längsbewehrung ---- */
    k.s.stab(
      f.dsL,
      "gerade",
      [f.laengsLaenge],
      f.nL * f.teile,
      `Längsbewehrung unten (${f.nL} Ø${f.dsL}${f.teile > 1 ? `, ${f.teile}-teilig gestoßen` : ""})`,
      "Längs unten"
    );
    if (f.korb)
      k.s.stab(
        f.dsL,
        "gerade",
        [f.laengsLaenge],
        f.nL * f.teile,
        `Längsbewehrung oben (${f.nL} Ø${f.dsL}${f.teile > 1 ? `, ${f.teile}-teilig gestoßen` : ""})`,
        "Längs oben"
      );
    if (f.teile > 1)
      k.hinweise.push(
        `Die Längsstäbe sind länger als die Lieferlänge von ${LIEFERLAENGE} m und deshalb ${f.teile}-teilig mit Übergreifungsstoß (ls ≈ ${zahl(
          uebergreifung(f.dsL)
        )} m) aufgeführt. Stöße versetzt anordnen.`
      );

    /* ---- 3) Anschluss der aufgehenden Wand ---- */
    // Bewusst OHNE eigene Position: Die Steckeisen der aufgehenden Wand
    // gehören zum Bauteil „Wand" und sind dort als Anschlussbewehrung
    // bereits enthalten – sonst würde derselbe Stahl doppelt bestellt.
    if (projekt.details.wandanschluss === "stahlbeton")
      k.hinweise.push(
        "Die Anschlusseisen der aufgehenden Stahlbetonwand sind Teil des Bauteils „Wand“ (dort: Anschlussbewehrung Streifenfundament) und in dieser Liste bewusst nicht enthalten, damit sie nicht doppelt bestellt werden."
      );
    if (projekt.details.wandanschluss === "mauerwerk")
      k.hinweise.push(
        "Unter Mauerwerk sind keine Anschlusseisen erforderlich. Auf eine waagrechte Feuchtigkeitsabdichtung zwischen Fundament und Mauerwerk achten."
      );

    /* ---- 4) Fachliche Hinweise ---- */
    k.hinweise.push(
      "⚠ Streifenfundament: Enthalten ist die konstruktive Mindestbewehrung. Sohlspannung, Grundbruch- und Setzungsnachweis sowie die Biegebemessung des Kragarms aus dem tatsächlichen Sohldruck sind auf Basis eines Bodengutachtens statisch nachzuweisen (EC7/ÖNORM B 1997)."
    );
    k.hinweise.push(
      "⚠ Gründungstiefe: Außenfundamente sind frostfrei zu gründen (in Österreich üblicherweise mindestens 80–100 cm unter Geländeoberkante, regional auch tiefer)."
    );
    if (f.biegebeansprucht)
      k.hinweise.push(
        `⚠ Kragarm ${Math.round(f.krag * 100)} cm > Fundamenthöhe ${Math.round(
          f.h * 100
        )} cm: Das Fundament wirkt biegeweich, die Querbewehrung wird lastabhängig maßgebend. Angesetzt ist die Biege-Mindestbewehrung von ${zahl(
          f.asBiegung
        )} cm²/m nach EC2 9.2.1.1; sie genügt hier in der Regel NICHT – der Kragarm ist auf den tatsächlichen Sohldruck zu bemessen.`
      );
    else
      k.hinweise.push(
        `Kragarm ${Math.round(f.krag * 100)} cm ≤ Fundamenthöhe ${Math.round(
          f.h * 100
        )} cm: gedrungenes, biegesteifes Fundament. Der Sohldruck wird über Druckstreben abgetragen, eine Biege-Mindestbewehrung ist nach EC2 12 nicht erforderlich – angesetzt ist die konstruktive Querbewehrung von ${zahl(
          AS_KONSTRUKTIV_FUNDAMENT
        )} cm²/m (die Biege-Mindestbewehrung einer Platte läge bei ${zahl(
          f.asBiegung
        )} cm²/m).`
      );
    if (f.h < 0.3)
      k.hinweise.push(
        "⚠ Fundamenthöhe unter 30 cm: Bewehrte Streifenfundamente werden üblicherweise mindestens 30 cm hoch ausgeführt, damit Verankerung und Betondeckung einbaubar bleiben."
      );

    return {
      ac: Math.round(f.ac),
      nutzhoehe: f.d,
      asMinHaupt: f.asQuerMin,
      asMinQuer: f.asLaengsMin,
      gewaehlteMatte: `Ø${f.dsQ}/${Math.round(f.sQ * 100)} cm`,
      asVorhanden: f.asQuerVorh,
      cnom: Math.round(f.cU * 1000),
      flaecheNetto: Math.round(f.l * f.b * 100) / 100,
      hauptLabel: f.biegebeansprucht
        ? "erforderlich (As,min Biegung)"
        : "erforderlich (konstruktiv)",
      hauptEinheit: "cm²/m",
      wahlLabel: f.korb ? "Bügel (Untergurt)" : "Querbewehrung unten",
      flaecheLabel: "Sohlfläche",
    };
  },

  pruefe(projekt: Projekt): Pruefmeldung[] {
    const meldungen: Pruefmeldung[] = [];
    const b = projekt.masse.breite;
    const h = projekt.masse.hoehe;
    const wand = projekt.masse.wanddicke;
    if (!isFinite(b) || !isFinite(h) || !isFinite(wand) || b <= 0 || h <= 0) return meldungen;

    if (wand >= b)
      meldungen.push({
        feld: "wanddicke",
        schwere: "fehler",
        text: `Die Wand (${Math.round(wand * 100)} cm) ist mindestens so breit wie das Fundament (${Math.round(
          b * 100
        )} cm). Das Fundament muss beidseitig über die Wand hinausragen – Fundamentbreite erhöhen.`,
      });
    else if (b - wand < 0.1)
      meldungen.push({
        feld: "breite",
        schwere: "warnung",
        text: `Der Kragarm beträgt nur ${Math.round(
          ((b - wand) / 2) * 100
        )} cm je Seite. Für die Lastausbreitung in den Baugrund ist das sehr wenig – Fundamentbreite aus der zulässigen Sohlspannung ermitteln lassen.`,
      });

    const cMin = C_MIN_UNTERGRUND[projekt.details?.untergrund] ?? 40;
    if (h < (2 * cMin) / 1000 + 0.1)
      meldungen.push({
        feld: "hoehe",
        schwere: "fehler",
        text: `Bei ${cMin} mm Mindestbetondeckung unten und seitlich bleibt in einem ${Math.round(
          h * 100
        )} cm hohen Fundament kein einbaubarer Bewehrungsquerschnitt. Fundament höher ausführen.`,
      });

    if (isFinite(b) && b > 0 && (b - wand) / 2 > 2 * h)
      meldungen.push({
        feld: "hoehe",
        schwere: "warnung",
        text: `Der Kragarm (${Math.round(
          ((b - wand) / 2) * 100
        )} cm) ist mehr als doppelt so lang wie das Fundament hoch. Ein so schlankes Fundament biegt sich merklich – die Querbewehrung muss aus dem Sohldruck bemessen werden, die Mindestbewehrung reicht nicht.`,
      });

    return meldungen;
  },
};
