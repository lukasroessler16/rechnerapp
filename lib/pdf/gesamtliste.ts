/**
 * Gesamt-Stückliste über alle Abschnitte (A4 hoch).
 *
 * WOZU: Bei vier Abschnitten liegen vier Stücklisten vor – aber bestellt wird
 * einmal. Wer die Mengen aus vier Blättern zusammenaddiert, verrechnet sich.
 * Dieses Blatt macht das: Übersicht der Abschnitte, dann die Bestellmengen
 * über alles, nach Mattentyp und Stabdurchmesser zusammengefasst.
 *
 * Es ersetzt die Einzellisten nicht – die bleiben das, was auf der Baustelle
 * je Abschnitt abgehakt wird. Dieses Blatt ist das, was zum Händler geht.
 */

import { PDFDocument } from "pdf-lib";
import { Ergebnis, Projekt } from "../types";
import { bauteilModul } from "../bauteile";
import { regelwerkVon } from "../regelwerk";
import { Fonts, GRAU, HELLGRAU, Zeichner, de, ladeFonts, listenKopf, mm } from "./helpers";
import { zeichneAbschnitte } from "./abschnittsgrafik";

export interface AbschnittErgebnis {
  projekt: Projekt;
  ergebnis: Ergebnis;
}

/** Eine Zeile der Bestellübersicht */
interface Sammelposten {
  /** "Matte Q257A" bzw. "Stabstahl Ø12" */
  bezeichnung: string;
  /** Sortierschlüssel: Matten zuerst, dann nach Durchmesser */
  art: "matte" | "stab";
  durchmesser: number;
  stueck: number;
  gewicht: number;
}

/**
 * Fasst gleiche Erzeugnisse über alle Abschnitte zusammen.
 *
 * Bewusst NICHT nach Verwendung getrennt: Beim Bestellen interessiert, wie
 * viele Matten Q257A und wie viel Ø12 gebraucht werden – nicht, ob ein Stab
 * im Sturz oder in der Laibung liegt. Das steht in den Einzellisten.
 */
function sammle(abschnitte: AbschnittErgebnis[]): Sammelposten[] {
  const karte = new Map<string, Sammelposten>();
  for (const a of abschnitte) {
    for (const p of a.ergebnis.positionen) {
      const schluessel = p.art === "matte" ? `matte:${p.bezeichnung}` : `stab:${p.durchmesser}`;
      const vorhanden = karte.get(schluessel);
      if (vorhanden) {
        vorhanden.stueck += p.stueck;
        vorhanden.gewicht = Math.round((vorhanden.gewicht + p.gewichtGesamt) * 10) / 10;
      } else {
        karte.set(schluessel, {
          bezeichnung:
            p.art === "matte" ? `Lagermatte ${p.bezeichnung}` : `Stabstahl ${p.bezeichnung}`,
          art: p.art,
          durchmesser: p.durchmesser ?? 0,
          stueck: p.stueck,
          gewicht: p.gewichtGesamt,
        });
      }
    }
  }
  return [...karte.values()].sort((a, b) => {
    if (a.art !== b.art) return a.art === "matte" ? -1 : 1;
    return a.durchmesser - b.durchmesser;
  });
}

export async function erzeugeGesamtliste(
  abschnitte: AbschnittErgebnis[],
  stempel?: string
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle("Gesamt-Stückliste – Bewehrungsrechner");
  const fonts: Fonts = await ladeFonts(doc);

  const erster = abschnitte[0].projekt;
  const modul = bauteilModul(erster.bauteil);
  const regelwerk = regelwerkVon(erster.parameter.regelwerk);
  const laengen = abschnitte.map((a) => a.projekt.masse.laenge ?? 0);

  const stahlGesamt =
    Math.round(abschnitte.reduce((s, a) => s + a.ergebnis.gesamtgewicht, 0) * 10) / 10;
  const betonGesamt =
    Math.round(abschnitte.reduce((s, a) => s + a.ergebnis.beton.volumen, 0) * 100) / 100;
  const bestellBeton =
    Math.ceil(abschnitte.reduce((s, a) => s + a.ergebnis.beton.bestellmenge, 0) * 10) / 10;

  const seite = doc.addPage([mm(210), mm(297)]);
  const z = new Zeichner(seite, fonts);
  await listenKopf(doc, z, "GESAMT-STÜCKLISTE", erster.firmendaten, 1);
  z.text(
    `${modul.name} in ${abschnitte.length} Abschnitten · ${erster.parameter.stahlguete} · ` +
      `${erster.parameter.betonklasse} · ${regelwerk.normKurz}`,
    15,
    258,
    8,
    { farbe: GRAU }
  );

  let y = 246;

  /* ---------- Abschnittsgrafik ---------- */
  // aktiv = -1: Auf diesem Blatt ist kein Abschnitt hervorgehoben, es gilt
  // für alle. Die Grafik zeigt trotzdem die Aufteilung.
  y -= zeichneAbschnitte(z, { laengen, aktiv: -1, x: 15, y: y - 8, breite: 180 });

  /* ---------- Übersicht der Abschnitte ---------- */
  y -= 8;
  z.text("DIE ABSCHNITTE IM EINZELNEN", 15, y, 8.5, { fett: true });
  y -= 7;
  z.rechteck(15, y - 2, 180, 7, { fuellung: HELLGRAU });
  const spalten = [
    { x: 15, t: "Abschnitt" },
    { x: 48, t: "Maße" },
    { x: 108, t: "Öffn." },
    { x: 126, t: "Positionen" },
    { x: 152, t: "Stahl [kg]" },
    { x: 176, t: "Beton [m³]" },
  ];
  for (const s of spalten) z.text(s.t, s.x + 1, y, 7, { fett: true });
  y -= 7;

  for (const [i, a] of abschnitte.entries()) {
    z.text(String(i + 1), spalten[0].x + 1, y, 8, { fett: true });
    z.text(modul.masseText(a.projekt).replace(`${modul.name} `, ""), spalten[1].x + 1, y, 7.5);
    z.text(String(a.projekt.oeffnungen.length), spalten[2].x + 1, y, 8);
    z.text(String(a.ergebnis.positionen.length), spalten[3].x + 1, y, 8);
    z.text(de(a.ergebnis.gesamtgewicht, 1), spalten[4].x + 1, y, 8);
    z.text(de(a.ergebnis.beton.volumen), spalten[5].x + 1, y, 8);
    z.linie(15, y - 2.5, 195, y - 2.5, 0.2, GRAU);
    y -= 6.5;
  }

  /* ---------- Bestellmengen Stahl ---------- */
  y -= 8;
  z.text("BESTELLMENGEN BAUSTAHL (ALLE ABSCHNITTE)", 15, y, 8.5, { fett: true });
  y -= 7;
  z.rechteck(15, y - 2, 180, 7, { fuellung: HELLGRAU });
  z.text("Erzeugnis", 16, y, 7, { fett: true });
  z.text("Stück", 126, y, 7, { fett: true });
  z.text("Gewicht [kg]", 152, y, 7, { fett: true });
  y -= 7;

  for (const p of sammle(abschnitte)) {
    z.text(p.bezeichnung, 16, y, 8);
    z.text(String(p.stueck), 126, y, 8);
    z.text(de(p.gewicht, 1), 152, y, 8, { fett: true });
    z.linie(15, y - 2.5, 195, y - 2.5, 0.2, GRAU);
    y -= 6.5;
  }

  /* ---------- Summen ---------- */
  y -= 6;
  z.linie(15, y + 2, 195, y + 2, 0.6);
  y -= 4;
  z.rechteck(15, y - 10, 180, 16, { fuellung: HELLGRAU });
  z.text(`BAUSTAHL GESAMT: ${de(stahlGesamt, 1)} kg`, 18, y, 10, { fett: true });
  z.text(
    `Bestellmenge inkl. 5 % Reserve: ${de(stahlGesamt * 1.05, 0)} kg`,
    110,
    y,
    8,
    { farbe: GRAU }
  );
  y -= 6;
  z.text(`BETON GESAMT: ${de(betonGesamt)} m³`, 18, y, 10, { fett: true });
  z.text(`Bestellmenge: ${de(bestellBeton)} m³`, 110, y, 8, { farbe: GRAU });

  /* ---------- Hinweise ---------- */
  y -= 14;
  z.text(
    "Diese Liste fasst alle Abschnitte zu einer Bestellung zusammen. Was wo verlegt wird, steht in der",
    15,
    y,
    6.5,
    { farbe: GRAU }
  );
  y -= 4;
  z.text(
    "Stückliste des jeweiligen Abschnitts; die Biegeformen stehen in der jeweiligen Biegeliste.",
    15,
    y,
    6.5,
    { farbe: GRAU }
  );
  y -= 4;
  z.text(
    "Mengenermittlung ohne statische Bemessung - vor Bestellung durch Tragwerksplaner:in freigeben.",
    15,
    y,
    6.5,
    { farbe: GRAU }
  );
  if (stempel) z.text(stempel, 15, y - 4, 5.5, { farbe: GRAU });

  return doc.save();
}
