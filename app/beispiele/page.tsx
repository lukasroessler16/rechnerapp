import type { Metadata } from "next";
import Link from "next/link";
import SkizzeSVG from "@/components/SkizzeSVG";
import {
  VorschauBauplan,
  VorschauBiegeliste,
  VorschauStueckliste,
} from "@/components/DokumentVorschau";
import { Detailbild } from "@/components/DetailBilder";
import { MUSTERPROJEKT, musterProjekt } from "@/lib/muster";
import { berechneBewehrung } from "@/lib/bewehrung";
import { BAUTEILE, KATEGORIEN } from "@/lib/bauteile";
import { DEUTSCHLAND, OESTERREICH, cnomAusExposition } from "@/lib/regelwerk";

export const metadata: Metadata = {
  title: "Beispiele & Musterdokumente – Rösch Bewehrungsrechner",
  description:
    "Musterdokumente für alle acht Bauteile ansehen, dazu die fachlichen Grundlagen der Berechnung nach Eurocode 2 (ÖNORM B 1992-1-1 bzw. DIN EN 1992-1-1/NA) und der Unterschied zwischen österreichischem und deutschem Anhang.",
};

/**
 * Vertiefungsseite: Musterdokumente, fachliche Grundlagen und häufige Fragen.
 * Bewusst von der Startseite ausgelagert, damit diese schlank bleibt.
 */
export default function Beispiele() {
  const ergebnis = berechneBewehrung(MUSTERPROJEKT);

  /**
   * Kennzahlen je Bauteil – aus denselben Modulen gerechnet wie der Wizard,
   * mit den Werten, die dort vorbelegt sind. Die Übersicht kann dadurch nicht
   * veralten: Kommt ein Bauteil dazu, steht es hier automatisch mit.
   */
  const bauteile = BAUTEILE.map((modul) => {
    const projekt = musterProjekt(modul.id);
    const erg = berechneBewehrung(projekt);
    return {
      modul,
      masse: modul.masseText(projekt),
      gewicht: erg.gesamtgewicht,
      positionen: erg.positionen.length,
    };
  });

  /**
   * Der Regelwerksunterschied an der Musterwand – dieselbe Wand, einmal nach
   * ÖNORM und einmal nach DIN gerechnet. Angeschrieben werden die tatsächlich
   * gerechneten Werte, nicht abgetippte.
   */
  const wandNachDIN = {
    ...MUSTERPROJEKT,
    parameter: {
      ...MUSTERPROJEKT.parameter,
      regelwerk: "de",
      stahlguete: "B500B",
      betondeckung: cnomAusExposition(
        DEUTSCHLAND,
        MUSTERPROJEKT.parameter.expositionsklasse,
      ),
    },
  };
  const ergebnisDIN = berechneBewehrung(wandNachDIN);
  const nk4 = { minimumFractionDigits: 4, maximumFractionDigits: 4 };
  const vergleich = [
    {
      merkmal: "Betonstahl",
      at: `${MUSTERPROJEKT.parameter.stahlguete} (${OESTERREICH.betonstahlNorm})`,
      de: `${wandNachDIN.parameter.stahlguete} (${DEUTSCHLAND.betonstahlNorm})`,
    },
    {
      merkmal: "Streckgrenze f_yk",
      at: `${OESTERREICH.stahlsorten[0].fyk} N/mm²`,
      de: `${DEUTSCHLAND.stahlsorten[0].fyk} N/mm²`,
    },
    {
      merkmal: `Betondeckung c_nom (${MUSTERPROJEKT.parameter.expositionsklasse})`,
      at: `${cnomAusExposition(OESTERREICH, MUSTERPROJEKT.parameter.expositionsklasse)} mm`,
      de: `${cnomAusExposition(DEUTSCHLAND, MUSTERPROJEKT.parameter.expositionsklasse)} mm`,
    },
    {
      merkmal: "Mindestbewehrung Wand (vertikal)",
      // vier Nachkommastellen: sonst rundet die Anzeige 0,0015 auf 0,002 und
      // der Unterschied, um den es hier geht, verschwindet
      at: `${OESTERREICH.wandVertikalFaktor.toLocaleString("de-AT", nk4)} · Ac`,
      de: `${DEUTSCHLAND.wandVertikalFaktor.toLocaleString("de-AT", nk4)} · Ac`,
    },
    {
      merkmal: "daraus erforderlich je Lage",
      at: `${ergebnis.kennwerte.asMinHaupt.toLocaleString("de-AT")} cm²/m`,
      de: `${ergebnisDIN.kennwerte.asMinHaupt.toLocaleString("de-AT")} cm²/m`,
    },
    {
      merkmal: "gewählte Lagermatte",
      at: ergebnis.kennwerte.gewaehlteMatte,
      de: ergebnisDIN.kennwerte.gewaehlteMatte,
    },
    {
      merkmal: "Baustahl gesamt",
      at: `${ergebnis.gesamtgewicht.toLocaleString("de-AT")} kg`,
      de: `${ergebnisDIN.gesamtgewicht.toLocaleString("de-AT")} kg`,
    },
  ];

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

      {/* ---------------- Alle Bauteile ---------------- */}
      <section className="start-block">
        <h3>Diese Bauteile kann der Rechner</h3>
        <p className="start-blocktext">
          Jeweils ein Bauteil je Berechnung. Die angegebenen Mengen sind die
          Ergebnisse der Standardwerte, die im Rechner schon eingetragen sind –
          Sie sehen also, womit Sie starten, bevor Sie irgendetwas eingeben.
        </p>
        {/* nach denselben Kategorien gegliedert wie die Auswahl im Rechner */}
        {KATEGORIEN.map((kat) => {
          const inGruppe = bauteile.filter((b) => b.modul.kategorie === kat.id);
          if (inGruppe.length === 0) return null;
          return (
            <div key={kat.id}>
              <h4 className="bauteil-kategorie">
                {kat.name} <span>{kat.beschreibung}</span>
              </h4>
              <div className="bauteil-liste">
                {inGruppe.map((b) => (
                  <article className="bauteil-karte" key={b.modul.id}>
                    <div className="bauteil-bild">
                      <Detailbild bildId={b.modul.bildId} />
                    </div>
                    <div className="bauteil-text">
                      <h4>{b.modul.name}</h4>
                      <p className="bauteil-was">{b.modul.beschreibung}</p>
                      <p className="bauteil-masse">{b.masse}</p>
                      <p className="bauteil-menge">
                        <strong>{b.gewicht.toLocaleString("de-AT")} kg</strong>{" "}
                        in {b.positionen} Positionen
                      </p>
                      <p className="bauteil-muster">
                        Muster:{" "}
                        <a
                          href={`/api/muster?typ=bauplan&bauteil=${b.modul.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Bauplan
                        </a>
                        {" · "}
                        <a
                          href={`/api/muster?typ=biegeliste&bauteil=${b.modul.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Biegeliste
                        </a>
                        {" · "}
                        <a
                          href={`/api/muster?typ=stueckliste&bauteil=${b.modul.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Stückliste
                        </a>
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          );
        })}
        <p className="bauteil-fussnote">
          Damit nichts doppelt gezählt wird, gehört jede Anschlussbewehrung
          genau einem Bauteil: Die Anschlusseisen zwischen Wand und Bodenplatte
          liegen bei der Wand, die Verbindung von Decke zu Unterzug bei der
          Deckenplatte, der Stützenanschluss bei der Stütze. Jedes Dokument
          schreibt an, was bei ihm enthalten ist und was beim Nachbarbauteil
          liegt – so lassen sich die Mengen mehrerer Bauteile bedenkenlos
          addieren.
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

      {/* ---------------- Regelwerk Österreich / Deutschland ---------------- */}
      <section className="start-block">
        <h3>Österreich oder Deutschland</h3>
        <p className="start-blocktext">
          Gerechnet wird in beiden Ländern nach demselben Eurocode 2 – die
          Nationalen Anhänge legen aber unterschiedliche Zahlenwerte fest. Ein
          Umschalter im Schritt „Parameter“ stellt das um, und er ändert
          tatsächlich die Rechnung, nicht nur die Beschriftung. Unten dieselbe
          Musterwand, einmal nach jedem Anhang gerechnet.
        </p>
        <div className="vergleich-rahmen">
          <table className="vergleich">
            <thead>
              <tr>
                <th scope="col">Merkmal</th>
                <th scope="col">
                  Österreich
                  <span>{OESTERREICH.normKurz}</span>
                </th>
                <th scope="col">
                  Deutschland
                  <span>{DEUTSCHLAND.normKurz}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {vergleich.map((z) => (
                <tr key={z.merkmal}>
                  <th scope="row">{z.merkmal}</th>
                  <td>{z.at}</td>
                  <td>{z.de}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="bauteil-fussnote">
          Dass die deutsche Wand hier weniger Stahl braucht, liegt an der
          geringeren Mindestbewehrung des deutschen Anhangs; bei Platten dreht
          sich das Verhältnis um, weil dort die niedrigere Streckgrenze des B500
          mehr Querschnitt verlangt. Wo beide Anhänge übereinstimmen oder sich
          nur in lastabhängigen Anteilen unterscheiden, die dieses Werkzeug
          ohnehin nicht rechnet, wird bewusst nicht unterschieden. Der gewählte
          Anhang steht auf jedem Plan, in jeder Liste und in jedem Hinweis.
        </p>
      </section>

      {/* ---------------- Fachliche Basis ---------------- */}
      <section className="start-block">
        <h3>Worauf die Berechnung beruht</h3>
        <div className="start-zweispalt">
          <div>
            <p>
              Ermittelt wird die Mindestbewehrung nach Eurocode 2 (EN 1992-1-1)
              in Verbindung mit dem gewählten Nationalen Anhang – ÖNORM B
              1992-1-1 oder DIN EN 1992-1-1/NA –, ergänzt um anerkannte
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
              Acht: Wand, Deckenplatte, Bodenplatte, Stütze, Träger, Streifen-
              und Einzelfundament sowie Stützmauer. Wand und Deckenplatte nehmen
              beliebig viele Fenster, Türen und Aussparungen auf.
            </p>
          </div>
          <div>
            <h4>Kann ich nach deutscher Norm rechnen?</h4>
            <p>
              Ja. Im Schritt „Parameter“ stellen Sie zwischen ÖNORM B 1992-1-1
              und DIN EN 1992-1-1/NA um – das ändert Betonstahl, Betondeckung,
              Mindestbewehrung und die Normangaben in allen Dokumenten.
            </p>
          </div>
          <div>
            <h4>Ich bin nicht vom Fach – komme ich damit zurecht?</h4>
            <p>
              Alle Felder sind sinnvoll vorbelegt, und neben jedem Fachbegriff
              steht ein Fragezeichen, das ihn in Alltagssprache erklärt. Prüfen
              lassen müssen Sie das Ergebnis trotzdem.
            </p>
          </div>
          <div>
            <h4>Kann ich mehrere Bauteile zusammenrechnen?</h4>
            <p>
              Ja, Bauteil für Bauteil – und die Mengen lassen sich addieren,
              ohne dass etwas doppelt gezählt wird. Firmendaten und Logo bleiben
              dabei für den nächsten Durchlauf erhalten.
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
