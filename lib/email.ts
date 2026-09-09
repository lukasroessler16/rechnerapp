/**
 * E-Mail-Versand über Resend.
 *
 * Bewusst über die REST-Schnittstelle statt über ein npm-Paket: spart eine
 * Abhängigkeit und funktioniert in jeder Serverless-Umgebung.
 *
 * Aufgerufen wird das ausschließlich vom Stripe-Webhook nach bestätigter
 * Zahlung. Fehlt die Konfiguration (RESEND_API_KEY / MAIL_ABSENDER), wird
 * nichts versendet und nur protokolliert – die Anwendung funktioniert dann
 * unverändert weiter, nur ohne E-Mail.
 */

export interface DokumentenMail {
  /** Empfängeradresse (aus der Stripe-Session) */
  an: string;
  /** Bezeichnung des Bauvorhabens für Betreff und Text */
  bauvorhaben: string;
  /** Dauerhafter Link auf die Downloadseite */
  downloadUrl: string;
  /** Gezahlter Betrag, bereits formatiert (z. B. "29,00 €") */
  betrag: string;
}

/** HTML-Sonderzeichen maskieren (Kundendaten landen im Mailtext) */
function maskiere(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendeDokumentenMail(d: DokumentenMail): Promise<boolean> {
  const schluessel = process.env.RESEND_API_KEY;
  const absender = process.env.MAIL_ABSENDER;

  if (!schluessel || !absender) {
    console.warn(
      "[E-Mail] RESEND_API_KEY oder MAIL_ABSENDER nicht gesetzt – kein Versand."
    );
    return false;
  }

  const vorhaben = maskiere(d.bauvorhaben || "Ihr Projekt");
  const url = d.downloadUrl;

  const html = `
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;color:#1c2430;line-height:1.55;max-width:560px">
  <h2 style="font-size:19px;margin:0 0 4px">Ihre Bewehrungsdokumente sind bereit</h2>
  <p style="color:#5a6472;margin:0 0 20px">${vorhaben}</p>

  <p>Vielen Dank für Ihre Zahlung über ${maskiere(d.betrag)}. Über den folgenden
  Link laden Sie Bauplan, Biegeliste und Stückliste als PDF herunter:</p>

  <p style="margin:24px 0">
    <a href="${url}" style="background:#e8590c;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block">
      Dokumente herunterladen
    </a>
  </p>

  <p style="font-size:13px;color:#5a6472">
    Falls der Knopf nicht funktioniert, kopieren Sie diese Adresse in Ihren Browser:<br>
    <span style="word-break:break-all">${url}</span>
  </p>

  <p style="font-size:13px;color:#5a6472">
    Bewahren Sie diese E-Mail auf – der Link bleibt gültig und ist Ihr Zugang
    zu den Dokumenten. Wenn Sie beim Ausfüllen ein Firmenlogo hochgeladen
    haben, erscheint es beim Öffnen im selben Browser automatisch wieder im
    Schriftkopf.
  </p>

  <hr style="border:none;border-top:1px solid #d9dde3;margin:24px 0">

  <p style="font-size:12px;color:#5a6472">
    <strong>Haftungshinweis:</strong> Die Dokumente beruhen auf einer
    Mengenermittlung nach Eurocode 2 und dem in der Berechnung gewählten
    Nationalen Anhang (Mindestbewehrung und Konstruktionsregeln) und ersetzen keine statische Berechnung. Sie sind vor
    der Ausführung von einer zur Tragwerksplanung befugten Person zu prüfen und
    freizugeben.
  </p>
</div>`.trim();

  try {
    const antwort = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${schluessel}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: absender,
        to: [d.an],
        subject: `Ihre Bewehrungsdokumente – ${d.bauvorhaben || "Bewehrungsrechner"}`,
        html,
      }),
    });
    if (!antwort.ok) {
      console.error("[E-Mail] Resend antwortete mit", antwort.status, await antwort.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("[E-Mail] Versand fehlgeschlagen:", e);
    return false;
  }
}
