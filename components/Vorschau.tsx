"use client";

/**
 * Schritt 7: Ergebnis-Vorschau mit Paywall.
 *
 * Kennwerte, Gesamtgewicht und Hinweise sind kostenlos sichtbar.
 * Die detaillierte Positionsliste ist unscharf gestellt; die PDF-Dokumente
 * (Bauplan, Biegeliste, Stückliste) werden erst nach der Einmalzahlung
 * über Stripe Checkout freigeschaltet.
 */

import { useMemo, useState } from "react";
import { Projekt } from "@/lib/types";
import { berechneBewehrung } from "@/lib/bewehrung";

const PREIS = process.env.NEXT_PUBLIC_PREIS_EUR ?? "29";

export default function Vorschau({ projekt }: { projekt: Projekt }) {
  const ergebnis = useMemo(() => berechneBewehrung(projekt), [projekt]);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  /** Checkout starten: Projekt an den Server, weiter zu Stripe */
  const bezahlen = async () => {
    setLaedt(true);
    setFehler(null);
    try {
      // Logo + Firmendaten für die Erfolgsseite sichern (Stripe leitet zurück)
      sessionStorage.setItem("bewehrung_projekt", JSON.stringify(projekt));
      const antwort = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projekt }),
      });
      const daten = await antwort.json();
      if (!antwort.ok) throw new Error(daten.fehler ?? "Checkout fehlgeschlagen.");
      if (daten.demo) {
        // Demo-Modus ohne Stripe-Schlüssel: direkt zur Erfolgsseite
        window.location.href = "/erfolg?demo=1";
        return;
      }
      window.location.href = daten.url;
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Unbekannter Fehler.");
      setLaedt(false);
    }
  };

  const k = ergebnis.kennwerte;
  const warnungen = ergebnis.hinweise.filter((h) => h.startsWith("⚠"));
  const infos = ergebnis.hinweise.filter((h) => !h.startsWith("⚠"));

  return (
    <>
      <h2 className="schritt-titel">7 · Ergebnis &amp; Freischaltung</h2>
      <p className="schritt-hilfe">
        Zusammenfassung der Bewehrungsermittlung. Die vollständigen Dokumente
        (Bauplan, Biegeliste, Stückliste als PDF) erhalten Sie nach der Zahlung.
      </p>

      <div className="kennwert-gitter">
        <div className="kennwert">
          <div className="kw-wert">{ergebnis.gesamtgewicht.toLocaleString("de-AT")} kg</div>
          <div className="kw-name">Baustahl gesamt</div>
        </div>
        <div className="kennwert">
          <div className="kw-wert">{k.gewaehlteMatte}</div>
          <div className="kw-name">Lagermatte ({k.asVorhanden} cm²/m)</div>
        </div>
        <div className="kennwert">
          <div className="kw-wert">{ergebnis.positionen.length}</div>
          <div className="kw-name">Positionen</div>
        </div>
        <div className="kennwert">
          <div className="kw-wert">{k.asMinHaupt.toLocaleString("de-AT")} cm²/m</div>
          <div className="kw-name">As,min Haupt (je Lage)</div>
        </div>
        <div className="kennwert">
          <div className="kw-wert">{k.cnom} mm</div>
          <div className="kw-name">Betondeckung c_nom</div>
        </div>
        <div className="kennwert">
          <div className="kw-wert">{k.flaecheNetto.toLocaleString("de-AT")} m²</div>
          <div className="kw-name">Bewehrungsfläche netto</div>
        </div>
      </div>

      {warnungen.length > 0 && (
        <div className="warnbox">
          <strong>Statisch zu prüfen:</strong>
          <ul>
            {warnungen.map((w, i) => (
              <li key={i}>{w.replace("⚠ ", "")}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="gesperrt">
        <div className="verwischt">
          <table className="positionsliste">
            <thead>
              <tr>
                <th>Pos.</th>
                <th>Art</th>
                <th>Form</th>
                <th className="zahl">L [m]</th>
                <th className="zahl">Stk.</th>
                <th className="zahl">kg</th>
                <th>Verwendung</th>
              </tr>
            </thead>
            <tbody>
              {ergebnis.positionen.map((p) => (
                <tr key={p.pos}>
                  <td>{p.pos}</td>
                  <td>{p.bezeichnung}</td>
                  <td>{p.form ?? "Matte"}</td>
                  <td className="zahl">{p.laenge.toFixed(2)}</td>
                  <td className="zahl">{p.stueck}</td>
                  <td className="zahl">{p.gewichtGesamt.toFixed(1)}</td>
                  <td>{p.verwendung}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="schloss">
          <div style={{ fontSize: 28 }}>🔒</div>
          <div>
            <strong>Positionsliste, Bauplan, Biegeliste &amp; Stückliste (PDF)</strong>
            <br />
            werden nach der Einmalzahlung freigeschaltet.
          </div>
          <button className="knopf primaer" onClick={bezahlen} disabled={laedt}>
            {laedt ? "Weiterleitung zu Stripe …" : `Jetzt freischalten – ${PREIS} € (einmalig)`}
          </button>
          <div style={{ fontSize: 12, color: "#5a6472" }}>
            Sichere Zahlung über Stripe · Karte, Apple&nbsp;Pay, EPS · keine Registrierung
          </div>
          {fehler && <div className="warnbox">{fehler}</div>}
        </div>
      </div>

      <div className="haftung">
        <strong>Wichtig:</strong> {infos.join(" ")}
      </div>
    </>
  );
}
