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
import { hatFehler, pruefeProjekt } from "@/lib/validierung";

const PREIS = process.env.NEXT_PUBLIC_PREIS_EUR ?? "29";

/** Klartext der Biegeformen in der Positionstabelle */
const FORM_KURZ: Record<string, string> = {
  gerade: "gerade",
  winkel: "Winkel (L)",
  buegel_u: "Steckbügel (U)",
  buegel_rechteck: "Rechteckbügel",
  schraegstab: "Schrägstab",
};

export default function Vorschau({ projekt }: { projekt: Projekt }) {
  const ergebnis = useMemo(() => berechneBewehrung(projekt), [projekt]);
  // Eingabefehler blockieren die Zahlung – niemand soll für ein
  // geometrisch unmögliches Bauteil bezahlen.
  const pruefung = useMemo(() => pruefeProjekt(projekt), [projekt]);
  const eingabeFehler = pruefung.filter((m) => m.schwere === "fehler");
  const eingabeWarnungen = pruefung.filter((m) => m.schwere === "warnung");
  const gesperrt = hatFehler(pruefung);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  /** Zustimmung zur sofortigen Bereitstellung (Rücktrittsverzicht, FAGG) */
  const [verzicht, setVerzicht] = useState(false);

  /** Checkout starten: Projekt an den Server, weiter zu Stripe */
  const bezahlen = async () => {
    setLaedt(true);
    setFehler(null);
    try {
      // Projekt für die Erfolgsseite sichern (Stripe leitet zurück).
      // Zusätzlich dauerhaft (localStorage): so erscheint das Logo auch dann
      // wieder, wenn der Kunde später über den E-Mail-Link zurückkommt.
      sessionStorage.setItem("bewehrung_projekt", JSON.stringify(projekt));
      localStorage.setItem("bewehrung_firmendaten", JSON.stringify(projekt.firmendaten));
      const antwort = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projekt, verzichtBestaetigt: verzicht }),
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
          <div className="kw-name">
            {k.wahlLabel} ({k.asVorhanden} {k.hauptEinheit})
          </div>
        </div>
        <div className="kennwert">
          <div className="kw-wert">{ergebnis.positionen.length}</div>
          <div className="kw-name">Positionen</div>
        </div>
        <div className="kennwert">
          <div className="kw-wert">
            {k.asMinHaupt.toLocaleString("de-AT")} {k.hauptEinheit}
          </div>
          <div className="kw-name">{k.hauptLabel}</div>
        </div>
        <div className="kennwert">
          <div className="kw-wert">{k.cnom} mm</div>
          <div className="kw-name">Betondeckung c_nom</div>
        </div>
        <div className="kennwert">
          <div className="kw-wert">{k.flaecheNetto.toLocaleString("de-AT")} m²</div>
          <div className="kw-name">{k.flaecheLabel}</div>
        </div>
      </div>

      {eingabeFehler.length > 0 && (
        <div className="fehlerbox">
          <strong>Eingaben korrigieren – die Zahlung ist bis dahin gesperrt:</strong>
          <ul>
            {eingabeFehler.map((m, i) => (
              <li key={i}>{m.text}</li>
            ))}
          </ul>
          <div style={{ marginTop: 6, fontSize: 12.5 }}>
            Die betroffenen Schritte sind in der Leiste oben mit „!" markiert.
          </div>
        </div>
      )}

      {eingabeWarnungen.length > 0 && (
        <div className="warnbox">
          <strong>Bautechnisch heikel:</strong>
          <ul>
            {eingabeWarnungen.map((m, i) => (
              <li key={i}>{m.text}</li>
            ))}
          </ul>
        </div>
      )}

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
                  <td>{p.form ? FORM_KURZ[p.form] ?? p.form : "Matte"}</td>
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
          {/* Rücktrittsverzicht: gesetzlich erforderliche, aktive Zustimmung
              vor dem Kauf digitaler Inhalte, die sofort bereitgestellt werden */}
          <label className="zustimmung">
            <input
              type="checkbox"
              checked={verzicht}
              onChange={(e) => setVerzicht(e.target.checked)}
            />
            <span>
              Ich verlange ausdrücklich, dass die Dokumente sofort nach der Zahlung
              bereitgestellt werden, und nehme zur Kenntnis, dass ich damit mein
              Rücktrittsrecht verliere.
            </span>
          </label>

          <button
            className="knopf primaer"
            onClick={bezahlen}
            disabled={laedt || !verzicht || gesperrt}
            title={
              gesperrt
                ? "Bitte zuerst die Eingabefehler beheben"
                : !verzicht
                  ? "Bitte zuerst die Zustimmung oben bestätigen"
                  : undefined
            }
          >
            {laedt ? "Weiterleitung zu Stripe …" : `Jetzt freischalten – ${PREIS} € (einmalig)`}
          </button>
          <div style={{ fontSize: 12, color: "#5a6472" }}>
            Sichere Zahlung über Stripe · Karte, Apple&nbsp;Pay, EPS · keine Registrierung
            <br />
            Die Dokumente erhalten Sie zusätzlich per E-Mail.
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
