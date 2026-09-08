/**
 * Plausibilitätsprüfung der Eingaben.
 *
 * Zwei Schweregrade:
 *  – "fehler":  geometrisch unmöglich oder außerhalb des zulässigen Bereichs.
 *               Die Zahlung wird gesperrt, bis der Fehler behoben ist.
 *  – "warnung": bautechnisch heikel, aber rechenbar (z. B. sehr schmale
 *               Restpfeiler). Wird angezeigt, blockiert aber nicht.
 *
 * Die Grenzen der Grundmaße kommen aus der Felddefinition des jeweiligen
 * Bauteilmoduls; bauteilspezifische Zusatzprüfungen liefert dessen
 * `pruefe()`. Öffnungen werden generisch geprüft: Bauteile mit Öffnungen
 * spannen sie definitionsgemäß in der Ebene `laenge` (x) × `hoehe` (y) auf.
 *
 * Die Prüfung läuft rein im Browser und ergänzt die serverseitige
 * Validierung in `lib/payload.ts` – ersetzt sie aber nicht.
 */

import { Oeffnung, Projekt, Pruefmeldung } from "./types";
import { bauteilModul } from "./bauteile";
import { oeffnungsMarke } from "./bauteile/helfer";

export type { Pruefmeldung } from "./types";
export { oeffnungsMarke } from "./bauteile/helfer";

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

/* ------------------------------------------------------------------ */
/* Hilfen                                                              */
/* ------------------------------------------------------------------ */

/** Meter als Zentimeter-Text, z. B. 0.42 → "42 cm" */
const cmText = (m: number) => `${Math.round(m * 100)} cm`;
/** Meter mit zwei Nachkommastellen, deutsche Schreibweise */
const mText = (m: number) => `${m.toFixed(2).replace(".", ",")} m`;

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
  const modul = bauteilModul(projekt.bauteil);
  const { masse, oeffnungen } = projekt;
  // kleine Toleranz gegen Rundungsartefakte bei Kommazahlen
  const eps = 1e-6;

  const fehler = (feld: string, text: string) =>
    meldungen.push({ feld, schwere: "fehler", text });
  const warnung = (feld: string, text: string) =>
    meldungen.push({ feld, schwere: "warnung", text });

  /* ---------- Grundmaße: Grenzen aus der Modulbeschreibung ---------- */
  for (const f of modul.masse) {
    const wert = masse[f.schluessel];
    const grenzText = (v: number) =>
      f.einheit === "cm" ? `${Math.round(v * 100)} cm` : mText(v);

    if (!isFinite(wert) || wert <= 0) {
      fehler(f.schluessel, `${f.label} muss größer als 0 sein.`);
      continue;
    }
    if (wert < f.min)
      fehler(f.schluessel, `${f.label} muss mindestens ${grenzText(f.min)} betragen.`);
    else if (wert > f.max)
      fehler(f.schluessel, `${f.label} darf höchstens ${grenzText(f.max)} betragen.`);
  }

  /* ---------- Öffnungen ---------- */
  // Nur Bauteile mit Öffnungen; die Öffnungsebene ist laenge × hoehe.
  if (modul.hatOeffnungen) {
    const laenge = masse.laenge;
    const hoehe = masse.hoehe;
    const masseOk = isFinite(laenge) && isFinite(hoehe) && laenge > 0 && hoehe > 0;

    oeffnungen.forEach((o: Oeffnung, i: number) => {
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
      const ueberRechts = o.x + o.breite - laenge;
      const ueberOben = o.y + o.hoehe - hoehe;

      if (ueberRechts > eps)
        fehler(
          `${s}:breite`,
          `${marke} ragt um ${cmText(ueberRechts)} über den rechten Rand hinaus. ` +
            `Position x + Breite darf höchstens ${mText(laenge)} ergeben.`
        );
      if (ueberOben > eps)
        fehler(
          `${s}:hoehe`,
          `${marke} ragt um ${cmText(ueberOben)} über die Oberkante hinaus. ` +
            `Position y + Höhe darf höchstens ${mText(hoehe)} ergeben.`
        );

      if (ueberRechts > eps || ueberOben > eps) return;

      /* --- Rand- und Pfeilerabstände --- */
      const abstaende: [string, number][] = [
        ["links", o.x],
        ["rechts", laenge - (o.x + o.breite)],
        ["unten", o.y],
        ["oben", hoehe - (o.y + o.hoehe)],
      ];

      for (const [seite, d] of abstaende) {
        // d = 0 ist zulässig (Tür bis Unterkante, Öffnung bis Oberkante)
        if (d <= eps) continue;
        if (d < MIN_PFEILER)
          warnung(
            s,
            `${marke}: nur ${cmText(d)} Restquerschnitt ${seite}. Ein Bauteilstreifen ` +
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
              `Zwischen ${marke} und ${marke2} bleiben nur ${cmText(spalt)} Bauteil stehen – ` +
                `dieser Pfeiler ist als Stütze zu bemessen.`
            );
        }
      });
    });
  }

  /* ---------- bauteilspezifische Zusatzprüfungen ---------- */
  if (modul.pruefe) meldungen.push(...modul.pruefe(projekt));

  return meldungen;
}

/**
 * Ordnet eine Meldung einem Wizard-Schritt zu, damit fehlerhafte Schritte in
 * der Schrittleiste markiert werden können. Es wird ein Schlüssel und keine
 * Nummer geliefert, weil die Schrittfolge je Bauteil unterschiedlich lang ist
 * (Bauteile ohne Öffnungen überspringen den Öffnungsschritt).
 */
export function schrittZuMeldung(m: Pruefmeldung): "masse" | "oeffnungen" {
  return m.feld.startsWith("oef:") ? "oeffnungen" : "masse";
}
