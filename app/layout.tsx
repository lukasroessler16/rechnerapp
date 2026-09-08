import type { Metadata } from "next";
import Link from "next/link";
import { LogoMarke, LogoZeile } from "@/components/Logo";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bewehrungsrechner – Baustahlmenge für Wände & Decken",
  description:
    "Bewehrungsmenge (Baustahl) für Betonwände und Decken schnell ermitteln: Skizze, Biegeliste und Stückliste als PDF. Nach EC2/ÖNORM B 1992-1-1. Pay-per-Use, ohne Registrierung.",
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
          Basis der Mindestbewehrung nach Eurocode 2 / ÖNORM B 1992-1-1 und anerkannter
          Konstruktionsregeln. Es ersetzt keine statische Berechnung. Alle Ergebnisse sind
          vor der Ausführung von einer zur Tragwerksplanung befugten Person (Statiker:in,
          Ziviltechniker:in) zu prüfen und freizugeben. Die Nutzung erfolgt auf eigene
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
