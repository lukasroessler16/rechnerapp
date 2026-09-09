import type { Metadata } from "next";
import Link from "next/link";
import { LogoMarke, LogoZeile } from "@/components/Logo";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bewehrungsrechner – Baustahlmenge für Betonbauteile",
  description:
    "Bewehrungsmenge (Baustahl) für Betonbauteile schnell ermitteln: Bauplan, Biegeliste und Stückliste als PDF. Nach Eurocode 2 mit österreichischem oder deutschem Nationalem Anhang. Pay-per-Use, ohne Registrierung.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        <header className="kopf">
          {/* Marke führt von überall zurück zur Startseite */}
          <Link href="/" className="kopf-marke" aria-label="Rösch – zur Startseite">
            <LogoZeile groesse={28} farbe="#ffffff" />
          </Link>
          <nav className="kopf-nav">
            <Link href="/beispiele">Beispiele</Link>
            <Link href="/rechner" className="knopf klein primaer">
              Berechnung starten
            </Link>
          </nav>
        </header>
        {children}
        <footer className="fuss">
          <div className="fuss-marke">
            <LogoMarke groesse={30} farbe="#5a6472" />
            <span>Rösch · Bewehrungsrechner</span>
          </div>
          <strong>Haftungshinweis:</strong> Dieses Werkzeug ermittelt Bewehrungsmengen auf
          Basis der Mindestbewehrung nach Eurocode 2 mit dem gewählten Nationalen Anhang
          (ÖNORM B 1992-1-1 oder DIN EN 1992-1-1/NA) und anerkannter
          Konstruktionsregeln. Es ersetzt keine statische Berechnung. Alle Ergebnisse sind
          vor der Ausführung von einer zur Tragwerksplanung befugten Person (Statiker:in,
          Ziviltechniker:in bzw. Prüfingenieur:in) zu prüfen und freizugeben. Die Nutzung erfolgt auf eigene
          Verantwortung.
          <br />
          <span className="fuss-links">
            <Link href="/impressum">Impressum</Link>
            <Link href="/datenschutz">Datenschutz</Link>
            <Link href="/rechtliches">Nutzungsbedingungen &amp; Haftung</Link>
          </span>
        </footer>
      </body>
    </html>
  );
}
