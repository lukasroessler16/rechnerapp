/**
 * POST /api/checkout
 *
 * Erstellt eine Stripe-Checkout-Session (Einmalzahlung, ohne Kundenkonto).
 * Die Projektgeometrie wird komprimiert in den Session-Metadata abgelegt –
 * so ist sie nach der Zahlung serverseitig verfügbar und kann nicht gegen
 * andere Daten getauscht werden (zustandslose Architektur, keine Datenbank).
 *
 * DEMO-MODUS: Nur außerhalb der Produktion (oder mit ausdrücklichem
 * DEMO_MODUS=1) antwortet die Route mit { demo: true } und die App springt
 * ohne Zahlung zur Erfolgsseite. In Produktion ohne Stripe-Schlüssel schlägt
 * der Aufruf hart fehl – siehe lib/betrieb.ts.
 */

import { NextRequest, NextResponse } from "next/server";
import { stripeClient } from "@/lib/stripe";
import { validiereBauvorhaben, projektZuMetadata } from "@/lib/payload";
import { bauteilModul } from "@/lib/bauteile";
import { basisUrl } from "@/lib/basis";
import { BetriebsFehler, kundenMeldung, melde, stripeSchluessel } from "@/lib/betrieb";
import { pruefeLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

/** Preis je Durchlauf in Cent (über Umgebungsvariable änderbar) */
const PREIS_CENT = parseInt(process.env.PREIS_CENT ?? "2900", 10);

export async function POST(req: NextRequest) {
  // Zahlungsvorgänge anzustoßen ist billig, aber nicht gratis (Stripe-API).
  const limit = pruefeLimit(req, "checkout", 10, 60);
  if (!limit.erlaubt) {
    return NextResponse.json(
      { fehler: "Zu viele Anfragen. Bitte einen Moment warten." },
      { status: 429, headers: { "Retry-After": String(limit.wartenSek) } }
    );
  }

  try {
    const { projekt: roh, verzichtBestaetigt } = await req.json();
    // Der Client schickt eine Liste von Abschnitten; ältere Aufrufe mit einem
    // einzelnen Projekt werden davon mit abgedeckt.
    const bauvorhaben = validiereBauvorhaben(roh);
    const abschnitte = bauvorhaben.length;

    // Rücktrittsverzicht (§ 18 Abs. 1 Z 11 FAGG): Ohne ausdrückliche
    // Zustimmung darf die Zahlung nicht starten. Serverseitig geprüft, damit
    // die Bestätigung nicht durch Manipulation der Oberfläche umgehbar ist.
    if (verzichtBestaetigt !== true) {
      throw new BetriebsFehler(
        "Bitte bestätigen Sie die sofortige Bereitstellung der Dokumente, um fortzufahren."
      );
    }

    // Wirft in Produktion, wenn die Zahlungsanbindung fehlt, statt still
    // in den Demo-Modus zu fallen.
    const schluessel = stripeSchluessel();
    if (!schluessel) {
      melde("checkout", "Demo-Modus aktiv – es wird keine Zahlung verlangt.", {}, "warnung");
      return NextResponse.json({ demo: true });
    }

    const stripe = stripeClient(schluessel);
    const basis = basisUrl(req);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      // Zahlarten steuert das Stripe-Dashboard (Karte, EPS, Klarna, …)
      line_items: [
        {
          // Jeder Abschnitt ist ein eigener vollständiger Plan und kostet
          // entsprechend. Die Zahl kommt aus den geprüften Daten, nicht aus
          // einem Feld, das der Client frei setzen könnte.
          quantity: abschnitte,
          price_data: {
            currency: "eur",
            unit_amount: PREIS_CENT,
            product_data: {
              name: `Bewehrungsrechner – ${bauteilModul(bauvorhaben[0].bauteil).name}`,
              description:
                abschnitte > 1
                  ? `Bauplan, Biegeliste und Stückliste je Abschnitt (${abschnitte} Abschnitte) sowie eine Gesamt-Stückliste`
                  : "Bauplan, Biegeliste und Stückliste (PDF) für einen Berechnungsdurchlauf",
            },
          },
        },
      ],
      metadata: {
        ...projektZuMetadata(bauvorhaben),
        // Zahl der Abschnitte zusätzlich im Klartext – so steht im
        // Stripe-Dashboard, wofür bezahlt wurde, ohne die Daten auszupacken.
        abschnitte: String(abschnitte),
        // Nachweis der Zustimmung zum Rücktrittsverzicht, dauerhaft bei
        // der Zahlung dokumentiert
        widerrufsverzicht: new Date().toISOString(),
      },
      success_url: `${basis}/erfolg?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${basis}/rechner?abbruch=1`,
      // Rechnungs-/Steuerdaten bewusst minimal: keine Registrierung nötig
      billing_address_collection: "auto",
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    melde("checkout", e);
    const { text, status } = kundenMeldung(e);
    return NextResponse.json({ fehler: text }, { status });
  }
}
