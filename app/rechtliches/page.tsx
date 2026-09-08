import type { Metadata } from "next";
import Link from "next/link";
import { Platzhalter, BetreiberHinweis, RechtsSeite } from "@/components/Rechtstext";

export const metadata: Metadata = {
  title: "Nutzungsbedingungen & Haftung – Bewehrungsrechner",
  description:
    "Leistungsumfang, Haftungsausschluss, Zahlung und Rücktrittsrecht sowie Hinweis zur Berechnungsmethode.",
};

/**
 * Nutzungsbedingungen: Leistungsumfang, Haftung, Zahlung/Rücktritt sowie
 * Transparenz zur Berechnungsmethode (KI-Verordnung).
 *
 * Impressum und Datenschutzerklärung stehen auf eigenen Seiten.
 */
export default function Rechtliches() {
  return (
    <RechtsSeite titel="Nutzungsbedingungen & Haftung" stand="[Datum eintragen]">
      <BetreiberHinweis>
        Diese Bedingungen sind eine fachlich vorbereitete Grundlage, aber kein
        anwaltlich geprüfter Text. Vor dem ersten Verkauf durch eine
        Rechtsanwältin oder einen Rechtsanwalt bzw. die WKO-Gründerberatung
        prüfen lassen und die gelben Felder ausfüllen.
      </BetreiberHinweis>

      <h3>1. Leistungsumfang</h3>
      <p>
        Der Bewehrungsrechner ermittelt für Stahlbetonwände sowie Decken und
        Bodenplatten die erforderliche Baustahlmenge und erstellt daraus drei
        Dokumente: einen maßstäblichen Bauplan, eine Biegeliste und eine
        Stückliste im PDF-Format. Grundlage sind die Mindestbewehrung nach
        Eurocode 2 (EN 1992-1-1) in Verbindung mit ÖNORM B 1992-1-1 sowie
        anerkannte Konstruktionsregeln des Stahlbetonbaus.
      </p>

      <h3>2. Haftungsausschluss – keine statische Berechnung</h3>
      <p>
        <strong>
          Die Anwendung führt keine statische Bemessung durch und ersetzt keine
          Tragwerksplanung.
        </strong>{" "}
        Nicht enthalten sind insbesondere Nachweise für Biegung, Querkraft,
        Knicksicherheit, Durchstanzen, Erdbebeneinwirkung, Brandschutz sowie
        sämtliche lastabhängige Bewehrung.
      </p>
      <p>
        Alle Ergebnisse sind vor der Verwendung auf der Baustelle von einer zur
        Tragwerksplanung befugten Person (Ziviltechniker:in, Statiker:in) zu
        prüfen und freizugeben. Die Nutzung erfolgt auf eigene Verantwortung.
        Eine Haftung für Schäden aus der ungeprüften Verwendung der Ergebnisse
        ist ausgeschlossen, soweit gesetzlich zulässig. Die Haftung für
        Personenschäden sowie für Vorsatz und grobe Fahrlässigkeit bleibt
        unberührt.
      </p>
      <p>
        Die Richtigkeit der Ergebnisse setzt richtige Eingaben voraus. Für die
        Vollständigkeit und Plausibilität der eingegebenen Maße, Öffnungen und
        bautechnischen Parameter ist die nutzende Person verantwortlich.
      </p>

      <h3>3. Preis, Zahlung und Bereitstellung</h3>
      <p>
        Der Fragebogen einschließlich Ergebnisvorschau ist kostenlos. Die
        Freischaltung der Dokumente kostet{" "}
        <Platzhalter>29,00 €</Platzhalter> je Berechnungsdurchlauf
        (Einmalzahlung, keine Abonnements, kein Kundenkonto). Preisangaben
        verstehen sich{" "}
        <Platzhalter>inklusive / zuzüglich gesetzlicher Umsatzsteuer</Platzhalter>.
      </p>
      <p>
        Die Zahlung wird über Stripe abgewickelt. Nach erfolgreicher Zahlung
        stehen die Dokumente sofort zum Download bereit; zusätzlich erhalten Sie
        den dauerhaft gültigen Zugangslink per E-Mail.
      </p>

      <h3>4. Rücktrittsrecht bei digitalen Inhalten</h3>
      <p>
        Vor dem Zahlungsvorgang bestätigen Sie ausdrücklich, dass die Dokumente
        sofort bereitgestellt werden sollen. Damit erlischt das Rücktrittsrecht
        gemäß § 18 Abs. 1 Z 11 FAGG, sobald mit der Ausführung begonnen wurde.
        Der Zeitpunkt dieser Zustimmung wird gemeinsam mit der Zahlung
        dokumentiert. Ohne diese Bestätigung kann der Bezahlvorgang nicht
        gestartet werden.
      </p>
      <p>
        Unabhängig davon: Kommen die Dokumente aus technischen Gründen nicht bei
        Ihnen an, wenden Sie sich an{" "}
        <Platzhalter>support@ihre-domain.at</Platzhalter> – wir stellen sie
        erneut bereit oder erstatten den Betrag.
      </p>

      <h3>5. Gewährleistung</h3>
      <p>
        Es gelten die gesetzlichen Gewährleistungsbestimmungen. Die Gewährleistung
        bezieht sich auf die vertragsgemäße Bereitstellung der Dokumente, nicht
        auf die Eignung der Ergebnisse für ein konkretes Bauvorhaben – diese
        beurteilt die Tragwerksplanung (siehe Punkt 2).
      </p>

      <h3>6. Berechnungsmethode und KI-Verordnung</h3>
      <p>
        Diese Anwendung ist <strong>kein KI-System</strong> im Sinne der
        Verordnung (EU) 2024/1689 (KI-Verordnung / AI Act). Sämtliche Ergebnisse
        entstehen ausschließlich durch fest hinterlegte, nachvollziehbare
        Rechenregeln nach Eurocode 2 und ÖNORM B 1992-1-1. Es findet weder
        maschinelles Lernen noch eine Ableitung aus Trainingsdaten statt: Bei
        gleichen Eingaben ergibt sich stets dasselbe Ergebnis, und jeder
        Rechenschritt ist normativ belegbar.
      </p>
      <p>
        Eine Kennzeichnungspflicht nach Artikel 50 der KI-Verordnung besteht
        daher nicht, da diese ausschließlich für KI-Systeme gilt – etwa
        Chatbots, KI-generierte Bild-, Ton- oder Videoinhalte sowie Systeme zur
        Emotionserkennung.
      </p>
      <p>
        Bei der Entwicklung der Software wurden KI-gestützte Werkzeuge
        eingesetzt. Die ausgelieferte Anwendung enthält selbst keine
        KI-Funktion; die Verantwortung für Inhalt und Richtigkeit liegt
        unverändert beim Betreiber.
      </p>
      <BetreiberHinweis>
        Dieser Abschnitt ist eine freiwillige Transparenzangabe – rechtlich
        verpflichtend ist er nicht. Er wirkt bei Fachpublikum eher als Vorteil,
        weil er klarstellt, dass keine Blackbox rechnet. Sie können den letzten
        Absatz aber auch ersatzlos streichen. Wichtig: Sollte später eine
        KI-Funktion ergänzt werden (z. B. ein Chat-Assistent oder automatische
        Vorschläge auf Basis eines Modells), ist dieser Abschnitt zu überarbeiten
        und eine Kennzeichnung nach Artikel 50 vorzusehen.
      </BetreiberHinweis>

      <h3>7. Anwendbares Recht und Gerichtsstand</h3>
      <p>
        Es gilt österreichisches Recht unter Ausschluss der Verweisungsnormen des
        internationalen Privatrechts und des UN-Kaufrechts. Für Verbraucher
        bleiben zwingende Schutzbestimmungen ihres Aufenthaltsstaates unberührt.
        Für Geschäfte mit Unternehmern ist Gerichtsstand{" "}
        <Platzhalter>Ort des Unternehmenssitzes</Platzhalter>.
      </p>

      <p style={{ marginTop: 24 }}>
        Siehe auch <Link href="/impressum">Impressum</Link> und{" "}
        <Link href="/datenschutz">Datenschutzerklärung</Link>.
      </p>
    </RechtsSeite>
  );
}
