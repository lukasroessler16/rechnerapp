/**
 * Einfaches Rate-Limit für die API-Routen.
 *
 * WARUM: Jede PDF-Erzeugung ist Rechenzeit, die auf Vercel abgerechnet wird.
 * Ohne Bremse genügt eine Schleife in der Konsole, um Kosten zu erzeugen –
 * ganz ohne böse Absicht, ein hängender Client reicht.
 *
 * ANSATZ: Zähler je IP in einem Zeitfenster, im Arbeitsspeicher der Instanz.
 * Das ist bewusst einfach gehalten und passt zum zustandslosen Entwurf der
 * App: kein zusätzlicher Dienst, keine Datenbank, keine gespeicherten
 * personenbezogenen Daten (die IP wird nur gehasht und nach Ablauf des
 * Fensters vergessen).
 *
 * GRENZE: Serverless-Instanzen leben kurz und es gibt mehrere davon. Das
 * Limit wirkt deshalb je Instanz, nicht global – gegen Versehen und einfache
 * Schleifen hilft es zuverlässig, gegen einen verteilten Angriff nicht. Wenn
 * das einmal nötig wird, ist die Vercel-Firewall oder ein geteilter Zähler
 * (Upstash Redis) der nächste Schritt; die Aufrufstellen bleiben gleich.
 */

import { createHash } from "crypto";
import { NextRequest } from "next/server";

interface Fenster {
  anzahl: number;
  /** Zeitpunkt, an dem das Fenster endet (ms seit Epoche) */
  bis: number;
}

const zaehler = new Map<string, Fenster>();

/** Verhindert, dass die Map bei langlebigen Instanzen unbegrenzt wächst */
function aufraeumen(jetzt: number) {
  if (zaehler.size < 5000) return;
  for (const [schluessel, f] of zaehler) if (f.bis <= jetzt) zaehler.delete(schluessel);
}

/**
 * Anfragenden identifizieren. Hinter Vercel steht die echte Adresse in
 * x-forwarded-for. Gespeichert wird nur ein Hash – die Adresse selbst
 * brauchen wir nicht und wollen wir nicht vorhalten.
 */
function kennung(req: NextRequest): string {
  const roh =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unbekannt";
  return createHash("sha256").update(roh).digest("hex").slice(0, 16);
}

export interface LimitErgebnis {
  erlaubt: boolean;
  /** Sekunden bis zum nächsten erlaubten Versuch (nur wenn gesperrt) */
  wartenSek: number;
  /** verbleibende Aufrufe im laufenden Fenster */
  rest: number;
}

/**
 * Prüft und zählt einen Aufruf.
 *
 * @param bereich  eigener Topf je Route ("checkout", "dokumente", "muster")
 * @param grenze   erlaubte Aufrufe je Fenster
 * @param fensterSek Länge des Fensters in Sekunden
 */
export function pruefeLimit(
  req: NextRequest,
  bereich: string,
  grenze: number,
  fensterSek: number
): LimitErgebnis {
  const jetzt = Date.now();
  aufraeumen(jetzt);

  const schluessel = `${bereich}:${kennung(req)}`;
  const vorhanden = zaehler.get(schluessel);

  if (!vorhanden || vorhanden.bis <= jetzt) {
    zaehler.set(schluessel, { anzahl: 1, bis: jetzt + fensterSek * 1000 });
    return { erlaubt: true, wartenSek: 0, rest: grenze - 1 };
  }

  vorhanden.anzahl++;
  if (vorhanden.anzahl > grenze) {
    return {
      erlaubt: false,
      wartenSek: Math.max(1, Math.ceil((vorhanden.bis - jetzt) / 1000)),
      rest: 0,
    };
  }
  return { erlaubt: true, wartenSek: 0, rest: grenze - vorhanden.anzahl };
}

/** Nur für Tests: Zählerstände zurücksetzen */
export function limitZuruecksetzen() {
  zaehler.clear();
}
