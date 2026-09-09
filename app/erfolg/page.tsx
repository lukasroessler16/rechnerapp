"use client";

/**
 * Erfolgsseite nach der Zahlung (bzw. im Demo-Modus).
 *
 * Stripe leitet mit ?session_id=… hierher zurück. Die Seite bietet die
 * drei PDF-Dokumente zum Download an; der Server prüft bei jedem Abruf
 * erneut, ob die Session bezahlt ist. Firmendaten + Logo kommen aus dem
 * sessionStorage (sie werden nicht über Stripe geführt).
 */

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const DOKUMENTE = [
  { typ: "bauplan", titel: "Bauplan / Skizze", text: "maßstäbliche Zeichnung mit Schriftkopf (A4 quer)" },
  { typ: "biegeliste", titel: "Biegeliste", text: "alle Stäbe mit Biegeform, Maßen und Stückzahl" },
  { typ: "stueckliste", titel: "Stückliste", text: "alle Positionen mit Mini-Skizze, Gewicht und Summen" },
] as const;

function ErfolgInhalt() {
  const params = useSearchParams();
  const sessionId = params.get("session_id");
  const demo = params.get("demo") === "1";
  const [laedt, setLaedt] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  const herunterladen = async (typ: string) => {
    setLaedt(typ);
    setFehler(null);
    try {
      // Projekt (für Demo) bzw. Firmendaten/Logo (immer) aus dem Browser.
      // Reihenfolge: laufende Sitzung zuerst, sonst der dauerhafte Speicher –
      // so erscheint das Logo auch, wenn der Kunde später über den
      // E-Mail-Link zurückkommt und die Sitzung längst beendet ist.
      let projekt: unknown = null;
      let firmendaten: unknown = null;
      try {
        const roh = sessionStorage.getItem("bewehrung_projekt");
        if (roh) {
          projekt = JSON.parse(roh);
          firmendaten = (projekt as { firmendaten?: unknown }).firmendaten;
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
      a.download = typ.charAt(0).toUpperCase() + typ.slice(1) + ".pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Unbekannter Fehler.");
    } finally {
      setLaedt(null);
    }
  };

  if (!sessionId && !demo) {
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

  return (
    <main className="mitte panel">
      <h2>{demo ? "Demo-Modus: Dokumente testen" : "Vielen Dank für Ihre Zahlung!"}</h2>
      <p>
        {demo
          ? "Stripe ist noch nicht konfiguriert – die Dokumente werden ohne Zahlung erzeugt (nur lokal zum Testen)."
          : "Ihre Dokumente sind freigeschaltet. Denselben Link haben wir Ihnen zusätzlich per E-Mail geschickt – er bleibt dauerhaft gültig."}
      </p>
      <div className="download-reihe">
        {DOKUMENTE.map((d) => (
          <button
            key={d.typ}
            className="knopf"
            onClick={() => herunterladen(d.typ)}
            disabled={laedt !== null}
          >
            <span>
              <strong>{d.titel}</strong>
              <br />
              <span style={{ fontWeight: 400, fontSize: 12.5, color: "#5a6472" }}>{d.text}</span>
            </span>
            <span>{laedt === d.typ ? "erzeuge PDF …" : "⬇ PDF"}</span>
          </button>
        ))}
      </div>
      {fehler && <div className="warnbox">{fehler}</div>}
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
