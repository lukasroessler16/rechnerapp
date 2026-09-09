/**
 * Bauteil: Einzelfundament (Köcher-/Plattenfundament) unter einer Stütze.
 *
 * Fachliche Grundlage (EC2 / ÖNORM B 1992-1-1):
 *
 *  Betondeckung (EC2 4.4.1.3(4))
 *   – gegen Sauberkeitsschicht c_min ≥ 40 mm, gegen Erdreich ≥ 75 mm;
 *     gilt an Sohle und Seitenflächen (siehe lib/bauteile/helfer.ts).
 *
 *  Bewehrung (EC2 9.8.2)
 *   – Das Fundament kragt in BEIDE Richtungen aus und bekommt deshalb eine
 *     untere Bewehrungslage in beiden Richtungen. Die Richtung mit dem
 *     längeren Kragarm liegt unten (größerer Hebelarm), die andere darüber –
 *     die Nutzhöhen unterscheiden sich dadurch um einen Stabdurchmesser.
 *   – Gedrungenes Fundament (längster Kragarm ≤ Höhe): Der Sohldruck wird
 *     über Druckstreben abgetragen; nach EC2 12 ist keine Biege-Mindest-
 *     bewehrung nötig, angesetzt wird die konstruktive Bewehrung.
 *   – Schlankes Fundament (Kragarm > Höhe): Der Kragarm wirkt als Platte,
 *     dann gilt As,min = max(0,26 · fctm/fyk · b · d ; 0,0013 · b · d).
 *   – EC2 9.8.2.2: Die Bewehrung ist ab dem Schnittpunkt der Druckstrebe mit
 *     der Bewehrungslage zu verankern; die Stabenden werden deshalb
 *     aufgebogen ausgeführt.
 *
 * NICHT enthalten: Sohlspannung, Grundbruch und Setzungen (EC7), die
 * Biegebemessung aus dem tatsächlichen Sohldruck, der Durchstanznachweis
 * (EC2 6.4) und ausmittige Belastung aus Stützenmomenten. Der
 * Durchstanznachweis ist bei Einzelfundamenten regelmäßig maßgebend – das
 * Ergebnis weist ausdrücklich darauf hin.
 */

import { Kennwerte, Projekt, Pruefmeldung } from "../types";
import { BETONKLASSEN, FYK, stabflaeche } from "../normdaten";
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

/** Stabdurchmesser der Fundamentbewehrung [mm] */
const DURCHMESSER = [10, 12, 14, 16, 20];
/** wählbare Stababstände [cm] */
const ABSTAENDE = [25, 20, 15, 12.5, 10];
/** Höhe der Aufbiegung an den Stabenden [m] */
const AUFBIEGUNG_MAX = 0.25;

/* ------------------------------------------------------------------ */
/* Bewehrungslayout                                                    */
/* ------------------------------------------------------------------ */

/** Eine Bewehrungsrichtung des Fundaments */
export interface Richtung {
  /** "x" = Stäbe laufen in Fundamentlänge, "y" = in Fundamentbreite */
  achse: "x" | "y";
  /** Spannweite der Stäbe (Fundamentmaß in dieser Richtung) [m] */
  spannweite: number;
  /** Strecke, über die verteilt wird (Fundamentmaß quer dazu) [m] */
  verteilung: number;
  /** Kragarm je Seite [m] */
  krag: number;
  /** untere Lage (größerer Hebelarm) oder darüberliegende Lage? */
  unten: boolean;
  /** statische Nutzhöhe [cm] */
  d: number;
  /** Höhenlage der Stabachse über der Sohle [m] */
  z: number;
  /** erforderliche und vorhandene Bewehrung [cm²/m] */
  asMin: number;
  asVorh: number;
  /** Biege-Mindestbewehrung nach EC2 9.2.1.1, auch wenn nicht maßgebend */
  asBiegung: number;
  /** Stabwahl */
  ds: number;
  s: number;
  /** Stückzahl und Achspositionen quer zur Stabrichtung [m] */
  stueck: number;
  positionen: number[];
  /** Länge des geraden Schenkels und Aufbiegung [m] */
  laenge: number;
  aufbiegung: number;
}

export interface EinzelfundamentLayout {
  /** Fundamentmaße [m] */
  a: number;
  b: number;
  h: number;
  /** Stützenquerschnitt [m] */
  sx: number;
  sy: number;
  /** Betondeckung [m] */
  cU: number;
  cO: number;
  /** gedrungenes Fundament? */
  gedrungen: boolean;
  /** beide Bewehrungsrichtungen, untere Lage zuerst */
  richtungen: Richtung[];
  /** obere Lage vorgesehen? */
  obereLage: boolean;
  /** Bewehrung der oberen Lage [cm²/m] und Stabwahl */
  obenDs: number;
  obenS: number;
  ac: number;
  warnungen: string[];
}

export function einzelfundamentLayout(projekt: Projekt): EinzelfundamentLayout {
  const a = projekt.masse.laenge;
  const b = projekt.masse.breite;
  const h = projekt.masse.hoehe;
  const sx = projekt.masse.stuetzeX;
  const sy = projekt.masse.stuetzeY;
  const warnungen: string[] = [];
  const beton =
    BETONKLASSEN.find((x) => x.name === projekt.parameter.betonklasse) ?? BETONKLASSEN[1];

  const deckung = fundamentDeckung(projekt);
  if (deckung.hinweis) warnungen.push(deckung.hinweis);
  const { cU, cO } = deckung;

  const kragX = Math.max(0, (a - sx) / 2);
  const kragY = Math.max(0, (b - sy) / 2);
  // Nur der längere Kragarm entscheidet, ob das Fundament biegeweich wirkt
  const gedrungen = Math.max(kragX, kragY) <= h;

  /* ---- untere Lage: Richtung mit dem längeren Kragarm ---- */
  const xUnten = kragX >= kragY;

  /** eine Richtung durchrechnen; dsUnter = Durchmesser der darunterliegenden Lage */
  const rechne = (achse: "x" | "y", unten: boolean, dsUnter: number): Richtung => {
    const spannweite = achse === "x" ? a : b;
    const verteilung = achse === "x" ? b : a;
    const krag = achse === "x" ? kragX : kragY;

    // Bei zwei Runden reicht eine Vorschätzung des eigenen Durchmessers
    let ds = DURCHMESSER[0];
    let s = ABSTAENDE[0] / 100;
    let asVorh = 0;
    let asMin = 0;
    let asBiegung = 0;
    let d = 0;
    let z = 0;
    for (let runde = 0; runde < 3; runde++) {
      z = cU + dsUnter / 1000 + ds / 2000;
      d = (h - z) * 100;
      asBiegung = Math.max((0.26 * beton.fctm * 100 * d) / FYK, 0.0013 * 100 * d);
      asMin = gedrungen ? AS_KONSTRUKTIV_FUNDAMENT : asBiegung;
      const wahl = stabRaster(asMin, DURCHMESSER, ABSTAENDE);
      if (wahl.ds === ds && runde > 0) break;
      ds = wahl.ds;
      s = wahl.s;
      asVorh = wahl.as;
    }
    if (asVorh < asMin)
      warnungen.push(
        "⚠ Die erforderliche Bewehrung ist mit den üblichen Stabdurchmessern nicht abzudecken – Fundament höher ausführen oder Bewehrung statisch festlegen."
      );

    const rand = cU + ds / 2000;
    const positionen = verteile(
      rand,
      verteilung - rand,
      imRaster(Math.max(0, verteilung - 2 * rand), s)
    );
    // Gerader Schenkel plus aufgebogene Enden (Verankerung nach EC2 9.8.2.2)
    const aufbiegung = Math.max(0.1, Math.min(AUFBIEGUNG_MAX, h - cU - cO - ds / 1000));

    return {
      achse,
      spannweite,
      verteilung,
      krag,
      unten,
      d: Math.round(d * 10) / 10,
      z,
      asMin: Math.round(asMin * 100) / 100,
      asVorh,
      asBiegung: Math.round(asBiegung * 100) / 100,
      ds,
      s,
      stueck: positionen.length,
      positionen,
      laenge: Math.max(0.2, spannweite - 2 * cU - ds / 1000),
      aufbiegung,
    };
  };

  const untere = rechne(xUnten ? "x" : "y", true, 0);
  const obere = rechne(xUnten ? "y" : "x", false, untere.ds);
  const richtungen = [untere, obere];

  /* ---- obere Lage (konstruktiv, beide Richtungen) ---- */
  const obereLage = projekt.details.bewehrung === "unten_oben";
  const obenWahl = stabRaster(AS_KONSTRUKTIV_FUNDAMENT, DURCHMESSER, ABSTAENDE);

  return {
    a, b, h, sx, sy, cU, cO,
    gedrungen,
    richtungen,
    obereLage,
    obenDs: obenWahl.ds,
    obenS: obenWahl.s,
    ac: a * b * 10000,
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

const STUETZE_NAME: Record<string, string> = {
  ortbeton: "Ortbetonstütze darüber",
  fertigteil: "Fertigteilstütze (Köcher)",
  keine: "keine Stütze / später",
};

/* ------------------------------------------------------------------ */
/* Das Modul                                                           */
/* ------------------------------------------------------------------ */

export const einzelfundament: Bauteilmodul = {
  id: "einzelfundament",
  name: "Einzelfundament",
  beschreibung: "Fundamentplatte unter einer einzelnen Stütze",
  bildId: "icon_einzelfundament",
  hatOeffnungen: false,
  flaechenbewehrt: false,
  detailTitel: "Untergrund und Stütze",
  detailHilfe:
    "Der Untergrund bestimmt die Mindestbetondeckung nach EC2 4.4.1.3, die Stützenabmessung den Kragarm und damit die Bewehrung.",
  planinhalt: "Bewehrungsplan Einzelfundament (Draufsicht und Schnitt)",

  masse: [
    {
      schluessel: "laenge",
      label: "Fundamentlänge a",
      einheit: "cm",
      min: 0.3,
      max: 8.0,
      schritt: 5,
      standard: 1.5,
      hinweis: "üblich: 100–250 cm",
    },
    {
      schluessel: "breite",
      label: "Fundamentbreite b",
      einheit: "cm",
      min: 0.3,
      max: 8.0,
      schritt: 5,
      standard: 1.5,
      hinweis: "üblich: 100–250 cm",
    },
    {
      schluessel: "hoehe",
      label: "Fundamenthöhe h",
      einheit: "cm",
      min: 0.2,
      max: 2.0,
      schritt: 5,
      standard: 0.5,
      hinweis: "üblich: 40–80 cm",
    },
    {
      schluessel: "stuetzeX",
      label: "Stütze in Richtung a",
      einheit: "cm",
      min: 0.1,
      max: 3.0,
      schritt: 5,
      standard: 0.3,
    },
    {
      schluessel: "stuetzeY",
      label: "Stütze in Richtung b",
      einheit: "cm",
      min: 0.1,
      max: 3.0,
      schritt: 5,
      standard: 0.3,
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
      label: "Bewehrungslagen",
      standard: "unten",
      optionen: [
        { wert: "unten", titel: "nur untere Lage (beide Richtungen)", bildId: "auflager" },
        {
          wert: "unten_oben",
          titel: "untere und obere Lage",
          bildId: "wandstoss",
        },
      ],
    },
    {
      schluessel: "stuetze",
      label: "Stütze darüber",
      standard: "ortbeton",
      optionen: [
        { wert: "ortbeton", titel: "Ortbetonstütze", bildId: "decke_ueber" },
        { wert: "fertigteil", titel: "Fertigteilstütze (Köcher)", bildId: "wand_weiter" },
        { wert: "keine", titel: "keine / später", bildId: "freier_rand" },
      ],
    },
  ],

  masseText: (p) =>
    `Einzelfundament ${Math.round(p.masse.laenge * 100)}/${Math.round(
      p.masse.breite * 100
    )}/${Math.round(p.masse.hoehe * 100)} cm`,

  /* ---------------- Zeichnung: Draufsicht + Schnitt ---------------- */

  zeichnung(projekt: Projekt): Ansicht[] {
    const f = einzelfundamentLayout(projekt);
    const kragX = (f.a - f.sx) / 2;
    const kragY = (f.b - f.sy) / 2;
    const mitStuetze = projekt.details.stuetze !== "keine";

    /* --- Draufsicht --- */
    const oben: Zeichenelement[] = [
      { art: "flaeche", x: 0, y: 0, b: f.a, h: f.b, ton: "beton" },
      { art: "rahmen", x: 0, y: 0, b: f.a, h: f.b, stil: "kante" },
    ];
    // Bewehrungsraster beider Richtungen
    for (const r of f.richtungen) {
      for (const p of r.positionen) {
        if (r.achse === "x")
          oben.push({ art: "linie", x1: f.cU, y1: p, x2: f.a - f.cU, y2: p, stil: "stahl" });
        else oben.push({ art: "linie", x1: p, y1: f.cU, x2: p, y2: f.b - f.cU, stil: "stahl" });
      }
    }
    // Stützenquerschnitt andeuten (gehört nicht zum Bauteil)
    if (mitStuetze)
      oben.push({
        art: "rahmen",
        x: kragX,
        y: kragY,
        b: f.sx,
        h: f.sy,
        stil: "strich",
      });

    const ansichtOben: Ansicht = {
      id: "draufsicht",
      titel: "Draufsicht",
      breite: f.a,
      hoehe: f.b,
      elemente: oben,
      massketteX: kragX > 0.01 ? [0, kragX, kragX + f.sx, f.a] : [0, f.a],
      massketteY: kragY > 0.01 ? [0, kragY, kragY + f.sy, f.b] : [0, f.b],
      randtexte: [{ seite: "oben", text: STUETZE_NAME[projekt.details.stuetze] ?? "" }],
      fuss: f.richtungen
        .map((r) => `${r.achse === "x" ? "a" : "b"}: Ø${r.ds}/${Math.round(r.s * 100)}`)
        .join(" · "),
    };

    /* --- Schnitt in Richtung a --- */
    const stumpf = Math.min(0.5, Math.max(0.3, f.h * 0.8));
    const schnitt: Zeichenelement[] = [
      { art: "flaeche", x: 0, y: 0, b: f.a, h: f.h, ton: "beton" },
      { art: "rahmen", x: 0, y: 0, b: f.a, h: f.h, stil: "kante" },
    ];
    if (mitStuetze)
      schnitt.push({
        art: "rahmen",
        x: kragX,
        y: f.h,
        b: f.sx,
        h: stumpf,
        stil: "strich",
      });
    // beide unteren Lagen im Schnitt: die in Schnittrichtung laufende Lage als
    // durchgehender Stab mit aufgebogenen Enden, die andere als Punktreihe
    for (const r of f.richtungen) {
      if (r.achse === "x") {
        schnitt.push({
          art: "polylinie",
          stil: "stahl",
          punkte: [
            [f.cU, r.z + r.aufbiegung],
            [f.cU, r.z],
            [f.a - f.cU, r.z],
            [f.a - f.cU, r.z + r.aufbiegung],
          ],
        });
      } else {
        for (const p of r.positionen)
          schnitt.push({ art: "kreis", x: p, y: r.z, r: r.ds / 2000, ton: "stahl" });
      }
    }
    if (f.obereLage) {
      const zo = f.h - f.cO - f.obenDs / 2000;
      schnitt.push({
        art: "linie",
        x1: f.cU,
        y1: zo,
        x2: f.a - f.cU,
        y2: zo,
        stil: "stahl",
      });
    }

    const ansichtSchnitt: Ansicht = {
      id: "schnitt",
      titel: "Schnitt A–A",
      breite: f.a,
      hoehe: f.h + (mitStuetze ? stumpf : 0),
      elemente: schnitt,
      massketteX: kragX > 0.01 ? [0, kragX, kragX + f.sx, f.a] : [0, f.a],
      massketteY: [0, f.h],
      randtexte: [
        { seite: "unten", text: UNTERGRUND_NAME[projekt.details.untergrund] ?? "" },
      ],
      fuss: `c_nom Sohle ${Math.round(f.cU * 1000)} mm · oben ${Math.round(f.cO * 1000)} mm`,
    };

    return [ansichtOben, ansichtSchnitt];
  },

  /* ---------------- Bewehrung ---------------- */

  bewehrung(k: Kontext): Kennwerte {
    const projekt = k.projekt;
    const f = einzelfundamentLayout(projekt);
    for (const w of f.warnungen) k.hinweise.push(w);

    /* ---- 1) untere Bewehrung in beiden Richtungen ---- */
    for (const r of f.richtungen) {
      const seite = r.achse === "x" ? "Länge a" : "Breite b";
      k.s.stab(
        r.ds,
        "buegel_u",
        [r.aufbiegung, r.laenge, r.aufbiegung],
        r.stueck,
        `Untere Bewehrung ${seite} Ø${r.ds}/${Math.round(r.s * 100)} cm, Enden aufgebogen${
          r.unten ? " (untere Lage)" : ""
        }`,
        `Unten ${r.achse === "x" ? "a" : "b"}`
      );
    }

    /* ---- 2) obere Lage, falls vorgesehen ---- */
    if (f.obereLage) {
      for (const r of f.richtungen) {
        const seite = r.achse === "x" ? "Länge a" : "Breite b";
        const laenge = Math.max(0.2, r.spannweite - 2 * f.cU - f.obenDs / 1000);
        const stueck = imRaster(
          Math.max(0, r.verteilung - 2 * f.cU),
          f.obenS
        );
        k.s.stab(
          f.obenDs,
          "gerade",
          [laenge],
          stueck,
          `Obere Bewehrung ${seite} Ø${f.obenDs}/${Math.round(f.obenS * 100)} cm (konstruktiv)`,
          `Oben ${r.achse === "x" ? "a" : "b"}`
        );
      }
      k.hinweise.push(
        "Die obere Lage ist konstruktiv angesetzt. Sie ist erforderlich, wenn das Fundament abheben kann (Zug in der Stütze), bei ausmittiger Belastung oder wenn es über weiche Bereiche im Baugrund spannt – der genaue Bedarf folgt aus der Statik."
      );
    }

    /* ---- 3) Anschluss der Stütze ---- */
    if (projekt.details.stuetze === "ortbeton")
      k.hinweise.push(
        "Die Steckeisen der Ortbetonstütze sind Teil des Bauteils „Stütze“ (dort: Steckeisen Stützenfuß) und in dieser Liste bewusst nicht enthalten, damit sie nicht doppelt bestellt werden."
      );
    if (projekt.details.stuetze === "fertigteil")
      k.hinweise.push(
        "⚠ Fertigteilstütze im Köcher: Köcherwände, Verzahnung bzw. Vergussfuge und die Krafteinleitung in das Fundament sind gesondert zu bemessen (EC2 10.9.6) – sie sind in dieser Ermittlung nicht enthalten."
      );

    /* ---- 4) Fachliche Hinweise ---- */
    const haupt = f.richtungen[0];
    if (f.gedrungen)
      k.hinweise.push(
        `Längster Kragarm ${Math.round(
          Math.max(f.richtungen[0].krag, f.richtungen[1].krag) * 100
        )} cm ≤ Fundamenthöhe ${Math.round(
          f.h * 100
        )} cm: gedrungenes, biegesteifes Fundament. Der Sohldruck wird über Druckstreben abgetragen, eine Biege-Mindestbewehrung ist nach EC2 12 nicht erforderlich – angesetzt ist die konstruktive Bewehrung von ${zahl(
          AS_KONSTRUKTIV_FUNDAMENT
        )} cm²/m (die Biege-Mindestbewehrung einer Platte läge bei ${zahl(
          haupt.asBiegung
        )} cm²/m).`
      );
    else
      k.hinweise.push(
        `⚠ Längster Kragarm ${Math.round(
          Math.max(f.richtungen[0].krag, f.richtungen[1].krag) * 100
        )} cm > Fundamenthöhe ${Math.round(
          f.h * 100
        )} cm: Das Fundament wirkt biegeweich. Angesetzt ist die Biege-Mindestbewehrung nach EC2 9.2.1.1; sie genügt in der Regel NICHT – der Kragarm ist auf den tatsächlichen Sohldruck zu bemessen.`
      );

    k.hinweise.push(
      "⚠ Durchstanzen: Bei Einzelfundamenten ist der Durchstanznachweis im Stützenbereich (EC2 6.4) regelmäßig maßgebend und kann eine größere Fundamenthöhe oder eine Durchstanzbewehrung erfordern. Er ist hier NICHT enthalten."
    );
    k.hinweise.push(
      "⚠ Einzelfundament: Sohlspannung, Grundbruch- und Setzungsnachweis sowie die Fundamentabmessungen sind auf Basis eines Bodengutachtens nach EC7/ÖNORM B 1997 zu ermitteln. Bei Stützenmomenten entsteht eine ausmittige Sohlpressung – die Fundamentgröße ist dann gesondert nachzuweisen."
    );
    k.hinweise.push(
      "Die Stabenden sind aufgebogen ausgeführt: Nach EC2 9.8.2.2 muss die Bewehrung ab dem Schnittpunkt der Druckstrebe mit der Bewehrungslage verankert sein; ein gerader Stab reicht dafür in schmalen Fundamenten oft nicht."
    );
    k.hinweise.push(
      "⚠ Gründungstiefe: Außenfundamente sind frostfrei zu gründen (in Österreich üblicherweise mindestens 80–100 cm unter Geländeoberkante, regional auch tiefer)."
    );
    if (f.h < 0.3)
      k.hinweise.push(
        "⚠ Fundamenthöhe unter 30 cm: Einzelfundamente werden üblicherweise mindestens 30 cm hoch ausgeführt – für den Durchstanznachweis ist meist deutlich mehr nötig."
      );

    return {
      ac: Math.round(f.ac),
      nutzhoehe: haupt.d,
      asMinHaupt: haupt.asMin,
      asMinQuer: f.richtungen[1].asMin,
      gewaehlteMatte: `Ø${haupt.ds}/${Math.round(haupt.s * 100)} cm`,
      asVorhanden: haupt.asVorh,
      cnom: Math.round(f.cU * 1000),
      flaecheNetto: Math.round(f.a * f.b * 100) / 100,
      hauptLabel: f.gedrungen
        ? "erforderlich (konstruktiv)"
        : "erforderlich (As,min Biegung)",
      hauptEinheit: "cm²/m",
      wahlLabel: `Untere Lage Richtung ${haupt.achse === "x" ? "a" : "b"}`,
      flaecheLabel: "Sohlfläche",
    };
  },

  pruefe(projekt: Projekt): Pruefmeldung[] {
    const meldungen: Pruefmeldung[] = [];
    const a = projekt.masse.laenge;
    const b = projekt.masse.breite;
    const h = projekt.masse.hoehe;
    const sx = projekt.masse.stuetzeX;
    const sy = projekt.masse.stuetzeY;
    if (![a, b, h, sx, sy].every((v) => isFinite(v) && v > 0)) return meldungen;

    if (sx >= a)
      meldungen.push({
        feld: "stuetzeX",
        schwere: "fehler",
        text: `Die Stütze (${Math.round(sx * 100)} cm) ist mindestens so lang wie das Fundament (${Math.round(
          a * 100
        )} cm). Das Fundament muss die Stütze allseitig überragen.`,
      });
    if (sy >= b)
      meldungen.push({
        feld: "stuetzeY",
        schwere: "fehler",
        text: `Die Stütze (${Math.round(sy * 100)} cm) ist mindestens so breit wie das Fundament (${Math.round(
          b * 100
        )} cm). Das Fundament muss die Stütze allseitig überragen.`,
      });

    const cMin = C_MIN_UNTERGRUND[projekt.details?.untergrund] ?? 40;
    if (h < (2 * cMin) / 1000 + 0.1)
      meldungen.push({
        feld: "hoehe",
        schwere: "fehler",
        text: `Bei ${cMin} mm Mindestbetondeckung bleibt in einem ${Math.round(
          h * 100
        )} cm hohen Fundament kein Platz für zwei Bewehrungslagen. Fundament höher ausführen.`,
      });

    const krag = Math.max((a - sx) / 2, (b - sy) / 2);
    if (krag > 2 * h)
      meldungen.push({
        feld: "hoehe",
        schwere: "warnung",
        text: `Der längste Kragarm (${Math.round(
          krag * 100
        )} cm) ist mehr als doppelt so lang wie das Fundament hoch. Ein so flaches Einzelfundament biegt sich merklich und ist durchstanzgefährdet – Höhe und Bewehrung statisch nachweisen lassen.`,
      });

    const verhaeltnis = Math.max(a, b) / Math.min(a, b);
    if (verhaeltnis > 3)
      meldungen.push({
        feld: "laenge",
        schwere: "warnung",
        text: `Seitenverhältnis ${verhaeltnis.toFixed(
          1
        )} : 1 – ein so langgestrecktes Fundament verhält sich eher wie ein Streifenfundament. Prüfen, ob das Bauteil „Streifenfundament“ besser passt.`,
      });

    return meldungen;
  },
};
