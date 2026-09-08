/**
 * POST /api/stripe-webhook
 *
 * Von Stripe aufgerufen, sobald eine Zahlung abgeschlossen ist. Verschickt
 * dem Kunden per E-Mail den dauerhaften Link auf seine Dokumente.
 *
 * WARUM ein Webhook und nicht die Erfolgsseite? Der Webhook trifft auch dann
 * ein, wenn der Kunde nach der Zahlung den Browser-Tab sofort schließt –
 * genau der Fall, in dem er sonst bezahlt hätte, aber ohne Dokumente
 * dastünde.
 *
 * Sicherheit: Die Signatur jeder Anfrage wird gegen STRIPE_WEBHOOK_SECRET
 * geprüft. Ohne gültige Signatur wird nichts verarbeitet.
 */

import { NextRequest, NextResponse } from "next/server";
import { stripeClient } from "@/lib/stripe";
import { basisUrl } from "@/lib/basis";
import { metadataZuProjekt } from "@/lib/payload";
import { sendeDokumentenMail } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const schluessel = process.env.STRIPE_SECRET_KEY;
  const webhookGeheimnis = process.env.STRIPE_WEBHOOK_SECRET;

  if (!schluessel || !webhookGeheimnis) {
    console.error("[Webhook] STRIPE_SECRET_KEY oder STRIPE_WEBHOOK_SECRET fehlt.");
    return NextResponse.json({ fehler: "Webhook nicht konfiguriert." }, { status: 500 });
  }

  const signatur = req.headers.get("stripe-signature");
  if (!signatur) {
    return NextResponse.json({ fehler: "Signatur fehlt." }, { status: 400 });
  }

  // Rohkörper (unverändert!) – die Signaturprüfung schlägt sonst fehl
  const rohkoerper = await req.text();
  const stripe = stripeClient(schluessel);

  let ereignis;
  try {
    // Async-Variante: funktioniert mit dem fetch-basierten HTTP-Client
    ereignis = await stripe.webhooks.constructEventAsync(
      rohkoerper,
      signatur,
      webhookGeheimnis
    );
  } catch (e) {
    console.error("[Webhook] Signaturprüfung fehlgeschlagen:", e);
    return NextResponse.json({ fehler: "Signatur ungültig." }, { status: 400 });
  }

  if (ereignis.type === "checkout.session.completed") {
    const session = ereignis.data.object;

    if (session.payment_status === "paid") {
      const empfaenger = session.customer_details?.email;

      if (!empfaenger) {
        console.warn("[Webhook] Keine E-Mail-Adresse in der Session", session.id);
      } else {
        // Bauvorhaben aus den Metadaten lesen (rein kosmetisch für die Mail)
        let bauvorhaben = "";
        try {
          const projekt = metadataZuProjekt(
            (session.metadata ?? {}) as Record<string, string>
          );
          bauvorhaben = projekt.firmendaten.bauvorhaben;
        } catch {
          /* ohne Bauvorhaben versenden */
        }

        const betrag = ((session.amount_total ?? 0) / 100).toLocaleString("de-AT", {
          style: "currency",
          currency: (session.currency ?? "eur").toUpperCase(),
        });

        const erfolgreich = await sendeDokumentenMail({
          an: empfaenger,
          bauvorhaben,
          downloadUrl: `${basisUrl(req)}/erfolg?session_id=${session.id}`,
          betrag,
        });
        console.log(
          `[Webhook] Dokumenten-Mail an ${empfaenger}: ${erfolgreich ? "versendet" : "NICHT versendet"}`
        );
      }
    }
  }

  // Stripe erwartet 200 – sonst wird der Aufruf wiederholt
  return NextResponse.json({ empfangen: true });
}
