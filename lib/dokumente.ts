/**
 * Erzeugung aller Dokumente eines Bauvorhabens.
 *
 * Hier liegt die Antwort auf die Frage "welche Dateien bekommt der Kunde?",
 * damit sie nicht zwischen API-Route und Erfolgsseite auseinanderläuft:
 *
 *   je Abschnitt   Bauplan, Biegeliste, Stückliste
 *   ab zwei        zusätzlich eine Gesamt-Stückliste über alle Abschnitte
 *
 * Die Gesamt-Stückliste ist das Blatt, das zum Baustahlhändler geht; die
 * Einzellisten sind das, was auf der Baustelle je Abschnitt abgehakt wird.
 */

import { Projekt } from "./types";
import { berechneBewehrung } from "./bewehrung";
import { bauteilModul } from "./bauteile";
import { Bauvorhaben } from "./abschnitte";
import { erzeugeBauplan } from "./pdf/bauplan";
import { erzeugeBiegeliste } from "./pdf/biegeliste";
import { erzeugeStueckliste } from "./pdf/stueckliste";
import { erzeugeGesamtliste } from "./pdf/gesamtliste";

export type Dokumenttyp = "bauplan" | "biegeliste" | "stueckliste";

/**
 * Namensbaustein im DATEINAMEN – bewusst ohne Umlaute.
 * Für die Anzeige gibt es DOKUMENT_TITEL.
 */
export const DOKUMENTTYPEN: Record<Dokumenttyp, string> = {
  bauplan: "Bauplan",
  biegeliste: "Biegeliste",
  stueckliste: "Stueckliste",
};

/** Bezeichnung für Bildschirm und Überschriften */
export const DOKUMENT_TITEL: Record<Dokumenttyp, string> = {
  bauplan: "Bauplan",
  biegeliste: "Biegeliste",
  stueckliste: "Stückliste",
};

export function istDokumenttyp(v: unknown): v is Dokumenttyp {
  return typeof v === "string" && v in DOKUMENTTYPEN;
}

/** Dateinamen von Umlauten und Sonderzeichen befreien */
export function dateifreundlich(text: string, maxLaenge = 60): string {
  return text
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/Ä/g, "Ae")
    .replace(/Ö/g, "Oe")
    .replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLaenge);
}

/**
 * Dateiname eines Dokuments.
 *
 * Mit Abschnittsnummer, sobald es mehrere gibt – vier gleich benannte
 * Baupläne im Download-Ordner sind der sichere Weg, auf der Baustelle den
 * falschen auszudrucken. Die Nummer steht vorne, damit die Dateien in jedem
 * Dateimanager in der richtigen Reihenfolge liegen.
 */
export function dateiname(
  typ: Dokumenttyp | "gesamtliste",
  bauvorhaben: string,
  abschnitt?: { nr: number; von: number }
): string {
  const art = typ === "gesamtliste" ? "Gesamt-Stueckliste" : DOKUMENTTYPEN[typ];
  const vorhaben = dateifreundlich(bauvorhaben);
  const teil =
    abschnitt && abschnitt.von > 1
      ? `Abschnitt-${String(abschnitt.nr).padStart(2, "0")}-`
      : "";
  return vorhaben ? `${teil}${art}-${vorhaben}.pdf` : `${teil}${art}.pdf`;
}

/** Ein fertiges Dokument */
export interface Dokument {
  name: string;
  daten: Uint8Array;
}

/** Beschreibt, welche Dateien ein Bauvorhaben hervorbringt – ohne sie zu bauen */
export interface Dokumentplan {
  typ: Dokumenttyp | "gesamtliste";
  /** 0-basierter Abschnitt; fehlt bei der Gesamtliste */
  abschnitt?: number;
  name: string;
  titel: string;
}

export function dokumentplan(bv: Bauvorhaben): Dokumentplan[] {
  const vorhaben = bv[0]?.firmendaten.bauvorhaben ?? "";
  const von = bv.length;
  const plan: Dokumentplan[] = [];

  bv.forEach((_, i) => {
    for (const typ of Object.keys(DOKUMENTTYPEN) as Dokumenttyp[]) {
      plan.push({
        typ,
        abschnitt: i,
        name: dateiname(typ, vorhaben, { nr: i + 1, von }),
        titel:
          von > 1
            ? `${DOKUMENT_TITEL[typ]} · Abschnitt ${i + 1} von ${von}`
            : DOKUMENT_TITEL[typ],
      });
    }
  });

  if (von > 1) {
    plan.push({
      typ: "gesamtliste",
      name: dateiname("gesamtliste", vorhaben),
      titel: "Gesamt-Stückliste über alle Abschnitte",
    });
  }
  return plan;
}

/** Ein einzelnes Dokument erzeugen */
export async function erzeugeDokument(
  bv: Bauvorhaben,
  typ: Dokumenttyp | "gesamtliste",
  abschnitt: number,
  stempel?: string
): Promise<Uint8Array> {
  const laengen = bv.map((p) => p.masse.laenge ?? 0);
  const lage = bv.length > 1 ? { laengen, aktiv: abschnitt } : undefined;

  if (typ === "gesamtliste") {
    return erzeugeGesamtliste(
      bv.map((p) => ({ projekt: p, ergebnis: berechneBewehrung(p) })),
      stempel
    );
  }

  const projekt: Projekt = bv[Math.min(Math.max(0, abschnitt), bv.length - 1)];
  const ergebnis = berechneBewehrung(projekt);
  if (typ === "bauplan") return erzeugeBauplan(projekt, ergebnis, stempel, lage);
  if (typ === "biegeliste") return erzeugeBiegeliste(projekt, ergebnis, stempel, lage);
  return erzeugeStueckliste(projekt, ergebnis, stempel, lage);
}

/** Alle Dokumente eines Bauvorhabens erzeugen */
export async function erzeugeAlle(
  bv: Bauvorhaben,
  stempel?: string
): Promise<Dokument[]> {
  const fertig: Dokument[] = [];
  for (const d of dokumentplan(bv)) {
    fertig.push({
      name: d.name,
      daten: await erzeugeDokument(bv, d.typ, d.abschnitt ?? 0, stempel),
    });
  }
  return fertig;
}

/** Name der ZIP-Datei */
export function paketname(bv: Bauvorhaben): string {
  const vorhaben = dateifreundlich(bv[0]?.firmendaten.bauvorhaben ?? "");
  const bauteil = dateifreundlich(bauteilModul(bv[0]?.bauteil ?? "wand").name);
  const kern = vorhaben || bauteil || "Bewehrung";
  return `Bewehrung-${kern}.zip`;
}
