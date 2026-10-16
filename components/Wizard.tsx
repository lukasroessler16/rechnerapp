"use client";

/**
 * Wizard-Hauptkomponente: Schrittsteuerung + Live-Skizze.
 *
 * Der gesamte Eingabezustand liegt in einem einzigen Projekt-Objekt und
 * wird zusätzlich in sessionStorage gespiegelt, damit die Eingaben einen
 * Seitenwechsel (z. B. Umweg über Stripe) überleben. Keine Server-Sitzung,
 * keine Datenbank – jeder Aufruf ist eigenständig.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Projekt } from "@/lib/types";
import { bauteilModul } from "@/lib/bauteile";
import { neuesProjekt, normalisiereProjekt } from "@/lib/standardwerte";
import { pruefeProjekt, schrittZuMeldung } from "@/lib/validierung";
import { ereignis } from "@/lib/statistik";
import {
  MAX_ABSCHNITTE,
  gemeinsameMasse,
  gesperrteDetails,
  teilbar,
  vereinheitliche,
} from "@/lib/abschnitte";
import SkizzeSVG from "./SkizzeSVG";
import AbschnittSVG from "./AbschnittSVG";
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
  /*
   * Der Zustand ist eine LISTE von Abschnitten, auch wenn es meistens genau
   * einer ist. Eine lange Wand wird in Betonierabschnitte geteilt; jeder ist
   * ein eigener Plan mit eigenen Maßen, Öffnungen und Rändern. Bauteil,
   * bautechnische Vorgaben und Firmendaten gelten dagegen für alle gemeinsam
   * und werden beim Ändern auf alle Abschnitte gezogen (siehe set()).
   */
  const [abschnitte, setAbschnitte] = useState<Projekt[]>(() => [neuesProjekt()]);
  const [aktiv, setAktiv] = useState(0);
  const [schritt, setSchritt] = useState(0);
  const [geladen, setGeladen] = useState(false);

  const projekt = abschnitte[Math.min(aktiv, abschnitte.length - 1)];

  /** Nur den aktuellen Abschnitt ersetzen */
  const setProjekt = (fn: Projekt | ((p: Projekt) => Projekt)) =>
    setAbschnitte((liste) =>
      liste.map((p, i) => (i === aktiv ? (typeof fn === "function" ? fn(p) : fn) : p))
    );

  /*
   * Zustand wiederherstellen (nur im Browser).
   *
   * Zur eslint-Ausnahme: Die Regel warnt vor setState im Effektkörper, weil
   * das meist ein vermeidbarer zweiter Renderdurchlauf ist. Hier ist es der
   * ausdrücklich vorgesehene Fall – Übernahme des Zustands aus einem externen
   * Speicher beim Einhängen. Die Alternative, den Wert schon in useState zu
   * lesen, scheidet aus: sessionStorage existiert beim Rendern auf dem Server
   * nicht, und der Server würde etwas anderes ausliefern als der Browser
   * anschließend darstellt (Hydration-Fehler). Der Effekt läuft genau einmal.
   */
  useEffect(() => {
    try {
      const roh = sessionStorage.getItem("bewehrung_projekt");
      if (roh) {
        // normalisieren: Projekte aus älteren Versionen können andere
        // Maß- und Detailschlüssel haben. Ältere Sitzungen haben ein
        // einzelnes Projekt gespeichert, neuere eine Liste von Abschnitten.
        const gelesen = JSON.parse(roh);
        const liste = (Array.isArray(gelesen) ? gelesen : [gelesen]).map(normalisiereProjekt);
        // vereinheitliche(): Ein Zustand aus einer älteren Programmversion
        // kann je Abschnitt abweichende Höhen oder freie Ränder an den Fugen
        // enthalten. Hier gelten dieselben Regeln wie serverseitig.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAbschnitte(liste.length ? vereinheitliche(liste) : [neuesProjekt()]);
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
      sessionStorage.setItem("bewehrung_projekt", JSON.stringify(abschnitte));
      localStorage.setItem(
        "bewehrung_firmendaten",
        JSON.stringify(abschnitte[0].firmendaten)
      );
    } catch {
      /* Speicher voll oder gesperrt – Eingaben bleiben trotzdem nutzbar */
    }
  }, [abschnitte, geladen]);

  /**
   * Je Sitzung einmal melden, welcher Schritt am weitesten erreicht wurde.
   * Daraus ergibt sich der Trichter: Wo brechen Interessenten ab? Erfasst
   * werden nur Schrittname und Bauteil, nichts Eingegebenes.
   */
  const gemeldet = useRef(new Set<string>());

  /**
   * Eingaben übernehmen.
   *
   * Länge, Öffnungen und die äußeren Anschlüsse gehören dem Abschnitt.
   * Bauteil, bautechnische Parameter und Firmendaten gehören dem
   * Bauvorhaben und werden deshalb auf alle Abschnitte gezogen: Es wäre
   * sinnlos, Abschnitt 1 nach ÖNORM und Abschnitt 2 nach DIN zu rechnen, und
   * der Schriftkopf soll auf allen Blättern gleich aussehen.
   *
   * Dasselbe gilt für Höhe und Dicke (`gemeinsameMasse` des Bauteilmoduls)
   * und für die Anschlüsse an den Fugen – nach denselben Regeln, die auch
   * der Server beim Checkout anwendet. So kann die Oberfläche gar nicht erst
   * einen Zustand erzeugen, den der Server anschließend korrigiert.
   */
  const set: Setzer = (fn) =>
    setAbschnitte((liste) => {
      const neuAktiv = fn(liste[aktiv]);
      const vorher = liste[aktiv];
      const gemeinsamGeaendert =
        neuAktiv.bauteil !== vorher.bauteil ||
        neuAktiv.parameter !== vorher.parameter ||
        neuAktiv.firmendaten !== vorher.firmendaten;

      // Wechsel auf ein nicht teilbares Bauteil: Abschnitte ergeben dort
      // keinen Sinn, also bleibt der aktuelle übrig.
      if (neuAktiv.bauteil !== vorher.bauteil && !teilbar(neuAktiv.bauteil)) {
        setAktiv(0);
        return [neuAktiv];
      }

      const neu = liste.map((p, i) => {
        if (i === aktiv) return neuAktiv;
        if (!gemeinsamGeaendert) return p;
        // Bauteilwechsel: Die anderen Abschnitte haben Maße und Details des
        // alten Bauteils – die wären für das neue sinnlos. Sie werden beim
        // Wechsel ohnehin auf einen einzigen Abschnitt zurückgesetzt
        // (siehe Wirkung unten), hier zählt nur die Gleichheit der Vorgaben.
        return {
          ...p,
          bauteil: neuAktiv.bauteil,
          parameter: neuAktiv.parameter,
          firmendaten: neuAktiv.firmendaten,
        };
      });

      if (neu.length < 2) return neu;
      // Der BEARBEITETE Abschnitt gibt die gemeinsamen Maße vor, auch wenn es
      // nicht der erste ist: Wer in Abschnitt 3 die Dicke ändert, meint die
      // Wand und nicht den Abschnitt. (vereinheitliche() nimmt dafür den
      // ersten – dort ist es der Server, der keine Bearbeitung kennt.)
      const gemeinsam = gemeinsameMasse(neuAktiv.bauteil);
      return neu.map((p, i) => {
        const masse = i === aktiv ? p.masse : { ...p.masse };
        if (i !== aktiv) for (const k of gemeinsam) masse[k] = neuAktiv.masse[k];
        const fest = gesperrteDetails(p.bauteil, i, neu.length);
        return { ...p, masse, details: { ...p.details, ...fest } };
      });
    });

  const modul = bauteilModul(projekt.bauteil);

  /**
   * Die Anschlüsse an den Fugen festsetzen.
   *
   * Wird nach jeder strukturellen Änderung angewendet, weil sich dabei die
   * Indizes verschieben: Entfernt man Abschnitt 2 von 3, liegt der bisher
   * mittlere Rand plötzlich außen.
   */
  const mitFugen = (liste: Projekt[]): Projekt[] =>
    liste.map((p, i) => ({
      ...p,
      details: { ...p.details, ...gesperrteDetails(p.bauteil, i, liste.length) },
    }));

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

  /**
   * Weiteren Abschnitt anlegen.
   *
   * Der neue übernimmt Höhe, Dicke und die Vorgaben des aktuellen – wer eine
   * Wand teilt, teilt dieselbe Wand. Was sich je Abschnitt unterscheidet,
   * sind Länge und Öffnungen; die Länge bleibt als Vorschlag stehen.
   *
   * An der neuen Fuge wird beidseits "Wand läuft weiter" gesetzt: Das ist
   * fachlich das, was eine Teilung bedeutet, und erspart den häufigsten
   * Fehler – zwei Abschnitte, die sich für freie Wandenden halten und je
   * eine Randeinfassung bekommen, die es gar nicht gibt.
   */
  const abschnittHinzu = () => {
    if (abschnitte.length >= MAX_ABSCHNITTE) return;
    const vorlage = abschnitte[abschnitte.length - 1];
    const neuerAbschnitt: Projekt = {
      ...vorlage,
      masse: { ...vorlage.masse },
      oeffnungen: [],
      details: { ...vorlage.details },
    };
    setAbschnitte(mitFugen([...abschnitte, neuerAbschnitt]));
    // In den neuen Abschnitt wechseln und zu seiner Länge springen: Sie ist
    // das Einzige, was zwingend anders ist. Ohne diesen Sprung sieht es aus,
    // als wäre beim Klick nichts geschehen.
    setAktiv(abschnitte.length);
    setSchritt(schluessel.indexOf("masse"));
  };

  /** Aktuellen Abschnitt entfernen; der letzte bleibt immer bestehen */
  const abschnittWeg = () => {
    if (abschnitte.length <= 1) return;
    // Nach dem Entfernen verschieben sich die Fugen: Aus dem bisherigen
    // Abschnitt 3 wird 2, und was innen lag, kann nun außen liegen.
    setAbschnitte(mitFugen(abschnitte.filter((_, i) => i !== aktiv)));
    setAktiv(Math.max(0, Math.min(aktiv, abschnitte.length - 2)));
  };

  // Wechselt das Bauteil auf eines ohne Öffnungen, darf der Zeiger nicht
  // hinter das Ende der (nun kürzeren) Schrittfolge zeigen.
  const aktiverSchritt = Math.min(schritt, schluessel.length - 1);

  // Erreichten Schritt melden – jeder Schritt nur beim ersten Besuch.
  const schrittName = schluessel[aktiverSchritt];
  const bauteilId = projekt.bauteil;
  useEffect(() => {
    if (!geladen || gemeldet.current.has(schrittName)) return;
    gemeldet.current.add(schrittName);
    ereignis("schritt", { schritt: schrittName, bauteil: bauteilId });
  }, [schrittName, bauteilId, geladen]);

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

  /**
   * Wo im Bauvorhaben steht der gerade bearbeitete Abschnitt? Die
   * Eingabeschritte brauchen das, um gemeinsame Maße zu kennzeichnen und die
   * Anschlüsse an den Fugen zu sperren. Bei nur einem Abschnitt: undefined –
   * dann ändert sich an den Schritten gar nichts.
   */
  const lage =
    abschnitte.length > 1 ? { nr: aktiv + 1, von: abschnitte.length } : undefined;

  const inhalt: Record<SchrittSchluessel, React.ReactNode> = {
    bauteil: <Step1Bauteil projekt={projekt} set={set} nr={nr("bauteil")} />,
    masse: <Step2Masse projekt={projekt} set={set} nr={nr("masse")} lage={lage} />,
    oeffnungen: <Step3Oeffnungen projekt={projekt} set={set} nr={nr("oeffnungen")} />,
    details: <Step4Anschluesse projekt={projekt} set={set} nr={nr("details")} lage={lage} />,
    parameter: <Step5Parameter projekt={projekt} set={set} nr={nr("parameter")} />,
    firmendaten: <Step6Firmendaten projekt={projekt} set={set} nr={nr("firmendaten")} />,
    ergebnis: (
      <Vorschau
        abschnitte={abschnitte}
        aktiv={aktiv}
        aufAbschnitt={setAktiv}
        nr={nr("ergebnis")}
      />
    ),
  };

  return (
    <main className="buehne">
      <section className="panel">
        {/*
          Abschnittsleiste – nur bei teilbaren Bauteilen (Wand). Sie steht
          ÜBER der Schrittleiste, weil sie die übergeordnete Ebene ist: erst
          welcher Abschnitt, dann welcher Schritt darin.
        */}
        {teilbar(projekt.bauteil) && (
          <div className="abschnitte-leiste">
            <div className="abschnitte-reiter">
              {abschnitte.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  className={`abschnitt-reiter${i === aktiv ? " aktiv" : ""}`}
                  onClick={() => setAktiv(i)}
                  title={`Abschnitt ${i + 1}: ${p.masse.laenge?.toLocaleString("de-AT")} m`}
                >
                  {i + 1}
                </button>
              ))}
              {abschnitte.length < MAX_ABSCHNITTE && (
                <button
                  type="button"
                  className="abschnitt-reiter neu"
                  onClick={abschnittHinzu}
                  title="Weiteren Abschnitt anlegen"
                >
                  + Abschnitt
                </button>
              )}
              {abschnitte.length > 1 && (
                <button
                  type="button"
                  className="abschnitt-weg"
                  onClick={abschnittWeg}
                  title={`Abschnitt ${aktiv + 1} entfernen`}
                >
                  Abschnitt {aktiv + 1} entfernen
                </button>
              )}
            </div>
            {abschnitte.length > 1 && (
              <AbschnittSVG
                laengen={abschnitte.map((p) => p.masse.laenge ?? 0)}
                aktiv={aktiv}
                onWechsel={setAktiv}
              />
            )}
          </div>
        )}

        <ol className="schritte">
          {schluessel.map((k, i) => {
            const fehlerhaft = fehlerSchritte.has(k as SchrittSchluessel);
            return (
              <li
                key={k}
                className={[
                  i === aktiverSchritt ? "aktiv" : i < aktiverSchritt ? "erledigt" : "",
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

        {inhalt[schluessel[aktiverSchritt]]}

        <div className="knopfleiste">
          <button
            className="knopf"
            onClick={() => setSchritt(Math.max(0, aktiverSchritt - 1))}
            disabled={aktiverSchritt === 0}
          >
            ← Zurück
          </button>
          {aktiverSchritt < schluessel.length - 1 && (
            <button className="knopf primaer" onClick={() => setSchritt(aktiverSchritt + 1)}>
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
