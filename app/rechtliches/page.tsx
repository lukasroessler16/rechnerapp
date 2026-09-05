/**
 * Rechtliches: Haftungsausschluss + Impressums-Platzhalter.
 * WICHTIG: Vor Veröffentlichung Impressum (ECG/§ 5) und ggf. AGB/Widerruf
 * durch den Betreiber vervollständigen lassen.
 */
export default function Rechtliches() {
  return (
    <main className="mitte panel">
      <h2>Rechtliche Hinweise</h2>

      <h3>Haftungsausschluss</h3>
      <p>
        Der Bewehrungsrechner ermittelt Baustahlmengen auf Grundlage der
        Mindestbewehrung nach Eurocode 2 (EN 1992-1-1) in Verbindung mit
        ÖNORM B 1992-1-1 sowie anerkannter Konstruktionsregeln des
        Stahlbetonbaus. Er führt <strong>keine statische Bemessung</strong> durch:
        Lastabhängige Bewehrung (Biegung, Querkraft, Knicksicherheit,
        Durchstanzen, Erdbeben, Brandschutz) ist nicht enthalten.
      </p>
      <p>
        Alle Ergebnisse – insbesondere Biegelisten, Stücklisten und Pläne –
        sind vor der Verwendung auf der Baustelle von einer zur
        Tragwerksplanung befugten Person (Ziviltechniker:in, Statiker:in)
        zu prüfen und freizugeben. Der Betreiber übernimmt keine Haftung für
        Schäden, die aus der ungeprüften Verwendung der Ergebnisse entstehen.
      </p>

      <h3>Impressum (Platzhalter – vor Veröffentlichung ausfüllen!)</h3>
      <p>
        [Firmenname / Inhaber:in]<br />
        [Anschrift]<br />
        [E-Mail, Telefon]<br />
        [UID-Nummer, Firmenbuchnummer, Gewerbebehörde – gem. § 5 ECG und § 14 UGB]
      </p>

      <h3>Zahlung &amp; Widerruf</h3>
      <p>
        Die Bezahlung erfolgt als Einmalzahlung über Stripe. Mit dem Kauf
        digitaler Inhalte, die sofort bereitgestellt werden, erlischt das
        Widerrufsrecht gemäß § 18 Abs. 1 Z 11 FAGG, sobald die Dokumente
        heruntergeladen werden können. [Vor Veröffentlichung rechtlich prüfen
        lassen.]
      </p>
    </main>
  );
}
