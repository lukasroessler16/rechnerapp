import type { Metadata } from "next";
import Link from "next/link";
import SkizzeSVG from "@/components/SkizzeSVG";
import { LogoGestapelt } from "@/components/Logo";
import { MUSTERPROJEKT } from "@/lib/muster";
import { berechneBewehrung } from "@/lib/bewehrung";

export const metadata: Metadata = {
  title: "Rösch Bewehrungsrechner – Baustahlmenge für Wände und Decken",
  description:
    "In wenigen Minuten zur Baustahlmenge: Bauplan, Biegeliste und Stückliste als PDF. Nach EC2/ÖNORM B 1992-1-1. Ohne Registrierung, Einmalzahlung pro Berechnung.",
};

const PREIS = process.env.NEXT_PUBLIC_PREIS_EUR ?? "29";

/**
 * Startseite: bewusst schlank gehalten – Marke, Nutzenversprechen, eine echte
 * Live-Skizze, der Ablauf in drei Schritten und der Preis. Alles Vertiefende
 * (Musterdokumente, fachliche Grundlagen, FAQ) liegt auf /beispiele.
 */
export default function Startseite() {
  const ergebnis = berechneBewehrung(MUSTERPROJEKT);

  return (
    <main className="start">
      {/* ---------------- Aufmacher ---------------- */}
      <section className="start-hero">
        <div>
          <LogoGestapelt groesse={64} zusatz="BEWEHRUNGSRECHNER" />

          <h2>Baustahlmenge berechnen – in Minuten statt in Stunden</h2>
          <p className="start-lead">
            Maße eingeben, Öffnungen setzen, fertig. Sie erhalten den
            maßstäblichen Bauplan, die Biegeliste für den Baustahlhändler und
            die Stückliste – als druckfertige PDFs mit Ihrem Logo im
            Schriftkopf.
          </p>
          <div className="start-knoepfe">
            <Link href="/rechner" className="knopf primaer gross">
              Berechnung starten
            </Link>
            <Link href="/beispiele" className="knopf gross">
              Muster ansehen
            </Link>
          </div>
          <p className="start-klein">
            Kostenlos bis zur Ergebnisvorschau · keine Registrierung ·{" "}
            {PREIS} € einmalig je Berechnung
          </p>
        </div>

        <figure className="start-skizze">
          <figcaption className="start-skizze-kopf">
            Live-Skizze · so sieht die Eingabe aus
          </figcaption>
          <SkizzeSVG projekt={MUSTERPROJEKT} />
          <div className="start-skizze-fuss">
            Wand 8,00 × 2,75 × 0,25 m mit Fenster und Tür →{" "}
            <strong>{ergebnis.gesamtgewicht.toLocaleString("de-AT")} kg</strong>{" "}
            Baustahl, Matte {ergebnis.kennwerte.gewaehlteMatte}
          </div>
        </figure>
      </section>

      {/* ---------------- Ablauf ---------------- */}
      <section className="start-block">
        <h3>In drei Schritten zum fertigen Plan</h3>
        <div className="start-schritte">
          <div className="start-schritt">
            <span className="nummer">1</span>
            <h4>Bauteil beschreiben</h4>
            <p>
              Wand oder Decke, Grundmaße, Öffnungen. Die Skizze wächst
              maßstäblich mit jeder Eingabe mit.
            </p>
          </div>
          <div className="start-schritt">
            <span className="nummer">2</span>
            <h4>Details wählen</h4>
            <p>
              Anschlüsse mit Vorschaubild, dazu Betonklasse, Expositionsklasse
              und Betondeckung – sinnvoll vorbelegt.
            </p>
          </div>
          <div className="start-schritt">
            <span className="nummer">3</span>
            <h4>Dokumente erhalten</h4>
            <p>
              Drei PDFs zum Download, dazu der dauerhaft gültige Link per
              E-Mail.
            </p>
          </div>
        </div>
      </section>

      {/* ---------------- Preis + Verweis auf Muster ---------------- */}
      <section className="start-preis">
        <div>
          <h3>Ein Preis, keine Überraschungen</h3>
          <p>
            Der ganze Fragebogen samt Ergebnisvorschau mit Gesamtgewicht ist
            kostenlos. Bezahlt wird erst, wenn Sie die Dokumente wirklich
            brauchen – und Sie können vorher in die Muster schauen.
          </p>
          <p className="start-preis-links">
            <Link href="/beispiele">Musterdokumente und fachliche Grundlagen →</Link>
          </p>
        </div>
        <div className="start-preisbox">
          <div className="start-betrag">{PREIS} €</div>
          <div className="start-betrag-text">einmalig je Berechnung</div>
          <Link href="/rechner" className="knopf primaer">
            Jetzt ausprobieren
          </Link>
          <div className="start-klein">
            Karte, Apple&nbsp;Pay, EPS · kein Konto nötig
          </div>
        </div>
      </section>

      {/* ---------------- Fachlicher Hinweis, kompakt ---------------- */}
      <section className="start-hinweis">
        <p>
          <strong>Fachliche Grundlage:</strong> Mindestbewehrung nach Eurocode 2
          und ÖNORM B 1992-1-1 samt anerkannter Konstruktionsregeln. Eine
          statische Bemessung ersetzt das Werkzeug nicht – die Ergebnisse
          gehören vor der Ausführung von einer zur Tragwerksplanung befugten
          Person geprüft und freigegeben.{" "}
          <Link href="/beispiele">Was genau berechnet wird →</Link>
        </p>
      </section>
    </main>
  );
}
