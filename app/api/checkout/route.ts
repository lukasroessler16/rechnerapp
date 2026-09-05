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


export const runtime = "nodejs";

/** Preis je Durchlauf in Cent (über Umgebungsvariable änderbar) */
const PREIS_CENT = parseInt(process.env.PREIS_CENT ?? "2900", 10);

export async function POST(req: NextRequest) {
  try {
    const { projekt: roh } = await req.json();
    const projekt = validiereProjekt(roh);

    const schluessel = process.env.STRIPE_SECRET_KEY;
    if (!schluessel) {
      // Kein Stripe konfiguriert → Demo-Modus (nur für lokales Testen!)
      return NextResponse.json({ demo: true });
    }

    const stripe = stripeClient(schluessel);

        // Basis-URL: bevorzugt aus Env, sonst aus dem Request ableiten.
    // Fehlt das Schema (https://), wird es automatisch ergänzt – Stripe
    // lehnt success_url/cancel_url ohne Schema sonst ab.
    const basisRoh = process.env.NEXT_PUBLIC_BASIS_URL || req.nextUrl.origin;
    const basis = /^https?:\/\//.test(basisRoh) ? basisRoh : `https://${basisRoh}`;

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
      metadata: projektZuMetadata(projekt),
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
