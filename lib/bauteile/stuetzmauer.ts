/**
 * Bauteil: Winkelstützmauer (Stahlbeton, mit Fundamentplatte und Ferse).
 *
 * SONDERSTELLUNG: Dies ist das einzige Bauteil, das eine VORBEMESSUNG rechnet
 * und nicht nur eine Mindestbewehrung. Grund: Bei einer Stützmauer bestimmt
 * der Erddruck die Bewehrung, und die liegt um ein Mehrfaches über der
 * Mindestbewehrung. Eine Mengenermittlung allein aus As,min wäre für dieses
 * Bauteil nicht bloß unvollständig, sondern schlicht falsch.
 *
 * Rechenmodell
 *  – Aktiver Erddruck nach Rankine für waagrechte Geländeoberfläche und
 *    senkrechte Ersatzwand durch die Fersenhinterkante: Ka = tan²(45° − φ/2).
 *  – Einwirkungen: Erddruck aus der Bodenwichte (ständig) und aus einer
 *    gleichmäßig verteilten Auflast (veränderlich).
 *  – Bemessungsschnittgrößen mit γ_G = 1,35 und γ_Q = 1,50.
 *  – Biegebemessung nach dem üblichen Handverfahren (siehe helfer.ts).
 *  – Standsicherheit (Kippen, Gleiten, Sohldruck) als Orientierungswerte mit
 *    charakteristischen Lasten; die Sohlspannung für die Zehenbemessung wird
 *    zusätzlich mit Bemessungslasten ermittelt.
 *
 * AUSDRÜCKLICH NICHT ENTHALTEN und deshalb im Ergebnis angeschrieben:
 * geböschtes Gelände, Linien- und Fahrzeuglasten, Wasserdruck (eine
 * funktionierende Dränage wird vorausgesetzt!), Kohäsion, Erdbeben, Nachweise
 * nach EC7 mit Teilsicherheiten auf der Widerstandsseite, Setzungen sowie die
 * Bemessung von Sporn oder Rippen. Das Ergebnis ist eine Vorbemessung, die
 * von einer zur Tragwerksplanung befugten Person zu bestätigen ist.
 */

import { Kennwerte, Projekt, Pruefmeldung } from "../types";
import { BETONKLASSEN, stabflaeche, uebergreifung } from "../normdaten";
import { fykVon, regelwerkVon } from "../regelwerk";
import { Ansicht, Bauteilmodul, Kontext, Zeichenelement } from "./typen";
import {
  Bemessung,
  biegebemessung,
  fundamentDeckung,
  imRaster,
  stabRaster,
  verteile,
  zahl,
} from "./helfer";

/** Wichte von Stahlbeton [kN/m³] */
const GAMMA_BETON = 25;
/** Teilsicherheitsbeiwerte der Einwirkungen */
const GAMMA_G = 1.35;
const GAMMA_Q = 1.5;
/** geforderte Sicherheiten (klassische Betrachtung, Orientierungswerte) */
const ETA_KIPP = 1.5;
const ETA_GLEIT = 1.5;
/** Stabdurchmesser und Abstände der Vorbemessung */
const DURCHMESSER = [10, 12, 14, 16, 20];
const ABSTAENDE = [25, 20, 15, 12.5, 10];
/** Lieferlänge von Stabstahl [m] */
const LIEFERLAENGE = 12;

/* ------------------------------------------------------------------ */
/* Statik                                                              */
/* ------------------------------------------------------------------ */

/** Ergebnis einer Sohlfugen-Betrachtung */
interface Sohlfuge {
  /** resultierende Vertikallast [kN/m] */
  V: number;
  /** resultierende Horizontallast [kN/m] */
  H: number;
  /** standsicherndes und kippendes Moment um die vordere Sohlkante [kNm/m] */
  mStand: number;
  mKipp: number;
  /** Abstand der Resultierenden von der vorderen Sohlkante [m] */
  xR: number;
  /** Ausmitte gegenüber der Sohlmitte [m] */
  e: number;
  /** Randspannungen [kN/m²] */
  sigmaMax: number;
  sigmaMin: number;
  /** Resultierende außerhalb des Kernquerschnitts → Fuge klafft */
  klaffend: boolean;
}

export interface StuetzmauerLayout {
  /** Mauerlänge, Wandhöhe über OK Fundament, Wanddicke [m] */
  l: number;
  hw: number;
  dw: number;
  /** Fundament: Breite, Dicke, Zehe (luftseitig), Ferse (erdseitig) [m] */
  bf: number;
  hf: number;
  zehe: number;
  ferse: number;
  /** Gesamthöhe Gelände bis Sohle [m] */
  hGes: number;
  /** Bodenkennwerte */
  phi: number;
  gamma: number;
  auflast: number;
  ka: number;
  /** Betondeckung [m] */
  cU: number;
  cO: number;
  /** Schnittgrößen [kNm/m] */
  mWand: number;
  mFerse: number;
  mZehe: number;
  /** Bemessungsergebnisse */
  bemWand: Bemessung;
  bemFerse: Bemessung;
  bemZehe: Bemessung;
  /** Standsicherheit mit charakteristischen Lasten */
  fuge: Sohlfuge;
  etaKipp: number;
  etaGleit: number;
  /** angesetzter Sohlreibungswinkel [°] */
  delta: number;
  /** Erddruck oder Mindestbewehrung maßgebend? */
  erddruckMassgebend: boolean;
  /** Faktor der vertikalen Wand-Mindestbewehrung des Regelwerks */
  wandFaktor: number;
  /** gewählte Bewehrung: Durchmesser [mm] und Abstand [m] */
  wandErd: { ds: number; s: number; as: number; asErf: number };
  wandLuft: { ds: number; s: number; as: number };
  wandHoriz: { ds: number; s: number; as: number };
  fundOben: { ds: number; s: number; as: number; asErf: number };
  fundUnten: { ds: number; s: number; as: number; asErf: number };
  laengsDs: number;
  laengsAnzahl: number;
  warnungen: string[];
}

export function stuetzmauerLayout(projekt: Projekt): StuetzmauerLayout {
  const m = projekt.masse;
  const l = m.laenge;
  const hw = m.hoehe;
  const dw = m.wanddicke;
  const bf = m.fundamentBreite;
  const hf = m.fundamentDicke;
  const zehe = m.zehe;
  const ferse = Math.max(0, bf - zehe - dw);
  const hGes = hw + hf;
  const phi = m.reibungswinkel;
  const gamma = m.wichte;
  const auflast = m.auflast;
  const warnungen: string[] = [];

  const beton =
    BETONKLASSEN.find((x) => x.name === projekt.parameter.betonklasse) ?? BETONKLASSEN[1];
  const regelwerk = regelwerkVon(projekt.parameter.regelwerk);
  const fyk = fykVon(regelwerk, projekt.parameter.stahlguete);
  const deckung = fundamentDeckung(projekt);
  if (deckung.hinweis) warnungen.push(deckung.hinweis);
  const { cU, cO } = deckung;

  /* ---- aktiver Erddruckbeiwert (Rankine, waagrechtes Gelände) ---- */
  const ka = Math.pow(Math.tan(Math.PI / 4 - (phi * Math.PI) / 360), 2);

  /* ---- Sohlfuge mit wählbaren Teilsicherheiten ---- */
  const sohlfuge = (fG: number, fQ: number): Sohlfuge => {
    // Vertikallasten und ihre Hebelarme ab der vorderen Sohlkante
    const lasten: [number, number][] = [
      [fG * GAMMA_BETON * bf * hf, bf / 2], // Fundamentplatte
      [fG * GAMMA_BETON * dw * hw, zehe + dw / 2], // Wandscheibe
      [fG * gamma * ferse * hw, zehe + dw + ferse / 2], // Erde auf der Ferse
      [fQ * auflast * ferse, zehe + dw + ferse / 2], // Auflast auf der Ferse
    ];
    const V = lasten.reduce((s, [k]) => s + k, 0);
    const mStand = lasten.reduce((s, [k, a]) => s + k * a, 0);

    // Erddruck auf die Ersatzwand durch die Fersenhinterkante
    const eGamma = fG * ka * gamma * (hGes * hGes) * 0.5; // Dreieckslast
    const eAuflast = fQ * ka * auflast * hGes; // Rechtecklast
    const H = eGamma + eAuflast;
    const mKipp = eGamma * (hGes / 3) + eAuflast * (hGes / 2);

    const xR = V > 0 ? (mStand - mKipp) / V : 0;
    const e = bf / 2 - xR;
    const klaffend = Math.abs(e) > bf / 6;
    const sigmaMax = klaffend
      ? xR > 0
        ? (2 * V) / (3 * xR)
        : Infinity
      : (V / bf) * (1 + (6 * Math.abs(e)) / bf);
    const sigmaMin = klaffend ? 0 : (V / bf) * (1 - (6 * Math.abs(e)) / bf);
    return { V, H, mStand, mKipp, xR, e, sigmaMax, sigmaMin, klaffend };
  };

  const fuge = sohlfuge(1, 1);
  const fugeEd = sohlfuge(GAMMA_G, GAMMA_Q);
  const etaKipp = fuge.mKipp > 0 ? fuge.mStand / fuge.mKipp : Infinity;
  // Sohlreibungswinkel δ: unmittelbar gegen Erdreich betoniert verzahnt sich
  // die Sohle mit dem Boden (δ = φ, EC7 6.5.3); auf einer glatten
  // Sauberkeitsschicht wird konservativ δ = 2/3 · φ angesetzt.
  const gegenErdreich = projekt.details.untergrund === "erdreich";
  const delta = gegenErdreich ? phi : (2 / 3) * phi;
  const etaGleit =
    fuge.H > 0 ? (fuge.V * Math.tan((delta * Math.PI) / 180)) / fuge.H : Infinity;

  /* ---- Schnittgrößen ---- */
  // Wandscheibe am Wandfuß: Erddruck über die Wandhöhe
  const mWand =
    GAMMA_G * ka * gamma * Math.pow(hw, 3) / 6 +
    GAMMA_Q * ka * auflast * Math.pow(hw, 2) / 2;

  // Ferse: Erdauflast und Eigengewicht nach unten; der Sohldruck unter der
  // Ferse wird konservativ vernachlässigt (Vorbemessung).
  const mFerse =
    (GAMMA_G * (gamma * hw + GAMMA_BETON * hf) + GAMMA_Q * auflast) *
    Math.pow(ferse, 2) /
    2;

  // Zehe: Sohldruck nach oben abzüglich Eigengewicht der Platte
  const qZehe = Math.max(0, fugeEd.sigmaMax - GAMMA_G * GAMMA_BETON * hf);
  const mZehe = (qZehe * Math.pow(zehe, 2)) / 2;

  /* ---- Bemessung ---- */
  // Für die Wandscheibe gilt die Deckung der Expositionsklasse, für das
  // Fundament unten die erhöhte Fundamentdeckung.
  const bemWand = biegebemessung(mWand, dw, cO, 14, beton.fck, fyk);
  const bemFerse = biegebemessung(mFerse, hf, cO, 12, beton.fck, fyk);
  const bemZehe = biegebemessung(mZehe, hf, cU, 12, beton.fck, fyk);
  for (const [name, b] of [
    ["Wandscheibe", bemWand],
    ["Ferse", bemFerse],
    ["Zehe", bemZehe],
  ] as const)
    if (b.ueberlastet)
      warnungen.push(
        `⚠ ${name}: Die Druckzone ist rechnerisch überlastet (µ = ${b.mu.toFixed(
          2
        )}). Der Querschnitt ist für das Moment zu dünn – Bauteil dicker ausführen.`
      );

  /* ---- Mindestbewehrung als Untergrenze ---- */
  // Wandscheibe wie eine Wand nach EC2 9.6: 0,002·Ac gesamt, je Seite die
  // Hälfte; horizontal max(25 % der Vertikalbewehrung; 0,001·Ac).
  const acWand = dw * 100 * 100; // [cm²/m]
  // je Seite die Hälfte der vertikalen Mindestbewehrung des Anhangs
  const asWandMin = (regelwerk.wandVertikalFaktor / 2) * acWand;

  const wandErfErd = Math.max(bemWand.asErf, asWandMin);
  const wErd = stabRaster(wandErfErd, DURCHMESSER, ABSTAENDE);
  const wLuft = stabRaster(Math.max(0.25 * wErd.as, asWandMin), DURCHMESSER, ABSTAENDE);
  const wHoriz = stabRaster(
    Math.max(0.25 * (wErd.as + wLuft.as), 0.001 * acWand),
    DURCHMESSER,
    ABSTAENDE
  );

  const fundErfOben = Math.max(bemFerse.asErf, 2.0);
  const fundErfUnten = Math.max(bemZehe.asErf, 2.0);
  const fOben = stabRaster(fundErfOben, DURCHMESSER, ABSTAENDE);
  const fUnten = stabRaster(fundErfUnten, DURCHMESSER, ABSTAENDE);

  /* ---- Längsbewehrung des Fundaments (≥ 20 % der Querbewehrung) ---- */
  const asLaengs = 0.2 * Math.max(fOben.as, fUnten.as) * bf;
  const laengsWahl =
    DURCHMESSER.map((ds) => ({
      ds,
      n: Math.max(4, Math.ceil(bf / 0.3) + 1, Math.ceil(asLaengs / stabflaeche(ds))),
    })).find((k) => k.n <= 10) ?? { ds: 16, n: 10 };

  return {
    l, hw, dw, bf, hf, zehe, ferse, hGes,
    phi, gamma, auflast, ka,
    cU, cO,
    mWand: Math.round(mWand * 10) / 10,
    mFerse: Math.round(mFerse * 10) / 10,
    mZehe: Math.round(mZehe * 10) / 10,
    bemWand, bemFerse, bemZehe,
    fuge,
    etaKipp,
    etaGleit,
    delta: Math.round(delta * 10) / 10,
    erddruckMassgebend: bemWand.asErf > asWandMin,
    wandFaktor: regelwerk.wandVertikalFaktor,
    wandErd: { ...wErd, asErf: Math.round(wandErfErd * 100) / 100 },
    wandLuft: wLuft,
    wandHoriz: wHoriz,
    fundOben: { ...fOben, asErf: Math.round(fundErfOben * 100) / 100 },
    fundUnten: { ...fUnten, asErf: Math.round(fundErfUnten * 100) / 100 },
    laengsDs: laengsWahl.ds,
    laengsAnzahl: laengsWahl.n,
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

/* ------------------------------------------------------------------ */
/* Das Modul                                                           */
/* ------------------------------------------------------------------ */

export const stuetzmauer: Bauteilmodul = {
  id: "stuetzmauer",
  name: "Stützmauer",
  beschreibung: "Winkelstützmauer aus Stahlbeton, Bewehrung aus dem Erddruck",
  bildId: "icon_stuetzmauer",
  hatOeffnungen: false,
  flaechenbewehrt: false,
  detailTitel: "Untergrund und Baugrund",
  detailHilfe:
    "Der Untergrund bestimmt die Mindestbetondeckung nach EC2 4.4.1.3. Die Bodenkennwerte gehen direkt in die Vorbemessung ein – sie sollten aus dem Bodengutachten stammen.",
  planinhalt: "Bewehrungsplan Stützmauer (Ansicht und Querschnitt)",

  masse: [
    {
      schluessel: "laenge",
      label: "Mauerlänge",
      einheit: "m",
      min: 0.5,
      max: 100,
      standard: 8.0,
    },
    {
      schluessel: "hoehe",
      label: "Wandhöhe über OK Fundament",
      einheit: "m",
      min: 0.3,
      max: 6.0,
      standard: 2.0,
      hinweis: "sichtbare Höhe",
    },
    {
      schluessel: "wanddicke",
      label: "Wanddicke",
      einheit: "cm",
      min: 0.15,
      max: 1.0,
      schritt: 5,
      standard: 0.25,
      hinweis: "Faustwert: H/12",
    },
    {
      schluessel: "fundamentBreite",
      label: "Fundamentbreite",
      einheit: "cm",
      min: 0.3,
      max: 6.0,
      schritt: 5,
      standard: 1.8,
      hinweis: "0,5–0,7 · H, für Gleiten oft mehr",
    },
    {
      schluessel: "fundamentDicke",
      label: "Fundamentdicke",
      einheit: "cm",
      min: 0.2,
      max: 1.5,
      schritt: 5,
      standard: 0.4,
    },
    {
      schluessel: "zehe",
      label: "Zehe (luftseitig)",
      einheit: "cm",
      min: 0.0,
      max: 3.0,
      schritt: 5,
      standard: 0.35,
      hinweis: "Vorsprung vor der Wand",
    },
  ],

  zusatz: {
    titel: "Baugrund und Auflast",
    hilfe:
      "Diese Werte bestimmen den Erddruck und damit die gesamte Bewehrung. Ohne Bodengutachten sind die Vorgaben nur Anhaltswerte für nichtbindige, gut verdichtete Hinterfüllung.",
    felder: [
      {
        schluessel: "reibungswinkel",
        label: "Reibungswinkel φ",
        einheit: "°",
        min: 17.5,
        max: 42.5,
        schritt: 0.5,
        standard: 32.5,
        hinweis: "Kies/Schotter ≈ 32,5°",
      },
      {
        schluessel: "wichte",
        label: "Wichte γ",
        einheit: "kN/m³",
        min: 14,
        max: 24,
        schritt: 0.5,
        standard: 19,
        hinweis: "Hinterfüllung",
      },
      {
        schluessel: "auflast",
        label: "Auflast p",
        einheit: "kN/m²",
        min: 0,
        max: 30,
        schritt: 0.5,
        standard: 5,
        hinweis: "gleichmäßig, keine Fahrzeuglast",
      },
    ],
  },

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
  ],

  planHinweis:
    "HINWEIS: VORBEMESSUNG aus Erddruck (EC2/ÖNORM B 1992-1-1). Annahmen und Standsicherheit siehe Stückliste.",

  abschlussHinweis:
    "Diese Vorbemessung beruht auf Eurocode 2 / ÖNORM B 1992-1-1 und dem oben angeschriebenen Erddruckmodell. Sie ersetzt keine geotechnische und statische Bearbeitung: Baugrund, Standsicherheit nach EC7, Wasserdruck und alle Abweichungen vom Regelfall sind von einer zur Tragwerksplanung befugten Person zu prüfen und freizugeben.",

  masseText: (p) =>
    `Stützmauer H = ${zahl(p.masse.hoehe)} m · Wand ${Math.round(
      p.masse.wanddicke * 100
    )} cm · Fundament ${Math.round(p.masse.fundamentBreite * 100)}/${Math.round(
      p.masse.fundamentDicke * 100
    )} cm · L = ${zahl(p.masse.laenge)} m`,

  /* ---------------- Zeichnung ---------------- */

  zeichnung(projekt: Projekt): Ansicht[] {
    const w = stuetzmauerLayout(projekt);
    const gesamt = w.hf + w.hw;

    /* --- Ansicht in Mauerlängsrichtung --- */
    const ansicht: Zeichenelement[] = [
      { art: "flaeche", x: 0, y: 0, b: w.l, h: w.hf, ton: "beton" },
      { art: "flaeche", x: 0, y: w.hf, b: w.l, h: w.hw, ton: "beton" },
      { art: "rahmen", x: 0, y: 0, b: w.l, h: w.hf, stil: "kante" },
      { art: "rahmen", x: 0, y: w.hf, b: w.l, h: w.hw, stil: "kante" },
    ];
    // senkrechte Wandbewehrung
    const vertPos = verteile(
      w.cO,
      w.l - w.cO,
      imRaster(Math.max(0, w.l - 2 * w.cO), w.wandErd.s)
    );
    for (const x of vertPos)
      ansicht.push({ art: "linie", x1: x, y1: w.hf, x2: x, y2: gesamt - w.cO, stil: "stahl" });
    // waagrechte Wandbewehrung
    const horizPos = verteile(
      w.hf + w.cO,
      gesamt - w.cO,
      imRaster(Math.max(0, w.hw - 2 * w.cO), w.wandHoriz.s)
    );
    for (const y of horizPos)
      ansicht.push({ art: "linie", x1: w.cO, y1: y, x2: w.l - w.cO, y2: y, stil: "stahl" });
    // Fundamentbewehrung oben und unten
    for (const y of [w.cU, w.hf - w.cO])
      ansicht.push({ art: "linie", x1: w.cU, y1: y, x2: w.l - w.cU, y2: y, stil: "stahl" });

    const ansichtLaengs: Ansicht = {
      id: "ansicht",
      titel: "Ansicht",
      breite: w.l,
      hoehe: gesamt,
      elemente: ansicht,
      massketteX: [0, w.l],
      massketteY: [0, w.hf, gesamt],
      randtexte: [
        { seite: "oben", text: "Geländeoberkante hinter der Mauer" },
        { seite: "unten", text: UNTERGRUND_NAME[projekt.details.untergrund] ?? "" },
      ],
      fuss: `Wand erdseitig Ø${w.wandErd.ds}/${Math.round(
        w.wandErd.s * 100
      )} · luftseitig Ø${w.wandLuft.ds}/${Math.round(w.wandLuft.s * 100)}`,
    };

    /* --- Querschnitt --- */
    const xWand = w.zehe;
    const quer: Zeichenelement[] = [
      { art: "flaeche", x: 0, y: 0, b: w.bf, h: w.hf, ton: "beton" },
      { art: "flaeche", x: xWand, y: w.hf, b: w.dw, h: w.hw, ton: "beton" },
      { art: "rahmen", x: 0, y: 0, b: w.bf, h: w.hf, stil: "kante" },
      { art: "rahmen", x: xWand, y: w.hf, b: w.dw, h: w.hw, stil: "kante" },
    ];
    // Geländeoberkante und Hinterfüllung andeuten
    if (w.ferse > 0.01) {
      quer.push({
        art: "linie",
        x1: xWand + w.dw,
        y1: gesamt,
        x2: w.bf,
        y2: gesamt,
        stil: "strich",
      });
      const schraffur = Math.max(2, Math.round(w.ferse / 0.15));
      for (let i = 0; i <= schraffur; i++) {
        const x = xWand + w.dw + (i / schraffur) * w.ferse;
        quer.push({
          art: "linie",
          x1: x,
          y1: gesamt,
          x2: Math.min(w.bf, x + w.hf * 0.5),
          y2: gesamt + w.hf * 0.5,
          stil: "hilfslinie",
        });
      }
    }
    // erdseitige Wandbewehrung: senkrecht und in die Ferse abgebogen
    const xErd = xWand + w.dw - w.cO;
    quer.push({
      art: "polylinie",
      stil: "stahl",
      punkte: [
        [xErd, gesamt - w.cO],
        [xErd, w.hf - w.cO],
        [w.bf - w.cU, w.hf - w.cO],
      ],
    });
    // luftseitige Wandbewehrung
    quer.push({
      art: "linie",
      x1: xWand + w.cO,
      y1: w.hf,
      x2: xWand + w.cO,
      y2: gesamt - w.cO,
      stil: "stahl",
    });
    // Fundamentquerbewehrung oben (Ferse) und unten (Zehe), Enden aufgebogen
    const auf = Math.max(0.08, Math.min(0.2, w.hf - w.cU - w.cO));
    quer.push({
      art: "polylinie",
      stil: "stahl",
      punkte: [
        [w.cU, w.hf - w.cO - auf],
        [w.cU, w.hf - w.cO],
        [w.bf - w.cU, w.hf - w.cO],
        [w.bf - w.cU, w.hf - w.cO - auf],
      ],
    });
    quer.push({
      art: "polylinie",
      stil: "stahl",
      punkte: [
        [w.cU, w.cU + auf],
        [w.cU, w.cU],
        [w.bf - w.cU, w.cU],
        [w.bf - w.cU, w.cU + auf],
      ],
    });
    // Längsstäbe des Fundaments andeuten
    for (const x of verteile(w.cU, w.bf - w.cU, Math.min(6, w.laengsAnzahl))) {
      quer.push({ art: "kreis", x, y: w.cU, r: w.laengsDs / 2000, ton: "stahl" });
      quer.push({ art: "kreis", x, y: w.hf - w.cO, r: w.laengsDs / 2000, ton: "stahl" });
    }

    const ansichtQuer: Ansicht = {
      id: "querschnitt",
      titel: "Querschnitt A–A",
      breite: w.bf,
      hoehe: gesamt + (w.ferse > 0.01 ? w.hf * 0.5 : 0),
      elemente: quer,
      massketteX:
        w.zehe > 0.01 ? [0, w.zehe, w.zehe + w.dw, w.bf] : [0, w.dw, w.bf],
      massketteY: [0, w.hf, gesamt],
      eigenerMassstab: true,
      fuss: `Fundament oben Ø${w.fundOben.ds}/${Math.round(
        w.fundOben.s * 100
      )} · unten Ø${w.fundUnten.ds}/${Math.round(w.fundUnten.s * 100)}`,
    };

    return [ansichtLaengs, ansichtQuer];
  },

  /* ---------------- Bewehrung ---------------- */

  bewehrung(k: Kontext): Kennwerte {
    const projekt = k.projekt;
    const w = stuetzmauerLayout(projekt);
    for (const h of w.warnungen) k.hinweise.push(h);

    /** Stäbe in Mauerlängsrichtung: Lieferlänge beachten */
    const laengsStab = (ds: number) => {
      const netto = Math.max(0.3, w.l - 2 * w.cU);
      const teile = Math.max(1, Math.ceil(netto / LIEFERLAENGE));
      return {
        teile,
        laenge:
          teile === 1 ? netto : Math.min(LIEFERLAENGE, netto / teile + uebergreifung(ds)),
      };
    };

    /* ---- 1) Wandscheibe, erdseitige Vertikalbewehrung (Hauptbewehrung) ---- */
    const nVert = imRaster(Math.max(0, w.l - 2 * w.cO), w.wandErd.s);
    const l0Erd = uebergreifung(w.wandErd.ds);
    k.s.stab(
      w.wandErd.ds,
      "winkel",
      [w.hw + w.hf - w.cO - w.cU, Math.max(0.3, Math.min(w.ferse, l0Erd))],
      nVert,
      `Wandbewehrung erdseitig, in die Ferse abgebogen (Ø${w.wandErd.ds}/${Math.round(
        w.wandErd.s * 100
      )} cm)`,
      "Wand erdseitig"
    );

    /* ---- 2) Wandscheibe, luftseitige Vertikalbewehrung ---- */
    const nLuft = imRaster(Math.max(0, w.l - 2 * w.cO), w.wandLuft.s);
    k.s.stab(
      w.wandLuft.ds,
      "gerade",
      [w.hw + w.hf - w.cO - w.cU],
      nLuft,
      `Wandbewehrung luftseitig, konstruktiv (Ø${w.wandLuft.ds}/${Math.round(
        w.wandLuft.s * 100
      )} cm)`,
      "Wand luftseitig"
    );

    /* ---- 3) Wandscheibe, Horizontalbewehrung beidseitig ---- */
    const hWand = laengsStab(w.wandHoriz.ds);
    const nHoriz = imRaster(Math.max(0, w.hw - 2 * w.cO), w.wandHoriz.s) * 2;
    k.s.stab(
      w.wandHoriz.ds,
      "gerade",
      [hWand.laenge],
      nHoriz * hWand.teile,
      `Wandbewehrung waagrecht, beidseitig (Ø${w.wandHoriz.ds}/${Math.round(
        w.wandHoriz.s * 100
      )} cm)`,
      "Wand waagrecht"
    );

    /* ---- 4) Fundament, Querbewehrung oben und unten ---- */
    const auf = Math.max(0.08, Math.min(0.2, w.hf - w.cU - w.cO));
    const querLaenge = Math.max(0.2, w.bf - 2 * w.cU);
    for (const [lage, wahl, kurz] of [
      ["oben (Ferse)", w.fundOben, "Fund. oben"],
      ["unten (Zehe)", w.fundUnten, "Fund. unten"],
    ] as const) {
      k.s.stab(
        wahl.ds,
        "buegel_u",
        [auf, querLaenge, auf],
        imRaster(Math.max(0, w.l - 2 * w.cU), wahl.s),
        `Fundament Querbewehrung ${lage} Ø${wahl.ds}/${Math.round(
          wahl.s * 100
        )} cm, Enden aufgebogen`,
        kurz
      );
    }

    /* ---- 5) Fundament, Längsbewehrung oben und unten ---- */
    const lStab = laengsStab(w.laengsDs);
    k.s.stab(
      w.laengsDs,
      "gerade",
      [lStab.laenge],
      2 * w.laengsAnzahl * lStab.teile,
      `Fundament Längsbewehrung oben und unten (je ${w.laengsAnzahl} Ø${w.laengsDs})`,
      "Fund. längs"
    );
    if (lStab.teile > 1)
      k.hinweise.push(
        `Stäbe in Mauerlängsrichtung sind länger als die Lieferlänge von ${LIEFERLAENGE} m und deshalb gestoßen aufgeführt (ls ≈ ${zahl(
          uebergreifung(w.laengsDs)
        )} m). Stöße versetzt anordnen.`
      );

    /* ---- 6) Rechenweg und Annahmen offenlegen ---- */
    k.hinweise.push(
      `VORBEMESSUNG: Diese Stützmauer ist als einziges Bauteil nicht nur konstruktiv, sondern aus dem Erddruck bemessen – bei höheren Mauern liegt die erforderliche Bewehrung weit über der Mindestbewehrung, eine reine Mengenermittlung wäre dort falsch. Angesetzt: aktiver Erddruck nach Rankine mit φ = ${zahl(
        w.phi
      )}°, γ = ${zahl(w.gamma)} kN/m³, Auflast p = ${zahl(
        w.auflast
      )} kN/m², Ka = ${w.ka.toFixed(3)}; Teilsicherheiten γ_G = 1,35 und γ_Q = 1,50.`
    );
    k.hinweise.push(
      `Bemessungsmomente: Wandfuß ${zahl(w.mWand)} kNm/m (erf. ${zahl(
        w.bemWand.asErf
      )} cm²/m) · Ferse ${zahl(w.mFerse)} kNm/m (erf. ${zahl(
        w.bemFerse.asErf
      )} cm²/m) · Zehe ${zahl(w.mZehe)} kNm/m (erf. ${zahl(w.bemZehe.asErf)} cm²/m).`
    );
    k.hinweise.push(
      w.erddruckMassgebend
        ? `Am Wandfuß ist der Erddruck maßgebend: erforderlich ${zahl(
            w.bemWand.asErf
          )} cm²/m gegenüber ${zahl(
            (w.wandFaktor / 2) * w.dw * 10000
          )} cm²/m Mindestbewehrung je Seite nach EC2 9.6.`
        : `Am Wandfuß ist die Mindestbewehrung nach EC2 9.6 maßgebend (${zahl(
            (w.wandFaktor / 2) * w.dw * 10000
          )} cm²/m je Seite gegenüber ${zahl(
            w.bemWand.asErf
          )} cm²/m aus dem Erddruck). Bei dieser Mauerhöhe bleibt der Erddruck also unter dem konstruktiven Mindestwert.`
    );
    k.hinweise.push(
      `Standsicherheit (Orientierungswerte, charakteristische Lasten): Kippen η = ${w.etaKipp.toFixed(
        2
      )} (gefordert ≥ ${zahl(ETA_KIPP)}) · Gleiten η = ${w.etaGleit.toFixed(
        2
      )} (gefordert ≥ ${zahl(ETA_GLEIT)}, Sohlreibung δ = ${zahl(w.delta)}°) · Sohldruck σ = ${Math.round(
        w.fuge.sigmaMin
      )} bis ${Math.round(w.fuge.sigmaMax)} kN/m² · Ausmitte e = ${zahl(
        Math.abs(w.fuge.e)
      )} m (Kernweite b/6 = ${zahl(w.bf / 6)} m).`
    );
    if (w.etaKipp < ETA_KIPP)
      k.hinweise.push(
        `⚠ Kippsicherheit η = ${w.etaKipp.toFixed(
          2
        )} liegt unter ${zahl(ETA_KIPP)} – Fundament verbreitern oder Ferse verlängern.`
      );
    if (w.etaGleit < ETA_GLEIT)
      k.hinweise.push(
        `⚠ Gleitsicherheit η = ${w.etaGleit.toFixed(
          2
        )} liegt unter ${zahl(ETA_GLEIT)} – Sporn anordnen, Fundament verbreitern oder tiefer gründen.`
      );
    if (w.fuge.klaffend)
      k.hinweise.push(
        "⚠ Die Sohlfuge klafft: Die Resultierende liegt außerhalb des Kernquerschnitts (e > b/6). Für ständige Lasten ist das unzulässig – Fundament verbreitern."
      );

    /* ---- 7) Grenzen des Modells ---- */
    k.hinweise.push(
      "⚠ NICHT enthalten: geböschtes Gelände, Linien- und Fahrzeuglasten, Wasserdruck, Kohäsion, Erdbeben, Setzungen sowie die Nachweise nach EC7/ÖNORM B 1997 mit Teilsicherheiten auf der Widerstandsseite. Jede Abweichung von den genannten Annahmen macht diese Vorbemessung ungültig."
    );
    k.hinweise.push(
      "⚠ Dränage: Die Rechnung setzt eine dauerhaft funktionierende Entwässerung hinter der Mauer voraus (Sickerpackung, Dränrohr mit Vorflut, Abdichtung der Erdseite). Ohne sie entsteht Wasserdruck, der den Erddruck um ein Vielfaches übersteigen kann."
    );
    k.hinweise.push(
      "Arbeitsfuge zwischen Fundament und Wandscheibe rau ausbilden und die Fugenbewehrung (erdseitige Wandbewehrung) durchführen; die Fuge ist auf Querkraft nachzuweisen (EC2 6.2.5)."
    );
    k.hinweise.push(
      "⚠ Gründungstiefe: Die Fundamentsohle ist frostfrei zu gründen (in Österreich üblicherweise mindestens 80–100 cm unter Geländeoberkante, regional auch tiefer)."
    );

    return {
      ac: Math.round(w.dw * 100 * 100),
      nutzhoehe: Math.round(w.bemWand.d * 1000) / 10,
      asMinHaupt: w.wandErd.asErf,
      asMinQuer: w.fundOben.asErf,
      gewaehlteMatte: `Ø${w.wandErd.ds}/${Math.round(w.wandErd.s * 100)} cm`,
      asVorhanden: w.wandErd.as,
      cnom: Math.round(w.cU * 1000),
      flaecheNetto: Math.round(w.l * w.bf * 100) / 100,
      hauptLabel: w.erddruckMassgebend
        ? "erforderlich (Wandfuß, aus Erddruck)"
        : "erforderlich (Mindestbewehrung maßgebend)",
      hauptEinheit: "cm²/m",
      wahlLabel: "Wandbewehrung erdseitig",
      flaecheLabel: "Sohlfläche",
    };
  },

  pruefe(projekt: Projekt): Pruefmeldung[] {
    const meldungen: Pruefmeldung[] = [];
    const m = projekt.masse;
    const { hoehe: hw, wanddicke: dw, fundamentBreite: bf, fundamentDicke: hf, zehe } = m;
    if (![hw, dw, bf, hf, zehe].every((v) => isFinite(v))) return meldungen;

    const ferse = bf - zehe - dw;
    if (ferse < 0.1)
      meldungen.push({
        feld: "fundamentBreite",
        schwere: "fehler",
        text: `Für die Ferse bleiben nur ${Math.round(
          ferse * 100
        )} cm. Eine Winkelstützmauer steht durch das Erdgewicht auf der Ferse – sie muss deutlich breiter sein. Fundamentbreite erhöhen oder Zehe verkleinern.`,
      });

    const hGes = hw + hf;
    if (bf < 0.4 * hGes)
      meldungen.push({
        feld: "fundamentBreite",
        schwere: "warnung",
        text: `Die Fundamentbreite ${Math.round(
          bf * 100
        )} cm liegt unter dem Faustwert 0,4 · Gesamthöhe (${Math.round(
          0.4 * hGes * 100
        )} cm). Kipp- und Gleitsicherheit werden voraussichtlich nicht eingehalten – die Werte stehen im Ergebnis.`,
      });

    if (hw > 3.5)
      meldungen.push({
        feld: "hoehe",
        schwere: "warnung",
        text: `Wandhöhe ${zahl(
          hw
        )} m: Ab etwa 3,5 m werden Winkelstützmauern üblicherweise mit Sporn oder Rippen ausgeführt und gehören in jedem Fall vollständig statisch bemessen. Diese Vorbemessung reicht dafür nicht aus.`,
      });

    if (dw < hGes / 16)
      meldungen.push({
        feld: "wanddicke",
        schwere: "warnung",
        text: `Wanddicke ${Math.round(
          dw * 100
        )} cm ist für ${zahl(
          hGes
        )} m Gesamthöhe sehr schlank (Faustwert H/12 ≈ ${Math.round(
          (hGes / 12) * 100
        )} cm). Prüfen, ob die Druckzone am Wandfuß ausreicht.`,
      });

    return meldungen;
  },
};
