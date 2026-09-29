"use client";

/**
 * Erfolgsseite nach der Zahlung (bzw. im Demo-Modus).
 *
 * Stripe leitet mit ?session_id=… hierher zurück. Der Server prüft bei jedem
 * Abruf erneut, ob die Session bezahlt ist. Firmendaten + Logo kommen aus dem
 * sessionStorage (sie werden nicht über Stripe geführt).
 *
 * DIE DREI DOKUMENTE LADEN VON SELBST.
 * Wer bezahlt hat und den Tab schließt, ohne geklickt zu haben, steht sonst
 * ohne Unterlagen da. Deshalb starten die Downloads automatisch, sobald die
 * Seite steht – nacheinander, damit nicht drei PDF-Erzeugungen gleichzeitig
 * laufen und der Browser die Dateien sauber ablegt. Die Knöpfe bleiben
 * trotzdem: Browser dürfen automatische Downloads blockieren (Chrome fragt
 * bei mehreren Dateien nach, Safari auf dem iPhone ist eigen), und dann muss
 * der Weg von Hand offenstehen. Der dauerhafte Link per E-Mail bleibt die
 * zweite Absicherung.
 */

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ereignis } from "@/lib/statistik";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const DOKUMENTE = [
  { typ: "bauplan", titel: "Bauplan / Skizze", text: "maßstäbliche Zeichnung mit Schriftkopf (A4 quer)" },
  { typ: "biegeliste", titel: "Biegeliste", text: "alle Stäbe mit Biegeform, Maßen und Stückzahl" },
  { typ: "stueckliste", titel: "Stückliste", text: "alle Positionen mit Mini-Skizze, Gewicht und Summen" },
] as const;

type Stand = "offen" | "laeuft" | "fertig" | "fehler";

const ZEICHEN: Record<Stand, string> = {
  offen: "…",
  laeuft: "lädt",
  fertig: "✓ geladen",
  fehler: "✗ fehlgeschlagen",
};

/** kurze Pause zwischen zwei Downloads */
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Dateiname aus Dokumentart und Bauvorhaben.
 *
 * Ohne das Bauvorhaben heißen die Dateien bei jedem Projekt gleich und landen
 * im Download-Ordner als „Bauplan (3).pdf“ – genau die Verwechslung, die auf
 * der Baustelle teuer wird.
 */
function dateiname(typ: string, bauvorhaben: unknown): string {
  const art = typ.charAt(0).toUpperCase() + typ.slice(1);
  const roh = typeof bauvorhaben === "string" ? bauvorhaben : "";
  const sauber = roh
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
    .replace(/Ä/g, "Ae").replace(/Ö/g, "Oe").replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return sauber ? `${art}-${sauber}.pdf` : `${art}.pdf`;
}

function ErfolgInhalt() {
  const params = useSearchParams();
  const sessionId = params.get("session_id");
  const demo = params.get("demo") === "1";
  const gueltig = !!sessionId || demo;

  const [stand, setStand] = useState<Record<string, Stand>>({});
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuftGerade, setLaeuftGerade] = useState(false);
  /** true, sobald der automatische Durchlauf einmal angestoßen wurde */
  const automatikGelaufen = useRef(false);

  const herunterladen = useCallback(
    async (typ: string) => {
      setStand((s) => ({ ...s, [typ]: "laeuft" }));
      try {
        // Projekt (für Demo) bzw. Firmendaten/Logo (immer) aus dem Browser.
        // Reihenfolge: laufende Sitzung zuerst, sonst der dauerhafte Speicher –
        // so erscheint das Logo auch, wenn der Kunde später über den
        // E-Mail-Link zurückkommt und die Sitzung längst beendet ist.
        let projekt: unknown = null;
        let firmendaten: { bauvorhaben?: unknown } | null = null;
        try {
          const roh = sessionStorage.getItem("bewehrung_projekt");
          if (roh) {
            projekt = JSON.parse(roh);
            firmendaten = (projekt as { firmendaten?: typeof firmendaten }).firmendaten ?? null;
          }
          if (!firmendaten) {
            const gesichert = localStorage.getItem("bewehrung_firmendaten");
            if (gesichert) firmendaten = JSON.parse(gesichert);
          }
        } catch {
          /* ohne gespeicherte Daten weiter – Dokumente kommen dann ohne Logo */
        }

        const antwort = await fetch("/api/dokumente", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            typ,
            session_id: sessionId ?? undefined,
            demo: demo || undefined,
            projekt: demo ? projekt : undefined,
            firmendaten,
          }),
        });
        if (!antwort.ok) {
          const daten = await antwort.json().catch(() => ({}));
          throw new Error(daten.fehler ?? "Download fehlgeschlagen.");
        }

        const blob = await antwort.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = dateiname(typ, firmendaten?.bauvorhaben);
        // Manche Browser lösen den Download nur aus, wenn das Element im
        // Dokument hängt.
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        a.remove();
        // Nicht sofort freigeben: Firefox und Safari brechen den Download
        // sonst gelegentlich ab, bevor er begonnen hat.
        setTimeout(() => URL.revokeObjectURL(url), 30_000);

        setStand((s) => ({ ...s, [typ]: "fertig" }));
        ereignis("dokument_geladen", { typ, bezahlt: demo ? "demo" : "ja" });
        return true;
      } catch (e) {
        setStand((s) => ({ ...s, [typ]: "fehler" }));
        setFehler(e instanceof Error ? e.message : "Unbekannter Fehler.");
        // Ein Fehler HIER ist der teuerste Fall: Es wurde bezahlt und es kommt
        // nichts an. Der Server meldet ihn ohnehin als kritisch; die Zählung
        // zeigt, ob es ein Einzelfall ist oder ein Muster.
        ereignis("dokument_fehler", { typ });
        return false;
      }
    },
    [sessionId, demo]
  );

  /** Alle drei nacheinander holen */
  const alleHolen = useCallback(async () => {
    setLaeuftGerade(true);
    setFehler(null);
    for (const [i, d] of DOKUMENTE.entries()) {
      await herunterladen(d.typ);
      // Kurz Luft lassen: drei gleichzeitige PDF-Erzeugungen wären unnötig,
      // und der Browser kommt mit den Dateien besser nach.
      if (i < DOKUMENTE.length - 1) await pause(700);
    }
    setLaeuftGerade(false);
  }, [herunterladen]);

  /**
   * Automatischer Start. Die kurze Verzögerung gibt der Seite Zeit, sich
   * aufzubauen – der Kunde sieht erst, dass alles geklappt hat, und dann
   * laufen die Downloads.
   *
   * Die Sperre sitzt bewusst IM Zeitgeber und nicht davor: React ruft Effekte
   * in der Entwicklung doppelt auf (einmal samt Aufräumen). Stünde die Sperre
   * vor dem setTimeout, würde der erste Durchlauf den Zeitgeber setzen, das
   * Aufräumen ihn löschen und der zweite Durchlauf an der Sperre abprallen –
   * der Download startete nie.
   */
  useEffect(() => {
    if (!gueltig) return;
    const t = setTimeout(() => {
      if (automatikGelaufen.current) return;
      automatikGelaufen.current = true;
      void alleHolen();
    }, 400);
    return () => clearTimeout(t);
  }, [gueltig, alleHolen]);

  if (!gueltig) {
    return (
      <main className="mitte panel">
        <h2>Keine Zahlungssession gefunden</h2>
        <p>
          Diese Seite ist nur nach einer abgeschlossenen Zahlung erreichbar.{" "}
          <Link href="/rechner">Zurück zum Rechner</Link>
        </p>
      </main>
    );
  }

  const fertige = DOKUMENTE.filter((d) => stand[d.typ] === "fertig").length;
  const alleFertig = fertige === DOKUMENTE.length;

  return (
    <main className="mitte panel">
      <h2>{demo ? "Demo-Modus: Dokumente testen" : "Vielen Dank für Ihre Zahlung!"}</h2>
      <p>
        {demo
          ? "Stripe ist noch nicht konfiguriert – die Dokumente werden ohne Zahlung erzeugt (nur lokal zum Testen)."
          : "Ihre Dokumente sind freigeschaltet und werden gerade heruntergeladen. Denselben Link haben wir Ihnen zusätzlich per E-Mail geschickt – er bleibt dauerhaft gültig."}
      </p>

      {/* Fortschritt des automatischen Downloads */}
      <div className={`ladestand${alleFertig ? " fertig" : ""}`}>
        <strong>
          {laeuftGerade
            ? `Download läuft … (${fertige} von ${DOKUMENTE.length})`
            : alleFertig
              ? "Alle drei Dokumente wurden heruntergeladen."
              : `${fertige} von ${DOKUMENTE.length} Dokumenten heruntergeladen`}
        </strong>
        <ul>
          {DOKUMENTE.map((d) => {
            const s = stand[d.typ] ?? "offen";
            return (
              <li key={d.typ} className={`stand-${s}`}>
                <span>{d.titel}</span>
                <span className="stand-wort">{ZEICHEN[s]}</span>
              </li>
            );
          })}
        </ul>
        {!laeuftGerade && (
          <button className="knopf primaer" onClick={() => void alleHolen()}>
            {alleFertig ? "Alle drei erneut herunterladen" : "Download erneut starten"}
          </button>
        )}
        <div className="hinweis" style={{ marginTop: 8 }}>
          Fragt Ihr Browser, ob mehrere Dateien geladen werden dürfen, bestätigen
          Sie bitte – es sind genau diese drei. Einzeln geht es weiter unten.
        </div>
      </div>

      {fehler && <div className="warnbox">{fehler}</div>}

      <h3 className="gruppe-titel" style={{ marginTop: 22 }}>
        Einzeln herunterladen
      </h3>
      <div className="download-reihe">
        {DOKUMENTE.map((d) => (
          <button
            key={d.typ}
            className="knopf"
            onClick={() => void herunterladen(d.typ)}
            disabled={laeuftGerade}
          >
            <span>
              <strong>{d.titel}</strong>
              <br />
              <span style={{ fontWeight: 400, fontSize: 12.5, color: "#5a6472" }}>{d.text}</span>
            </span>
            <span>{stand[d.typ] === "laeuft" ? "erzeuge PDF …" : "⬇ PDF"}</span>
          </button>
        ))}
      </div>

      <div className="haftung">
        Alle Dokumente basieren auf einer Mengenermittlung nach Eurocode 2 und dem in
        der Berechnung gewählten Nationalen Anhang (Mindestbewehrung +
        Konstruktionsregeln) und sind vor der Ausführung von einer
        tragwerksplanungsbefugten Person zu prüfen.
      </div>
      <p style={{ marginTop: 18 }}>
        <Link href="/rechner">← Neue Berechnung starten</Link>
      </p>
    </main>
  );
}

export default function Erfolg() {
  return (
    <Suspense>
      <ErfolgInhalt />
    </Suspense>
  );
}
