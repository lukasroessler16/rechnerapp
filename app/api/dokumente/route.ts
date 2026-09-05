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
 *         demo?: boolean, projekt?: {…}, // nur ohne konfiguriertes Stripe
 *         firmendaten?: {…} }
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { metadataZuProjekt, validiereProjekt } from "@/lib/payload";
import { berechneBewehrung } from "@/lib/bewehrung";
import { erzeugeBauplan } from "@/lib/pdf/bauplan";
import { erzeugeBiegeliste } from "@/lib/pdf/biegeliste";
import { erzeugeStueckliste } from "@/lib/pdf/stueckliste";
import { Projekt } from "@/lib/types";

export const runtime = "nodejs";

const DATEINAMEN: Record<string, string> = {
  bauplan: "Bauplan.pdf",
  biegeliste: "Biegeliste.pdf",
  stueckliste: "Stueckliste.pdf",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const typ = String(body.typ);
    if (!DATEINAMEN[typ])
      return NextResponse.json({ fehler: "Unbekannter Dokumenttyp." }, { status: 400 });

    const schluessel = process.env.STRIPE_SECRET_KEY;
    let projekt: Projekt;

    if (body.session_id) {
      /* ---------- Normalfall: bezahlte Stripe-Session ---------- */
      if (!schluessel)
        return NextResponse.json({ fehler: "Stripe nicht konfiguriert." }, { status: 500 });
      const stripe = new Stripe(schluessel);
      const session = await stripe.checkout.sessions.retrieve(String(body.session_id));
      if (session.payment_status !== "paid")
        return NextResponse.json(
          { fehler: "Zahlung noch nicht abgeschlossen." },
          { status: 402 }
        );
      projekt = metadataZuProjekt((session.metadata ?? {}) as Record<string, string>);
    } else if (body.demo === true && !schluessel) {
      /* ---------- Demo-Modus: nur solange kein Stripe-Key gesetzt ist ---------- */
      projekt = validiereProjekt(body.projekt);
    } else {
      return NextResponse.json({ fehler: "Keine gültige Zahlungssession." }, { status: 402 });
    }

    // Kosmetische Firmendaten (inkl. Logo) vom Client übernehmen
    if (body.firmendaten && typeof body.firmendaten === "object") {
      const fd = body.firmendaten as Projekt["firmendaten"];
      const logo = typeof fd.logoDataUrl === "string" && fd.logoDataUrl.length < 800_000
        ? fd.logoDataUrl
        : undefined;
      projekt.firmendaten = validiereProjekt({ ...projekt, firmendaten: fd }).firmendaten;
      projekt.firmendaten.logoDataUrl = logo;
    }

    const ergebnis = berechneBewehrung(projekt);
    const pdf =
      typ === "bauplan"
        ? await erzeugeBauplan(projekt, ergebnis)
        : typ === "biegeliste"
          ? await erzeugeBiegeliste(projekt, ergebnis)
          : await erzeugeStueckliste(projekt, ergebnis);

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${DATEINAMEN[typ]}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const text = e instanceof Error ? e.message : "Unbekannter Fehler";
    return NextResponse.json({ fehler: text }, { status: 400 });
  }
}
