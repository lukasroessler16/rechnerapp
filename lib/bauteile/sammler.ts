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
  positionen: Omit<Position, "pos">[] = [];

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
    const key = (p: Omit<Position, "pos">) =>
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
   * Durchmesser. Die Nummerierung läuft über alle Gruppen durch – der
   * Baustahlhändler bekommt eine Liste mit eindeutigen Positionsnummern,
   * die Gruppen sind die Zwischenüberschriften darüber.
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
    return sortiert.map((p, i) => ({ ...p, pos: i + 1 }));
  }
}
