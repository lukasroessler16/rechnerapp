import type { Metadata } from "next";
import Link from "next/link";
import SkizzeSVG from "@/components/SkizzeSVG";
import {
  VorschauBauplan,
  VorschauBiegeliste,
  VorschauStueckliste,
} from "@/components/DokumentVorschau";
import { MUSTERPROJEKT } from "@/lib/muster";
import { berechneBewehrung } from "@/lib/bewehrung";

export const metadata: Metadata = {
  title: "Beispiele & Musterdokumente – Rösch Bewehrungsrechner",
  description:
    "Bauplan, Biegeliste und Stückliste als Muster ansehen, dazu die fachlichen Grundlagen der Berechnung nach EC2/ÖNORM B 1992-1-1.",
};

/**
 * Vertiefungsseite: Musterdokumente, fachliche Grundlagen und häufige Fragen.
 * Bewusst von der Startseite ausgelagert, damit diese schlank bleibt.
 */
export default function Beispiele() {
  const ergebnis = berechneBewehrung(MUSTERPROJEKT);

  return (
    <main className="start">
      <p className="zurueck">
        <Link href="/">← Zurück zur Startseite</Link>
      </p>

      <section className="beispiel-kopf">
        <h2>Beispiele &amp; Musterdokumente</h2>
        <p className="start-lead">
          Alle Muster stammen aus einem einzigen Beispielbauteil und werden mit
          demselben Programm erzeugt wie Ihre späteren Dokumente. Was Sie hier
          sehen, ist also genau das, was Sie bekommen.
        </p>
      </section>

      {/* ---------------- Das Beispielbauteil ---------------- */}
      <section className="start-block">
        <h3>Das Beispielbauteil</h3>
        <div className="beispiel-bauteil">
          <div className="start-skizze">
            <SkizzeSVG projekt={MUSTERPROJEKT} />
          </div>
          <div className="beispiel-daten">
            <h4>Kellerwand W1</h4>
            <dl>
              <div>
                <dt>Abmessung</dt>
                <dd>8,00 × 2,75 × 0,25 m</dd>
              </div>
              <div>
                <dt>Öffnungen</dt>
                <dd>1 Fenster (F1), 1 Tür (T2)</dd>
              </div>
              <div>
                <dt>Beton / Exposition</dt>
                <dd>
                  {MUSTERPROJEKT.parameter.betonklasse} ·{" "}
                  {MUSTERPROJEKT.parameter.expositionsklasse}
                </dd>
              </div>
              <div>
                <dt>Bewehrung</dt>
                <dd>
                  {ergebnis.kennwerte.gewaehlteMatte}, zweilagig · Betonstahl{" "}
                  {MUSTERPROJEKT.parameter.stahlguete}
                </dd>
              </div>
              <div>
                <dt>Ergebnis</dt>
                <dd>
                  <strong>
                    {ergebnis.gesamtgewicht.toLocaleString("de-AT")} kg
                  </strong>{" "}
                  in {ergebnis.positionen.length} Positionen
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* ---------------- Dokumente ---------------- */}
      <section className="start-block">
        <h3>Die drei Dokumente</h3>
        <div className="start-dokumente">
          <article className="start-dokument">
            <div className="vorschaurahmen">
              <VorschauBauplan />
            </div>
            <h4>Bauplan</h4>
            <p>
              Maßstäbliche Zeichnung mit Maßketten, Öffnungen, Anschlussdetails
              und Schriftkopf inklusive Ihrem Logo. A4 quer, druckfertig.
            </p>
            <a
              className="knopf klein"
              href="/api/muster?typ=bauplan"
              target="_blank"
              rel="noopener noreferrer"
            >
              Muster ansehen (PDF)
            </a>
          </article>

          <article className="start-dokument">
            <div className="vorschaurahmen">
              <VorschauBiegeliste />
            </div>
            <h4>Biegeliste</h4>
            <p>
              Für den Baustahlhändler: jede Position mit Biegeform,
              Schenkelmaßen, Biegerollendurchmesser, Stückzahl und Gewicht.
            </p>
            <a
              className="knopf klein"
              href="/api/muster?typ=biegeliste"
              target="_blank"
              rel="noopener noreferrer"
            >
              Muster ansehen (PDF)
            </a>
          </article>

          <article className="start-dokument">
            <div className="vorschaurahmen">
              <VorschauStueckliste />
            </div>
            <h4>Stückliste</h4>
            <p>
              Alle Matten und Stäbe mit Positionsnummer, Mini-Skizze, Abmessung,
              Gewicht und Bestellmenge inklusive Reserve.
            </p>
            <a
              className="knopf klein"
              href="/api/muster?typ=stueckliste"
              target="_blank"
              rel="noopener noreferrer"
            >
              Muster ansehen (PDF)
            </a>
          </article>
        </div>
      </section>

      {/* ---------------- Fachliche Basis ---------------- */}
      <section className="start-block">
        <h3>Worauf die Berechnung beruht</h3>
        <div className="start-zweispalt">
          <div>
            <p>
              Ermittelt wird die Mindestbewehrung nach Eurocode 2 (EN 1992-1-1)
              in Verbindung mit ÖNORM B 1992-1-1, ergänzt um anerkannte
              Konstruktionsregeln des Stahlbetonbaus: Anschlussbewehrung im
              gewählten Raster, Eckwinkel, Steckbügel an freien Rändern, Sturz-,
              Brüstungs- und Laibungszulagen sowie Schrägstäbe an den
              Öffnungsecken.
            </p>
            <p>
              Die Betondeckung wird aus der Expositionsklasse vorgeschlagen, die
              Lagermatte aus der erforderlichen Bewehrung gewählt. Jeder
              Rechenweg ist normativ belegbar – es steckt keine Blackbox
              dahinter und kein maschinelles Lernen.
            </p>
            <p>
              Wo eine Eingabe bautechnisch heikel wird, meldet sich das Programm
              von selbst: zu schmale Restpfeiler neben Öffnungen, Randabstände
              unter der Verankerungslänge, Stürze über 2,00 m oder Spannweiten
              über 4,50 m.
            </p>
          </div>
          <div className="start-haftung">
            <strong>Was das Werkzeug nicht leistet</strong>
            <p>
              Es führt <em>keine statische Bemessung</em> durch. Nachweise für
              Biegung, Querkraft, Knicksicherheit, Durchstanzen, Erdbeben und
              Brandschutz sind nicht enthalten, ebenso keine lastabhängige
              Bewehrung.
            </p>
            <p>
              Alle Ergebnisse gehören vor der Ausführung von einer zur
              Tragwerksplanung befugten Person geprüft und freigegeben.
            </p>
          </div>
        </div>
      </section>

      {/* ---------------- Häufige Fragen ---------------- */}
      <section className="start-block">
        <h3>Häufige Fragen</h3>
        <div className="start-faq">
          <div>
            <h4>Brauche ich ein Benutzerkonto?</h4>
            <p>
              Nein. Es gibt keine Registrierung und kein Abo. Jeder Aufruf ist
              eine eigenständige Berechnung.
            </p>
          </div>
          <div>
            <h4>Kann ich die Dokumente später noch einmal laden?</h4>
            <p>
              Ja. Nach der Zahlung bekommen Sie den Link zusätzlich per E-Mail,
              er bleibt dauerhaft gültig.
            </p>
          </div>
          <div>
            <h4>Erscheint mein Firmenlogo im Plan?</h4>
            <p>
              Ja, Sie laden es im vorletzten Schritt hoch. Es erscheint im
              Schriftkopf aller drei Dokumente.
            </p>
          </div>
          <div>
            <h4>Welche Bauteile sind möglich?</h4>
            <p>
              Stahlbetonwände sowie Decken und Bodenplatten, jeweils mit
              beliebig vielen Fenstern, Türen oder Aussparungen.
            </p>
          </div>
          <div>
            <h4>Wie wird bezahlt?</h4>
            <p>
              Einmalig pro Berechnung über Stripe – Karte, Apple&nbsp;Pay oder
              EPS. Kein Konto, keine wiederkehrenden Kosten.
            </p>
          </div>
          <div>
            <h4>Ersetzt das meine Statik?</h4>
            <p>
              Nein. Es ist eine Mengen- und Konstruktionsermittlung. Die
              Tragwerksplanung bleibt Sache der befugten Fachperson.
            </p>
          </div>
        </div>
      </section>

      <section className="start-abschluss">
        <Link href="/rechner" className="knopf primaer gross">
          Eigene Berechnung starten
        </Link>
      </section>
    </main>
  );
}
