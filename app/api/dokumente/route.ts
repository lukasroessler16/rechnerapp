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
 * Body: { plan: true,                      // nur die Liste der Dateien
 *         paket: true,                     // alles als ZIP (Normalfall)
 *         typ: "bauplan"|"biegeliste"|"stueckliste"|"gesamtliste",
 *         abschnitt?: number,              // 0-basiert, nur bei mehreren
 *         session_id?: string,             // normaler Weg (nach Zahlung)
 *         demo?: boolean, projekt?: {…},   // nur wenn Demo ausdrücklich erlaubt
 *         firmendaten?: {…} }
 *
 * Eine geteilte Wand bringt bis zu 8 × 3 + 1 = 25 Blätter hervor. Sie einzeln
 * abzurufen hieße 25 Anfragen und 25 Dateien im Download-Ordner; deshalb ist
 * das ZIP der Normalfall und der Einzelabruf die Rückfallebene.
 *
 * Scheitert hier etwas NACH der Zahlung, ist das der teuerste Fehlerfall der
 * ganzen Anwendung: Der Kunde hat bezahlt und steht ohne Unterlagen da.
 * Solche Fälle werden deshalb als "kritisch" gemeldet – sie gehören auf einen
 * Alarm, der jemanden erreicht.
 */

import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { stripeClient } from "@/lib/stripe";
import {
  metadataHerkunft,
  metadataZuBauvorhaben,
  validiereBauvorhaben,
  validiereProjekt,
} from "@/lib/payload";
import { Bauvorhaben } from "@/lib/abschnitte";
import {
  Dokumenttyp,
  dateiname,
  erzeugeAlle,
  erzeugeDokument,
  istDokumenttyp,
  paketname,
  dokumentplan,
} from "@/lib/dokumente";
import { Projekt } from "@/lib/types";
import { BetriebsFehler, demoErlaubt, kundenMeldung, melde } from "@/lib/betrieb";
import { pruefeLimit } from "@/lib/ratelimit";
import { codeStand, dokumentStempel } from "@/lib/version";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Großzügig genug für „alles einmal als ZIP und danach ein paar Blätter
  // einzeln", eng genug, damit eine Schleife nicht dauerhaft Rechenzeit
  // verbraucht.
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
    const paket = body.paket === true;
    /** nur die Liste der Dateien, ohne sie zu erzeugen */
    const nurPlan = body.plan === true;
    /** nur bei Einzelabruf belegt */
    let art: Dokumenttyp | "gesamtliste" = "bauplan";
    if (!paket && !nurPlan) {
      const roh = String(body.typ);
      if (!istDokumenttyp(roh) && roh !== "gesamtliste")
        throw new BetriebsFehler("Unbekannter Dokumenttyp.");
      art = roh as Dokumenttyp | "gesamtliste";
    }

    const schluessel = process.env.STRIPE_SECRET_KEY;
    let bauvorhaben: Bauvorhaben;
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
      bauvorhaben = metadataZuBauvorhaben(meta);
    } else if (body.demo === true && demoErlaubt()) {
      /* ---------- Demo: nur wenn ausdrücklich erlaubt ---------- */
      if (!nurPlan)
        melde("dokumente", "Demo-Ausgabe ohne Zahlung.", { paket, art }, "warnung");
      bauvorhaben = validiereBauvorhaben(body.projekt);
    } else {
      throw new BetriebsFehler("Keine gültige Zahlungssession.", undefined, 402);
    }

    /* ---------- Kosmetische Firmendaten (inkl. Logo) vom Client ---------- */
    // Sie gelten für das ganze Bauvorhaben: Alle Blätter tragen denselben
    // Schriftkopf, sonst sieht Abschnitt 3 nach einer anderen Firma aus.
    if (body.firmendaten && typeof body.firmendaten === "object") {
      const fd = body.firmendaten as Projekt["firmendaten"];
      const logo =
        typeof fd.logoDataUrl === "string" && fd.logoDataUrl.length < 800_000
          ? fd.logoDataUrl
          : undefined;
      const geprueft = validiereProjekt({ ...bauvorhaben[0], firmendaten: fd }).firmendaten;
      for (const p of bauvorhaben) {
        p.firmendaten = { ...geprueft, logoDataUrl: logo };
      }
    }

    /* ---------- Nur der Dateiplan ---------- */
    // Die Erfolgsseite weiß aus sich heraus nicht, wie viele Abschnitte
    // bezahlt wurden – über den E-Mail-Link ist der Browserspeicher längst
    // leer. Die Liste kommt deshalb von derselben Stelle, die die Dateien
    // erzeugt (und nach der Übernahme der Firmendaten, damit die angezeigten
    // Dateinamen genau die sind, die auch geliefert werden).
    if (nurPlan) {
      return NextResponse.json(
        {
          abschnitte: bauvorhaben.length,
          paketname: paketname(bauvorhaben),
          dokumente: dokumentplan(bauvorhaben),
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const stempel = dokumentStempel({
      codeStand: herkunftStand === "unbekannt" ? codeStand() : herkunftStand,
      sessionId,
    });

    /* ---------- Alles als ZIP ---------- */
    if (paket) {
      const dateien = await erzeugeAlle(bauvorhaben, stempel);
      const zip = new JSZip();
      for (const d of dateien) zip.file(d.name, d.daten);
      // STORE statt DEFLATE: PDFs sind intern schon komprimiert, erneutes
      // Packen bringt kaum etwas und kostet auf dem Server messbar Zeit.
      const inhalt = await zip.generateAsync({ type: "nodebuffer", compression: "STORE" });
      return new NextResponse(new Uint8Array(inhalt), {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${paketname(bauvorhaben)}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    /* ---------- Einzelnes Blatt ---------- */
    const abschnitt = Math.min(
      Math.max(0, Number.isFinite(Number(body.abschnitt)) ? Number(body.abschnitt) : 0),
      bauvorhaben.length - 1
    );
    if (art === "gesamtliste" && bauvorhaben.length < 2)
      throw new BetriebsFehler("Eine Gesamt-Stückliste gibt es erst ab zwei Abschnitten.");
    const pdf = await erzeugeDokument(bauvorhaben, art, abschnitt, stempel);
    const name = dateiname(art, bauvorhaben[0].firmendaten.bauvorhaben, {
      nr: abschnitt + 1,
      von: art === "gesamtliste" ? 1 : bauvorhaben.length,
    });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${name}"`,
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
