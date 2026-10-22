/**
 * PDF-Renderer für die abstrakten Bauteil-Ansichten (lib/bauteile/typen.ts).
 *
 * Gegenstück zu components/AnsichtSVG.tsx: dieselbe Zeichenbeschreibung,
 * hier auf Papier. Dadurch zeigen Live-Skizze und Bauplan garantiert
 * dasselbe Bild – früher waren das zwei getrennt gepflegte Zeichenroutinen.
 *
 * Alle Ansichten eines Bauteils werden im selben Maßstab nebeneinander
 * gesetzt; der Maßstab ist ein branchenüblicher Rundwert.
 */

import { rgb } from "pdf-lib";
import { Ansicht, Stil, Zeichenelement } from "../bauteile/typen";
import { GRAU, HELLGRAU, ORANGE, SCHWARZ, Zeichner, de } from "./helpers";

const WEISS = rgb(1, 1, 1);

/** übliche Planmaßstäbe */
const MASSSTAEBE = [10, 20, 25, 50, 75, 100, 125, 150, 200, 250, 500];

/**
 * Zeichenbereich auf dem A4-Querformat [mm].
 *
 * yBasis liegt so hoch, dass unter der Zeichnung beide Maßketten (Abschnitte
 * und Gesamtmaß) plus die Anschlussbeschriftung Platz haben, ohne in die
 * Abschnittsgrafik am unteren Blattrand zu laufen.
 */
const BEREICH = { x0: 16, x1: 242, yBasis: 78, yOben: 190 };
/**
 * Randbedarf je Ansicht [mm]. Links müssen zwei Maßketten und die
 * Randbeschriftung nebeneinander passen, deshalb ist dort am meisten Platz.
 */
const RAND = { links: 28, rechts: 8, oben: 8, zwischen: 18 };

/** Abstand der inneren Maßkette vom Bauteil [mm] */
const KETTE_1 = 9;
/** Abstand der äußeren Kette (Gesamtmaß) vom Bauteil [mm] */
const KETTE_2 = 17;

/** Strichstärke, Farbe und Muster je Linienstil */
function stil(s: Stil = "duenn") {
  switch (s) {
    case "kante":
      return { dicke: 0.9, farbe: SCHWARZ, strich: undefined as number[] | undefined };
    case "hilfslinie":
      return { dicke: 0.25, farbe: GRAU, strich: undefined };
    case "strich":
      return { dicke: 0.3, farbe: GRAU, strich: [1.6, 1.2] };
    case "stahl":
      return { dicke: 0.7, farbe: ORANGE, strich: undefined };
    default:
      return { dicke: 0.6, farbe: SCHWARZ, strich: undefined };
  }
}

/** doppelte Stützpunkte entfernen und sortieren */
const stuetzpunkte = (werte: number[]) =>
  [...new Set(werte.map((v) => Math.round(v * 1000) / 1000))].sort((a, b) => a - b);

/**
 * Maßzahl mit weißem Grund.
 *
 * WOZU: Eine kurze Strecke – der 10-cm-Streifen zwischen Türsturz und
 * Fensterbrüstung – ist schmaler als ihre eigene Maßzahl. Die Zahl ragt dann
 * über die benachbarten Maßpfeile und die Kettenlinie hinaus, und durch die
 * Ziffern laufen Striche. Der weiße Grund schneidet sie frei; auf Bauplänen
 * ist das das Übliche.
 */
function massZahl(
  z: Zeichner,
  txt: string,
  x: number,
  y: number,
  groesse: number,
  opts: { fett?: boolean; drehung?: number } = {}
) {
  const b = z.textBreite(txt, groesse, opts.fett);
  const h = (groesse * 25.4) / 72;
  if (opts.drehung) {
    z.rechteck(x - h * 0.78, y - 0.4, h * 1.0, b + 0.8, { fuellung: WEISS });
    z.text(txt, x, y, groesse, { drehung: opts.drehung, fett: opts.fett });
  } else {
    z.rechteck(x - b / 2 - 0.4, y - h * 0.24, b + 0.8, h * 1.0, { fuellung: WEISS });
    z.text(txt, x, y, groesse, { ausrichtung: "mitte", fett: opts.fett });
  }
}

export interface Planlayout {
  /** gewählter Maßstab, z. B. 50 für M 1:50 */
  massstab: number;
}

/**
 * Zeichnet alle Ansichten eines Bauteils in den Planbereich und liefert den
 * verwendeten Maßstab zurück (für den Schriftkopf).
 */
export function zeichneAnsichten(z: Zeichner, ansichten: Ansicht[]): Planlayout {
  if (ansichten.length === 0) return { massstab: 50 };

  const n = ansichten.length;
  const verfuegbarH = BEREICH.yOben - BEREICH.yBasis - RAND.oben;
  const platzProAnsicht = RAND.links + RAND.rechts;
  const verfuegbarB =
    BEREICH.x1 - BEREICH.x0 - n * platzProAnsicht - (n - 1) * RAND.zwischen;

  /* ---- gemeinsamer Planmaßstab der Hauptansichten ---- */
  const haupt = ansichten.filter((a) => !a.eigenerMassstab);
  const bezug = haupt.length ? haupt : ansichten;
  const summeB = bezug.reduce((a, v) => a + v.breite, 0);
  const maxH = Math.max(...bezug.map((v) => v.hoehe));
  const noetig = Math.max((summeB * 1000) / verfuegbarB, (maxH * 1000) / verfuegbarH);
  const massstab = MASSSTAEBE.find((s) => s >= noetig) ?? 1000;

  /**
   * Detailschnitte bekommen einen eigenen, größeren Maßstab – sie sollen
   * lesbar sein und nicht in derselben Verkleinerung wie die Ansicht liegen.
   * Er wird nie größer als der Planmaßstab gewählt.
   */
  // Zielgröße eines Detailschnitts: in der Breite bescheiden, in der Höhe darf
  // er die ganze Zeichenfläche nutzen – ein hoher Schnitt wie der einer
  // Stützmauer wäre sonst unnötig klein.
  const DETAILBREITE = 70; // mm
  /*
   * Der Detailschnitt darf nur den Platz bekommen, den die Hauptansichten
   * übrig lassen. Sonst wächst die Gruppe über den Zeichenbereich hinaus und
   * schiebt sich in die Spalte mit den Bewehrungsangaben – beim
   * Streifenfundament stand der Querschnitt mitten in der Betonmenge.
   */
  const detailAnzahl = ansichten.filter((a) => a.eigenerMassstab).length;
  const restB = verfuegbarB - (summeB * 1000) / massstab;
  const detailPlatz = detailAnzahl
    ? Math.max(18, Math.min(DETAILBREITE, restB / detailAnzahl))
    : DETAILBREITE;
  const massstabVon = (a: Ansicht) => {
    if (!a.eigenerMassstab) return massstab;
    const noetigD = Math.max(
      (a.breite * 1000) / detailPlatz,
      (a.hoehe * 1000) / verfuegbarH
    );
    const m = MASSSTAEBE.find((s) => s >= noetigD) ?? 1000;
    return Math.min(m, massstab);
  };

  /* ---- Gesamtbreite ermitteln und die Gruppe mittig setzen ---- */
  const gesamtB =
    ansichten.reduce((sum, a) => sum + a.breite * (1000 / massstabVon(a)), 0) +
    n * platzProAnsicht +
    (n - 1) * RAND.zwischen;
  const hoehstesF = 1000 / massstab;

  let cursor = Math.max(
    BEREICH.x0,
    BEREICH.x0 + (BEREICH.x1 - BEREICH.x0 - gesamtB) / 2
  );

  /**
   * Flache Bauteile (Träger, Bodenplatte) füllen die Blatthöhe nicht aus.
   * Damit die Zeichnung nicht am unteren Blattrand klebt, wird die Gruppe im
   * Zeichenbereich auch senkrecht mittig gesetzt – die Grundlinie bleibt
   * dabei immer oberhalb des Schriftkopfs.
   */
  const gesamtH = Math.max(
    maxH * hoehstesF,
    ...ansichten.map((a) => a.hoehe * (1000 / massstabVon(a)))
  );
  const basis = BEREICH.yBasis + Math.max(0, (verfuegbarH - gesamtH) / 2);

  for (const a of ansichten) {
    const f = 1000 / massstabVon(a);
    const ox = cursor + RAND.links;
    // Ansichten mittig zueinander stellen, bezogen auf die höchste Hauptansicht
    const oy = basis + Math.max(0, (gesamtH - a.hoehe * f) / 2);
    const zusatz = a.eigenerMassstab ? `M 1:${massstabVon(a)}` : undefined;
    zeichneEine(z, a, ox, oy, f, zusatz);
    cursor += RAND.links + a.breite * f + RAND.rechts + RAND.zwischen;
  }

  return { massstab };
}

/* ------------------------------------------------------------------ */
/* Eine Ansicht                                                        */
/* ------------------------------------------------------------------ */

function zeichneEine(
  z: Zeichner,
  a: Ansicht,
  ox: number,
  oy: number,
  f: number,
  /** abweichender Maßstab, wird an die Ansicht angeschrieben */
  zusatz?: string
) {
  const X = (x: number) => ox + x * f;
  const Y = (y: number) => oy + y * f;
  const B = a.breite * f;
  const H = a.hoehe * f;

  /* ---------- Elemente ---------- */
  for (const e of a.elemente) zeichneElement(z, e, X, Y, f);

  /* ---------- waagrechte Maßketten ---------- */
  const xs = stuetzpunkte(a.massketteX ?? []);
  /** Ist eine zweite Kette mit dem Gesamtmaß nötig? */
  const gesamtX = xs.length > 2;
  if (xs.length >= 2) {
    const my = oy - KETTE_1;
    z.linie(X(xs[0]), my, X(xs[xs.length - 1]), my, 0.35);
    for (const x of xs) {
      z.linie(X(x), my - 2, X(x), my + 2, 0.35);
      z.linie(X(x) - 1.2, my - 1.2, X(x) + 1.2, my + 1.2, 0.5);
      z.linie(X(x), my + 2, X(x), oy, 0.15, GRAU); // Maßhilfslinie
    }
    // Maßzahlen, die breiter als ihr Feld sind, wandern versetzt nach außen –
    // sonst überschreiben sich benachbarte Zahlen bei kurzen Abschnitten.
    // Nach innen (zum Bauteil hin) darf ausgewichen werden, nach außen nur,
    // solange darunter keine zweite Kette liegt.
    let reihe = 0;
    xs.slice(0, -1).forEach((x, i) => {
      const b = xs[i + 1] - x;
      const txt = de(b);
      const passt = z.textBreite(txt, 6.5) + 1 <= b * f;
      reihe = passt ? 0 : reihe === 1 ? 2 : 1;
      const dy = reihe === 0 ? 1.2 : reihe === 1 ? 4.4 : -3.2;
      massZahl(z, txt, X(x + b / 2), my + dy, 6.5);
    });

    /*
     * Gesamtmaß als zweite, äußere Kette.
     *
     * WOZU: Sobald eine Öffnung die Kette unterteilt, stehen dort nur noch
     * Teilmaße – wer die Wand bestellt oder absteckt, braucht aber als
     * Erstes ihre Gesamtlänge und soll sie nicht aus vier Zahlen addieren
     * müssen. Beide Ketten gemeinsam sind auf Bauplänen das Übliche: innen
     * die Unterteilung, außen das Ganze.
     */
    if (gesamtX) {
      const gy = oy - KETTE_2;
      const von = xs[0];
      const bis = xs[xs.length - 1];
      z.linie(X(von), gy, X(bis), gy, 0.35);
      for (const x of [von, bis]) {
        z.linie(X(x), gy - 2, X(x), gy + 2, 0.35);
        z.linie(X(x) - 1.2, gy - 1.2, X(x) + 1.2, gy + 1.2, 0.5);
        z.linie(X(x), gy + 2, X(x), oy - KETTE_1 - 2, 0.15, GRAU);
      }
      massZahl(z, de(bis - von), X((von + bis) / 2), gy + 1.2, 7, { fett: true });
    }
  }

  /* ---------- senkrechte Maßketten ---------- */
  const ys = stuetzpunkte(a.massketteY ?? []);
  const gesamtY = ys.length > 2;
  if (ys.length >= 2) {
    const mx = ox - KETTE_1 - 2;
    z.linie(mx, Y(ys[0]), mx, Y(ys[ys.length - 1]), 0.35);
    for (const y of ys) {
      z.linie(mx - 2, Y(y), mx + 2, Y(y), 0.35);
      z.linie(mx - 1.2, Y(y) - 1.2, mx + 1.2, Y(y) + 1.2, 0.5);
      z.linie(mx + 2, Y(y), ox, Y(y), 0.15, GRAU);
    }
    let reiheY = 0;
    ys.slice(0, -1).forEach((y, i) => {
      const b = ys[i + 1] - y;
      const txt = de(b);
      const passt = z.textBreite(txt, 6.5) + 1 <= b * f;
      reiheY = passt ? 0 : reiheY === 1 ? 2 : 1;
      // Reihe 1 liegt rechts der Kettenlinie und muss sie ganz freilassen:
      // Bei +1,5 mm stand die gedrehte Zahl mitten auf dem Strich.
      const dx = reiheY === 0 ? -1.5 : reiheY === 1 ? 4.2 : -4.5;
      massZahl(z, txt, mx + dx, Y(y + b / 2) - 1, 6.5, { drehung: 90 });
    });

    /* Gesamthöhe als zweite Kette – gleiche Überlegung wie waagrecht */
    if (gesamtY) {
      const gx = ox - KETTE_2 - 2;
      const von = ys[0];
      const bis = ys[ys.length - 1];
      z.linie(gx, Y(von), gx, Y(bis), 0.35);
      for (const y of [von, bis]) {
        z.linie(gx - 2, Y(y), gx + 2, Y(y), 0.35);
        z.linie(gx - 1.2, Y(y) - 1.2, gx + 1.2, Y(y) + 1.2, 0.5);
        z.linie(gx + 2, Y(y), mx - 2, Y(y), 0.15, GRAU);
      }
      massZahl(z, de(bis - von), gx - 1.6, Y((von + bis) / 2) - 1, 7, {
        drehung: 90,
        fett: true,
      });
    }
  }

  /* ---------- Randbeschriftungen ---------- */
  // Sie stehen außerhalb der Maßketten; wie weit außen, hängt davon ab, ob
  // es eine zweite Kette gibt.
  const untenY = oy - (gesamtX ? KETTE_2 + 8.5 : KETTE_1 + 9.5);
  const linksX = ox - (gesamtY ? KETTE_2 + 7 : KETTE_1 + 6);
  for (const r of a.randtexte ?? []) {
    if (!r.text) continue;
    if (r.seite === "unten")
      z.text(r.text, ox + B / 2, untenY, 7, { ausrichtung: "mitte", farbe: ORANGE });
    else if (r.seite === "oben")
      z.text(r.text, ox + B / 2, oy + H + 2.5, 7, { ausrichtung: "mitte", farbe: ORANGE });
    else if (r.seite === "links")
      z.text(r.text, linksX, oy + H / 2, 7, { drehung: 90, farbe: ORANGE });
    else z.text(r.text, ox + B + 4, oy + H / 2, 7, { drehung: 90, farbe: ORANGE });
  }

  /* ---------- Titel über der Ansicht ---------- */
  // Der Titel wird über der Ansicht zentriert. Bei schmalen Ansichten (etwa
  // einem Querschnitt) ragt er sonst über den Zeichenbereich hinaus und
  // landet in der Spalte mit den Bewehrungsangaben – deshalb wird er zuerst
  // notfalls gekürzt und danach in den Zeichenbereich hineingeschoben.
  const voll = [a.titel, zusatz, a.fuss].filter(Boolean).join(" · ");
  const kurz = [a.titel, zusatz].filter(Boolean).join(" · ");
  const maxBreite = BEREICH.x1 - BEREICH.x0;
  const titel = z.textBreite(voll, 8, true) <= maxBreite ? voll : kurz;
  const breite = z.textBreite(titel, 8, true);
  const mitte = Math.min(
    Math.max(ox + B / 2, BEREICH.x0 + breite / 2),
    BEREICH.x1 - breite / 2
  );
  z.text(titel, mitte, oy + H + 8, 8, { ausrichtung: "mitte", fett: true });
}

/* ------------------------------------------------------------------ */
/* Einzelnes Zeichenelement                                            */
/* ------------------------------------------------------------------ */

function zeichneElement(
  z: Zeichner,
  e: Zeichenelement,
  X: (x: number) => number,
  Y: (y: number) => number,
  f: number
) {
  switch (e.art) {
    case "flaeche":
      z.rechteck(X(e.x), Y(e.y), e.b * f, e.h * f, {
        fuellung: e.ton === "beton" ? HELLGRAU : WEISS,
      });
      break;
    case "rahmen": {
      const s = stil(e.stil ?? "kante");
      z.rechteck(X(e.x), Y(e.y), e.b * f, e.h * f, {
        dicke: s.dicke,
        rand: s.farbe,
        strich: s.strich,
      });
      break;
    }
    case "linie": {
      const s = stil(e.stil);
      z.linie(X(e.x1), Y(e.y1), X(e.x2), Y(e.y2), s.dicke, s.farbe, s.strich);
      break;
    }
    case "polylinie": {
      const s = stil(e.stil);
      const p = e.geschlossen ? [...e.punkte, e.punkte[0]] : e.punkte;
      for (let i = 1; i < p.length; i++)
        z.linie(X(p[i - 1][0]), Y(p[i - 1][1]), X(p[i][0]), Y(p[i][1]), s.dicke, s.farbe, s.strich);
      break;
    }
    case "kreis":
      // maßstäblich wäre ein Ø12 bei M 1:25 kaum 0,5 mm groß → Mindestgröße
      z.kreis(X(e.x), Y(e.y), Math.max(0.55, e.r * f), e.ton === "kante" ? SCHWARZ : ORANGE);
      break;
    case "text": {
      const rolle = e.rolle ?? "normal";
      const groesse = rolle === "marke" ? 9 : rolle === "klein" ? 6 : 7;
      z.text(e.text, X(e.x), Y(e.y) - groesse / 6, groesse, {
        ausrichtung: e.ausrichtung ?? "mitte",
        fett: rolle === "marke",
        farbe: rolle === "marke" ? ORANGE : rolle === "klein" ? GRAU : SCHWARZ,
        drehung: e.drehung,
      });
      break;
    }
  }
}
