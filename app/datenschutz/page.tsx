import type { Metadata } from "next";
import Link from "next/link";
import { Platzhalter, BetreiberHinweis, RechtsSeite } from "@/components/Rechtstext";

export const metadata: Metadata = {
  title: "Datenschutzerklärung – Bewehrungsrechner",
  description:
    "Informationen zur Verarbeitung personenbezogener Daten gemäß Art. 13 DSGVO.",
};

/**
 * Datenschutzerklärung nach Art. 13 DSGVO.
 *
 * Beschreibt exakt die tatsächliche Verarbeitung dieser Anwendung:
 * keine Registrierung, keine Datenbank, keine Tracking-Cookies;
 * Projektdaten liegen im Browser und – während des Bezahlvorgangs –
 * in den Metadaten der Stripe-Zahlungssession.
 */
export default function Datenschutz() {
  return (
    <RechtsSeite titel="Datenschutzerklärung" stand="[Datum eintragen]">
      <BetreiberHinweis>
        Gelb markierte Felder ausfüllen und die genannten Dienstleister mit dem
        tatsächlich eingesetzten Anbieter abgleichen (Hosting, Zahlung,
        E-Mail-Versand). Danach diesen Kasten löschen.
      </BetreiberHinweis>

      <h3>1. Verantwortlicher</h3>
      <p>
        Verantwortlich für die Datenverarbeitung auf dieser Website ist:
        <br />
        <Platzhalter>Firmenwortlaut bzw. Vor- und Nachname</Platzhalter>
        <br />
        <Platzhalter>Anschrift</Platzhalter>
        <br />
        E-Mail: <Platzhalter>datenschutz@ihre-domain.at</Platzhalter>
      </p>
      <p>
        Ein Datenschutzbeauftragter ist{" "}
        <Platzhalter>nicht bestellt / bestellt: Name, Kontakt</Platzhalter>.
      </p>

      <h3>2. Grundsatz: keine Registrierung, keine Nutzerkonten</h3>
      <p>
        Die Anwendung kann ohne Anmeldung genutzt werden. Es werden keine
        Benutzerkonten geführt und keine Nutzungsprofile gebildet. Ihre
        Eingaben verbleiben grundsätzlich in Ihrem Browser; sie werden erst dann
        an unsere Server übertragen, wenn Sie einen kostenpflichtigen Durchlauf
        starten.
      </p>

      <h3>3. Welche Daten verarbeitet werden</h3>

      <h4>a) Ihre Eingaben im Rechner</h4>
      <p>
        Bauteilmaße, Öffnungen, Anschlussdetails, bautechnische Parameter sowie
        Projekt- und Firmendaten (Bauvorhaben, Adresse, Datum, Planersteller,
        optionales Firmenlogo). Diese Angaben werden während der Nutzung im
        Speicher Ihres Browsers gehalten. Beim Start des Bezahlvorgangs werden
        die Geometrie- und Projektdaten – ohne das Logo – komprimiert als
        Metadaten der Zahlungssession an unseren Zahlungsdienstleister
        übermittelt, damit die Dokumente nach der Zahlung erzeugt werden können.
      </p>
      <p>
        Das Firmenlogo verlässt Ihren Browser ausschließlich im Moment der
        Dokumenterstellung; es wird zur Erzeugung des PDF verwendet und von uns
        nicht dauerhaft gespeichert.
      </p>

      <h4>b) Zahlungsdaten</h4>
      <p>
        Die Zahlungsabwicklung erfolgt über{" "}
        <Platzhalter>Stripe Payments Europe Ltd., North Wall Quay, Dublin, Irland</Platzhalter>
        . Zahlungsdaten (z. B. Kartendaten) geben Sie direkt bei diesem Anbieter
        ein; wir erhalten sie nicht. Wir erhalten Angaben zum Zahlungsstatus,
        den Betrag sowie die von Ihnen angegebene E-Mail-Adresse.
      </p>

      <h4>c) E-Mail-Adresse</h4>
      <p>
        Ihre im Bezahlvorgang angegebene E-Mail-Adresse wird verwendet, um Ihnen
        den Zugangslink zu den erworbenen Dokumenten zuzusenden. Der Versand
        erfolgt über{" "}
        <Platzhalter>Resend, Inc., 2261 Market Street, San Francisco, CA, USA</Platzhalter>
        . Es erfolgt kein Newsletter- oder Werbeversand.
      </p>

      <h4>d) Server-Protokolldaten</h4>
      <p>
        Beim Aufruf der Website verarbeitet unser Hosting-Anbieter automatisch
        übermittelte Zugriffsdaten (IP-Adresse, Zeitpunkt, abgerufene Adresse,
        Browsertyp, übertragene Datenmenge). Hosting-Anbieter ist{" "}
        <Platzhalter>Vercel Inc., 340 S Lemon Ave, Walnut, CA, USA</Platzhalter>
        . Diese Daten dienen dem sicheren und stabilen Betrieb.
      </p>

      <h4>e) Speicher in Ihrem Browser</h4>
      <p>
        Es werden keine Tracking-Cookies und keine Werbe-Cookies gesetzt. Für den
        Betrieb genutzt werden ausschließlich:
      </p>
      <ul>
        <li>
          <strong>Sitzungsspeicher</strong> (<code>sessionStorage</code>): hält Ihre
          Eingaben während des Ausfüllens und über den Bezahlvorgang hinweg. Er
          wird beim Schließen des Browser-Tabs geleert und ist für die
          Bereitstellung des ausdrücklich gewünschten Dienstes erforderlich.
        </li>
        <li>
          <strong>Dauerhafter Speicher</strong> (<code>localStorage</code>): merkt
          sich Ihre Firmendaten und Ihr Logo auf diesem Gerät, damit sie bei einer
          weiteren Berechnung nicht erneut eingegeben werden müssen und beim
          späteren Aufruf des Download-Links wieder im Schriftkopf erscheinen.
          Sie können diesen Speicher jederzeit über die Einstellungen Ihres
          Browsers löschen.
        </li>
      </ul>
      <BetreiberHinweis>
        Der dauerhafte Speicher ist eine Komfortfunktion. Ob dafür nach § 165 TKG
        2021 eine Einwilligung erforderlich ist, sollte anwaltlich geprüft
        werden. Alternativ lässt sich das Merken der Firmendaten leicht in eine
        Auswahl per Häkchen umbauen.
      </BetreiberHinweis>

      <h3>4. Zwecke und Rechtsgrundlagen</h3>
      <ul>
        <li>
          <strong>Bereitstellung des Rechners und der Dokumente</strong> – Erfüllung
          des Vertrags bzw. vorvertragliche Maßnahmen, Art. 6 Abs. 1 lit. b DSGVO.
        </li>
        <li>
          <strong>Zahlungsabwicklung und Zusendung des Download-Links</strong> –
          Art. 6 Abs. 1 lit. b DSGVO.
        </li>
        <li>
          <strong>Sicherer Betrieb, Fehlersuche, Missbrauchsabwehr</strong> –
          berechtigtes Interesse, Art. 6 Abs. 1 lit. f DSGVO.
        </li>
        <li>
          <strong>Aufbewahrung von Zahlungs- und Belegdaten</strong> – rechtliche
          Verpflichtung, Art. 6 Abs. 1 lit. c DSGVO in Verbindung mit den
          steuerrechtlichen Aufbewahrungspflichten (§ 132 BAO).
        </li>
      </ul>

      <h3>5. Empfänger</h3>
      <p>
        Personenbezogene Daten werden ausschließlich an die oben genannten
        Dienstleister übermittelt, die für uns als Auftragsverarbeiter tätig sind
        (Hosting, Zahlungsabwicklung, E-Mail-Versand), sowie an Behörden, soweit
        eine gesetzliche Verpflichtung besteht. Ein Verkauf von Daten findet
        nicht statt.
      </p>

      <h3>6. Übermittlung in Drittländer</h3>
      <p>
        Einzelne Dienstleister verarbeiten Daten in den USA. Die Übermittlung
        stützt sich auf{" "}
        <Platzhalter>
          das EU-US Data Privacy Framework bzw. Standardvertragsklauseln gemäß
          Art. 46 Abs. 2 lit. c DSGVO
        </Platzhalter>
        . Die entsprechenden Nachweise können beim Verantwortlichen angefordert
        werden.
      </p>

      <h3>7. Speicherdauer</h3>
      <ul>
        <li>
          Eingaben im Browser: bis zum Schließen des Tabs bzw. bis Sie den
          Browserspeicher löschen.
        </li>
        <li>
          Zahlungssession samt Projektdaten beim Zahlungsdienstleister:{" "}
          <Platzhalter>gemäß dessen Aufbewahrungsfristen, i. d. R. mehrere Jahre</Platzhalter>
          . Der Download-Link bleibt dadurch gültig.
        </li>
        <li>
          Buchhaltungs- und Belegdaten: sieben Jahre gemäß § 132 BAO.
        </li>
        <li>Server-Protokolle: <Platzhalter>Aufbewahrungsdauer des Hosters</Platzhalter>.</li>
      </ul>

      <h3>8. Ihre Rechte</h3>
      <p>
        Sie haben das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16),
        Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18),
        Datenübertragbarkeit (Art. 20) sowie Widerspruch gegen Verarbeitungen auf
        Grundlage berechtigter Interessen (Art. 21 DSGVO). Wenden Sie sich dafür
        formlos an die oben genannte Kontaktadresse.
      </p>

      <h3>9. Beschwerderecht</h3>
      <p>
        Sie können sich bei einer Aufsichtsbehörde beschweren, in Österreich bei
        der Datenschutzbehörde,{" "}
        <Platzhalter>Barichgasse 40–42, 1030 Wien, dsb.gv.at</Platzhalter>.
      </p>

      <h3>10. Keine automatisierte Entscheidungsfindung, keine KI</h3>
      <p>
        Es findet keine automatisierte Entscheidungsfindung einschließlich
        Profiling im Sinne des Art. 22 DSGVO statt. Die Berechnung erfolgt
        ausschließlich anhand fest hinterlegter Rechenregeln; Näheres dazu unter{" "}
        <Link href="/rechtliches">Nutzungsbedingungen</Link>.
      </p>

      <h3>11. Änderungen</h3>
      <p>
        Wir passen diese Datenschutzerklärung an, wenn sich die Verarbeitung oder
        die Rechtslage ändert. Es gilt jeweils die hier veröffentlichte Fassung.
      </p>
    </RechtsSeite>
  );
}
