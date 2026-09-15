/**
 * GET /api/muster?typ=bauplan|biegeliste|stueckliste&bauteil=<kennung>
 *
 * Liefert eines der drei Dokumente mit Beispieldaten – kostenlos und ohne
 * Zahlung. Damit können Interessenten vor dem Kauf sehen, was sie bekommen,
 * und zwar für jedes Bauteil: Wer eine Stützmauer rechnen will, hat wenig
 * davon, nur einen Wandplan zu sehen. Ohne bauteil-Parameter kommt die Wand.
 *
 * Bewusst dieselbe Erzeugungslogik wie bei den Kundendokumenten: Die Muster
 * bleiben dadurch automatisch aktuell, wenn sich Layout oder Rechenregeln
 * ändern.
 */

import { NextRequest, NextResponse } from "next/server";
import { musterProjekt } from "@/lib/muster";
import { bauteilModul, istBauteil } from "@/lib/bauteile";
import { berechneBewehrung } from "@/lib/bewehrung";
import { erzeugeBauplan } from "@/lib/pdf/bauplan";
import { erzeugeBiegeliste } from "@/lib/pdf/biegeliste";
import { erzeugeStueckliste } from "@/lib/pdf/stueckliste";
import { kundenMeldung, melde } from "@/lib/betrieb";
import { pruefeLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

const DATEINAMEN: Record<string, string> = {
  bauplan: "Bauplan",
  biegeliste: "Biegeliste",
  stueckliste: "Stueckliste",
};

export async function GET(req: NextRequest) {
  // Frei zugänglich und damit der offenste Punkt der App: Ohne Bremse ließe
  // sich hier beliebig viel Rechenzeit verbrennen.
  const limit = pruefeLimit(req, "muster", 20, 60);
  if (!limit.erlaubt) {
    return NextResponse.json(
      { fehler: "Zu viele Anfragen. Bitte einen Moment warten." },
      { status: 429, headers: { "Retry-After": String(limit.wartenSek) } }
    );
  }

  const typ = req.nextUrl.searchParams.get("typ") ?? "bauplan";
  if (!DATEINAMEN[typ])
    return NextResponse.json({ fehler: "Unbekannter Dokumenttyp." }, { status: 400 });

  const gewuenscht = req.nextUrl.searchParams.get("bauteil") ?? "wand";
  if (!istBauteil(gewuenscht))
    return NextResponse.json({ fehler: "Unbekanntes Bauteil." }, { status: 400 });

  try {
    const projekt = musterProjekt(gewuenscht);
    const ergebnis = berechneBewehrung(projekt);
    const pdf =
      typ === "bauplan"
        ? await erzeugeBauplan(projekt, ergebnis)
        : typ === "biegeliste"
          ? await erzeugeBiegeliste(projekt, ergebnis)
          : await erzeugeStueckliste(projekt, ergebnis);

    // Dateiname mit Bauteil: Wer sich mehrere Muster ansieht, findet sie
    // im Download-Ordner sonst nicht mehr auseinander.
    const datei = `Muster-${DATEINAMEN[typ]}-${bauteilModul(gewuenscht).name}.pdf`
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/[^A-Za-z0-9.\-]/g, "-");

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        // "inline": öffnet direkt im Browser statt herunterzuladen
        "Content-Disposition": `inline; filename="${datei}"`,
        // Muster ändern sich selten – eine Stunde zwischenspeichern
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e) {
    // Ein kaputtes Muster heißt: Die Musterdokumente auf /beispiele sind
    // kaputt – das sieht jeder Interessent vor dem Kauf.
    melde("muster", e, { typ, bauteil: gewuenscht });
    const { text, status } = kundenMeldung(e);
    return NextResponse.json({ fehler: text }, { status });
  }
}
