/**
 * POST /api/dokumente
 *
 * Erzeugt die finalen PDF-Dokumente – aber nur für BEZAHLTE
 * Stripe-Sessions. Die Projektgeometrie wird aus den Metadata der
 * bezahlten Session gelesen (Quelle der Wahrheit, nicht manipulierbar).
 *
 * Firmendaten/Logo sind rein kosmetisch und dürfen vom Client kommen
 * (das Logo wird aus Größengründen nicht über Stripe geführt).
 *
 * Body: { typ: "bauplan"|"biegeliste"|"stueckliste",
 *         session_id?: string,           // normaler Weg (nach Zahlung)
 *         demo?: boolean, projekt?: {…}, // nur wenn Demo ausdrücklich erlaubt
 *         firmendaten?: {…} }
 *
 * Scheitert hier etwas NACH der Zahlung, ist das der teuerste Fehlerfall der
 * ganzen Anwendung: Der Kunde hat bezahlt und steht ohne Unterlagen da.
 * Solche Fälle werden deshalb als "kritisch" gemeldet – sie gehören auf einen
 * Alarm, der jemanden erreicht.
 */

import { NextRequest, NextResponse } from "next/server";
import { stripeClient } from "@/lib/stripe";
import { metadataHerkunft, metadataZuProjekt, validiereProjekt } from "@/lib/payload";
import { berechneBewehrung } from "@/lib/bewehrung";
import { erzeugeBauplan } from "@/lib/pdf/bauplan";
import { erzeugeBiegeliste } from "@/lib/pdf/biegeliste";
import { erzeugeStueckliste } from "@/lib/pdf/stueckliste";
import { Projekt } from "@/lib/types";
import { BetriebsFehler, demoErlaubt, kundenMeldung, melde } from "@/lib/betrieb";
import { pruefeLimit } from "@/lib/ratelimit";
import { codeStand, dokumentStempel } from "@/lib/version";

export const runtime = "nodejs";

const DATEINAMEN: Record<string, string> = {
  bauplan: "Bauplan.pdf",
  biegeliste: "Biegeliste.pdf",
  stueckliste: "Stueckliste.pdf",
};

export async function POST(req: NextRequest) {
  // Großzügig genug für „alle drei Dokumente, zweimal heruntergeladen“,
  // eng genug, damit eine Schleife nicht dauerhaft Rechenzeit verbraucht.
  const limit = pruefeLimit(req, "dokumente", 30, 60);
  if (!limit.erlaubt) {
    return NextResponse.json(
      { fehler: "Zu viele Downloads in kurzer Zeit. Bitte einen Moment warten." },
      { status: 429, headers: { "Retry-After": String(limit.wartenSek) } }
    );
  }

  // Ab hier wissen wir, ob bereits gezahlt wurde – das entscheidet über
  // Dringlichkeit der Meldung und Wortlaut der Fehlermeldung.
  let bezahlt = false;
  let sessionId: string | undefined;

  try {
    const body = await req.json();
    const typ = String(body.typ);
    if (!DATEINAMEN[typ]) throw new BetriebsFehler("Unbekannter Dokumenttyp.");

    const schluessel = process.env.STRIPE_SECRET_KEY;
    let projekt: Projekt;
    let herkunftStand = codeStand();

    if (body.session_id) {
      /* ---------- Normalfall: bezahlte Stripe-Session ---------- */
      if (!schluessel)
        throw new BetriebsFehler(
          "Die Dokumentenausgabe ist derzeit nicht verfügbar. Bitte später erneut versuchen.",
          "STRIPE_SECRET_KEY fehlt, es liegt aber eine session_id vor.",
          503
        );
      sessionId = String(body.session_id);
      const stripe = stripeClient(schluessel);
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status !== "paid")
        throw new BetriebsFehler(
          "Zahlung noch nicht abgeschlossen.",
          `payment_status = ${session.payment_status}`,
          402
        );
      bezahlt = true;
      const meta = (session.metadata ?? {}) as Record<string, string>;
      // Code-Stand der Zahlung, nicht der von heute: So steht auf dem Blatt,
      // mit welchem Programmstand gekauft wurde.
      herkunftStand = metadataHerkunft(meta).codeStand;
      projekt = metadataZuProjekt(meta);
    } else if (body.demo === true && demoErlaubt()) {
      /* ---------- Demo: nur wenn ausdrücklich erlaubt ---------- */
      melde("dokumente", "Demo-Ausgabe ohne Zahlung.", { typ }, "warnung");
      projekt = validiereProjekt(body.projekt);
    } else {
      throw new BetriebsFehler("Keine gültige Zahlungssession.", undefined, 402);
    }

    // Kosmetische Firmendaten (inkl. Logo) vom Client übernehmen
    if (body.firmendaten && typeof body.firmendaten === "object") {
      const fd = body.firmendaten as Projekt["firmendaten"];
      const logo =
        typeof fd.logoDataUrl === "string" && fd.logoDataUrl.length < 800_000
          ? fd.logoDataUrl
          : undefined;
      projekt.firmendaten = validiereProjekt({ ...projekt, firmendaten: fd }).firmendaten;
      projekt.firmendaten.logoDataUrl = logo;
    }

    const stempel = dokumentStempel({
      codeStand: herkunftStand === "unbekannt" ? codeStand() : herkunftStand,
      sessionId,
    });

    const ergebnis = berechneBewehrung(projekt);
    const pdf =
      typ === "bauplan"
        ? await erzeugeBauplan(projekt, ergebnis, stempel)
        : typ === "biegeliste"
          ? await erzeugeBiegeliste(projekt, ergebnis, stempel)
          : await erzeugeStueckliste(projekt, ergebnis, stempel);

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${DATEINAMEN[typ]}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    // Nach erfolgter Zahlung ist jeder Fehler ein Alarmfall: Hier steht
    // jemand mit einer Belastung auf der Karte und ohne Unterlagen da.
    melde("dokumente", e, { sessionId, bezahlt }, bezahlt ? "kritisch" : "fehler");
    const { text, status } = kundenMeldung(e, bezahlt);
    return NextResponse.json({ fehler: text }, { status });
  }
}
