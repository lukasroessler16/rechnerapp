/**
 * Versionierung der bezahlten Projektdaten.
 *
 * WARUM DAS WICHTIG IST
 * Die App ist zustandslos: Der Link, den ein Kunde nach der Zahlung bekommt,
 * enthält keine fertigen PDFs, sondern nur die Stripe-Session. Die Dokumente
 * werden bei JEDEM Aufruf neu gerechnet – mit dem Code, der gerade läuft.
 *
 * Solange sich an den Rechenregeln nichts ändert, ist das elegant. Sobald
 * sich etwas ändert (ein Standardwert, ein Feldname, eine Norminterpretation),
 * bekäme ein Kunde beim erneuten Aufruf seines Links andere Mengen als beim
 * Kauf – bei Unterlagen, nach denen Baustahl bestellt wird, ist das nicht
 * hinnehmbar. Dokumentiert werden deshalb zwei Dinge in der Zahlungssession:
 *
 *   v     Format der Projektdaten. Wird beim Einlesen geprüft. Ändert sich
 *         die Struktur, steigt die Zahl, und alte Sessions laufen durch eine
 *         Migration (siehe MIGRATIONEN) statt still falsch gelesen zu werden.
 *
 *   b     Code-Stand zum Zeitpunkt der Zahlung (Git-Commit). Damit lässt sich
 *         später zweifelsfrei feststellen, welcher Programmstand ein Dokument
 *         erzeugt hat. Der Wert wird auch auf die PDFs gedruckt.
 *
 * REGEL FÜR SPÄTERE ÄNDERUNGEN
 * Ändert sich etwas an der Bedeutung der gespeicherten Felder, wird
 * PAYLOAD_VERSION erhöht und eine Migration ergänzt. Ändert sich etwas an den
 * Rechenregeln, gehört das im Changelog (siehe README) mit dem Commit
 * festgehalten, damit ein altes Dokument nachvollziehbar bleibt.
 */

/** Aktuelles Format der in der Zahlungssession gespeicherten Projektdaten */
export const PAYLOAD_VERSION = 1;

/**
 * Migrationen von älteren Formaten auf das aktuelle.
 * Schlüssel = Ausgangsversion. Jede Funktion hebt die Daten um genau eine
 * Version an; metadataZuProjekt() wendet sie der Reihe nach an.
 *
 * Noch leer – Version 1 ist die erste veröffentlichte Fassung.
 */
export const MIGRATIONEN: Record<number, (daten: unknown) => unknown> = {};

/**
 * Code-Stand, mit dem gerade gerechnet wird.
 * Auf Vercel liefert VERCEL_GIT_COMMIT_SHA den Commit automatisch; lokal
 * kann APP_VERSION gesetzt werden. Ohne beides: "dev".
 */
export function codeStand(): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (sha) return sha.slice(0, 7);
  return process.env.APP_VERSION || "dev";
}

/**
 * Kurzer Stempel für den Fuß der Dokumente: Code-Stand und – falls vorhanden –
 * die Zahlungsreferenz. Damit ist ein ausgedrucktes Blatt eindeutig einer
 * Berechnung zuzuordnen, ohne personenbezogene Daten aufzudrucken.
 */
export function dokumentStempel(opts: {
  codeStand: string;
  sessionId?: string;
}): string {
  const ref = opts.sessionId ? ` · Ref. ${opts.sessionId.slice(-12)}` : "";
  return `Dok.-Stand ${opts.codeStand}${ref}`;
}
