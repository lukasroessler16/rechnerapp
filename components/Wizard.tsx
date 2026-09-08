"use client";

/**
 * Wizard-Hauptkomponente: Schrittsteuerung + Live-Skizze.
 *
 * Der gesamte Eingabezustand liegt in einem einzigen Projekt-Objekt und
 * wird zusätzlich in sessionStorage gespiegelt, damit die Eingaben einen
 * Seitenwechsel (z. B. Umweg über Stripe) überleben. Keine Server-Sitzung,
 * keine Datenbank – jeder Aufruf ist eigenständig.
 */

import { useEffect, useMemo, useState } from "react";
import { Projekt } from "@/lib/types";
import { bauteilModul } from "@/lib/bauteile";
import { neuesProjekt, normalisiereProjekt } from "@/lib/standardwerte";
import { pruefeProjekt, schrittZuMeldung } from "@/lib/validierung";
import SkizzeSVG from "./SkizzeSVG";
import {
  Step1Bauteil,
  Step2Masse,
  Step3Oeffnungen,
  Step4Anschluesse,
  Step5Parameter,
  Step6Firmendaten,
  Setzer,
} from "./steps";
import Vorschau from "./Vorschau";

/**
 * Schrittfolge. Der Öffnungsschritt entfällt bei Bauteilen ohne Öffnungen
 * (Bodenplatte, Stütze …) – deshalb wird die Leiste je Bauteil aufgebaut
 * und die Schritte werden über ihren Schlüssel und nicht über eine feste
 * Nummer angesprochen.
 */
type SchrittSchluessel =
  | "bauteil"
  | "masse"
  | "oeffnungen"
  | "details"
  | "parameter"
  | "firmendaten"
  | "ergebnis";

const TITEL: Record<SchrittSchluessel, string> = {
  bauteil: "Bauteil",
  masse: "Maße",
  oeffnungen: "Öffnungen",
  details: "Anschlüsse",
  parameter: "Parameter",
  firmendaten: "Firmendaten",
  ergebnis: "Ergebnis",
};

export default function Wizard() {
  const [projekt, setProjekt] = useState<Projekt>(neuesProjekt);
  const [schritt, setSchritt] = useState(0);
  const [geladen, setGeladen] = useState(false);

  // Zustand wiederherstellen (nur im Browser)
  useEffect(() => {
    try {
      const roh = sessionStorage.getItem("bewehrung_projekt");
      if (roh) {
        // normalisieren: Projekte aus älteren Versionen können andere
        // Maß- und Detailschlüssel haben
        setProjekt(normalisiereProjekt(JSON.parse(roh)));
      } else {
        // Neuer Aufruf: Firmendaten und Logo aus einem früheren Durchlauf
        // übernehmen – Baumeister rechnen meist mehrere Bauteile nacheinander
        // und müssen ihr Logo dann nicht jedes Mal neu hochladen.
        const gesichert = localStorage.getItem("bewehrung_firmendaten");
        if (gesichert) {
          const fd = JSON.parse(gesichert);
          setProjekt((p) => ({
            ...p,
            // Datum bewusst nicht übernehmen: das soll immer aktuell sein
            firmendaten: { ...p.firmendaten, ...fd, datum: p.firmendaten.datum },
          }));
        }
      }
    } catch {
      /* defekte Daten ignorieren */
    }
    setGeladen(true);
  }, []);

  // Zustand fortlaufend sichern: Geometrie nur für diese Sitzung,
  // Firmendaten dauerhaft (überdauern das Schließen des Tabs)
  useEffect(() => {
    if (!geladen) return;
    try {
      sessionStorage.setItem("bewehrung_projekt", JSON.stringify(projekt));
      localStorage.setItem(
        "bewehrung_firmendaten",
        JSON.stringify(projekt.firmendaten)
      );
    } catch {
      /* Speicher voll oder gesperrt – Eingaben bleiben trotzdem nutzbar */
    }
  }, [projekt, geladen]);

  const set: Setzer = (fn) => setProjekt(fn);

  const modul = bauteilModul(projekt.bauteil);

  // Schrittfolge des aktuellen Bauteils
  const schluessel: SchrittSchluessel[] = [
    "bauteil",
    "masse",
    ...(modul.hatOeffnungen ? (["oeffnungen"] as SchrittSchluessel[]) : []),
    "details",
    "parameter",
    "firmendaten",
    "ergebnis",
  ];

  // Wechselt das Bauteil auf eines ohne Öffnungen, darf der Zeiger nicht
  // hinter das Ende der (nun kürzeren) Schrittfolge zeigen.
  const aktiv = Math.min(schritt, schluessel.length - 1);

  // Schritte mit blockierenden Fehlern in der Leiste rot markieren
  const fehlerSchritte = useMemo(() => {
    const menge = new Set<SchrittSchluessel>();
    for (const m of pruefeProjekt(projekt))
      if (m.schwere === "fehler") menge.add(schrittZuMeldung(m));
    return menge;
  }, [projekt]);

  // Schrittnummer für die Überschrift: hängt davon ab, ob der
  // Öffnungsschritt in der Folge enthalten ist
  const nr = (k: SchrittSchluessel) => schluessel.indexOf(k) + 1;

  const inhalt: Record<SchrittSchluessel, React.ReactNode> = {
    bauteil: <Step1Bauteil projekt={projekt} set={set} nr={nr("bauteil")} />,
    masse: <Step2Masse projekt={projekt} set={set} nr={nr("masse")} />,
    oeffnungen: <Step3Oeffnungen projekt={projekt} set={set} nr={nr("oeffnungen")} />,
    details: <Step4Anschluesse projekt={projekt} set={set} nr={nr("details")} />,
    parameter: <Step5Parameter projekt={projekt} set={set} nr={nr("parameter")} />,
    firmendaten: <Step6Firmendaten projekt={projekt} set={set} nr={nr("firmendaten")} />,
    ergebnis: <Vorschau projekt={projekt} />,
  };

  return (
    <main className="buehne">
      <section className="panel">
        <ol className="schritte">
          {schluessel.map((k, i) => {
            const fehlerhaft = fehlerSchritte.has(k as SchrittSchluessel);
            return (
              <li
                key={k}
                className={[
                  i === aktiv ? "aktiv" : i < aktiv ? "erledigt" : "",
                  fehlerhaft ? "fehlerhaft" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setSchritt(i)}
                title={fehlerhaft ? "Dieser Schritt enthält Fehler" : undefined}
              >
                {i + 1} {TITEL[k]}
                {fehlerhaft && " !"}
              </li>
            );
          })}
        </ol>

        {inhalt[schluessel[aktiv]]}

        <div className="knopfleiste">
          <button
            className="knopf"
            onClick={() => setSchritt(Math.max(0, aktiv - 1))}
            disabled={aktiv === 0}
          >
            ← Zurück
          </button>
          {aktiv < schluessel.length - 1 && (
            <button className="knopf primaer" onClick={() => setSchritt(aktiv + 1)}>
              Weiter →
            </button>
          )}
        </div>
      </section>

      <aside className="panel skizze-panel">
        <h3>Live-Skizze (maßstäblich)</h3>
        {geladen && <SkizzeSVG projekt={projekt} />}
      </aside>
    </main>
  );
}
