import type { Metadata } from "next";
import Link from "next/link";
import { LogoGestapelt } from "@/components/Logo";
import { BAUTEILE } from "@/lib/bauteile";

export const metadata: Metadata = {
  title: "Rösch Bewehrungsrechner – Baustahlmenge für Betonbauteile",
  description:
    "Bauplan, Biegeliste und Stückliste für Betonbauteile als PDF. Nach Eurocode 2 mit österreichischem oder deutschem Nationalem Anhang. Ohne Registrierung, Einmalzahlung pro Berechnung.",
};

const PREIS = process.env.NEXT_PUBLIC_PREIS_EUR ?? "29";

/**
 * Startseite: bewusst nur Begrüßung und Kurzvorstellung.
 *
 * Alles Vertiefende – Musterdokumente, fachliche Grundlagen, FAQ – liegt auf
 * /beispiele; die Rechtstexte auf ihren eigenen Seiten. Diese Seite muss nur
 * zwei Fragen beantworten: Was ist das, und wo geht es los.
 */
export default function Startseite() {
  return (
    <main className="start start-schlank">
      <section className="willkommen">
        <LogoGestapelt groesse={64} zusatz="BEWEHRUNGSRECHNER" />

        <h2>Willkommen</h2>
        <p className="willkommen-lead">
          Der Rösch Bewehrungsrechner ermittelt die Baustahlmenge für einzelne
          Betonbauteile und liefert die Papiere gleich mit: einen maßstäblichen{" "}
          <strong>Bauplan</strong>, die <strong>Biegeliste</strong> für den
          Baustahlhändler und die <strong>Stückliste</strong> – als druckfertige
          PDFs mit Ihrem Logo im Schriftkopf.
        </p>
        <p className="willkommen-lead">
          Sie geben die Maße ein, wählen die Anschlüsse und die bautechnischen
          Vorgaben; gerechnet wird nach Eurocode 2, wahlweise mit dem
          österreichischen oder dem deutschen Nationalen Anhang. Bis zur
          Ergebnisvorschau kostet das nichts, eine Anmeldung braucht es nicht.
        </p>

        <div className="willkommen-knoepfe">
          <Link href="/rechner" className="knopf primaer gross">
            Berechnung starten
          </Link>
          <Link href="/beispiele" className="knopf gross">
            Beispiele &amp; Erklärungen
          </Link>
        </div>

        <p className="willkommen-klein">
          {BAUTEILE.length} Bauteiltypen · {PREIS} € einmalig je Berechnung ·
          keine Registrierung
        </p>
      </section>

      <section className="willkommen-recht">
        <p>
          <strong>Bitte beachten:</strong> Das Werkzeug ermittelt Mengen nach
          Mindestbewehrung und anerkannten Konstruktionsregeln. Es ersetzt keine
          statische Berechnung – die Ergebnisse sind vor der Ausführung von
          einer zur Tragwerksplanung befugten Person zu prüfen und freizugeben.
        </p>
        <p className="willkommen-rechtlinks">
          <Link href="/rechtliches">Nutzungsbedingungen &amp; Haftung</Link>
          <Link href="/impressum">Impressum</Link>
          <Link href="/datenschutz">Datenschutz</Link>
        </p>
      </section>
    </main>
  );
}
