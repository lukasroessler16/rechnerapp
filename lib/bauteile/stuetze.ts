/**
 * Bauteil: Stahlbetonstütze mit Rechteckquerschnitt.
 *
 * Fachliche Grundlage (EC2 / ÖNORM B 1992-1-1, Abschnitt 9.5):
 *
 *  Längsbewehrung (9.5.2)
 *   – As,min = max(0,10 · N_Ed / f_yd ; 0,002 · Ac)
 *     Der lastabhängige Anteil 0,10·N_Ed/f_yd kann hier NICHT ermittelt
 *     werden (die Normalkraft ist nicht bekannt) – es wird der geometrische
 *     Mindestwert 0,002·Ac angesetzt und im Ergebnis ausdrücklich darauf
 *     hingewiesen.
 *   – As,max = 0,04 · Ac (außerhalb von Stößen)
 *   – mindestens ein Stab je Ecke, in Österreich üblich ds ≥ 12 mm
 *   – Stababstand entlang einer Querschnittsseite ≤ 300 mm
 *
 *  Querbewehrung / Bügel (9.5.3)
 *   – ds,w ≥ max(6 mm ; ds,längs/4)
 *   – s_cl,tmax = min(20 · ds,längs ; kleinere Querschnittsseite ; 400 mm)
 *   – Verdichtung auf 0,6 · s über eine Länge = größere Querschnittsseite
 *     ober- und unterhalb von Decken/Trägern sowie im Stoßbereich
 *
 * NICHT enthalten: Knicknachweis (Schlankheit, Theorie II. Ordnung),
 * Bemessung auf N/M, Erdbeben, Brandschutz. Das bleibt der Statik vorbehalten.
 */

import { Kennwerte, Projekt, Pruefmeldung } from "../types";
import { stabflaeche, uebergreifung } from "../normdaten";
import { Ansicht, Bauteilmodul, Kontext, Zeichenelement } from "./typen";
import { abrunden, buegelLagen, verteile, zahl } from "./helfer";

/** für Stützen sinnvolle Längsstabdurchmesser [mm] */
const LAENGS_DURCHMESSER = [12, 14, 16, 20];
/** wählbare Bügeldurchmesser [mm] */
const BUEGEL_DURCHMESSER = [6, 8, 10, 12];
/** größter zulässiger Achsabstand der Längsstäbe entlang einer Seite [m] */
const MAX_STABABSTAND = 0.3;

/* ------------------------------------------------------------------ */
/* Bewehrungslayout – einmal berechnet, von Zeichnung und Liste genutzt */
/* ------------------------------------------------------------------ */

export interface StuetzenLayout {
  /** Querschnitt [m] */
  b: number;
  t: number;
  /** Stützenhöhe [m] */
  h: number;
  /** Betondeckung [m] */
  c: number;
  /** Längsstabdurchmesser [mm] und Anzahl */
  ds: number;
  n: number;
  /** Stäbe je Seite (inkl. Ecken) */
  nx: number;
  ny: number;
  /** Bügeldurchmesser [mm], Regelabstand und verdichteter Abstand [m] */
  dsw: number;
  s: number;
  sv: number;
  /** Länge des Verdichtungsbereichs oben und unten [m] */
  lv: number;
  /** Höhenlagen aller Bügel [m] */
  buegelLagen: number[];
  /** Bruttoquerschnitt [cm²] und Bewehrungsflächen [cm²] */
  ac: number;
  asMin: number;
  asVorh: number;
  /** Achslage der Bügelmitte, Innenmaße des Bügels [m] */
  buegelB: number;
  buegelT: number;
  /** Achspositionen der Längsstäbe im Querschnitt [m] */
  stabPunkte: [number, number][];
  /** Warnungen aus der Layoutfindung */
  warnungen: string[];
}

/**
 * Ermittelt Stabwahl, Anzahl und Bügelbild aus Querschnitt, Höhe und
 * Betondeckung. Reine Funktion – damit Skizze, Bauplan und Stückliste
 * garantiert dasselbe Bewehrungsbild zeigen.
 */
export function stuetzenLayout(projekt: Projekt): StuetzenLayout {
  const b = projekt.masse.breite;
  const t = projekt.masse.tiefe;
  const h = projekt.masse.hoehe;
  const cnom = projekt.parameter.betondeckung; // [mm]
  const warnungen: string[] = [];

  const ac = b * t * 10000; // [cm²]
  // geometrische Mindestbewehrung; die 4 Eckstäbe Ø12 sind zusätzlich Pflicht
  const asMin = Math.max(0.002 * ac, 4 * stabflaeche(12));

  // Bügeldurchmesser vorläufig, damit die Kernmaße bestimmt werden können
  let dsw = 8;
  let ds = LAENGS_DURCHMESSER[0];
  let nx = 2;
  let ny = 2;
  let asVorh = 0;

  for (let zusatz = 0; zusatz < 8; zusatz++) {
    const c = (cnom + dsw) / 1000; // Achse Längsstab ≈ Deckung + Bügel
    const kernB = Math.max(0.02, b - 2 * c);
    const kernT = Math.max(0.02, t - 2 * c);
    nx = Math.max(2, Math.ceil(kernB / MAX_STABABSTAND) + 1) + zusatz;
    ny = Math.max(2, Math.ceil(kernT / MAX_STABABSTAND) + 1) + zusatz;
    const n = 2 * nx + 2 * ny - 4;
    const passend = LAENGS_DURCHMESSER.find((d) => n * stabflaeche(d) >= asMin);
    if (passend) {
      ds = passend;
      asVorh = n * stabflaeche(passend);
      break;
    }
    // nichts gefunden: mit dem größten Durchmesser weiterrechnen und mehr Stäbe
    ds = LAENGS_DURCHMESSER[LAENGS_DURCHMESSER.length - 1];
    asVorh = n * stabflaeche(ds);
    if (zusatz === 7)
      warnungen.push(
        "⚠ Die geometrische Mindestbewehrung lässt sich mit Lagerstäben nicht wirtschaftlich abdecken – Querschnitt vergrößern oder Bewehrung statisch festlegen."
      );
  }

  // Bügeldurchmesser endgültig: EC2 9.5.3 fordert ds,w ≥ max(6 mm; ds/4).
  // In Österreich sind gebogene Stützenbügel praktisch immer mindestens Ø8 –
  // Ø6 wird für Bügelkörbe nicht verarbeitet.
  const dswErf = Math.max(8, ds / 4);
  dsw = BUEGEL_DURCHMESSER.find((d) => d >= dswErf) ?? 12;

  const c = (cnom + dsw) / 1000;
  const n = 2 * nx + 2 * ny - 4;
  asVorh = n * stabflaeche(ds);

  if (asVorh > 0.04 * ac)
    warnungen.push(
      "⚠ Die gewählte Längsbewehrung überschreitet As,max = 0,04·Ac – Querschnitt vergrößern."
    );

  /* ---- Bügelabstände (EC2 9.5.3) ---- */
  // auf 5-cm-Werte abrunden: baustellentaugliche, runde Bügelabstände
  const sMaxMm = Math.min(20 * ds, Math.min(b, t) * 1000, 400);
  const s = abrunden(sMaxMm, 50) / 1000; // Regelabstand [m]
  const sv = abrunden(0.6 * sMaxMm, 50) / 1000; // Verdichtungsbereich [m]
  const lv = Math.max(b, t); // Länge des Verdichtungsbereichs [m]

  /* ---- Höhenlagen der Bügel ---- */
  const lagen = buegelLagen(h, c, s, sv, lv);

  /* ---- Stabpositionen im Querschnitt ---- */
  const xs = verteile(c, b - c, nx);
  const ys = verteile(c, t - c, ny);
  const stabPunkte: [number, number][] = [];
  for (const x of xs) stabPunkte.push([x, ys[0]], [x, ys[ys.length - 1]]);
  for (const y of ys.slice(1, -1)) stabPunkte.push([xs[0], y], [xs[xs.length - 1], y]);

  return {
    b, t, h, c, ds, n, nx, ny, dsw, s, sv, lv,
    buegelLagen: lagen,
    ac,
    asMin,
    asVorh,
    buegelB: b - 2 * (cnom / 1000) - dsw / 1000,
    buegelT: t - 2 * (cnom / 1000) - dsw / 1000,
    stabPunkte,
    warnungen,
  };
}

/* ------------------------------------------------------------------ */
/* Klartexte der Detailauswahlen                                       */
/* ------------------------------------------------------------------ */

const FUSS_NAME: Record<string, string> = {
  fundament: "Einzelfundament",
  bodenplatte: "Bodenplatte",
  decke_unter: "Decke unten",
  frei: "frei / ohne Anschluss",
};

const KOPF_NAME: Record<string, string> = {
  decke_ueber: "Deckenanschluss oben",
  traeger: "Träger / Unterzug",
  stuetze_weiter: "Stütze läuft weiter",
  frei: "freies Stützenende",
};

/* ------------------------------------------------------------------ */
/* Das Modul                                                           */
/* ------------------------------------------------------------------ */

export const stuetze: Bauteilmodul = {
  id: "stuetze",
  name: "Stütze",
  beschreibung: "Stahlbetonstütze mit Rechteckquerschnitt, Längsstäbe und Bügel",
  bildId: "icon_stuetze",
  hatOeffnungen: false,
  flaechenbewehrt: false,
  detailTitel: "Anschlüsse der Stütze",
  detailHilfe:
    "Wie ist die Stütze am Fuß und am Kopf angeschlossen? Daraus ergeben sich Steckeisen, Übergreifungsstöße und die Bügelverdichtung.",
  planinhalt: "Bewehrungsplan Stütze (Längs- und Querschnitt)",

  masse: [
    {
      schluessel: "breite",
      label: "Querschnitt b",
      einheit: "cm",
      min: 0.15,
      max: 2.0,
      schritt: 5,
      standard: 0.3,
      hinweis: "üblich: 25–50 cm",
    },
    {
      schluessel: "tiefe",
      label: "Querschnitt h",
      einheit: "cm",
      min: 0.15,
      max: 2.0,
      schritt: 5,
      standard: 0.3,
      hinweis: "üblich: 25–50 cm",
    },
    {
      schluessel: "hoehe",
      label: "Stützenhöhe",
      einheit: "m",
      min: 0.5,
      max: 20,
      standard: 3.0,
      hinweis: "lichte Geschosshöhe",
    },
  ],

  details: [
    {
      schluessel: "fuss",
      label: "Anschluss unten (Stützenfuß)",
      standard: "fundament",
      optionen: [
        { wert: "fundament", titel: "Einzelfundament", bildId: "streifenfundament" },
        { wert: "bodenplatte", titel: "Bodenplatte", bildId: "bodenplatte" },
        { wert: "decke_unter", titel: "Decke (Stütze steht auf Decke)", bildId: "decke_unter" },
        { wert: "frei", titel: "frei / ohne Anschluss", bildId: "freier_rand" },
      ],
    },
    {
      schluessel: "kopf",
      label: "Anschluss oben (Stützenkopf)",
      standard: "decke_ueber",
      optionen: [
        { wert: "decke_ueber", titel: "Deckenanschluss oben", bildId: "decke_ueber" },
        { wert: "traeger", titel: "Träger / Unterzug", bildId: "wandstoss" },
        { wert: "stuetze_weiter", titel: "Stütze läuft weiter (Stoß)", bildId: "wand_weiter" },
        { wert: "frei", titel: "freies Stützenende", bildId: "freier_rand" },
      ],
    },
  ],

  masseText: (p) =>
    `Stütze ${Math.round(p.masse.breite * 100)}/${Math.round(p.masse.tiefe * 100)} cm · h = ${zahl(
      p.masse.hoehe
    )} m`,

  /* ---------------- Zeichnung: Längsschnitt + Querschnitt ---------------- */

  zeichnung(projekt: Projekt): Ansicht[] {
    const l = stuetzenLayout(projekt);

    /* --- Längsschnitt --- */
    const laengs: Zeichenelement[] = [
      { art: "flaeche", x: 0, y: 0, b: l.b, h: l.h, ton: "beton" },
      { art: "rahmen", x: 0, y: 0, b: l.b, h: l.h, stil: "kante" },
    ];
    // Längsstäbe (nur die beiden äußeren Stablagen sind im Schnitt sichtbar)
    for (const x of [l.c, l.b - l.c])
      laengs.push({ art: "linie", x1: x, y1: l.c, x2: x, y2: l.h - l.c, stil: "stahl" });
    // Bügel als waagrechte Striche in ihrer tatsächlichen Höhenlage
    for (const y of l.buegelLagen)
      laengs.push({ art: "linie", x1: l.c, y1: y, x2: l.b - l.c, y2: y, stil: "stahl" });
    // Verdichtungsbereiche kennzeichnen
    if (l.h > 2 * l.lv) {
      laengs.push({ art: "linie", x1: 0, y1: l.lv, x2: l.b, y2: l.lv, stil: "strich" });
      laengs.push({ art: "linie", x1: 0, y1: l.h - l.lv, x2: l.b, y2: l.h - l.lv, stil: "strich" });
    }

    const ansichtLaengs: Ansicht = {
      id: "laengsschnitt",
      titel: "Längsschnitt",
      breite: l.b,
      hoehe: l.h,
      elemente: laengs,
      massketteX: [0, l.b],
      massketteY:
        l.h > 2 * l.lv ? [0, l.lv, l.h - l.lv, l.h] : [0, l.h],
      randtexte: [
        { seite: "unten", text: FUSS_NAME[projekt.details.fuss] ?? "" },
        { seite: "oben", text: KOPF_NAME[projekt.details.kopf] ?? "" },
      ],
      fuss: `${l.n} Ø${l.ds} · Bügel Ø${l.dsw}/${Math.round(l.s * 100)} (Enden /${Math.round(
        l.sv * 100
      )})`,
    };

    /* --- Querschnitt --- */
    const cq = projekt.parameter.betondeckung / 1000;
    const quer: Zeichenelement[] = [
      { art: "flaeche", x: 0, y: 0, b: l.b, h: l.t, ton: "beton" },
      { art: "rahmen", x: 0, y: 0, b: l.b, h: l.t, stil: "kante" },
      // Bügel als geschlossener Umriss innerhalb der Betondeckung
      {
        art: "polylinie",
        geschlossen: true,
        stil: "stahl",
        punkte: [
          [cq, cq],
          [l.b - cq, cq],
          [l.b - cq, l.t - cq],
          [cq, l.t - cq],
        ],
      },
    ];
    for (const [x, y] of l.stabPunkte)
      quer.push({ art: "kreis", x, y, r: l.ds / 2000, ton: "stahl" });

    const ansichtQuer: Ansicht = {
      id: "querschnitt",
      titel: "Querschnitt A–A",
      breite: l.b,
      hoehe: l.t,
      elemente: quer,
      massketteX: [0, l.b],
      massketteY: [0, l.t],
      // Detailschnitt: eigener, größerer Maßstab, sonst unlesbar
      eigenerMassstab: true,
      fuss: `${l.n} Ø${l.ds} · Bügel Ø${l.dsw} · c_nom = ${projekt.parameter.betondeckung} mm`,
    };

    return [ansichtLaengs, ansichtQuer];
  },

  /* ---------------- Bewehrung ---------------- */

  bewehrung(k: Kontext): Kennwerte {
    const projekt = k.projekt;
    const l = stuetzenLayout(projekt);
    const { fuss, kopf } = projekt.details;
    for (const w of l.warnungen) k.hinweise.push(w);

    const l0 = uebergreifung(l.ds); // Übergreifungslänge ≈ 50·ds [m]

    /* ---- 1) Längsbewehrung ---- */
    // Stäbe laufen von OK Anschluss bis Stützenkopf; beim Stoß nach oben
    // kommt die Übergreifungslänge dazu.
    const zuschlagKopf = kopf === "stuetze_weiter" ? l0 : 0;
    const laengsLaenge = Math.max(0.3, l.h - l.c + zuschlagKopf);
    k.s.stab(
      l.ds,
      "gerade",
      [laengsLaenge],
      l.n,
      `Längsbewehrung Stütze (${l.n} Ø${l.ds})`,
      "Längsstäbe"
    );

    /* ---- 2) Bügel ---- */
    // geschlossener Rechteckbügel mit Haken 2 × 10·ds,w
    const haken = (2 * 10 * l.dsw) / 1000;
    k.s.stab(
      l.dsw,
      "buegel_rechteck",
      [l.buegelB, l.buegelT, l.buegelB, l.buegelT, haken],
      l.buegelLagen.length,
      `Bügel Ø${l.dsw}/${Math.round(l.s * 100)} cm, Enden /${Math.round(l.sv * 100)} cm`,
      "Bügel"
    );

    /* ---- 3) Anschluss am Stützenfuß ---- */
    if (fuss === "frei") {
      k.hinweise.push(
        "⚠ Stütze ohne Fußanschluss – Lagesicherheit und Einspannung statisch klären."
      );
    } else {
      // Steckeisen: senkrechter Schenkel = Übergreifung + Einbindung,
      // waagrechter Schenkel = Verankerung im anschließenden Bauteil
      const senkrecht = l0 + 0.2;
      const waagrecht = Math.max(0.15, (15 * l.ds) / 1000);
      k.s.stab(
        l.ds,
        "winkel",
        [senkrecht, waagrecht],
        l.n,
        `Steckeisen Stützenfuß in ${FUSS_NAME[fuss] ?? fuss} (${l.n} Ø${l.ds})`,
        "Steckeisen Fuß"
      );
      // Im Stoßbereich gilt die verdichtete Bügellage (EC2 8.7.4.1)
      const stossBuegel = Math.max(3, Math.ceil(l0 / l.sv));
      k.s.stab(
        l.dsw,
        "buegel_rechteck",
        [l.buegelB, l.buegelT, l.buegelB, l.buegelT, haken],
        stossBuegel,
        `Zusatzbügel Stoßbereich Stützenfuß Ø${l.dsw}/${Math.round(l.sv * 100)} cm`,
        "Bügel Stoß"
      );
    }

    /* ---- 4) Hinweise ---- */
    k.hinweise.push(
      "⚠ Stütze: Die Längsbewehrung deckt hier nur die geometrische Mindestbewehrung 0,002·Ac ab. Der lastabhängige Anteil As,min = 0,10·N_Ed/f_yd sowie die Bemessung auf Normalkraft und Moment sind statisch nachzuweisen."
    );
    const schlankheit = l.h / Math.min(l.b, l.t);
    if (schlankheit > 12)
      k.hinweise.push(
        `⚠ Verhältnis Höhe/kleinste Querschnittsseite = ${schlankheit.toFixed(
          1
        )} – Knicknachweis (Schlankheit, Theorie II. Ordnung nach EC2 5.8) zwingend erforderlich.`
      );
    if (Math.min(l.b, l.t) < 0.2)
      k.hinweise.push(
        "⚠ Querschnittsseite < 20 cm: Betonieren und Einbau der Bügel sind schwierig; Mindestabmessungen für Brandschutz (EC2-1-2) prüfen."
      );
    if (kopf === "traeger")
      k.hinweise.push(
        "Rahmenknoten Stütze/Träger: Anschlussbewehrung und Knotennachweis gehören zur Trägerbemessung."
      );
    if (kopf === "decke_ueber")
      k.hinweise.push(
        "⚠ Deckenanschluss oben: Durchstanznachweis der Decke im Stützenbereich (EC2 6.4) ist gesondert zu führen."
      );

    return {
      ac: Math.round(l.ac),
      asMinHaupt: Math.round(l.asMin * 100) / 100,
      asMinQuer: 0,
      gewaehlteMatte: `${l.n} Ø${l.ds}`,
      asVorhanden: Math.round(l.asVorh * 100) / 100,
      cnom: k.cnom,
      flaecheNetto: Math.round(l.b * l.t * 100) / 100,
      hauptLabel: "erforderlich (As,min Längsbewehrung)",
      hauptEinheit: "cm²",
      wahlLabel: "Längsbewehrung",
      flaecheLabel: "Betonquerschnitt",
    };
  },

  pruefe(projekt: Projekt): Pruefmeldung[] {
    const meldungen: Pruefmeldung[] = [];
    const b = projekt.masse.breite;
    const t = projekt.masse.tiefe;
    const h = projekt.masse.hoehe;
    if (isFinite(b) && isFinite(t) && b > 0 && t > 0) {
      const verhaeltnis = Math.max(b, t) / Math.min(b, t);
      if (verhaeltnis > 4)
        meldungen.push({
          feld: "breite",
          schwere: "warnung",
          text: `Seitenverhältnis ${verhaeltnis.toFixed(
            1
          )} : 1 – ab 4 : 1 ist das Bauteil als Wandscheibe zu behandeln (EC2 9.6), nicht als Stütze.`,
        });
      const cnomM = projekt.parameter.betondeckung / 1000;
      if (Math.min(b, t) < 4 * cnomM + 0.05)
        meldungen.push({
          feld: "breite",
          schwere: "fehler",
          text: `Bei c_nom = ${projekt.parameter.betondeckung} mm bleibt in einem ${Math.round(
            Math.min(b, t) * 100
          )} cm dünnen Querschnitt kein einbaubarer Bewehrungskorb. Querschnitt vergrößern oder Betondeckung verringern.`,
        });
    }
    if (isFinite(h) && isFinite(b) && isFinite(t) && h / Math.min(b, t) > 25)
      meldungen.push({
        feld: "hoehe",
        schwere: "warnung",
        text: "Sehr schlanke Stütze (h / b > 25). Ein Knicknachweis nach EC2 5.8 ist zwingend; ggf. Querschnitt vergrößern.",
      });
    return meldungen;
  },
};
