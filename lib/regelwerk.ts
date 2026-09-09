/**
 * Regelwerk: Nationaler Anhang zum Eurocode 2.
 *
 * Der Eurocode selbst ist in Österreich und Deutschland derselbe – die
 * Nationalen Anhänge legen aber unterschiedliche Zahlenwerte fest. Wer eine
 * Bewehrung in Wien rechnet, bekommt andere Ergebnisse als in München, und
 * zwar nicht nur andere Wörter, sondern andere Stahlmengen.
 *
 * Belegt und hier umgesetzt sind diese Unterschiede:
 *
 *  1. Betonstahl
 *     Österreich (ÖNORM B 4707): B550A/B550B, f_yk = 550 N/mm²
 *     Deutschland (DIN 488):     B500A/B500B, f_yk = 500 N/mm²
 *     Wirkt auf jede Bemessung und auf As,min der Platten (0,26·fctm/fyk·b·d)
 *     sowie auf die Mindestbügelbewehrung (0,08·√fck/fyk).
 *
 *  2. Betondeckung
 *     c_min,dur je Expositionsklasse und das Vorhaltemaß Δc_dev unterscheiden
 *     sich. Österreich: Δc_dev = 10 mm. Deutschland: Δc_dev = 15 mm,
 *     bei XC1 10 mm.
 *
 *  3. Mindestbewehrung von Wänden (9.6.2)
 *     Empfehlung des EC2 und Österreich: As,vmin = 0,002 · Ac
 *     Deutschland (DIN EN 1992-1-1/NA): As,vmin = 0,0015 · Ac
 *     (0,003 · Ac bei schlanken oder hoch belasteten Wänden – das hängt von
 *     der Normalkraft ab und wird deshalb nur als Hinweis ausgegeben.)
 *
 *  4. Normbezeichnungen in Plan, Listen und Hinweisen.
 *
 * BEWUSST NICHT unterschieden, weil beide Anhänge dort übereinstimmen oder
 * die Abweichung nur lastabhängige Terme betrifft, die dieses Werkzeug nicht
 * rechnet: Mindestbewehrung von Platten und Trägern (9.2/9.3, nur über f_yk),
 * geometrische Mindestbewehrung von Stützen (9.5.2: 0,002·Ac in beiden; der
 * deutsche NA ändert nur den Term 0,10 → 0,15 · N_Ed/f_yd), Bügelabstände,
 * Biegerollendurchmesser und das Lagermattenprogramm.
 *
 * Jedes Dokument schreibt an, nach welchem Regelwerk gerechnet wurde.
 */

export type RegelwerkId = "at" | "de";

/** Eine Betonstahlsorte mit ihrer charakteristischen Streckgrenze */
export interface Stahlsorte {
  name: string;
  /** charakteristische Streckgrenze f_yk [N/mm²] */
  fyk: number;
  titel: string;
}

/** Expositionsklasse mit den Werten des jeweiligen Nationalen Anhangs */
export interface Expositionsklasse {
  name: string;
  beschreibung: string;
  /** Mindestbetondeckung c_min,dur [mm] */
  cminDur: number;
  /** empfohlene Mindest-Betonklasse */
  minBeton: string;
}

export interface Regelwerk {
  id: RegelwerkId;
  land: string;
  /** Kurzform für Beschriftungen, z. B. "AT" */
  kuerzel: string;
  /** Kurzbezeichnung für Schriftkopf und Listen */
  normKurz: string;
  /** vollständige Bezeichnung des Nationalen Anhangs */
  normLang: string;
  /** Norm des Betonstahls */
  betonstahlNorm: string;
  /** Norm der Betonzusammensetzung */
  betonNorm: string;
  /** wählbare Betonstahlsorten */
  stahlsorten: Stahlsorte[];
  /** Expositionsklassen mit den Deckungswerten dieses Anhangs */
  expositionsklassen: Expositionsklasse[];
  /** Vorhaltemaß Δc_dev [mm], teils abhängig von der Expositionsklasse */
  deltaCdev(expo: string): number;
  /** Faktor der vertikalen Mindestbewehrung von Wänden (auf Ac) */
  wandVertikalFaktor: number;
  /** erläuternder Hinweis zur Wand-Mindestbewehrung dieses Anhangs */
  wandHinweis: string;
  /**
   * Textersetzungen für Hinweise, die in den Bauteilmodulen österreichisch
   * formuliert sind. Die Reihenfolge ist wichtig – längere Begriffe zuerst.
   */
  ersetzungen: [string, string][];
}

/* ------------------------------------------------------------------ */
/* Österreich                                                          */
/* ------------------------------------------------------------------ */

export const OESTERREICH: Regelwerk = {
  id: "at",
  land: "Österreich",
  kuerzel: "AT",
  normKurz: "EC2/ÖNORM B 1992-1-1",
  normLang: "ÖNORM EN 1992-1-1 mit ÖNORM B 1992-1-1 (Nationaler Anhang)",
  betonstahlNorm: "ÖNORM B 4707",
  betonNorm: "ÖNORM B 4710-1",
  stahlsorten: [
    { name: "B550B", fyk: 550, titel: "B550B (Stabstahl, hochduktil)" },
    { name: "B550A", fyk: 550, titel: "B550A (Matten, normalduktil)" },
  ],
  // c_min,dur nach ÖNORM B 1992-1-1, Bauteilklasse S4
  expositionsklassen: [
    { name: "XC1", beschreibung: "trocken / ständig nass (Innenräume)", cminDur: 15, minBeton: "C20/25" },
    { name: "XC2", beschreibung: "nass, selten trocken (Fundamente)", cminDur: 20, minBeton: "C20/25" },
    { name: "XC3", beschreibung: "mäßige Feuchte (überdachte Außenbauteile)", cminDur: 25, minBeton: "C25/30" },
    { name: "XC4", beschreibung: "wechselnd nass/trocken (bewittert)", cminDur: 25, minBeton: "C25/30" },
    { name: "XD1", beschreibung: "mäßige Feuchte, Chloride (Sprühnebel)", cminDur: 30, minBeton: "C30/37" },
    { name: "XD2", beschreibung: "nass, selten trocken, Chloride", cminDur: 35, minBeton: "C30/37" },
    { name: "XD3", beschreibung: "wechselnd nass/trocken, Chloride (Spritzwasser)", cminDur: 40, minBeton: "C35/45" },
    { name: "XF1", beschreibung: "Frost ohne Taumittel, mäßig wassergesättigt", cminDur: 25, minBeton: "C25/30" },
  ],
  deltaCdev: () => 10,
  wandVertikalFaktor: 0.002,
  wandHinweis:
    "Vertikale Mindestbewehrung der Wand nach EC2 9.6.2: As,vmin = 0,002 · Ac (Empfehlung des Eurocode, in Österreich übernommen).",
  ersetzungen: [],
};

/* ------------------------------------------------------------------ */
/* Deutschland                                                         */
/* ------------------------------------------------------------------ */

export const DEUTSCHLAND: Regelwerk = {
  id: "de",
  land: "Deutschland",
  kuerzel: "DE",
  normKurz: "EC2/DIN EN 1992-1-1/NA",
  normLang: "DIN EN 1992-1-1 mit DIN EN 1992-1-1/NA (Nationaler Anhang)",
  betonstahlNorm: "DIN 488",
  betonNorm: "DIN EN 206 / DIN 1045-2",
  stahlsorten: [
    { name: "B500B", fyk: 500, titel: "B500B (Stabstahl, hochduktil)" },
    { name: "B500A", fyk: 500, titel: "B500A (Matten, normalduktil)" },
  ],
  // c_min,dur nach DIN EN 1992-1-1/NA Tab. 4.4DE, Betonstahl.
  // Bei XD1/XD2 ist das Sicherheitselement Δc_dur,γ (+10 bzw. +5 mm)
  // bereits eingerechnet.
  expositionsklassen: [
    { name: "XC1", beschreibung: "trocken / ständig nass (Innenräume)", cminDur: 10, minBeton: "C20/25" },
    { name: "XC2", beschreibung: "nass, selten trocken (Fundamente)", cminDur: 20, minBeton: "C20/25" },
    { name: "XC3", beschreibung: "mäßige Feuchte (überdachte Außenbauteile)", cminDur: 20, minBeton: "C20/25" },
    { name: "XC4", beschreibung: "wechselnd nass/trocken (bewittert)", cminDur: 25, minBeton: "C25/30" },
    { name: "XD1", beschreibung: "mäßige Feuchte, Chloride (Sprühnebel)", cminDur: 40, minBeton: "C30/37" },
    { name: "XD2", beschreibung: "nass, selten trocken, Chloride", cminDur: 40, minBeton: "C35/45" },
    { name: "XD3", beschreibung: "wechselnd nass/trocken, Chloride (Spritzwasser)", cminDur: 40, minBeton: "C35/45" },
    { name: "XF1", beschreibung: "Frost ohne Taumittel, mäßig wassergesättigt", cminDur: 25, minBeton: "C25/30" },
  ],
  // Δc_dev = 15 mm für die Dauerhaftigkeit, bei XC1 genügen 10 mm
  deltaCdev: (expo) => (expo === "XC1" ? 10 : 15),
  wandVertikalFaktor: 0.0015,
  wandHinweis:
    "Vertikale Mindestbewehrung der Wand nach DIN EN 1992-1-1/NA 9.6.2: As,vmin = 0,0015 · Ac. Bei schlanken Wänden (λ ≥ λlim) oder |N_Ed| ≥ 0,3 · fcd · Ac fordert der Anhang 0,003 · Ac – das hängt von der Normalkraft ab und ist statisch zu prüfen.",
  ersetzungen: [
    ["EC2/ÖNORM B 1992-1-1", "EC2/DIN EN 1992-1-1/NA"],
    ["ÖNORM B 1992-1-1", "DIN EN 1992-1-1/NA"],
    ["EC7/ÖNORM B 1997", "EC7/DIN EN 1997-1/NA"],
    ["ÖNORM B 1997", "DIN EN 1997-1/NA"],
    ["ÖNORM B 4710", "DIN EN 206 / DIN 1045-2"],
    ["ÖNORM B 4707", "DIN 488"],
    ["ÖNORM/BVBS", "DIN/BVBS"],
    ["ÖNORM", "DIN"],
    ["in Österreich", "in Deutschland"],
    ["Ziviltechnikerin", "Prüfingenieurin"],
    ["Ziviltechniker", "Prüfingenieur"],
  ],
};

/* ------------------------------------------------------------------ */
/* Register                                                            */
/* ------------------------------------------------------------------ */

export const REGELWERKE: Regelwerk[] = [OESTERREICH, DEUTSCHLAND];

/** Standard: Österreich – der Heimatmarkt des Werkzeugs */
export const STANDARD_REGELWERK: RegelwerkId = "at";

/** Regelwerk zu einer Kennung; fällt auf Österreich zurück */
export function regelwerkVon(id: string | undefined): Regelwerk {
  return REGELWERKE.find((r) => r.id === id) ?? OESTERREICH;
}

/** Gibt es diese Regelwerkskennung? */
export function istRegelwerk(id: unknown): id is RegelwerkId {
  return typeof id === "string" && REGELWERKE.some((r) => r.id === id);
}

/** Streckgrenze der Sorte; fällt auf die erste Sorte des Regelwerks zurück */
export function fykVon(regelwerk: Regelwerk, stahlguete: string): number {
  return (
    regelwerk.stahlsorten.find((s) => s.name === stahlguete)?.fyk ??
    regelwerk.stahlsorten[0].fyk
  );
}

/** Nennmaß der Betondeckung c_nom = c_min,dur + Δc_dev [mm] */
export function cnomAusExposition(regelwerk: Regelwerk, expo: string): number {
  const e = regelwerk.expositionsklassen.find((x) => x.name === expo);
  return (e ? e.cminDur : 25) + regelwerk.deltaCdev(expo);
}

/**
 * Passt einen österreichisch formulierten Hinweistext an das gewählte
 * Regelwerk an. Die Bauteilmodule schreiben ihre Texte in einer Sprache;
 * die Umstellung passiert an dieser einen Stelle, damit kein Modul zwei
 * Textvarianten pflegen muss.
 */
export function anNorm(text: string, regelwerk: Regelwerk): string {
  let s = text;
  for (const [von, nach] of regelwerk.ersetzungen) s = s.split(von).join(nach);
  return s;
}
