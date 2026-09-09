"use client";

/**
 * Erklärungsfenster für Fachbegriffe.
 *
 * Der Rechner ist so gebaut, dass ihn auch jemand bedienen kann, der nicht
 * täglich mit Beton zu tun hat. Jedes Feld mit einem Fachbegriff bekommt
 * deshalb ein kleines Fragezeichen; ein Klick klappt eine Erklärung in
 * Alltagssprache auf. Der Text steht zentral in ERKLAERUNGEN, damit die
 * Formulierungen an einer Stelle gepflegt werden können.
 */

import { useEffect, useId, useRef, useState } from "react";

export interface Erklaerungstext {
  titel: string;
  /** Absätze in einfacher Sprache */
  text: string[];
  /** optionale Merksätze / Faustregeln */
  merke?: string[];
}

export const ERKLAERUNGEN: Record<string, Erklaerungstext> = {
  regelwerk: {
    titel: "Regelwerk (Nationaler Anhang)",
    text: [
      "Gerechnet wird in ganz Europa nach demselben Eurocode 2. Jedes Land darf aber eigene Zahlenwerte festlegen – das steht im sogenannten Nationalen Anhang.",
      "Österreich und Deutschland unterscheiden sich dabei tatsächlich: Der übliche Betonstahl ist in Österreich B550 (Streckgrenze 550 N/mm²), in Deutschland B500. Auch die vorgeschriebene Betondeckung und die Mindestbewehrung von Wänden sind nicht gleich.",
    ],
    merke: [
      "Stellen Sie hier das Land ein, in dem gebaut wird – nicht das, in dem geplant wird.",
    ],
  },
  expositionsklasse: {
    titel: "Expositionsklasse",
    text: [
      "Die Expositionsklasse beschreibt, was auf den Beton einwirkt: trockene Innenluft, Regen, Frost, Streusalz oder Meerwasser. Je rauer die Umgebung, desto dichter muss der Beton sein und desto dicker muss er die Bewehrung überdecken.",
      "XC steht für Karbonatisierung (Luft und Feuchte), XD für Chloride aus Streusalz, XF für Frost.",
    ],
    merke: [
      "XC1 – trockener Innenraum, z. B. Wohnzimmerwand",
      "XC2 – ständig nass oder im Erdreich, z. B. Fundament",
      "XC3 – Innenräume mit hoher Feuchte, überdachte Außenteile",
      "XC4 – wechselnd nass und trocken, z. B. bewitterte Außenwand",
      "XD/XF – Streusalz bzw. Frost, z. B. Garageneinfahrt",
    ],
  },
  betonklasse: {
    titel: "Betonklasse (Betonfestigkeit)",
    text: [
      "C25/30 heißt: Der Beton hält im Zylinderversuch 25 N/mm², im Würfelversuch 30 N/mm² Druck aus. Je höher die Zahl, desto fester und dichter der Beton – und desto teurer.",
      "Die Betonklasse muss zur Expositionsklasse passen. Der Rechner warnt, wenn die gewählte Klasse für die Umgebung zu schwach ist.",
    ],
    merke: ["C25/30 ist der übliche Standardbeton im Hochbau."],
  },
  betondeckung: {
    titel: "Betondeckung c_nom",
    text: [
      "Der Abstand zwischen der äußersten Bewehrung und der Betonoberfläche. Diese Schicht schützt den Stahl vor Rost und im Brandfall vor Hitze – zu wenig Deckung ist der häufigste Grund für Bauschäden an Stahlbeton.",
      "Sie setzt sich zusammen aus dem Mindestmaß für die Umgebung plus einem Vorhaltemaß für Bautoleranzen.",
    ],
    merke: [
      "Der Rechner schlägt den Normwert zur Expositionsklasse vor; ändern Sie ihn nur nach Rücksprache mit der Tragwerksplanung.",
    ],
  },
  betonstahl: {
    titel: "Betonstahlsorte",
    text: [
      "Die Zahl gibt die Streckgrenze in N/mm² an: B550 hält 550 N/mm² Zug aus, bevor er sich bleibend verformt. Der Buchstabe steht für die Duktilität – A ist normalduktil (typisch Lagermatten), B ist hochduktil (typisch Stabstahl).",
    ],
    merke: [
      "Österreich: B550A / B550B nach ÖNORM B 4707",
      "Deutschland: B500A / B500B nach DIN 488",
    ],
  },
  lagen: {
    titel: "Bewehrungslagen",
    text: [
      "Einlagig heißt: eine Matte, mittig oder an der Zugseite. Zweilagig heißt: je eine Matte an beiden Oberflächen.",
      "Dünne Bauteile bekommen eine Lage, dickere zwei – dann ist der Stahl dort, wo der Zug entsteht, und das Bauteil reißt gleichmäßiger.",
    ],
    merke: ["Ab etwa 20 cm Bauteildicke ist zweilagig üblich."],
  },
  matte: {
    titel: "Lagermatte",
    text: [
      "Vorgefertigte, geschweißte Bewehrungsmatten in genormten Größen. Der Name verrät den Querschnitt: Q188A hat 1,88 cm² Stahl je Meter in beide Richtungen, R-Matten sind in einer Richtung stärker.",
      "Matten sind deutlich schneller verlegt als einzelne Stäbe und deshalb im Hochbau der Regelfall.",
    ],
    merke: [
      "„automatisch“ wählt die kleinste Matte, die den rechnerischen Bedarf deckt – das ist meist die wirtschaftlichste Lösung.",
    ],
  },
  stababstand: {
    titel: "Raster der Anschlussbewehrung",
    text: [
      "Anschlusseisen verbinden ein Bauteil mit dem nächsten, etwa die Wand mit der Bodenplatte. Der Wert gibt an, in welchem Abstand diese Stäbe gesetzt werden.",
      "Enger heißt mehr Stahl und mehr Arbeit, aber eine gleichmäßigere Kraftübertragung.",
    ],
    merke: ["Ø10 alle 25 cm ist der übliche Standard im Wohnbau."],
  },
};

/**
 * Fragezeichen-Schaltfläche mit aufklappbarer Erklärung.
 * Wird direkt hinter das Label gesetzt.
 */
export function Erklaerung({ thema }: { thema: keyof typeof ERKLAERUNGEN | string }) {
  const inhalt = ERKLAERUNGEN[thema];
  const [offen, setOffen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const id = useId();

  // Klick daneben oder Escape schließt das Fenster wieder.
  useEffect(() => {
    if (!offen) return;
    const weg = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOffen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOffen(false);
    document.addEventListener("mousedown", weg);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", weg);
      document.removeEventListener("keydown", esc);
    };
  }, [offen]);

  if (!inhalt) return null;

  return (
    <span className="erkl" ref={box}>
      <button
        type="button"
        className="erkl-knopf"
        aria-expanded={offen}
        aria-controls={id}
        aria-label={`Erklärung: ${inhalt.titel}`}
        onClick={() => setOffen((o) => !o)}
      >
        ?
      </button>
      {offen && (
        <span className="erkl-box" id={id} role="note">
          <span className="erkl-titel">{inhalt.titel}</span>
          {inhalt.text.map((t, i) => (
            <span className="erkl-absatz" key={i}>
              {t}
            </span>
          ))}
          {inhalt.merke && (
            <span className="erkl-merke">
              {inhalt.merke.map((m, i) => (
                <span key={i}>{m}</span>
              ))}
            </span>
          )}
          <button type="button" className="erkl-zu" onClick={() => setOffen(false)}>
            schließen
          </button>
        </span>
      )}
    </span>
  );
}
