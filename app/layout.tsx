import type { Metadata } from "next";
import Link from "next/link";
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
          <h1>Bewehrungsrechner</h1>
          <span className="untertitel">
            Baustahl für Wände &amp; Decken · Biegeliste · Stückliste · Bauplan (PDF)
          </span>
        </header>
        {children}
        <footer className="fuss">
          <strong>Haftungshinweis:</strong> Dieses Werkzeug ermittelt Bewehrungsmengen auf
          Basis der Mindestbewehrung nach Eurocode 2 / ÖNORM B 1992-1-1 und anerkannter
          Konstruktionsregeln. Es ersetzt keine statische Berechnung. Alle Ergebnisse sind
          vor der Ausführung von einer zur Tragwerksplanung befugten Person (Statiker:in,
          Ziviltechniker:in) zu prüfen und freizugeben. Die Nutzung erfolgt auf eigene
          Verantwortung. · <Link href="/rechtliches">Rechtliches &amp; Impressum</Link>
        </footer>
      </body>
    </html>
  );
}
