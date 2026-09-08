/**
 * POST /api/checkout
 *
 * Erstellt eine Stripe-Checkout-Session (Einmalzahlung, ohne Kundenkonto).
 * Die Projektgeometrie wird komprimiert in den Session-Metadata abgelegt –
 * so ist sie nach der Zahlung serverseitig verfügbar und kann nicht gegen
 * andere Daten getauscht werden (zustandslose Architektur, keine Datenbank).
 *
 * DEMO-MODUS: Ist kein STRIPE_SECRET_KEY gesetzt, antwortet die Route mit
 * { demo: true } und die App springt ohne Zahlung zur Erfolgsseite. So lässt
 * sich alles lokal testen, bevor Stripe eingerichtet ist.
 */

import { NextRequest, NextResponse } from "next/server";
import { stripeClient } from "@/lib/stripe";
import { validiereProjekt, projektZuMetadata } from "@/lib/payload";
import { basisUrl } from "@/lib/basis";


export const runtime = "nodejs";

/** Preis je Durchlauf in Cent (über Umgebungsvariable änderbar) */
const PREIS_CENT = parseInt(process.env.PREIS_CENT ?? "2900", 10);

export async function POST(req: NextRequest) {
  try {
    const { projekt: roh, verzichtBestaetigt } = await req.json();
    const projekt = validiereProjekt(roh);

    // Rücktrittsverzicht (§ 18 Abs. 1 Z 11 FAGG): Ohne ausdrückliche
    // Zustimmung darf die Zahlung nicht starten. Serverseitig geprüft, damit
    // die Bestätigung nicht durch Manipulation der Oberfläche umgehbar ist.
    if (verzichtBestaetigt !== true) {
      return NextResponse.json(
        {
          fehler:
            "Bitte bestätigen Sie die sofortige Bereitstellung der Dokumente, um fortzufahren.",
        },
        { status: 400 }
      );
    }

    const schluessel = process.env.STRIPE_SECRET_KEY;
    if (!schluessel) {
      // Kein Stripe konfiguriert → Demo-Modus (nur für lokales Testen!)
      return NextResponse.json({ demo: true });
    }

    const stripe = stripeClient(schluessel);

    const basis = basisUrl(req);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      // Zahlarten steuert das Stripe-Dashboard (Karte, EPS, Klarna, …)
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: PREIS_CENT,
            product_data: {
              name: "Bewehrungsrechner – Dokumentenpaket",
              description:
                "Bauplan, Biegeliste und Stückliste (PDF) für einen Berechnungsdurchlauf",
            },
          },
        },
      ],
      metadata: {
        ...projektZuMetadata(projekt),
        // Nachweis der Zustimmung zum Rücktrittsverzicht, dauerhaft bei
        // der Zahlung dokumentiert
        widerrufsverzicht: new Date().toISOString(),
      },
      success_url: `${basis}/erfolg?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${basis}/?abbruch=1`,
      // Rechnungs-/Steuerdaten bewusst minimal: keine Registrierung nötig
      billing_address_collection: "auto",
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    const text = e instanceof Error ? e.message : "Unbekannter Fehler";
    return NextResponse.json({ fehler: text }, { status: 400 });
  }
}
