/**
 * Bauteil: Stahlbetonträger (Unterzug, Überzug, Kragträger).
 *
 * Fachliche Grundlage (EC2 / ÖNORM B 1992-1-1, Abschnitt 9.2):
 *
 *  Längsbewehrung (9.2.1.1)
 *   – As,min = max(0,26 · fctm/fyk · bt · d ; 0,0013 · bt · d)
 *   – As,max = 0,04 · Ac
 *   – lichter Stababstand ≥ max(ds ; dg + 5 mm ; 20 mm) (EC2 8.2)
 *  Bewehrung an Endauflagern (9.2.1.2 / 9.2.1.4)
 *   – auch bei rechnerisch gelenkiger Lagerung ist die Einspannwirkung
 *     konstruktiv abzudecken: obere Bewehrung ≥ 25 % der Feldbewehrung
 *   – ≥ 25 % der Feldbewehrung sind bis zum Auflager zu führen und dort
 *     zu verankern
 *  Bügel (9.2.2)
 *   – ρw,min = 0,08 · √fck / fyk
 *   – Längsabstand s_l,max = 0,75 · d
 *   – Abstand der Bügelschenkel quer s_t,max = 0,75 · d ≤ 600 mm
 *  Oberflächenbewehrung (9.7 / Anhang J)
 *   – ab Bauteilhöhen über 60 cm seitliche Hautbewehrung zur
 *     Rissbreitenbegrenzung
 *
 * NICHT enthalten: Biege- und Querkraftbemessung, Torsion, Durchbiegung,
 * Kippsicherheit, Aufhängebewehrung bei indirekter Lagerung, Nachweise am
 * Rahmenknoten. Der hier ermittelte Bügelabstand ist der zulässige
 * HÖCHSTABSTAND aus der Mindestbewehrung – die Querkraftbemessung liefert
 * in aller Regel engere Bügel. Entsprechende Hinweise stehen im Ergebnis.
 */

import { Kennwerte, Projekt, Pruefmeldung } from "../types";
import { BETONKLASSEN, FYK, stabflaeche, uebergreifung } from "../normdaten";
import { Ansicht, Bauteilmodul, Kontext, Zeichenelement } from "./typen";
import { abrunden, buegelLagen, verteile, zahl } from "./helfer";

/** für Träger sinnvolle Längsstabdurchmesser [mm] */
const LAENGS_DURCHMESSER = [12, 14, 16, 20];
/** wählbare Bügeldurchmesser [mm] */
const BUEGEL_DURCHMESSER = [8, 10, 12];
/** lichter Mindestabstand der Längsstäbe [m] (EC2 8.2: max(ds; dg+5; 20 mm)) */
const MIN_LICHT = 0.02;
/** ab dieser Bauteilhöhe seitliche Hautbewehrung [m] */
const HAUT_AB_HOEHE = 0.6;
/** Abstand der Hautbewehrung über die Höhe [m] */
const HAUT_ABSTAND = 0.3;

/* ------------------------------------------------------------------ */
/* Bewehrungslayout – einmal berechnet, von Zeichnung und Liste genutzt */
/* ------------------------------------------------------------------ */

export interface TraegerLayout {
  /** Trägerlänge, Querschnittsbreite und -höhe [m] */
  l: number;
  b: number;
  h: number;
  /** statische Nutzhöhe [cm] */
  d: number;
  /** Achsabstand der Längsstäbe vom Rand [m] */
  c: number;
  /** Längsstäbe unten: Durchmesser [mm], Anzahl, Lagen, Anzahl je Lage */
  ds: number;
  n: number;
  lagen: number;
  jeLage: number[];
  /** obere Bewehrung: Montagestäbe bzw. Stützbewehrung */
  dsOben: number;
  nOben: number;
  /** Länge der oberen Stützbewehrung je Ende [m]; 0 = durchlaufend/keine */
  lStuetz: number;
  nStuetz: number;
  /** Bügel: Durchmesser [mm], Schnittigkeit, Abstände und Verdichtungslänge [m] */
  dsw: number;
  schnitte: number;
  s: number;
  sv: number;
  lv: number;
  buegelX: number[];
  /** Innenmaße des Bügels [m] */
  buegelB: number;
  buegelH: number;
  /** Hautbewehrung: Stäbe je Seite und Durchmesser */
  nHaut: number;
  dsHaut: number;
  /** Querschnitts- und Bewehrungsflächen [cm²] */
  ac: number;
  asMin: number;
  asVorh: number;
  /** erforderliche Bügelbewehrung [cm²/m] */
  aswErf: number;
  warnungen: string[];
}

/**
 * Ermittelt Stabwahl, Lagenaufteilung und Bügelbild aus Querschnitt, Länge,
 * Betonklasse und Betondeckung. Reine Funktion – dadurch zeigen Live-Skizze,
 * Bauplan und Stückliste garantiert dasselbe Bewehrungsbild.
 */
export function traegerLayout(projekt: Projekt): TraegerLayout {
  const l = projekt.masse.laenge;
  const b = projekt.masse.breite;
  const h = projekt.masse.hoehe;
  const cnom = projekt.parameter.betondeckung; // [mm]
  const system = projekt.details.system;
  const auflager = projekt.details.auflager;
  const warnungen: string[] = [];
  const beton =
    BETONKLASSEN.find((x) => x.name === projekt.parameter.betonklasse) ?? BETONKLASSEN[1];

  const ac = b * h * 10000; // [cm²]

  /* ---- Bügeldurchmesser: praktisch Ø8, bei kräftigen Trägern mehr ---- */
  let dsw = 8;

  /* ---- Stabwahl unten (EC2 9.2.1.1) ---- */
  // Nutzhöhe zunächst mit einer Annahme für ds, danach mit der Wahl verfeinert
  let ds = LAENGS_DURCHMESSER[0];
  let n = 2;
  let jeLage: number[] = [2];
  let d = 0;
  let asMin = 0;

  for (let runde = 0; runde < 3; runde++) {
    // Achse der unteren Stablage
    const c = (cnom + dsw) / 1000 + ds / 2000;
    d = (h - c) * 100; // [cm]
    asMin = Math.max((0.26 * beton.fctm * b * 100 * d) / FYK, 0.0013 * b * 100 * d);

    // wie viele Stäbe passen nebeneinander?
    const kern = Math.max(0.02, b - 2 * ((cnom + dsw) / 1000));
    const passend = LAENGS_DURCHMESSER.map((kandidat) => {
      const teilung = kandidat / 1000 + Math.max(MIN_LICHT, kandidat / 1000);
      const maxProLage = Math.max(2, Math.floor((kern + Math.max(MIN_LICHT, kandidat / 1000)) / teilung));
      const noetig = Math.max(2, Math.ceil(asMin / stabflaeche(kandidat)));
      return { ds: kandidat, n: noetig, maxProLage, lagen: Math.ceil(noetig / maxProLage) };
    });
    // bevorzugt der kleinste Durchmesser, der einlagig auskommt
    const wahl =
      passend.find((k) => k.lagen === 1) ?? passend.find((k) => k.lagen <= 2) ?? passend[passend.length - 1];
    if (wahl.ds === ds && runde > 0) break;
    ds = wahl.ds;
    n = wahl.n;
    jeLage =
      wahl.lagen <= 1
        ? [n]
        : [Math.min(wahl.maxProLage, Math.ceil(n / 2)), n - Math.min(wahl.maxProLage, Math.ceil(n / 2))];
    if (wahl.lagen > 2)
      warnungen.push(
        "⚠ Die Mindestbewehrung passt nicht in zwei Stablagen – Querschnitt vergrößern oder Bewehrung statisch festlegen."
      );
  }

  const c = (cnom + dsw) / 1000 + ds / 2000;
  const asVorh = n * stabflaeche(ds);
  if (asVorh > 0.04 * ac)
    warnungen.push("⚠ Die Längsbewehrung überschreitet As,max = 0,04·Ac – Querschnitt vergrößern.");

  /* ---- Bügel (EC2 9.2.2) ---- */
  // ds,w ≥ ds/4 (analog zur Stütze), praktisch mindestens Ø8
  dsw = BUEGEL_DURCHMESSER.find((x) => x >= Math.max(8, ds / 4)) ?? 12;
  const rhoMin = (0.08 * Math.sqrt(beton.fck)) / FYK;
  const aswErf = rhoMin * b * 100 * 100; // [cm²/m] Bügelquerschnitt je lfm

  // Schnittigkeit: quer darf der Schenkelabstand 0,75·d bzw. 60 cm nicht
  // überschreiten (EC2 9.2.2(8))
  const kernB = Math.max(0.02, b - 2 * (cnom / 1000) - dsw / 1000);
  const stMax = Math.min((0.75 * d) / 100, 0.6);
  let schnitte = 2;
  if (kernB > stMax) {
    if (n >= 4) schnitte = 4;
    else
      warnungen.push(
        `⚠ Bügelschenkelabstand ${Math.round(kernB * 100)} cm > zulässig ${Math.round(
          stMax * 100
        )} cm – zusätzliche Bügelschenkel erforderlich, Bewehrungsführung statisch klären.`
      );
  }

  // Regelabstand: aus Mindestbewehrung, begrenzt durch s_l,max = 0,75·d
  const aswBuegel = schnitte * stabflaeche(dsw); // [cm²] je Bügel
  const sAusMin = (aswBuegel / aswErf) * 100; // [cm]
  // 0,75·d nach EC2 9.2.2(6); zusätzlich baustellenübliche Obergrenze 30 cm –
  // größere Bügelabstände werden im Hochbau praktisch nicht ausgeführt.
  const sZul = Math.min(sAusMin, 0.75 * d, 30);
  const s = abrunden(sZul, 5) / 100; // [m]
  const sv = abrunden((s * 100) / 2, 5) / 100; // verdichteter Auflagerbereich
  const lv = Math.min(h, l / 4); // Verdichtungslänge je Ende

  const randBuegel = cnom / 1000 + dsw / 2000;
  const buegelX = buegelLagen(l, randBuegel, s, sv, lv);

  /* ---- obere Bewehrung ---- */
  // Montagestäbe halten den Bügelkorb; beim Kragträger ist die obere Lage
  // die Hauptbewehrung und tauscht mit der unteren die Rolle.
  const kragarm = system === "kragarm";
  const dsOben = kragarm ? ds : 12;
  const nOben = kragarm ? n : 2;

  // Stützbewehrung an den Endauflagern (nicht beim Kragarm – dort läuft die
  // obere Bewehrung ohnehin durch)
  let nStuetz = 0;
  let lStuetz = 0;
  if (!kragarm) {
    const anteil =
      system === "durchlauf" ? 1 : auflager === "eingespannt" ? 0.5 : 0.25;
    nStuetz = Math.max(2, Math.ceil(anteil * n));
    lStuetz = Math.min(l - 2 * c, (system === "durchlauf" ? 0.35 : 0.25) * l);
  }

  /* ---- Hautbewehrung (EC2 9.7) ---- */
  const dsHaut = 10;
  const nHaut =
    h > HAUT_AB_HOEHE ? Math.max(1, Math.ceil((h - 2 * c) / HAUT_ABSTAND) - 1) : 0;

  return {
    l, b, h, d, c, ds, n,
    lagen: jeLage.length,
    jeLage,
    dsOben, nOben, lStuetz, nStuetz,
    dsw, schnitte, s, sv, lv,
    buegelX,
    buegelB: b - 2 * (cnom / 1000) - dsw / 1000,
    buegelH: h - 2 * (cnom / 1000) - dsw / 1000,
    nHaut, dsHaut,
    ac,
    asMin,
    asVorh,
    aswErf,
    warnungen,
  };
}

/* ------------------------------------------------------------------ */
/* Klartexte der Detailauswahlen                                       */
/* ------------------------------------------------------------------ */

const SYSTEM_NAME: Record<string, string> = {
  einfeld: "Einfeldträger",
  durchlauf: "Durchlaufträger",
  kragarm: "Kragträger",
};

const AUFLAGER_NAME: Record<string, string> = {
  wand: "Auflager auf Wand",
  stuetze: "Auflager auf Stütze",
  eingespannt: "biegesteif eingespannt",
};

const LAGE_NAME: Record<string, string> = {
  unterzug: "Decke beidseitig (Plattenbalken)",
  randunterzug: "Decke einseitig (Randunterzug)",
  frei: "freiliegender Balken",
};

/* ------------------------------------------------------------------ */
/* Das Modul                                                           */
/* ------------------------------------------------------------------ */

export const traeger: Bauteilmodul = {
  id: "traeger",
  name: "Träger",
  beschreibung: "Unterzug oder Balken mit Längsbewehrung und Bügeln",
  bildId: "icon_traeger",
  hatOeffnungen: false,
  flaechenbewehrt: false,
  detailTitel: "System und Auflagerung",
  detailHilfe:
    "Statisches System, Auflagerart und Lage im Bauwerk bestimmen die obere Stützbewehrung, die Verankerung am Auflager und die Bügelverdichtung.",
  planinhalt: "Bewehrungsplan Träger (Längs- und Querschnitt)",

  masse: [
    {
      schluessel: "laenge",
      label: "Trägerlänge",
      einheit: "m",
      min: 0.5,
      max: 30,
      standard: 5.0,
      hinweis: "Gesamtlänge inkl. Auflager",
    },
    {
      schluessel: "breite",
      label: "Querschnitt b",
      einheit: "cm",
      min: 0.12,
      max: 1.5,
      schritt: 5,
      standard: 0.25,
      hinweis: "üblich: 20–40 cm",
    },
    {
      schluessel: "hoehe",
      label: "Querschnitt h",
      einheit: "cm",
      min: 0.15,
      max: 2.0,
      schritt: 5,
      standard: 0.5,
      hinweis: "Faustwert: h ≈ L/12",
    },
  ],

  details: [
    {
      schluessel: "system",
      label: "Statisches System",
      standard: "einfeld",
      optionen: [
        { wert: "einfeld", titel: "Einfeldträger (beidseitig aufgelagert)", bildId: "auflager" },
        { wert: "durchlauf", titel: "Durchlaufträger (über Auflager durchlaufend)", bildId: "wand_weiter" },
        { wert: "kragarm", titel: "Kragträger (einseitig eingespannt)", bildId: "freier_rand" },
      ],
    },
    {
      schluessel: "auflager",
      label: "Auflagerart",
      standard: "wand",
      optionen: [
        { wert: "wand", titel: "Wand / Mauerwerk", bildId: "auflager" },
        { wert: "stuetze", titel: "Stahlbetonstütze", bildId: "wandstoss" },
        { wert: "eingespannt", titel: "biegesteif eingespannt (Rahmenknoten)", bildId: "ecke" },
      ],
    },
    {
      schluessel: "lage",
      label: "Lage im Bauwerk",
      standard: "unterzug",
      optionen: [
        { wert: "unterzug", titel: "Unterzug, Decke beidseitig", bildId: "decke_ueber" },
        { wert: "randunterzug", titel: "Randunterzug, Decke einseitig", bildId: "decke_unter" },
        { wert: "frei", titel: "freiliegender Balken", bildId: "freier_rand" },
      ],
    },
  ],

  masseText: (p) =>
    `Träger ${Math.round(p.masse.breite * 100)}/${Math.round(p.masse.hoehe * 100)} cm · L = ${zahl(
      p.masse.laenge
    )} m`,

  /* ---------------- Zeichnung: Längsschnitt + Querschnitt ---------------- */

  zeichnung(projekt: Projekt): Ansicht[] {
    const t = traegerLayout(projekt);
    const kragarm = projekt.details.system === "kragarm";

    /* --- Längsschnitt --- */
    const laengs: Zeichenelement[] = [
      { art: "flaeche", x: 0, y: 0, b: t.l, h: t.h, ton: "beton" },
      { art: "rahmen", x: 0, y: 0, b: t.l, h: t.h, stil: "kante" },
    ];
    // Hauptbewehrung liegt beim Kragträger oben, sonst unten – je Stablage
    // eine Linie; die Gegenseite bekommt die Linie der Montagestäbe.
    t.jeLage.forEach((_, i) => {
      const versatz = i * (t.ds / 1000 + MIN_LICHT);
      const y = kragarm ? t.h - t.c - versatz : t.c + versatz;
      laengs.push({ art: "linie", x1: t.c, y1: y, x2: t.l - t.c, y2: y, stil: "stahl" });
    });
    laengs.push({
      art: "linie",
      x1: t.c,
      y1: kragarm ? t.c : t.h - t.c,
      x2: t.l - t.c,
      y2: kragarm ? t.c : t.h - t.c,
      stil: "stahl",
    });
    // obere Stützbewehrung an den Enden
    if (t.nStuetz > 0 && t.lStuetz > 0) {
      const y = t.h - t.c - Math.max(0.015, t.ds / 1000);
      laengs.push({ art: "linie", x1: t.c, y1: y, x2: t.c + t.lStuetz, y2: y, stil: "stahl" });
      laengs.push({
        art: "linie",
        x1: t.l - t.c - t.lStuetz,
        y1: y,
        x2: t.l - t.c,
        y2: y,
        stil: "stahl",
      });
    }
    // Hautbewehrung: je eine Linie in halber Höhe andeuten
    if (t.nHaut > 0)
      laengs.push({
        art: "linie",
        x1: t.c,
        y1: t.h / 2,
        x2: t.l - t.c,
        y2: t.h / 2,
        stil: "stahl",
      });
    // Bügel als senkrechte Striche in ihrer tatsächlichen Lage
    for (const x of t.buegelX)
      laengs.push({ art: "linie", x1: x, y1: t.c / 2, x2: x, y2: t.h - t.c / 2, stil: "stahl" });
    // Grenzen der Bügelverdichtung
    if (t.l > 2 * t.lv) {
      laengs.push({ art: "linie", x1: t.lv, y1: 0, x2: t.lv, y2: t.h, stil: "strich" });
      laengs.push({ art: "linie", x1: t.l - t.lv, y1: 0, x2: t.l - t.lv, y2: t.h, stil: "strich" });
    }

    const ansichtLaengs: Ansicht = {
      id: "laengsschnitt",
      titel: "Längsschnitt",
      breite: t.l,
      hoehe: t.h,
      elemente: laengs,
      massketteX: t.l > 2 * t.lv ? [0, t.lv, t.l - t.lv, t.l] : [0, t.l],
      massketteY: [0, t.h],
      randtexte: [
        {
          seite: "unten",
          text: kragarm
            ? "Einspannung links · freies Ende rechts"
            : AUFLAGER_NAME[projekt.details.auflager] ?? "",
        },
        { seite: "oben", text: LAGE_NAME[projekt.details.lage] ?? "" },
      ],
      fuss: `${t.n} Ø${t.ds} ${kragarm ? "oben" : "unten"} · Bügel Ø${t.dsw}/${Math.round(
        t.s * 100
      )} (Enden /${Math.round(t.sv * 100)})`,
    };

    /* --- Querschnitt --- */
    const cq = projekt.parameter.betondeckung / 1000;
    const quer: Zeichenelement[] = [
      { art: "flaeche", x: 0, y: 0, b: t.b, h: t.h, ton: "beton" },
      { art: "rahmen", x: 0, y: 0, b: t.b, h: t.h, stil: "kante" },
      {
        art: "polylinie",
        geschlossen: true,
        stil: "stahl",
        punkte: [
          [cq, cq],
          [t.b - cq, cq],
          [t.b - cq, t.h - cq],
          [cq, t.h - cq],
        ],
      },
    ];
    // zweiter (innerer) Bügel bei 4-schnittiger Ausführung
    if (t.schnitte === 4) {
      const rand = t.b / 4;
      quer.push({
        art: "polylinie",
        geschlossen: true,
        stil: "stahl",
        punkte: [
          [rand, cq],
          [t.b - rand, cq],
          [t.b - rand, t.h - cq],
          [rand, t.h - cq],
        ],
      });
    }
    // Hauptbewehrung lagenweise (Kragträger: oben, sonst unten)
    t.jeLage.forEach((anzahl, i) => {
      const versatz = i * (t.ds / 1000 + MIN_LICHT);
      const y = kragarm ? t.h - t.c - versatz : t.c + versatz;
      for (const x of verteile(t.c, t.b - t.c, anzahl))
        quer.push({ art: "kreis", x, y, r: t.ds / 2000, ton: "stahl" });
    });
    // Montagestäbe auf der Gegenseite
    for (const x of verteile(t.c, t.b - t.c, 2))
      quer.push({
        art: "kreis",
        x,
        y: kragarm ? t.c : t.h - t.c,
        r: (kragarm ? 12 : t.dsOben) / 2000,
        ton: "stahl",
      });
    // Hautbewehrung seitlich
    if (t.nHaut > 0) {
      const hoehen = verteile(t.c + HAUT_ABSTAND / 2, t.h - t.c - HAUT_ABSTAND / 2, t.nHaut);
      for (const y of hoehen) {
        quer.push({ art: "kreis", x: t.c, y, r: t.dsHaut / 2000, ton: "stahl" });
        quer.push({ art: "kreis", x: t.b - t.c, y, r: t.dsHaut / 2000, ton: "stahl" });
      }
    }

    const ansichtQuer: Ansicht = {
      id: "querschnitt",
      titel: "Querschnitt A–A",
      breite: t.b,
      hoehe: t.h,
      elemente: quer,
      massketteX: [0, t.b],
      massketteY: [0, t.h],
      eigenerMassstab: true,
      fuss: `${t.n} Ø${t.ds} · Bügel Ø${t.dsw} ${t.schnitte}-schnittig · c_nom = ${projekt.parameter.betondeckung} mm`,
    };

    return [ansichtLaengs, ansichtQuer];
  },

  /* ---------------- Bewehrung ---------------- */

  bewehrung(k: Kontext): Kennwerte {
    const projekt = k.projekt;
    const t = traegerLayout(projekt);
    const { system, auflager, lage } = projekt.details;
    const kragarm = system === "kragarm";
    for (const w of t.warnungen) k.hinweise.push(w);

    const l0 = uebergreifung(t.ds); // Verankerungs-/Übergreifungslänge ≈ 50·ds
    const haken = (2 * 10 * t.dsw) / 1000; // Bügelhaken 2 × 10·ds,w
    const stabLaenge = Math.max(0.3, t.l - 2 * (projekt.parameter.betondeckung / 1000));

    /* ---- 1) Hauptbewehrung ---- */
    // Beim Kragträger liegt die Hauptbewehrung oben und ist in das
    // einspannende Bauteil zu verankern; sonst liegt sie unten im Feld.
    if (kragarm) {
      k.s.stab(
        t.ds,
        "winkel",
        [t.l - (projekt.parameter.betondeckung / 1000), l0],
        t.n,
        `Kragarmbewehrung oben, in die Einspannung verankert (${t.n} Ø${t.ds})`,
        "Kragarm oben"
      );
      k.s.stab(12, "gerade", [stabLaenge], 2, "Montagestäbe unten (2 Ø12)", "Montage unten");
      k.hinweise.push(
        "⚠ Kragträger: Die obere Bewehrung ist die Hauptbewehrung und muss über die Einspannung hinaus verankert werden. Kragmoment, Verankerung und Durchbiegung sind zwingend statisch nachzuweisen."
      );
    } else {
      k.s.stab(
        t.ds,
        "gerade",
        [stabLaenge],
        t.n,
        `Feldbewehrung unten (${t.n} Ø${t.ds}${t.lagen > 1 ? ", 2-lagig" : ""})`,
        "Feld unten"
      );
      k.s.stab(
        t.dsOben,
        "gerade",
        [stabLaenge],
        t.nOben,
        `Montagestäbe oben (${t.nOben} Ø${t.dsOben})`,
        "Montage oben"
      );
    }

    /* ---- 2) Obere Stützbewehrung an den Auflagern (EC2 9.2.1.2) ---- */
    if (t.nStuetz > 0 && t.lStuetz > 0) {
      // je Auflager ein Satz – der Träger hat zwei Enden
      k.s.stab(
        t.ds,
        "gerade",
        [t.lStuetz + l0],
        t.nStuetz * 2,
        system === "durchlauf"
          ? `Stützbewehrung oben über den Auflagern (${t.nStuetz} Ø${t.ds} je Auflager)`
          : `Obere Bewehrung Endauflager, Einspannwirkung (${t.nStuetz} Ø${t.ds} je Auflager)`,
        "Stütz oben"
      );
    }

    /* ---- 3) Bügel ---- */
    // Bei 4-schnittiger Ausführung liegt an jeder Stelle ein zweiter,
    // schmalerer Bügel; er wird als eigene Position geführt.
    k.s.stab(
      t.dsw,
      "buegel_rechteck",
      [t.buegelB, t.buegelH, t.buegelB, t.buegelH, haken],
      t.buegelX.length,
      `Bügel Ø${t.dsw}/${Math.round(t.s * 100)} cm, Auflagerbereiche /${Math.round(t.sv * 100)} cm`,
      "Bügel"
    );
    if (t.schnitte === 4) {
      const innenB = t.buegelB / 2;
      k.s.stab(
        t.dsw,
        "buegel_rechteck",
        [innenB, t.buegelH, innenB, t.buegelH, haken],
        t.buegelX.length,
        `Innenbügel Ø${t.dsw}/${Math.round(t.s * 100)} cm (4-schnittig)`,
        "Innenbügel"
      );
    }

    /* ---- 4) Hautbewehrung (EC2 9.7) ---- */
    if (t.nHaut > 0) {
      k.s.stab(
        t.dsHaut,
        "gerade",
        [stabLaenge],
        2 * t.nHaut,
        `Hautbewehrung seitlich (2 × ${t.nHaut} Ø${t.dsHaut})`,
        "Hautbewehrung"
      );
      k.hinweise.push(
        `Bauteilhöhe ${zahl(t.h)} m > 0,60 m: seitliche Oberflächenbewehrung nach EC2 9.7 zur Rissbreitenbegrenzung angesetzt.`
      );
    }

    /* ---- 5) Anschluss an die Decke ---- */
    // Bewusst OHNE eigene Position: Die Anschlusseisen zwischen Decke und
    // Träger gehören zur Deckenplatte und sind in deren Liste bereits
    // enthalten. Würden sie hier nochmals erscheinen, zählte der Kunde beim
    // Rechnen beider Bauteile denselben Stahl doppelt.
    if (lage === "unterzug" || lage === "randunterzug") {
      k.hinweise.push(
        "Die Anschlussbewehrung zwischen Decke und Träger ist Teil der Deckenplatte und wird dort ermittelt – sie ist in dieser Liste bewusst nicht enthalten, damit sie nicht doppelt bestellt wird."
      );
      k.hinweise.push(
        "⚠ Plattenbalkenwirkung: Die mitwirkende Plattenbreite (EC2 5.3.2.1), der Anschluss Gurt/Steg (EC2 6.2.4) und – bei indirekter Lagerung – die Aufhängebewehrung sind statisch nachzuweisen."
      );
    }
    if (lage === "randunterzug")
      k.hinweise.push(
        "⚠ Randunterzug: Die einseitig anschließende Decke erzeugt Torsion im Träger. Torsionsbewehrung (geschlossene Bügel und Längsstäbe nach EC2 6.3) ist statisch nachzuweisen."
      );

    /* ---- 6) Verankerung am Auflager (EC2 9.2.1.4) ---- */
    if (!kragarm)
      k.hinweise.push(
        `Am Endauflager sind mindestens 25 % der Feldbewehrung (hier ${Math.max(
          2,
          Math.ceil(0.25 * t.n)
        )} Ø${t.ds}) durchzuführen und zu verankern; die erforderliche Verankerungslänge ist nach EC2 8.4 nachzuweisen (ggf. Haken oder Winkelhaken).`
      );
    if (auflager === "eingespannt")
      k.hinweise.push(
        "Biegesteifer Anschluss: Der Rahmenknoten (Umlenkkräfte, Verankerung der Knotenbewehrung, EC2 J.2) gehört gesondert nachgewiesen."
      );

    /* ---- 7) Fachliche Hinweise ---- */
    k.hinweise.push(
      "⚠ Träger: Enthalten ist ausschließlich die Mindestbewehrung nach EC2 9.2. Der angegebene Bügelabstand ist der zulässige HÖCHSTABSTAND – die Querkraftbemessung (EC2 6.2) ergibt in der Regel engere Bügel, insbesondere an den Auflagern. Biegebemessung, Querkraft, Torsion, Durchbiegung und Kippsicherheit sind statisch nachzuweisen."
    );
    const schlankheit = t.l / t.h;
    if (schlankheit > 18)
      k.hinweise.push(
        `⚠ Schlankheit L/h = ${schlankheit.toFixed(
          1
        )} – Durchbiegungsnachweis nach EC2 7.4 maßgebend; Trägerhöhe prüfen (Faustwert h ≈ L/12 bis L/15).`
      );
    if (schlankheit < 3)
      k.hinweise.push(
        `⚠ Gedrungener Träger (L/h = ${schlankheit.toFixed(
          1
        )}): Es liegt ein wandartiger Träger vor – Bemessung mit einem Stabwerkmodell nach EC2 6.5, nicht als Balken.`
      );

    return {
      ac: Math.round(t.ac),
      nutzhoehe: Math.round(t.d * 10) / 10,
      asMinHaupt: Math.round(t.asMin * 100) / 100,
      asMinQuer: Math.round(t.aswErf * 100) / 100,
      gewaehlteMatte: `${t.n} Ø${t.ds}`,
      asVorhanden: Math.round(t.asVorh * 100) / 100,
      cnom: k.cnom,
      flaecheNetto: Math.round(t.b * t.h * 1000) / 1000,
      hauptLabel: kragarm
        ? "erforderlich (As,min Kragarmbewehrung)"
        : "erforderlich (As,min Feldbewehrung)",
      hauptEinheit: "cm²",
      wahlLabel: kragarm ? "Bewehrung oben" : "Feldbewehrung",
      flaecheLabel: "Betonquerschnitt",
    };
  },

  pruefe(projekt: Projekt): Pruefmeldung[] {
    const meldungen: Pruefmeldung[] = [];
    const l = projekt.masse.laenge;
    const b = projekt.masse.breite;
    const h = projekt.masse.hoehe;
    if (!isFinite(l) || !isFinite(b) || !isFinite(h) || b <= 0 || h <= 0 || l <= 0)
      return meldungen;

    const cnomM = projekt.parameter.betondeckung / 1000;
    if (b < 4 * cnomM + 0.04)
      meldungen.push({
        feld: "breite",
        schwere: "fehler",
        text: `Bei c_nom = ${projekt.parameter.betondeckung} mm bleibt in einem ${Math.round(
          b * 100
        )} cm breiten Steg kein einbaubarer Bewehrungskorb. Querschnitt vergrößern oder Betondeckung verringern.`,
      });

    if (h < b)
      meldungen.push({
        feld: "hoehe",
        schwere: "warnung",
        text: `Der Querschnitt ist breiter als hoch (${Math.round(b * 100)}/${Math.round(
          h * 100
        )} cm). Als flachliegendes Bauteil ist er eher eine Platte – prüfen, ob „Deckenplatte“ das passende Bauteil ist.`,
      });

    const schlankheit = l / h;
    if (schlankheit > 18)
      meldungen.push({
        feld: "hoehe",
        schwere: "warnung",
        text: `L/h = ${schlankheit.toFixed(
          1
        )}: sehr schlanker Träger. Als Faustwert gilt h ≈ L/12 bis L/15 – hier wären das rund ${Math.round(
          (l / 12) * 100
        )} cm. Der Durchbiegungsnachweis wird maßgebend.`,
      });
    else if (schlankheit < 3)
      meldungen.push({
        feld: "laenge",
        schwere: "warnung",
        text: `L/h = ${schlankheit.toFixed(
          1
        )}: wandartiger Träger. Dieser ist mit einem Stabwerkmodell nach EC2 6.5 zu bemessen, nicht als Balken – die hier ermittelte Bewehrung reicht dafür nicht aus.`,
      });

    return meldungen;
  },
};
