/**
 * Layoutprüfung der PDF-Dokumente: Keine Beschriftung darf eine andere
 * überdecken.
 *
 * WOZU: Ein Bauplan wird auf der Baustelle gelesen, oft als Ausdruck und oft
 * in Eile. Eine Maßzahl, die halb unter einer anderen liegt, ist dort kein
 * Schönheitsfehler, sondern eine falsch abgesteckte Wand. Beim Durchsehen
 * einzelner PDFs fällt so etwas erst auf, wenn man genau hinschaut – und
 * schon gar nicht bei Zahlenkombinationen, die niemand von Hand durchprobiert
 * (eine 12 m lange Wand mit fünf Öffnungen dicht nebeneinander, ein langer
 * Firmenname, eine Stützmauer mit ihren Zusatzmaßen).
 *
 * WIE: Der Zeichner schreibt auf Wunsch jeden gezeichneten Text mit seinem
 * Platzbedarf mit (lib/pdf/helpers.ts, starteMitschrift()). Dieses Skript
 * erzeugt für jedes Bauteil alle drei Dokumente, dazu bewusst unangenehme
 * Fälle, und meldet jede Überschneidung zweier Textkästen auf demselben
 * Blatt. Was es meldet, ist hinterher im PDF auch zu sehen.
 *
 * Aufruf: npx tsx scripts/test-layout.ts
 */

import { Textkasten, endeMitschrift, schraegLinie, starteMitschrift } from "../lib/pdf/helpers";
import { MATTEN_STOSS_STANDARD } from "../lib/normdaten";
import { berechneBewehrung } from "../lib/bewehrung";
import { erzeugeBauplan } from "../lib/pdf/bauplan";
import { erzeugeBiegeliste } from "../lib/pdf/biegeliste";
import { erzeugeStueckliste } from "../lib/pdf/stueckliste";
import { erzeugeGesamtliste } from "../lib/pdf/gesamtliste";
import { BAUTEILE, bauteilModul, standardDetails } from "../lib/bauteile";
import { Oeffnung, Projekt } from "../lib/types";

/* ------------------------------------------------------------------ */
/* Überdeckungen finden                                                */
/* ------------------------------------------------------------------ */

/**
 * Zwei Kästen gelten als überdeckt, wenn sie sich in beiden Richtungen
 * nennenswert überschneiden. Die Toleranz ist kein Schönheitsmaß: Schrift-
 * kästen reichen bis zur vollen Zeilenhöhe, während die Buchstaben selbst
 * kleiner sind. Ohne Toleranz meldete die Prüfung Zeilen, die in Wahrheit
 * sauber untereinander stehen.
 */
const TOLERANZ = 0.45; // mm

interface Treffer {
  a: Textkasten;
  b: Textkasten;
  ueberX: number;
  ueberY: number;
}

/** Blattgrößen [mm]: A4 quer für den Plan, A4 hoch für die Listen */
const BLATT = { quer: { b: 297, h: 210 }, hoch: { b: 210, h: 297 } };
/** Mindestabstand jedes Textes vom Blattrand [mm] */
const RANDABSTAND = 5;

/**
 * Texte, die über den Blattrand hinausragen.
 *
 * Eigene Prüfung, weil so etwas keine Überdeckung erzeugt: Was neben dem
 * Blatt liegt, überdeckt nichts – es fehlt einfach im Ausdruck. Genau so
 * verschwand der Querschnitt eines Streifenfundaments nach rechts aus dem
 * Zeichenbereich.
 */
function ausserhalb(kaesten: Textkasten[], blatt: { b: number; h: number }): Textkasten[] {
  return kaesten.filter(
    (k) =>
      k.links < RANDABSTAND ||
      k.rechts > blatt.b - RANDABSTAND ||
      k.unten < RANDABSTAND ||
      k.oben > blatt.h - RANDABSTAND
  );
}

function ueberdeckungen(kaesten: Textkasten[]): Treffer[] {
  const treffer: Treffer[] = [];
  // nach Blatt gruppieren – Texte verschiedener Seiten liegen nie übereinander
  const blaetter = new Map<number, Textkasten[]>();
  for (const k of kaesten) {
    const liste = blaetter.get(k.blatt) ?? [];
    liste.push(k);
    blaetter.set(k.blatt, liste);
  }

  for (const liste of blaetter.values()) {
    // nach links sortiert: so kann die innere Schleife früh abbrechen
    const sortiert = [...liste].sort((x, y) => x.links - y.links);
    for (let i = 0; i < sortiert.length; i++) {
      const a = sortiert[i];
      for (let j = i + 1; j < sortiert.length; j++) {
        const b = sortiert[j];
        if (b.links >= a.rechts - TOLERANZ) break;
        const ueberX = Math.min(a.rechts, b.rechts) - Math.max(a.links, b.links);
        const ueberY = Math.min(a.oben, b.oben) - Math.max(a.unten, b.unten);
        if (ueberX > TOLERANZ && ueberY > TOLERANZ) treffer.push({ a, b, ueberX, ueberY });
      }
    }
  }
  return treffer;
}

/* ------------------------------------------------------------------ */
/* Prüffälle                                                           */
/* ------------------------------------------------------------------ */

const basis = {
  parameter: {
    regelwerk: "at",
    betonklasse: "C25/30",
    expositionsklasse: "XC2",
    betondeckung: 30,
    stahlguete: "B550B",
    lagen: 2 as const,
    matte: "auto",
    stababstand: 250,
    mattenstoss: MATTEN_STOSS_STANDARD,
  },
  firmendaten: {
    firma: "Muster Bau GmbH",
    planersteller: "L. Rößler",
    bauvorhaben: "EFH Familie Muster",
    adresse: "Mustergasse 12, 1100 Wien",
    datum: "2026-10-22",
  },
};

/** Standardmaße eines Bauteils aus seiner Felddefinition */
function standardMasse(id: string): Record<string, number> {
  const masse: Record<string, number> = {};
  const modul = bauteilModul(id);
  for (const f of [...modul.masse, ...(modul.zusatz?.felder ?? [])])
    masse[f.schluessel] = f.standard;
  return masse;
}

function projektVon(id: string, zusatz: Partial<Projekt> = {}): Projekt {
  const modul = bauteilModul(id);
  return {
    ...basis,
    bauteil: id,
    masse: standardMasse(id),
    oeffnungen: [],
    details: standardDetails(modul),
    ...zusatz,
  } as Projekt;
}

/** Öffnungen dicht an dicht – der Fall, der die Maßkette eng macht */
function engeOeffnungen(anzahl: number, breite = 0.9): Oeffnung[] {
  return Array.from({ length: anzahl }, (_, i) => ({
    id: String(i + 1),
    typ: i % 2 ? ("tuer" as const) : ("fenster" as const),
    x: 0.35 + i * (breite + 0.22),
    y: i % 2 ? 0 : 0.95,
    breite,
    hoehe: i % 2 ? 2.0 : 0.95,
  }));
}

interface Prueffall {
  name: string;
  projekt: Projekt;
}

const faelle: Prueffall[] = [];

// 1) Jedes Bauteil mit seinen Standardmaßen
for (const b of BAUTEILE) faelle.push({ name: `${b.id} – Standard`, projekt: projektVon(b.id) });

// 2) Wand und Deckenplatte in Grenzlagen
faelle.push(
  {
    name: "wand – lang, fünf enge Öffnungen",
    projekt: projektVon("wand", {
      masse: { laenge: 12, hoehe: 3.2, dicke: 0.3 },
      oeffnungen: engeOeffnungen(5),
    }),
  },
  {
    name: "wand – kurz und hoch, zwei Öffnungen",
    projekt: projektVon("wand", {
      masse: { laenge: 2.6, hoehe: 4.2, dicke: 0.2 },
      oeffnungen: engeOeffnungen(2, 0.5),
    }),
  },
  {
    name: "wand – lange Texte im Schriftkopf",
    projekt: projektVon("wand", {
      masse: { laenge: 9.5, hoehe: 2.75, dicke: 0.25 },
      oeffnungen: engeOeffnungen(3),
      firmendaten: {
        firma: "Bauunternehmung Mustermann & Söhne Gesellschaft m.b.H. & Co KG",
        planersteller: "Dipl.-Ing. Maximiliane Hochstätter-Breitenberger",
        bauvorhaben: "Wohnhausanlage Südtiroler Siedlung Bauteil C, Stiege 3",
        adresse: "Obere Donaustraße 145, Stiege 2, Top 14b, 1020 Wien",
        datum: "2026-10-22",
      },
    }),
  },
  {
    name: "deckenplatte – mit Aussparungen",
    projekt: projektVon("deckenplatte", {
      masse: { laenge: 7.2, hoehe: 5.4, dicke: 0.22 },
      oeffnungen: engeOeffnungen(3, 0.6),
    }),
  },
  {
    name: "bodenplatte – sehr groß",
    projekt: projektVon("bodenplatte", { masse: { laenge: 18, hoehe: 14, dicke: 0.3 } }),
  },
  {
    name: "traeger – lang und flach",
    projekt: projektVon("traeger", { masse: { laenge: 9, hoehe: 0.45, breite: 0.3, lv: 0.25 } }),
  },
  {
    name: "stuetze – schlank und hoch",
    projekt: projektVon("stuetze", { masse: { breite: 0.25, tiefe: 0.25, hoehe: 5.5 } }),
  }
);

/* ------------------------------------------------------------------ */
/* Lauf                                                                */
/* ------------------------------------------------------------------ */

/** Meldung so kürzen, dass sie in einer Zeile lesbar bleibt */
const kurz = (t: string) => (t.length > 38 ? `${t.slice(0, 37)}…` : t);

let gefunden = 0;
let geprueft = 0;

/** Ein Dokument erzeugen und beide Prüfungen darauf anwenden */
async function pruefe(
  titel: string,
  blatt: { b: number; h: number },
  bauen: () => Promise<Uint8Array>
) {
  const kaesten = starteMitschrift();
  await bauen();
  const treffer = ueberdeckungen(kaesten);
  const raus = ausserhalb(kaesten, blatt);
  endeMitschrift();
  geprueft++;

  if (treffer.length) {
    gefunden += treffer.length;
    console.log(`\n✗ ${titel}: ${treffer.length} Überdeckung(en)`);
    for (const t of treffer.slice(0, 6))
      console.log(
        `    "${kurz(t.a.text)}" ⟷ "${kurz(t.b.text)}" ` +
          `(${t.ueberX.toFixed(1)} × ${t.ueberY.toFixed(1)} mm, Blatt ${t.a.blatt})`
      );
    if (treffer.length > 6) console.log(`    … und ${treffer.length - 6} weitere`);
  }
  if (raus.length) {
    gefunden += raus.length;
    console.log(`\n✗ ${titel}: ${raus.length} Text(e) außerhalb des Blattes`);
    for (const t of raus.slice(0, 6))
      console.log(
        `    "${kurz(t.text)}" bei x ${t.links.toFixed(0)}…${t.rechts.toFixed(0)}, ` +
          `y ${t.unten.toFixed(0)}…${t.oben.toFixed(0)}`
      );
  }
}

/* ------------------------------------------------------------------ */
/* Schräge Stäbe liegen im angeschriebenen Winkel                      */
/* ------------------------------------------------------------------ */

/*
 * Vorher wurde ein Schrägstab von Ecke zu Ecke seines Kästchens gezeichnet.
 * Dadurch zeigte dieselbe Position in der Stückliste rund 12° und in der
 * Biegeliste rund 8° – eingebaut wird sie unter 45°. Wer danach biegt,
 * biegt falsch. Diese Prüfung hält fest, dass der gezeichnete Winkel vom
 * Kästchen unabhängig ist.
 */
function pruefeWinkel() {
  // Kästchen der Stückliste, der Biegeliste und zwei Grenzformate
  const kaesten = [
    { b: 28, h: 10 },
    { b: 44, h: 11 },
    { b: 60, h: 8 },
    { b: 20, h: 20 },
  ];
  for (const grad of [30, 45, 60, 90]) {
    for (const kasten of kaesten) {
      const l = schraegLinie(grad, 0, 0, kasten.b, kasten.h);
      const ist = (Math.atan2(l.y2 - l.y1, l.x2 - l.x1) * 180) / Math.PI;
      if (Math.abs(ist - grad) > 0.01) {
        console.log(
          `\n✗ Schrägstab: ${grad}° angeschrieben, ${ist.toFixed(1)}° gezeichnet ` +
            `(Kästchen ${kasten.b} × ${kasten.h} mm)`
        );
        gefunden++;
      }
      // und die Linie muss im Kästchen bleiben
      if (l.x1 < -0.01 || l.x2 > kasten.b + 0.01 || l.y1 < -0.01 || l.y2 > kasten.h + 0.01) {
        console.log(`\n✗ Schrägstab ${grad}° ragt aus dem Kästchen ${kasten.b} × ${kasten.h} mm`);
        gefunden++;
      }
    }
  }
}

async function main() {
  pruefeWinkel();

  for (const fall of faelle) {
    const e = berechneBewehrung(fall.projekt);
    await pruefe(`${fall.name} · Bauplan`, BLATT.quer, () =>
      erzeugeBauplan(fall.projekt, e, "Layoutprüfung")
    );
    await pruefe(`${fall.name} · Stückliste`, BLATT.hoch, () =>
      erzeugeStueckliste(fall.projekt, e, "Layoutprüfung")
    );
    await pruefe(`${fall.name} · Biegeliste`, BLATT.hoch, () =>
      erzeugeBiegeliste(fall.projekt, e, "Layoutprüfung")
    );
  }

  /* ---------- geteilte Wand: Abschnittsgrafik und Gesamtliste ---------- */
  const abschnitte: Projekt[] = [9, 7.5, 6, 4.5].map((laenge, i, alle) =>
    projektVon("wand", {
      masse: { laenge, hoehe: 2.75, dicke: 0.25 },
      oeffnungen: i === 1 ? engeOeffnungen(3) : [],
      details: {
        unten: "bodenplatte",
        oben: "decke_ueber",
        links: i === 0 ? "ecke" : "wand_weiter",
        rechts: i === alle.length - 1 ? "frei" : "wand_weiter",
      },
    })
  );
  const laengen = abschnitte.map((p) => p.masse.laenge);
  for (const [i, p] of abschnitte.entries()) {
    const e = berechneBewehrung(p);
    const lage = { laengen, aktiv: i };
    const name = `Abschnitt ${i + 1} von 4`;
    await pruefe(`${name} · Bauplan`, BLATT.quer, () =>
      erzeugeBauplan(p, e, "Layoutprüfung", lage)
    );
    await pruefe(`${name} · Stückliste`, BLATT.hoch, () =>
      erzeugeStueckliste(p, e, "Layoutprüfung", lage)
    );
    await pruefe(`${name} · Biegeliste`, BLATT.hoch, () =>
      erzeugeBiegeliste(p, e, "Layoutprüfung", lage)
    );
  }

  await pruefe("Gesamt-Stückliste", BLATT.hoch, () =>
    erzeugeGesamtliste(
      abschnitte.map((p) => ({ projekt: p, ergebnis: berechneBewehrung(p) })),
      "Layoutprüfung"
    )
  );

  console.log(`\n${geprueft} Dokumente geprüft, schräge Stäbe im angeschriebenen Winkel.`);
  if (gefunden) {
    console.log(`LAYOUTPRÜFUNG FEHLGESCHLAGEN: ${gefunden} Überdeckung(en).`);
    process.exit(1);
  }
  console.log("LAYOUT OK – keine Beschriftung überdeckt eine andere oder liegt neben dem Blatt.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
