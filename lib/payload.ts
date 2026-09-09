/**
 * Serialisierung des Projekt-Zustands für die Stripe-Checkout-Metadata.
 *
 * Ansatz: Die App ist bewusst zustandslos (keine Datenbank). Die gesamte
 * Projektgeometrie wird beim Checkout komprimiert (deflate → base64url)
 * und in den Metadata-Feldern der Stripe-Session gespeichert (Chunks à
 * 450 Zeichen, max. 40 Chunks ≈ 18 kB – für Geometriedaten mehr als genug).
 *
 * Nach der Zahlung liest der Server die Daten aus der bezahlten Session
 * zurück – so können die Dokumente nicht mit anderen Daten "getauscht"
 * werden. Das Firmenlogo (potenziell groß) wird NICHT über Stripe geführt,
 * sondern clientseitig gehalten und beim Dokumentabruf mitgesendet.
 *
 * Die Prüfung der Maße und Detailauswahlen erfolgt anhand der Felddefinition
 * des jeweiligen Bauteilmoduls – ein neues Bauteil ist damit automatisch
 * serverseitig abgesichert, ohne dass hier etwas geändert werden muss.
 */

import { deflateSync, inflateSync } from "zlib";
import { Projekt } from "./types";
import { alleMassfelder, bauteilModul, istBauteil, STANDARD_BAUTEIL } from "./bauteile";

const CHUNK = 450;
const MAX_CHUNKS = 40;

/** Projekt → Metadata-Objekt { n: Anzahl, p0..pn: Chunks } */
export function projektZuMetadata(projekt: Projekt): Record<string, string> {
  // Logo niemals in die Metadata aufnehmen (Größenlimit!)
  const schlank: Projekt = {
    ...projekt,
    firmendaten: { ...projekt.firmendaten, logoDataUrl: undefined },
  };
  const b64 = deflateSync(Buffer.from(JSON.stringify(schlank), "utf8")).toString(
    "base64url"
  );
  const meta: Record<string, string> = {};
  const chunks = Math.ceil(b64.length / CHUNK);
  if (chunks > MAX_CHUNKS)
    throw new Error("Projektdaten zu umfangreich für den Checkout.");
  meta["n"] = String(chunks);
  for (let i = 0; i < chunks; i++)
    meta[`p${i}`] = b64.slice(i * CHUNK, (i + 1) * CHUNK);
  return meta;
}

/** Metadata-Objekt → Projekt (wirft bei ungültigen Daten) */
export function metadataZuProjekt(meta: Record<string, string>): Projekt {
  const n = parseInt(meta["n"] ?? "0", 10);
  if (!n) throw new Error("Keine Projektdaten in der Zahlungssession.");
  let b64 = "";
  for (let i = 0; i < n; i++) b64 += meta[`p${i}`] ?? "";
  const json = inflateSync(Buffer.from(b64, "base64url")).toString("utf8");
  return validiereProjekt(JSON.parse(json));
}

/** Grund-Validierung + Begrenzung der Eingaben (Server-Seite) */
export function validiereProjekt(p: unknown): Projekt {
  const q = p as Projekt;
  const num = (v: unknown, min: number, max: number, name: string): number => {
    const x = Number(v);
    if (!isFinite(x) || x < min || x > max)
      throw new Error(`Ungültiger Wert für ${name}.`);
    return x;
  };

  /* ---------- Bauteil und dessen Felddefinition ---------- */
  if (!istBauteil(q.bauteil)) throw new Error("Ungültiger Bauteiltyp.");
  const modul = bauteilModul(q.bauteil ?? STANDARD_BAUTEIL);

  /* ---------- Grundmaße: nur bekannte Felder, jeweils im Bereich ---------- */
  const masse: Record<string, number> = {};
  for (const f of alleMassfelder(modul))
    masse[f.schluessel] = num(q.masse?.[f.schluessel], f.min, f.max, f.label);
  q.masse = masse;

  /* ---------- Detailauswahlen: nur zulässige Optionen ---------- */
  const details: Record<string, string> = {};
  for (const f of modul.details) {
    const wert = String(q.details?.[f.schluessel] ?? "");
    details[f.schluessel] = f.optionen.some((o) => o.wert === wert) ? wert : f.standard;
  }
  q.details = details;

  /* ---------- Öffnungen ---------- */
  if (!Array.isArray(q.oeffnungen)) q.oeffnungen = [];
  if (q.oeffnungen.length > 20) throw new Error("Ungültige Öffnungsliste (max. 20).");
  if (!modul.hatOeffnungen) {
    q.oeffnungen = [];
  } else {
    const erlaubt = modul.oeffnungsTypen ?? ["fenster", "tuer", "aussparung"];
    q.oeffnungen = q.oeffnungen.map((o, i) => ({
      id: String(o.id ?? i),
      typ: erlaubt.includes(o.typ) ? o.typ : erlaubt[0],
      x: num(o.x, 0, 100, `Öffnung ${i + 1}: x`),
      y: num(o.y, 0, 100, `Öffnung ${i + 1}: y`),
      breite: num(o.breite, 0.1, 20, `Öffnung ${i + 1}: Breite`),
      hoehe: num(o.hoehe, 0.1, 20, `Öffnung ${i + 1}: Höhe`),
    }));
  }

  /* ---------- Bautechnische Parameter ---------- */
  q.parameter = {
    betonklasse: String(q.parameter?.betonklasse ?? "C25/30"),
    expositionsklasse: String(q.parameter?.expositionsklasse ?? "XC2"),
    betondeckung: num(q.parameter?.betondeckung, 10, 80, "Betondeckung"),
    stahlguete: q.parameter?.stahlguete === "B550B" ? "B550B" : "B550A",
    lagen: q.parameter?.lagen === 1 ? 1 : 2,
    matte: String(q.parameter?.matte ?? "auto"),
    stababstand: num(q.parameter?.stababstand ?? 250, 100, 400, "Stababstand"),
  };

  /* ---------- Firmendaten ---------- */
  const txt = (v: unknown, max = 120) => String(v ?? "").slice(0, max);
  q.firmendaten = {
    firma: txt(q.firmendaten?.firma),
    planersteller: txt(q.firmendaten?.planersteller),
    bauvorhaben: txt(q.firmendaten?.bauvorhaben),
    adresse: txt(q.firmendaten?.adresse),
    datum: txt(q.firmendaten?.datum, 20),
    logoDataUrl: q.firmendaten?.logoDataUrl,
  };

  return q;
}
