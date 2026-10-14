"use client";

/**
 * Schritt 7: Ergebnis-Vorschau mit Paywall.
 *
 * Kennwerte, Gesamtgewicht und Hinweise sind kostenlos sichtbar.
 * Die detaillierte Positionsliste ist unscharf gestellt; die PDF-Dokumente
 * (Bauplan, Biegeliste, Stückliste) werden erst nach der Einmalzahlung
 * über Stripe Checkout freigeschaltet.
 */

import { Fragment, useMemo, useState } from "react";
import { nachGruppen } from "@/lib/gruppen";
import AbschnittSVG from "./AbschnittSVG";
import { useRouter } from "next/navigation";
import { ereignis } from "@/lib/statistik";
import { Projekt } from "@/lib/types";
import { berechneBewehrung } from "@/lib/bewehrung";
import { hatFehler, pruefeProjekt } from "@/lib/validierung";

const PREIS = process.env.NEXT_PUBLIC_PREIS_EUR ?? "29";

/** Gesamtpreis: je Abschnitt ein vollständiger Plan, also auch ein Preis */
function gesamtpreis(abschnitte: number): string {
  const einzeln = Number(PREIS);
  if (!isFinite(einzeln)) return PREIS;
  return (einzeln * abschnitte).toLocaleString("de-AT");
}

/** Klartext der Biegeformen in der Positionstabelle */
const FORM_KURZ: Record<string, string> = {
  gerade: "gerade",
  winkel: "Winkel (L)",
  buegel_u: "Steckbügel (U)",
  buegel_rechteck: "Rechteckbügel",
  schraegstab: "Schrägstab",
};

export default function Vorschau({
  abschnitte,
  aktiv,
  aufAbschnitt,
  nr,
}: {
  /** alle Abschnitte des Bauvorhabens – meistens genau einer */
  abschnitte: Projekt[];
  /** welcher Abschnitt im Detail gezeigt wird */
  aktiv: number;
  /** Abschnitt wechseln */
  aufAbschnitt: (i: number) => void;
  /** Nummer in der bauteilabhängigen Schrittfolge */
  nr: number;
}) {
  const projekt = abschnitte[Math.min(aktiv, abschnitte.length - 1)];
  const mehrere = abschnitte.length > 1;

  /** Ergebnis je Abschnitt – auch für die Summen über das ganze Bauvorhaben */
  const alle = useMemo(
    () => abschnitte.map((p) => ({ projekt: p, ergebnis: berechneBewehrung(p) })),
    [abschnitte]
  );
  const ergebnis = alle[Math.min(aktiv, alle.length - 1)].ergebnis;

  /** Summen über alle Abschnitte – das ist, was bestellt wird */
  const summe = useMemo(() => {
    const stahl = alle.reduce((a, x) => a + x.ergebnis.gesamtgewicht, 0);
    const beton = alle.reduce((a, x) => a + x.ergebnis.beton.volumen, 0);
    const bestell = alle.reduce((a, x) => a + x.ergebnis.beton.bestellmenge, 0);
    return {
      stahl: Math.round(stahl * 10) / 10,
      beton: Math.round(beton * 100) / 100,
      bestellmenge: Math.round(bestell * 10) / 10,
    };
  }, [alle]);

  // Eingabefehler blockieren die Zahlung – niemand soll für ein
  // geometrisch unmögliches Bauteil bezahlen. Geprüft werden ALLE Abschnitte:
  // Es wäre fatal, für vier Pläne zu zahlen, von denen einer unmöglich ist.
  const pruefungen = useMemo(() => abschnitte.map(pruefeProjekt), [abschnitte]);
  const pruefung = pruefungen[Math.min(aktiv, pruefungen.length - 1)];
  const eingabeFehler = pruefung.filter((m) => m.schwere === "fehler");
  const eingabeWarnungen = pruefung.filter((m) => m.schwere === "warnung");
  /** Abschnitte mit blockierenden Fehlern – 1-basiert für die Anzeige */
  const fehlerhafteAbschnitte = pruefungen
    .map((pr, i) => (hatFehler(pr) ? i + 1 : 0))
    .filter((n) => n > 0);
  const gesperrt = fehlerhafteAbschnitte.length > 0;
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const router = useRouter();
  /** Zustimmung zur sofortigen Bereitstellung (Rücktrittsverzicht, FAGG) */
  const [verzicht, setVerzicht] = useState(false);

  /** Checkout starten: Projekt an den Server, weiter zu Stripe */
  const bezahlen = async () => {
    setLaedt(true);
    setFehler(null);
    // Nur Bauteil und Regelwerk – keine Maße, keine Firmendaten.
    ereignis("checkout_gestartet", {
      bauteil: projekt.bauteil,
      regelwerk: projekt.parameter.regelwerk,
      abschnitte: String(abschnitte.length),
    });
    try {
      // Projekt für die Erfolgsseite sichern (Stripe leitet zurück).
      // Zusätzlich dauerhaft (localStorage): so erscheint das Logo auch dann
      // wieder, wenn der Kunde später über den E-Mail-Link zurückkommt.
      sessionStorage.setItem("bewehrung_projekt", JSON.stringify(abschnitte));
      localStorage.setItem("bewehrung_firmendaten", JSON.stringify(projekt.firmendaten));
      const antwort = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projekt: abschnitte, verzichtBestaetigt: verzicht }),
      });
      const daten = await antwort.json();
      if (!antwort.ok) throw new Error(daten.fehler ?? "Checkout fehlgeschlagen.");
      if (daten.demo) {
        // Demo-Modus ohne Stripe-Schlüssel: direkt zur Erfolgsseite
        router.push("/erfolg?demo=1");
        return;
      }
      // Stripe liegt außerhalb der App – hier ist ein echter Seitenwechsel
      // richtig, der Router kann das nicht.
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
      <h2 className="schritt-titel">{nr} · Ergebnis &amp; Freischaltung</h2>
      <p className="schritt-hilfe">
        {mehrere
          ? `Zusammenfassung über ${abschnitte.length} Abschnitte. Je Abschnitt erhalten Sie Bauplan, Biegeliste und Stückliste, dazu eine Gesamt-Stückliste zum Bestellen.`
          : "Zusammenfassung der Bewehrungsermittlung. Die vollständigen Dokumente (Bauplan, Biegeliste, Stückliste als PDF) erhalten Sie nach der Zahlung."}
      </p>

      {mehrere && (
        <section className="gruppe">
          <h3 className="gruppe-titel">Das ganze Bauvorhaben</h3>
          <AbschnittSVG
            laengen={abschnitte.map((p) => p.masse.laenge ?? 0)}
            aktiv={aktiv}
            onWechsel={aufAbschnitt}
          />
          <div className="kennwert-gitter" style={{ marginTop: 12 }}>
            <div className="kennwert">
              <div className="kw-wert">{summe.stahl.toLocaleString("de-AT")} kg</div>
              <div className="kw-name">Baustahl über alle Abschnitte</div>
            </div>
            <div className="kennwert">
              <div className="kw-wert">{summe.beton.toLocaleString("de-AT")} m³</div>
              <div className="kw-name">
                Beton netto · Bestellmenge {summe.bestellmenge.toLocaleString("de-AT")} m³
              </div>
            </div>
            <div className="kennwert">
              <div className="kw-wert">{abschnitte.length}</div>
              <div className="kw-name">Abschnitte à {PREIS} €</div>
            </div>
          </div>
          <table className="abschnitt-tabelle">
            <thead>
              <tr>
                <th>Abschnitt</th>
                <th>Länge</th>
                <th>Öffnungen</th>
                <th className="zahl">Stahl</th>
                <th className="zahl">Beton</th>
              </tr>
            </thead>
            <tbody>
              {alle.map((x, i) => (
                <tr
                  key={i}
                  className={i === aktiv ? "aktiv" : undefined}
                  onClick={() => aufAbschnitt(i)}
                >
                  <td>{i + 1}</td>
                  <td>{(x.projekt.masse.laenge ?? 0).toLocaleString("de-AT")} m</td>
                  <td>{x.projekt.oeffnungen.length}</td>
                  <td className="zahl">{x.ergebnis.gesamtgewicht.toLocaleString("de-AT")} kg</td>
                  <td className="zahl">{x.ergebnis.beton.volumen.toLocaleString("de-AT")} m³</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hinweis" style={{ marginTop: 8 }}>
            Die Kennzahlen darunter gelten für Abschnitt {aktiv + 1}. Zum Wechseln
            eine Zeile oder einen Abschnitt in der Grafik anklicken.
          </p>
        </section>
      )}

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
        <div className="kennwert">
          <div className="kw-wert">
            {ergebnis.beton.volumen.toLocaleString("de-AT")} m³
          </div>
          <div className="kw-name">
            Beton netto · Bestellmenge {ergebnis.beton.bestellmenge.toLocaleString("de-AT")} m³
          </div>
        </div>
        <div className="kennwert">
          <div className="kw-wert">{ergebnis.beton.gewicht.toLocaleString("de-AT")} t</div>
          <div className="kw-name">
            Eigengewicht · {ergebnis.beton.bewehrungsgrad} kg Stahl je m³
          </div>
        </div>
      </div>

      {mehrere && fehlerhafteAbschnitte.length > 0 && (
        <div className="fehlerbox">
          <strong>
            Zahlung gesperrt: Fehler in{" "}
            {fehlerhafteAbschnitte.length === 1
              ? `Abschnitt ${fehlerhafteAbschnitte[0]}`
              : `den Abschnitten ${fehlerhafteAbschnitte.join(", ")}`}
            .
          </strong>
          <div style={{ marginTop: 6, fontSize: 12.5 }}>
            Bitte dort nachsehen – bezahlt wird für alle Abschnitte gemeinsam,
            also muss auch jeder einzelne stimmen.
          </div>
        </div>
      )}

      {eingabeFehler.length > 0 && (
        <div className="fehlerbox">
          <strong>
            {mehrere ? `Abschnitt ${aktiv + 1}: ` : ""}Eingaben korrigieren – die
            Zahlung ist bis dahin gesperrt:
          </strong>
          <ul>
            {eingabeFehler.map((m, i) => (
              <li key={i}>{m.text}</li>
            ))}
          </ul>
          <div style={{ marginTop: 6, fontSize: 12.5 }}>
            Die betroffenen Schritte sind in der Leiste oben mit „!“ markiert.
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
              {/* nach Gruppen gegliedert wie in der Stückliste */}
              {nachGruppen(ergebnis.positionen).map((g) => (
                <Fragment key={g.name}>
                  <tr className="gruppenzeile">
                    <td colSpan={5}>{g.name}</td>
                    <td className="zahl">{g.gewicht.toFixed(1)}</td>
                    <td>{g.anteil} %</td>
                  </tr>
                  {g.positionen.map((p) => (
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
                </Fragment>
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
            {laedt
              ? "Weiterleitung zu Stripe …"
              : mehrere
                ? `Jetzt freischalten – ${gesamtpreis(abschnitte.length)} € für ${abschnitte.length} Abschnitte`
                : `Jetzt freischalten – ${PREIS} € (einmalig)`}
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
