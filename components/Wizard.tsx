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
import { neuesProjekt } from "@/lib/standardwerte";
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

const SCHRITTE = [
  "Bauteil",
  "Maße",
  "Öffnungen",
  "Anschlüsse",
  "Parameter",
  "Firmendaten",
  "Ergebnis",
];

export default function Wizard() {
  const [projekt, setProjekt] = useState<Projekt>(neuesProjekt);
  const [schritt, setSchritt] = useState(0);
  const [geladen, setGeladen] = useState(false);

  // Zustand wiederherstellen (nur im Browser)
  useEffect(() => {
    try {
      const roh = sessionStorage.getItem("bewehrung_projekt");
      if (roh) {
        setProjekt({ ...neuesProjekt(), ...JSON.parse(roh) });
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

  // Schritte mit blockierenden Fehlern in der Leiste rot markieren
  const fehlerSchritte = useMemo(() => {
    const menge = new Set<number>();
    for (const m of pruefeProjekt(projekt))
      if (m.schwere === "fehler") menge.add(schrittZuMeldung(m));
    return menge;
  }, [projekt]);

  const inhalte = [
    <Step1Bauteil key="1" projekt={projekt} set={set} />,
    <Step2Masse key="2" projekt={projekt} set={set} />,
    <Step3Oeffnungen key="3" projekt={projekt} set={set} />,
    <Step4Anschluesse key="4" projekt={projekt} set={set} />,
    <Step5Parameter key="5" projekt={projekt} set={set} />,
    <Step6Firmendaten key="6" projekt={projekt} set={set} />,
    <Vorschau key="7" projekt={projekt} />,
  ];

  return (
    <main className="buehne">
      <section className="panel">
        <ol className="schritte">
          {SCHRITTE.map((name, i) => (
            <li
              key={name}
              className={[
                i === schritt ? "aktiv" : i < schritt ? "erledigt" : "",
                fehlerSchritte.has(i) ? "fehlerhaft" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setSchritt(i)}
              title={fehlerSchritte.has(i) ? "Dieser Schritt enthält Fehler" : undefined}
            >
              {i + 1} {name}
              {fehlerSchritte.has(i) && " !"}
            </li>
          ))}
        </ol>

        {inhalte[schritt]}

        <div className="knopfleiste">
          <button
            className="knopf"
            onClick={() => setSchritt((s) => Math.max(0, s - 1))}
            disabled={schritt === 0}
          >
            ← Zurück
          </button>
          {schritt < SCHRITTE.length - 1 && (
            <button className="knopf primaer" onClick={() => setSchritt((s) => s + 1)}>
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
