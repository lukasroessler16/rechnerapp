/**
 * Plausibilitätsprüfung der Eingaben.
 *
 * Zwei Schweregrade:
 *  – "fehler":  geometrisch unmöglich oder außerhalb des zulässigen Bereichs.
 *               Die Zahlung wird gesperrt, bis der Fehler behoben ist.
 *  – "warnung": bautechnisch heikel, aber rechenbar (z. B. sehr schmale
 *               Restpfeiler). Wird angezeigt, blockiert aber nicht.
 *
 * Die Prüfung läuft rein im Browser und ergänzt die serverseitige
 * Validierung in `lib/payload.ts` – ersetzt sie aber nicht.
 */

import { Projekt, Oeffnung } from "./types";

export interface Pruefmeldung {
  /** Feldschlüssel, z. B. "laenge" oder "oef:<id>:breite" */
  feld: string;
  schwere: "fehler" | "warnung";
  text: string;
}

/* ------------------------------------------------------------------ */
/* Bautechnische Schwellenwerte                                        */
/* ------------------------------------------------------------------ */

/**
 * Verankerungslänge der Zulagen (≈ 50·ds bei Ø12) [m].
 * Liegt eine Öffnung näher am Rand, kann die Sturz- oder Laibungszulage
 * nicht mehr gerade verankert werden und muss abgewinkelt werden.
 */
const VERANKERUNG = 0.6;

/**
 * Restquerschnitt, ab dem ein stehengebliebener Wandstreifen nicht mehr
 * als Wand, sondern als Stütze zu bemessen ist [m].
 */
const MIN_PFEILER = 0.25;

/** Zulässige Bereiche (identisch zur serverseitigen Prüfung) */
const GRENZEN = {
  laenge: { min: 0.5, max: 100 },
  hoehe: { min: 0.5, max: 100 },
  dicke: { min: 0.08, max: 1.0 },
};

/* ------------------------------------------------------------------ */
/* Hilfen                                                              */
/* ------------------------------------------------------------------ */

/** Meter als Zentimeter-Text, z. B. 0.42 → "42 cm" */
const cmText = (m: number) => `${Math.round(m * 100)} cm`;
/** Meter mit zwei Nachkommastellen, deutsche Schreibweise */
const mText = (m: number) => `${m.toFixed(2).replace(".", ",")} m`;

/** Planmarke einer Öffnung, identisch zu Skizze, Bauplan und Stückliste */
export function oeffnungsMarke(o: Oeffnung, index: number): string {
  return (o.typ === "fenster" ? "F" : o.typ === "tuer" ? "T" : "A") + (index + 1);
}

/** Erste Fehlermeldung zu einem Feld (für die Anzeige am Eingabefeld) */
export function fehlerZu(meldungen: Pruefmeldung[], feld: string): string | undefined {
  return meldungen.find((m) => m.feld === feld && m.schwere === "fehler")?.text;
}

/** Gibt es blockierende Fehler? */
export function hatFehler(meldungen: Pruefmeldung[]): boolean {
  return meldungen.some((m) => m.schwere === "fehler");
}

/* ------------------------------------------------------------------ */
/* Hauptprüfung                                                        */
/* ------------------------------------------------------------------ */

export function pruefeProjekt(projekt: Projekt): Pruefmeldung[] {
  const meldungen: Pruefmeldung[] = [];
  const { masse, oeffnungen, bauteil } = projekt;
  const wand = bauteil === "wand";
  const nameQuer = wand ? "Höhe" : "Breite";
  // kleine Toleranz gegen Rundungsartefakte bei Kommazahlen
  const eps = 1e-6;

  const fehler = (feld: string, text: string) =>
    meldungen.push({ feld, schwere: "fehler", text });
  const warnung = (feld: string, text: string) =>
    meldungen.push({ feld, schwere: "warnung", text });

  /* ---------- Grundmaße ---------- */
  if (!isFinite(masse.laenge) || masse.laenge <= 0)
    fehler("laenge", "Die Länge muss größer als 0 sein.");
  else if (masse.laenge < GRENZEN.laenge.min)
    fehler("laenge", `Die Länge muss mindestens ${mText(GRENZEN.laenge.min)} betragen.`);
  else if (masse.laenge > GRENZEN.laenge.max)
    fehler("laenge", `Die Länge darf höchstens ${GRENZEN.laenge.max} m betragen.`);

  if (!isFinite(masse.hoehe) || masse.hoehe <= 0)
    fehler("hoehe", `Die ${nameQuer} muss größer als 0 sein.`);
  else if (masse.hoehe < GRENZEN.hoehe.min)
    fehler("hoehe", `Die ${nameQuer} muss mindestens ${mText(GRENZEN.hoehe.min)} betragen.`);
  else if (masse.hoehe > GRENZEN.hoehe.max)
    fehler("hoehe", `Die ${nameQuer} darf höchstens ${GRENZEN.hoehe.max} m betragen.`);

  if (!isFinite(masse.dicke) || masse.dicke <= 0)
    fehler("dicke", "Die Dicke muss größer als 0 sein.");
  else if (masse.dicke < GRENZEN.dicke.min || masse.dicke > GRENZEN.dicke.max)
    fehler(
      "dicke",
      `Die Dicke muss zwischen ${Math.round(GRENZEN.dicke.min * 100)} und ${Math.round(
        GRENZEN.dicke.max * 100
      )} cm liegen.`
    );

  // Ohne brauchbare Grundmaße sind Öffnungsprüfungen sinnlos
  const masseOk =
    masse.laenge > 0 && masse.hoehe > 0 && isFinite(masse.laenge) && isFinite(masse.hoehe);

  /* ---------- Öffnungen ---------- */
  oeffnungen.forEach((o, i) => {
    const marke = oeffnungsMarke(o, i);
    const s = `oef:${o.id}`;

    // Eigenmaße
    if (!isFinite(o.breite) || o.breite <= 0)
      fehler(`${s}:breite`, "Die Breite muss größer als 0 sein.");
    if (!isFinite(o.hoehe) || o.hoehe <= 0)
      fehler(`${s}:hoehe`, "Die Höhe muss größer als 0 sein.");
    if (!isFinite(o.x) || o.x < 0)
      fehler(`${s}:x`, "Die Position x darf nicht negativ sein.");
    if (!isFinite(o.y) || o.y < 0)
      fehler(`${s}:y`, "Die Position y darf nicht negativ sein.");

    if (!masseOk || o.breite <= 0 || o.hoehe <= 0 || o.x < 0 || o.y < 0) return;

    /* --- liegt die Öffnung im Bauteil? --- */
    const ueberRechts = o.x + o.breite - masse.laenge;
    const ueberOben = o.y + o.hoehe - masse.hoehe;

    if (ueberRechts > eps)
      fehler(
        `${s}:breite`,
        `${marke} ragt um ${cmText(ueberRechts)} über den rechten Rand hinaus. ` +
          `Position x + Breite darf höchstens ${mText(masse.laenge)} ergeben.`
      );
    if (ueberOben > eps)
      fehler(
        `${s}:hoehe`,
        `${marke} ragt um ${cmText(ueberOben)} über die Oberkante hinaus. ` +
          `Position y + Höhe darf höchstens ${mText(masse.hoehe)} ergeben.`
      );

    if (ueberRechts > eps || ueberOben > eps) return;

    /* --- Rand- und Pfeilerabstände --- */
    const abstaende: [string, number][] = [
      ["links", o.x],
      ["rechts", masse.laenge - (o.x + o.breite)],
      ["unten", o.y],
      ["oben", masse.hoehe - (o.y + o.hoehe)],
    ];

    for (const [seite, d] of abstaende) {
      // d = 0 ist zulässig (Tür bis Unterkante, Öffnung bis Oberkante)
      if (d <= eps) continue;
      if (d < MIN_PFEILER)
        warnung(
          s,
          `${marke}: nur ${cmText(d)} Restquerschnitt ${seite}. Ein Wandstreifen ` +
            `unter ${cmText(MIN_PFEILER)} ist als Stütze zu bemessen – bitte statisch prüfen.`
        );
      else if (d < VERANKERUNG)
        warnung(
          s,
          `${marke}: Randabstand ${seite} beträgt ${cmText(d)} und liegt unter der ` +
            `Verankerungslänge von ${cmText(VERANKERUNG)}. Die Zulagen müssen abgewinkelt ` +
            `oder mit Haken verankert werden.`
        );
    }

    /* --- Überschneidung mit anderen Öffnungen --- */
    oeffnungen.forEach((p, j) => {
      if (j <= i) return;
      if (p.breite <= 0 || p.hoehe <= 0) return;
      const ueberlapptX = o.x < p.x + p.breite - eps && p.x < o.x + o.breite - eps;
      const ueberlapptY = o.y < p.y + p.hoehe - eps && p.y < o.y + o.hoehe - eps;
      const marke2 = oeffnungsMarke(p, j);

      if (ueberlapptX && ueberlapptY) {
        fehler(s, `${marke} und ${marke2} überschneiden einander.`);
        return;
      }
      // Schmaler Pfeiler zwischen zwei nebeneinanderliegenden Öffnungen
      if (ueberlapptY) {
        const spalt = Math.max(o.x, p.x) - Math.min(o.x + o.breite, p.x + p.breite);
        if (spalt > eps && spalt < MIN_PFEILER)
          warnung(
            s,
            `Zwischen ${marke} und ${marke2} bleiben nur ${cmText(spalt)} Wand stehen – ` +
              `dieser Pfeiler ist als Stütze zu bemessen.`
          );
      }
    });
  });

  return meldungen;
}

/**
 * Ordnet eine Meldung dem Wizard-Schritt zu (0-basiert), damit fehlerhafte
 * Schritte in der Schrittleiste markiert werden können.
 */
export function schrittZuMeldung(m: Pruefmeldung): number {
  if (m.feld.startsWith("oef:")) return 2; // Schritt 3 · Öffnungen
  return 1; // Schritt 2 · Grundmaße
}
