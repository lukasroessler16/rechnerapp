/**
 * GET /api/muster?typ=bauplan|biegeliste|stueckliste
 *
 * Liefert eines der drei Dokumente mit Beispieldaten – kostenlos und ohne
 * Zahlung. Damit können Interessenten vor dem Kauf sehen, was sie bekommen.
 *
 * Bewusst dieselbe Erzeugungslogik wie bei den Kundendokumenten: Die Muster
 * bleiben dadurch automatisch aktuell, wenn sich das Layout ändert.
 */

import { NextRequest, NextResponse } from "next/server";
import { MUSTERPROJEKT } from "@/lib/muster";
import { berechneBewehrung } from "@/lib/bewehrung";
import { erzeugeBauplan } from "@/lib/pdf/bauplan";
import { erzeugeBiegeliste } from "@/lib/pdf/biegeliste";
import { erzeugeStueckliste } from "@/lib/pdf/stueckliste";

export const runtime = "nodejs";

const DATEINAMEN: Record<string, string> = {
  bauplan: "Muster-Bauplan.pdf",
  biegeliste: "Muster-Biegeliste.pdf",
  stueckliste: "Muster-Stueckliste.pdf",
};

export async function GET(req: NextRequest) {
  const typ = req.nextUrl.searchParams.get("typ") ?? "bauplan";
  if (!DATEINAMEN[typ])
    return NextResponse.json({ fehler: "Unbekannter Dokumenttyp." }, { status: 400 });

  const ergebnis = berechneBewehrung(MUSTERPROJEKT);
  const pdf =
    typ === "bauplan"
      ? await erzeugeBauplan(MUSTERPROJEKT, ergebnis)
      : typ === "biegeliste"
        ? await erzeugeBiegeliste(MUSTERPROJEKT, ergebnis)
        : await erzeugeStueckliste(MUSTERPROJEKT, ergebnis);

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      // "inline": öffnet direkt im Browser statt herunterzuladen
      "Content-Disposition": `inline; filename="${DATEINAMEN[typ]}"`,
      // Muster ändern sich selten – eine Stunde zwischenspeichern
      "Cache-Control": "public, max-age=3600",
    },
  });
}
