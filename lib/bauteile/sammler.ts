/**
 * Positions-Sammler der Stück-/Biegeliste.
 *
 * Jedes Bauteilmodul meldet seine Matten und Stäbe hier an; gleiche Stäbe
 * (Durchmesser, Biegeform, Schenkelmaße, Verwendung) werden automatisch zu
 * einer Position zusammengefasst. Die Nummerierung vergibt `fertig()`.
 */

import { Biegeform, Position } from "../types";
import { biegerolle, metergewicht } from "../normdaten";

/** auf ganze cm runden (Aufmaß Biegeliste) */
export const cm = (m: number) => Math.round(m * 100) / 100;

export class Sammler {
  positionen: Omit<Position, "pos">[] = [];

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
    this.positionen.push({
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
    const key = (p: Omit<Position, "pos">) =>
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
    this.positionen.push({
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

  /** nummerierte Positionsliste: erst Matten, dann Stäbe nach Ø */
  fertig(): Position[] {
    const sortiert = [...this.positionen].sort((a, b) => {
      if (a.art !== b.art) return a.art === "matte" ? -1 : 1;
      return (a.durchmesser ?? 0) - (b.durchmesser ?? 0);
    });
    return sortiert.map((p, i) => ({ ...p, pos: i + 1 }));
  }
}
