import type { Metadata } from "next";
import { Platzhalter, BetreiberHinweis, RechtsSeite } from "@/components/Rechtstext";

export const metadata: Metadata = {
  title: "Impressum – Bewehrungsrechner",
  description: "Offenlegung und Anbieterkennzeichnung gemäß § 5 ECG, § 14 UGB und § 25 MedienG.",
};

/**
 * Impressum nach österreichischem Recht:
 * § 5 E-Commerce-Gesetz (ECG), § 14 Unternehmensgesetzbuch (UGB) und
 * § 25 Mediengesetz (Offenlegung).
 *
 * Alle mit <Platzhalter> markierten Stellen sind vor der Veröffentlichung
 * durch echte Angaben zu ersetzen.
 */
export default function Impressum() {
  return (
    <RechtsSeite titel="Impressum" stand="[Datum eintragen]">
      <BetreiberHinweis>
        Alle gelb markierten Felder ausfüllen, anschließend diesen Kasten löschen.
        Nicht zutreffende Punkte (z. B. Firmenbuch bei Einzelunternehmen ohne
        Eintragung) ersatzlos streichen.
      </BetreiberHinweis>

      <h3>Medieninhaber, Herausgeber und Diensteanbieter</h3>
      <p>
        <Platzhalter>Firmenwortlaut bzw. Vor- und Nachname</Platzhalter>
        <br />
        <Platzhalter>Rechtsform, z. B. Einzelunternehmen / GmbH</Platzhalter>
        <br />
        <Platzhalter>Straße und Hausnummer</Platzhalter>
        <br />
        <Platzhalter>PLZ und Ort</Platzhalter>
        <br />
        Österreich
      </p>

      <h3>Kontakt</h3>
      <p>
        E-Mail: <Platzhalter>kontakt@ihre-domain.at</Platzhalter>
        <br />
        Telefon: <Platzhalter>+43 …</Platzhalter>
      </p>

      <h3>Unternehmensgegenstand</h3>
      <p>
        <Platzhalter>
          z. B. Entwicklung und Bereitstellung von Software zur Ermittlung von
          Bewehrungsmengen im Stahlbetonbau
        </Platzhalter>
      </p>

      <h3>Unternehmensdaten</h3>
      <p>
        UID-Nummer: <Platzhalter>ATU…</Platzhalter> (entfällt bei
        Kleinunternehmerregelung)
        <br />
        Firmenbuchnummer: <Platzhalter>FN … </Platzhalter>
        <br />
        Firmenbuchgericht: <Platzhalter>z. B. Handelsgericht Wien</Platzhalter>
        <br />
        Unternehmenssitz: <Platzhalter>Ort</Platzhalter>
      </p>

      <h3>Gewerbe und Aufsicht</h3>
      <p>
        Gewerbeberechtigung:{" "}
        <Platzhalter>z. B. Dienstleistungen in der automatischen Datenverarbeitung
        und Informationstechnik</Platzhalter>
        , verliehen in Österreich.
        <br />
        Gewerbebehörde: <Platzhalter>z. B. Magistrat der Stadt … / Bezirkshauptmannschaft …</Platzhalter>
        <br />
        Mitgliedschaft:{" "}
        <Platzhalter>Wirtschaftskammer …, Fachgruppe …</Platzhalter>
      </p>
      <p>
        Anwendbare Rechtsvorschrift: Gewerbeordnung (GewO), abrufbar im
        Rechtsinformationssystem des Bundes unter{" "}
        <a href="https://www.ris.bka.gv.at" target="_blank" rel="noopener noreferrer">
          www.ris.bka.gv.at
        </a>
        .
      </p>

      <h3>Verbraucherschlichtung</h3>
      <p>
        Wir sind{" "}
        <Platzhalter>bereit / nicht bereit / nicht verpflichtet</Platzhalter>, an
        einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle
        teilzunehmen. Zuständige Stelle in Österreich:{" "}
        <Platzhalter>z. B. Internet Ombudsstelle, Margaretenstraße 70/2/10, 1050 Wien</Platzhalter>
        .
      </p>
      <BetreiberHinweis>
        Die frühere EU-Plattform zur Online-Streitbeilegung (OS-Plattform) wurde
        am 20. Juli 2025 eingestellt. Ein Link darauf gehört <em>nicht</em> mehr
        ins Impressum – falls Sie Vorlagen aus dem Netz übernehmen, diesen
        veralteten Hinweis unbedingt weglassen.
      </BetreiberHinweis>

      <h3>Offenlegung gemäß § 25 Mediengesetz</h3>
      <p>
        Grundlegende Richtung (Blattlinie):{" "}
        <Platzhalter>
          z. B. Information über das Angebot des Bewehrungsrechners sowie
          fachliche Hinweise zur Bewehrungsermittlung im Stahlbetonbau
        </Platzhalter>
        .
      </p>

      <h3>Haftung für Inhalte und Links</h3>
      <p>
        Die Inhalte dieser Website werden mit größtmöglicher Sorgfalt erstellt.
        Für die Richtigkeit, Vollständigkeit und Aktualität wird keine Gewähr
        übernommen. Für die Ergebnisse der Berechnung gelten ergänzend die
        Haftungsbestimmungen in den Nutzungsbedingungen: Die Anwendung ersetzt
        keine statische Berechnung.
      </p>
      <p>
        Für Inhalte externer Websites, auf die verlinkt wird, ist ausschließlich
        deren jeweiliger Betreiber verantwortlich.
      </p>

      <h3>Urheberrecht</h3>
      <p>
        Inhalte, Gestaltung und Software dieser Website sind urheberrechtlich
        geschützt. Die vom Kunden erzeugten Dokumente (Bauplan, Biegeliste,
        Stückliste) dürfen im Rahmen des jeweiligen Bauvorhabens uneingeschränkt
        verwendet und weitergegeben werden.
      </p>
    </RechtsSeite>
  );
}
