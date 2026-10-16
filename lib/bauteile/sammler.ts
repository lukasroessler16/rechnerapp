/**
 * Positions-Sammler der Stück-/Biegeliste.
 *
 * Jedes Bauteilmodul meldet seine Matten und Stäbe hier an; gleiche Stäbe
 * (Durchmesser, Biegeform, Schenkelmaße, Verwendung) werden automatisch zu
 * einer Position zusammengefasst. Die Nummerierung vergibt `fertig()`.
 *
 * GRUPPEN: Auf der Baustelle wird nicht "Position 7" verlegt, sondern "der
 * Anschluss oben". Die Positionen tragen deshalb eine Gruppe, und Stückliste
 * und Plan fassen sie darunter zusammen – mit Zwischensumme, damit man sieht,
 * was ein Anschluss an Stahl kostet.
 *
 * Gesetzt wird die Gruppe nicht je Aufruf, sondern als Zustand: Ein Modul
 * schreibt einmal `k.s.gruppe("Anschluss oben")`, und alles Folgende landet
 * dort. Das hält die Aufrufe der Bauteilmodule lesbar und lässt sich beim
 * Lesen des Codes nicht übersehen.
 */

import { Biegeform, Position } from "../types";
import { biegerolle, metergewicht } from "../normdaten";

/** auf ganze cm runden (Aufmaß Biegeliste) */
export const cm = (m: number) => Math.round(m * 100) / 100;

/** Gruppe, solange ein Bauteilmodul nichts anderes sagt */
export const STANDARD_GRUPPE = "Grundbewehrung";

export class Sammler {
  positionen: Omit<Position, "pos" | "gruppeNr" | "nr">[] = [];

  /** aktuell gesetzte Gruppe */
  private aktuell = STANDARD_GRUPPE;
  /** Reihenfolge, in der die Gruppen zuerst auftauchen – so werden sie sortiert */
  private reihenfolge: string[] = [];

  /**
   * Alles ab hier gehört zu dieser Gruppe, bis die nächste gesetzt wird.
   * Mehrfach derselbe Name ist zulässig und erlaubt, später noch etwas zu
   * einer früheren Gruppe zu ergänzen.
   */
  gruppe(name: string) {
    this.aktuell = name;
    if (!this.reihenfolge.includes(name)) this.reihenfolge.push(name);
  }

  matte(
    name: string,
    laenge: number,
    breite: number,
    stueck: number,
    gewichtProM2: number,
    verwendung: string,
    kurz: string
  ) {
    const gewichtJeStueck = Math.round(laenge * breite * gewichtProM2 * 10) / 10;
    this.merkeGruppe();
    this.positionen.push({
      gruppe: this.aktuell,
      art: "matte",
      bezeichnung: name,
      laenge: cm(laenge),
      breite: cm(breite),
      stueck,
      gewichtJeStueck,
      gewichtGesamt: Math.round(gewichtJeStueck * stueck * 10) / 10,
      verwendung,
      kurz,
    });
  }

  stab(
    d: number,
    form: Biegeform,
    segmente: number[],
    stueck: number,
    verwendung: string,
    kurz: string
  ) {
    const laenge = cm(segmente.reduce((a, b) => a + b, 0));
    const seg = segmente.map(cm);
    // gleiche Stäbe (Form, Ø, Schenkel, Verwendung) zusammenfassen
    // Gleiche Stäbe werden nur innerhalb derselben Gruppe zusammengefasst –
    // sonst verschwänden die Anschlusseisen links in der Position der
    // Anschlusseisen oben, und die Zwischensummen wären falsch.
    const key = (p: Omit<Position, "pos" | "gruppeNr" | "nr">) =>
      p.gruppe === this.aktuell &&
      p.art === "stab" &&
      p.durchmesser === d &&
      p.form === form &&
      p.laenge === laenge &&
      JSON.stringify(p.segmente) === JSON.stringify(seg) &&
      p.verwendung === verwendung;
    const vorhanden = this.positionen.find(key);
    if (vorhanden) {
      vorhanden.stueck += stueck;
      vorhanden.gewichtGesamt =
        Math.round(vorhanden.gewichtJeStueck * vorhanden.stueck * 100) / 100;
      return;
    }
    const gewichtJeStueck = Math.round(laenge * metergewicht(d) * 100) / 100;
    this.merkeGruppe();
    this.positionen.push({
      gruppe: this.aktuell,
      art: "stab",
      bezeichnung: `Ø${d}`,
      durchmesser: d,
      form,
      segmente: seg,
      biegerolle:
        form === "gerade" || form === "schraegstab" ? undefined : biegerolle(d),
      laenge,
      stueck,
      gewichtJeStueck,
      gewichtGesamt: Math.round(gewichtJeStueck * stueck * 100) / 100,
      verwendung,
      kurz,
    });
  }

  /** Gruppen, die ohne ausdrückliches gruppe() entstehen, trotzdem einreihen */
  private merkeGruppe() {
    if (!this.reihenfolge.includes(this.aktuell)) this.reihenfolge.push(this.aktuell);
  }

  /**
   * Nummerierte Positionsliste: nach Gruppen in der Reihenfolge ihres
   * Auftretens, innerhalb einer Gruppe erst Matten, dann Stäbe nach
   * Durchmesser.
   *
   * Jede Position bekommt zwei Nummern:
   *   `nr`  gegliedert, "2.3" = dritter Posten der zweiten Gruppe. Das ist
   *         die Nummer, die auf Plan und Listen steht – sie sagt beim
   *         Abhaken sofort, wozu ein Stab gehört und ob von einer Gruppe
   *         noch etwas fehlt.
   *   `pos` durchlaufend über alle Gruppen, für Händler und Nachfragen.
   *
   * Hier und nur hier wird nummeriert: Bauplan, Stückliste, Biegeliste und
   * die Bildschirmvorschau zeigen dieselbe Nummer, weil sie alle diese eine
   * Liste anzeigen. Eine zweite Nummerierung in der Ausgabe würde früher
   * oder später von dieser abweichen – und dann bestellt jemand nach der
   * einen Nummer und verlegt nach der anderen.
   */
  fertig(): Position[] {
    const rang = (g: string) => {
      const i = this.reihenfolge.indexOf(g);
      return i < 0 ? this.reihenfolge.length : i;
    };
    const sortiert = [...this.positionen].sort((a, b) => {
      const dg = rang(a.gruppe) - rang(b.gruppe);
      if (dg !== 0) return dg;
      if (a.art !== b.art) return a.art === "matte" ? -1 : 1;
      return (a.durchmesser ?? 0) - (b.durchmesser ?? 0);
    });

    // Gruppen durchzählen, sobald sie zum ersten Mal auftauchen; innerhalb
    // einer Gruppe von vorn.
    const gruppenNr = new Map<string, number>();
    const laufend = new Map<string, number>();
    return sortiert.map((p, i) => {
      if (!gruppenNr.has(p.gruppe)) gruppenNr.set(p.gruppe, gruppenNr.size + 1);
      const g = gruppenNr.get(p.gruppe)!;
      const inGruppe = (laufend.get(p.gruppe) ?? 0) + 1;
      laufend.set(p.gruppe, inGruppe);
      return { ...p, pos: i + 1, gruppeNr: g, nr: `${g}.${inGruppe}` };
    });
  }
}
