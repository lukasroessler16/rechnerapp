"use client";

/**
 * Wizard-Hauptkomponente: Schrittsteuerung + Live-Skizze.
 *
 * Der gesamte Eingabezustand liegt in einem einzigen Projekt-Objekt und
 * wird zusätzlich in sessionStorage gespiegelt, damit die Eingaben einen
 * Seitenwechsel (z. B. Umweg über Stripe) überleben. Keine Server-Sitzung,
 * keine Datenbank – jeder Aufruf ist eigenständig.
 */

import { useEffect, useState } from "react";
import { Projekt } from "@/lib/types";
import { neuesProjekt } from "@/lib/standardwerte";
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

  // Zustand aus sessionStorage wiederherstellen (nur im Browser)
  useEffect(() => {
    try {
      const roh = sessionStorage.getItem("bewehrung_projekt");
      if (roh) setProjekt({ ...neuesProjekt(), ...JSON.parse(roh) });
    } catch {
      /* defekte Daten ignorieren */
    }
    setGeladen(true);
  }, []);

  // Zustand fortlaufend sichern
  useEffect(() => {
    if (geladen) sessionStorage.setItem("bewehrung_projekt", JSON.stringify(projekt));
  }, [projekt, geladen]);

  const set: Setzer = (fn) => setProjekt(fn);

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
              className={i === schritt ? "aktiv" : i < schritt ? "erledigt" : ""}
              onClick={() => setSchritt(i)}
            >
              {i + 1} {name}
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
