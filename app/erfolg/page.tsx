"use client";

/**
 * Erfolgsseite nach der Zahlung (bzw. im Demo-Modus).
 *
 * Stripe leitet mit ?session_id=… hierher zurück. Der Server prüft bei jedem
 * Abruf erneut, ob die Session bezahlt ist. Firmendaten + Logo kommen aus dem
 * sessionStorage (sie werden nicht über Stripe geführt).
 *
 * DAS PAKET LÄDT VON SELBST.
 * Wer bezahlt hat und den Tab schließt, ohne geklickt zu haben, steht sonst
 * ohne Unterlagen da. Deshalb startet der Download automatisch, sobald die
 * Seite steht – und zwar als EINE ZIP-Datei: Bei einer Wand in vier
 * Abschnitten sind es dreizehn Blätter, und dreizehn einzelne Downloads
 * blockiert jeder Browser irgendwann. Eine Datei kommt entweder an oder
 * nicht; dreizehn kommen halb an, und das merkt niemand.
 *
 * Die Einzel-Knöpfe bleiben trotzdem: Browser dürfen automatische Downloads
 * blockieren, und wer nur den Plan von Abschnitt 3 nachdrucken will, soll
 * nicht das ganze Paket laden müssen. Der dauerhafte Link per E-Mail bleibt
 * die zweite Absicherung.
 */

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ereignis } from "@/lib/statistik";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

/** entspricht Dokumentplan in lib/dokumente.ts */
interface Blatt {
  typ: "bauplan" | "biegeliste" | "stueckliste" | "gesamtliste";
  abschnitt?: number;
  name: string;
  titel: string;
}

interface Plan {
  abschnitte: number;
  paketname: string;
  dokumente: Blatt[];
}

const ERKLAERUNG: Record<Blatt["typ"], string> = {
  bauplan: "maßstäbliche Zeichnung mit Schriftkopf (A4 quer)",
  biegeliste: "alle Stäbe mit Biegeform, Maßen und Stückzahl",
  stueckliste: "alle Positionen mit Mini-Skizze, Gewicht und Summen",
  gesamtliste: "Bestellmengen über alle Abschnitte – das Blatt für den Händler",
};

type Stand = "offen" | "laeuft" | "fertig" | "fehler";

/**
 * Was im Browser über das Projekt bekannt ist.
 *
 * Reihenfolge: laufende Sitzung zuerst, sonst der dauerhafte Speicher – so
 * erscheint das Logo auch, wenn der Kunde später über den E-Mail-Link
 * zurückkommt und die Sitzung längst beendet ist.
 */
function ausDemBrowser(): {
  projekt: unknown;
  firmendaten: { bauvorhaben?: unknown; logoDataUrl?: unknown } | null;
} {
  let projekt: unknown = null;
  let firmendaten: { bauvorhaben?: unknown } | null = null;
  try {
    const roh = sessionStorage.getItem("bewehrung_projekt");
    if (roh) {
      projekt = JSON.parse(roh);
      // Seit der Aufteilung in Abschnitte steht hier eine Liste; ältere
      // Sitzungen (noch offener Tab über einen Programmwechsel hinweg)
      // können noch ein einzelnes Projekt enthalten.
      const erster = Array.isArray(projekt) ? projekt[0] : projekt;
      firmendaten = (erster as { firmendaten?: typeof firmendaten })?.firmendaten ?? null;
    }
    if (!firmendaten) {
      const gesichert = localStorage.getItem("bewehrung_firmendaten");
      if (gesichert) firmendaten = JSON.parse(gesichert);
    }
  } catch {
    /* ohne gespeicherte Daten weiter – Dokumente kommen dann ohne Logo */
  }
  return { projekt, firmendaten };
}

/** Blob im Browser als Datei ablegen */
function ablegen(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  // Manche Browser lösen den Download nur aus, wenn das Element im
  // Dokument hängt.
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Nicht sofort freigeben: Firefox und Safari brechen den Download
  // sonst gelegentlich ab, bevor er begonnen hat.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function ErfolgInhalt() {
  const params = useSearchParams();
  const sessionId = params.get("session_id");
  const demo = params.get("demo") === "1";
  const gueltig = !!sessionId || demo;

  const [plan, setPlan] = useState<Plan | null>(null);
  const [paketStand, setPaketStand] = useState<Stand>("offen");
  const [einzel, setEinzel] = useState<Record<string, Stand>>({});
  const [fehler, setFehler] = useState<string | null>(null);
  /** true, sobald der automatische Download einmal angestoßen wurde */
  const automatikGelaufen = useRef(false);

  /** gemeinsamer Rumpf jeder Anfrage an /api/dokumente */
  const anfrage = useCallback(
    async (zusatz: Record<string, unknown>): Promise<Response> => {
      const { projekt, firmendaten } = ausDemBrowser();
      return fetch("/api/dokumente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId ?? undefined,
          demo: demo || undefined,
          projekt: demo ? projekt : undefined,
          firmendaten,
          ...zusatz,
        }),
      });
    },
    [sessionId, demo]
  );

  /** Welche Dateien gehören zu dieser Zahlung? */
  useEffect(() => {
    if (!gueltig) return;
    let abgebrochen = false;
    (async () => {
      try {
        const antwort = await anfrage({ plan: true });
        if (!antwort.ok) {
          const daten = await antwort.json().catch(() => ({}));
          throw new Error(daten.fehler ?? "Dokumentenliste nicht verfügbar.");
        }
        const daten = (await antwort.json()) as Plan;
        if (!abgebrochen) setPlan(daten);
      } catch (e) {
        if (!abgebrochen)
          setFehler(e instanceof Error ? e.message : "Unbekannter Fehler.");
      }
    })();
    return () => {
      abgebrochen = true;
    };
  }, [gueltig, anfrage]);

  /** Das ganze Paket als ZIP */
  const paketHolen = useCallback(async () => {
    setPaketStand("laeuft");
    setFehler(null);
    try {
      const antwort = await anfrage({ paket: true });
      if (!antwort.ok) {
        const daten = await antwort.json().catch(() => ({}));
        throw new Error(daten.fehler ?? "Download fehlgeschlagen.");
      }
      ablegen(await antwort.blob(), plan?.paketname ?? "Bewehrung.zip");
      setPaketStand("fertig");
      ereignis("paket_geladen", {
        bezahlt: demo ? "demo" : "ja",
        abschnitte: String(plan?.abschnitte ?? 1),
      });
    } catch (e) {
      setPaketStand("fehler");
      setFehler(e instanceof Error ? e.message : "Unbekannter Fehler.");
      // Ein Fehler HIER ist der teuerste Fall: Es wurde bezahlt und es kommt
      // nichts an. Der Server meldet ihn ohnehin als kritisch; die Zählung
      // zeigt, ob es ein Einzelfall ist oder ein Muster.
      ereignis("paket_fehler", {});
    }
  }, [anfrage, demo, plan]);

  /** Ein einzelnes Blatt */
  const blattHolen = useCallback(
    async (b: Blatt) => {
      setEinzel((s) => ({ ...s, [b.name]: "laeuft" }));
      setFehler(null);
      try {
        const antwort = await anfrage({ typ: b.typ, abschnitt: b.abschnitt ?? 0 });
        if (!antwort.ok) {
          const daten = await antwort.json().catch(() => ({}));
          throw new Error(daten.fehler ?? "Download fehlgeschlagen.");
        }
        ablegen(await antwort.blob(), b.name);
        setEinzel((s) => ({ ...s, [b.name]: "fertig" }));
        ereignis("dokument_geladen", { typ: b.typ, bezahlt: demo ? "demo" : "ja" });
      } catch (e) {
        setEinzel((s) => ({ ...s, [b.name]: "fehler" }));
        setFehler(e instanceof Error ? e.message : "Unbekannter Fehler.");
        ereignis("dokument_fehler", { typ: b.typ });
      }
    },
    [anfrage, demo]
  );

  /**
   * Automatischer Start, sobald die Dateiliste da ist.
   *
   * Die Sperre sitzt bewusst IM Zeitgeber und nicht davor: React ruft Effekte
   * in der Entwicklung doppelt auf (einmal samt Aufräumen). Stünde die Sperre
   * vor dem setTimeout, würde der erste Durchlauf den Zeitgeber setzen, das
   * Aufräumen ihn löschen und der zweite Durchlauf an der Sperre abprallen –
   * der Download startete nie.
   */
  useEffect(() => {
    if (!gueltig || !plan) return;
    const t = setTimeout(() => {
      if (automatikGelaufen.current) return;
      automatikGelaufen.current = true;
      void paketHolen();
    }, 400);
    return () => clearTimeout(t);
  }, [gueltig, plan, paketHolen]);

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

  const anzahl = plan?.dokumente.length ?? 0;
  const mehrere = (plan?.abschnitte ?? 1) > 1;

  return (
    <main className="mitte panel">
      <h2>{demo ? "Demo-Modus: Dokumente testen" : "Vielen Dank für Ihre Zahlung!"}</h2>
      <p>
        {demo
          ? "Stripe ist noch nicht konfiguriert – die Dokumente werden ohne Zahlung erzeugt (nur lokal zum Testen)."
          : "Ihre Unterlagen sind freigeschaltet und werden gerade heruntergeladen. Denselben Link haben wir Ihnen zusätzlich per E-Mail geschickt – er bleibt dauerhaft gültig."}
      </p>

      {/* Fortschritt des automatischen Downloads */}
      <div className={`ladestand${paketStand === "fertig" ? " fertig" : ""}`}>
        <strong>
          {paketStand === "laeuft"
            ? mehrere
              ? `Paket wird erzeugt … (${anzahl} Blätter aus ${plan?.abschnitte} Abschnitten)`
              : "Paket wird erzeugt …"
            : paketStand === "fertig"
              ? `Alle Unterlagen wurden als ZIP-Datei heruntergeladen${
                  plan ? ` (${plan.paketname})` : ""
                }.`
              : paketStand === "fehler"
                ? "Der Download ist fehlgeschlagen."
                : plan
                  ? "Der Download startet in einem Moment …"
                  : "Unterlagen werden freigeschaltet …"}
        </strong>
        {plan && (
          <p className="hinweis" style={{ marginTop: 6 }}>
            {mehrere
              ? `${plan.abschnitte} Abschnitte · je Abschnitt Bauplan, Biegeliste und Stückliste, dazu eine Gesamt-Stückliste über alle Abschnitte – zusammen ${anzahl} Blätter in einer ZIP-Datei.`
              : "Bauplan, Biegeliste und Stückliste in einer ZIP-Datei."}
          </p>
        )}
        <button
          className="knopf primaer"
          onClick={() => void paketHolen()}
          disabled={paketStand === "laeuft" || !plan}
        >
          {paketStand === "fertig"
            ? "ZIP-Datei erneut herunterladen"
            : paketStand === "laeuft"
              ? "erzeuge Dokumente …"
              : "ZIP-Datei herunterladen"}
        </button>
        <div className="hinweis" style={{ marginTop: 8 }}>
          Die ZIP-Datei lässt sich auf Windows, macOS, iPhone und Android ohne
          Zusatzprogramm öffnen. Blockiert Ihr Browser den Download, holen Sie
          ihn über den Knopf oben – oder laden Sie die Blätter einzeln.
        </div>
      </div>

      {fehler && <div className="warnbox">{fehler}</div>}

      <h3 className="gruppe-titel" style={{ marginTop: 22 }}>
        Einzeln herunterladen
      </h3>
      {!plan && <p className="hinweis">wird geladen …</p>}
      <div className="download-reihe">
        {plan?.dokumente.map((b) => {
          const s = einzel[b.name] ?? "offen";
          return (
            <button
              key={b.name}
              className="knopf"
              onClick={() => void blattHolen(b)}
              disabled={s === "laeuft"}
            >
              <span>
                <strong>{b.titel}</strong>
                <br />
                <span style={{ fontWeight: 400, fontSize: 12.5, color: "#5a6472" }}>
                  {ERKLAERUNG[b.typ]}
                </span>
              </span>
              <span>
                {s === "laeuft"
                  ? "erzeuge PDF …"
                  : s === "fertig"
                    ? "✓ geladen"
                    : s === "fehler"
                      ? "✗ nochmal"
                      : "⬇ PDF"}
              </span>
            </button>
          );
        })}
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
