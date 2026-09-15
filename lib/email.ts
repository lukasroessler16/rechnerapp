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

  return versende({
    an: d.an,
    betreff: `Ihre Bewehrungsdokumente – ${d.bauvorhaben || "Bewehrungsrechner"}`,
    html,
  });
}

/* ------------------------------------------------------------------ */
/* Gemeinsamer Versandweg                                              */
/* ------------------------------------------------------------------ */

/**
 * Eine Nachricht über Resend verschicken.
 *
 * Fehlt die Konfiguration, wird protokolliert und `false` geliefert – nie
 * geworfen. Ein gescheiterter Mailversand darf nie den Vorgang abbrechen, aus
 * dem er heraus ausgelöst wurde; im schlimmsten Fall hat jemand gezahlt und
 * bekäme wegen einer Mailstörung auch noch einen Fehler zu sehen.
 */
async function versende(m: {
  an: string;
  betreff: string;
  html: string;
}): Promise<boolean> {
  const schluessel = process.env.RESEND_API_KEY;
  const absender = process.env.MAIL_ABSENDER;
  if (!schluessel || !absender) {
    console.warn("[E-Mail] RESEND_API_KEY oder MAIL_ABSENDER nicht gesetzt – kein Versand.");
    return false;
  }
  try {
    const antwort = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${schluessel}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: absender, to: [m.an], subject: m.betreff, html: m.html }),
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

/* ------------------------------------------------------------------ */
/* Alarmmeldung an den Betreiber                                       */
/* ------------------------------------------------------------------ */

export interface Alarm {
  /** Stelle im Programm, z. B. "dokumente" */
  stelle: string;
  /** interner Fehlertext */
  meldung: string;
  /** Zahlungsreferenz, falls vorhanden */
  sessionId?: string;
  /** war zum Zeitpunkt des Fehlers bereits bezahlt? */
  bezahlt?: boolean;
  /** Stacktrace, gekürzt */
  spur?: string;
}

/**
 * Schickt eine Störungsmeldung an die Betreiberadresse.
 *
 * WARUM E-MAIL UND KEIN FEHLERDIENST: Bei ein paar Verkäufen am Tag ist ein
 * Dashboard, in das niemand schaut, kein Sicherheitsnetz. Eine Mail erreicht
 * Lukas auf dem Telefon, und zwar genau in dem Fall, der wirklich zählt –
 * jemand hat bezahlt und keine Unterlagen bekommen. Wächst das Aufkommen,
 * kann in melde() zusätzlich ein Fehlerdienst angebunden werden; diese Mail
 * bleibt davon unberührt.
 */
export async function sendeAlarmMail(a: Alarm): Promise<boolean> {
  const an = process.env.ALARM_MAIL || process.env.NEXT_PUBLIC_KONTAKT_MAIL;
  if (!an) {
    console.warn("[Alarm] Weder ALARM_MAIL noch NEXT_PUBLIC_KONTAKT_MAIL gesetzt.");
    return false;
  }

  const zeit = new Date().toLocaleString("de-AT", { timeZone: "Europe/Vienna" });
  const dringend = a.bezahlt === true;

  const zeilen: [string, string][] = [
    ["Zeitpunkt", zeit],
    ["Stelle", a.stelle],
    ["Bereits bezahlt", dringend ? "JA – Kunde wartet auf Unterlagen" : "nein"],
  ];
  if (a.sessionId) zeilen.push(["Stripe-Session", a.sessionId]);

  const html = `
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;color:#1c2430;line-height:1.55;max-width:620px">
  <h2 style="font-size:18px;margin:0 0 4px;color:${dringend ? "#c0392b" : "#a35a09"}">
    ${dringend ? "Störung nach einer Zahlung" : "Störung im Bewehrungsrechner"}
  </h2>
  <p style="color:#5a6472;margin:0 0 18px">${maskiere(a.stelle)}</p>

  ${
    dringend
      ? `<p style="background:#fbedeb;border:1px solid #c0392b;border-radius:8px;padding:12px 14px;margin:0 0 18px">
           <strong>Es wurde bereits bezahlt.</strong> Die Person hat eine Belastung auf
           der Karte und keine Dokumente. In Stripe nachsehen, ob erstattet werden soll,
           oder die Unterlagen von Hand nachreichen.
         </p>`
      : ""
  }

  <table style="border-collapse:collapse;font-size:14px;margin:0 0 18px">
    ${zeilen
      .map(
        ([k, v]) =>
          `<tr><td style="padding:3px 16px 3px 0;color:#5a6472;vertical-align:top">${maskiere(k)}</td>
               <td style="padding:3px 0"><code>${maskiere(v)}</code></td></tr>`
      )
      .join("")}
  </table>

  <p style="margin:0 0 6px;color:#5a6472;font-size:13px">Fehlermeldung:</p>
  <pre style="background:#f4f5f7;border:1px solid #d9dde3;border-radius:8px;padding:12px;font-size:12.5px;white-space:pre-wrap;word-break:break-word;margin:0">${maskiere(
    a.meldung
  )}${a.spur ? "\n\n" + maskiere(a.spur) : ""}</pre>
</div>`.trim();

  return versende({
    an,
    betreff: `${dringend ? "[DRINGEND] " : "[Störung] "}Bewehrungsrechner – ${a.stelle}`,
    html,
  });
}
