import Link from "next/link";

/**
 * Bausteine für die Rechtstexte (Impressum, Datenschutz, Nutzungsbedingungen).
 *
 * `Platzhalter` markiert alle Stellen, die der Betreiber vor der
 * Veröffentlichung durch echte Angaben ersetzen muss. Sie werden gelb
 * hervorgehoben, damit beim Durchscrollen keine Stelle übersehen wird.
 */

/** Gelb hervorgehobener Platzhalter, z. B. <Platzhalter>Firmenname</Platzhalter> */
export function Platzhalter({ children }: { children: React.ReactNode }) {
  return <span className="platzhalter">[{children}]</span>;
}

/** Hinweiskasten für den Betreiber – vor dem Livegang zu entfernen */
export function BetreiberHinweis({ children }: { children: React.ReactNode }) {
  return (
    <div className="warnbox">
      <strong>Hinweis für den Betreiber (vor Veröffentlichung entfernen):</strong>{" "}
      {children}
    </div>
  );
}

/** Rahmen einer Rechtstextseite – mit Rücksprung zur Startseite */
export function RechtsSeite({
  titel,
  stand,
  children,
}: {
  titel: string;
  stand?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mitte">
      <p className="zurueck">
        <Link href="/">← Zurück zur Startseite</Link>
      </p>
      <div className="panel rechtstext">
        <h2>{titel}</h2>
        {stand && <p className="stand">Stand: {stand}</p>}
        {children}
      </div>
      <p className="zurueck unten">
        <Link href="/">← Zurück zur Startseite</Link>
        <Link href="/rechner">Zum Rechner →</Link>
      </p>
    </main>
  );
}
