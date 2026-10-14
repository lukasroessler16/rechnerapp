"use client";

/**
 * Übersichtsgrafik der Abschnitte: „Abschnitt 2 von 4“.
 *
 * Zeigt die ganze Wand als Band, proportional in ihre Abschnitte geteilt, mit
 * dem gerade bearbeiteten hervorgehoben. Die Proportion ist der eigentliche
 * Inhalt – man sieht sofort, ob gleichmäßig geteilt wurde oder ob ein
 * Abschnitt aus der Reihe fällt.
 *
 * Dieselbe Geometrie landet über lib/abschnitte.ts auch auf Plan und
 * Stückliste, damit Bildschirm und Papier dasselbe zeigen.
 */

import { abschnittsStreifen } from "@/lib/abschnitte";

export default function AbschnittSVG({
  laengen,
  aktiv,
  /** klickbar machen (im Wizard) oder nur anzeigen (Vorschau) */
  onWechsel,
}: {
  laengen: number[];
  aktiv: number;
  onWechsel?: (index: number) => void;
}) {
  const BREITE = 560;
  const HOEHE = 54;
  const BAND_Y = 14;
  const BAND_H = 22;
  const streifen = abschnittsStreifen(laengen, aktiv, BREITE, 4);
  const gesamt = laengen.reduce((a, b) => a + b, 0);

  return (
    <div className="abschnittsgrafik">
      <svg
        viewBox={`0 0 ${BREITE} ${HOEHE}`}
        width="100%"
        role="img"
        aria-label={`Abschnitt ${aktiv + 1} von ${laengen.length}, Gesamtlänge ${gesamt.toLocaleString("de-AT")} Meter`}
      >
        {streifen.map((s) => (
          <g
            key={s.nr}
            className={`abschnitt-streifen${s.aktiv ? " aktiv" : ""}${onWechsel ? " klickbar" : ""}`}
            onClick={onWechsel ? () => onWechsel(s.nr - 1) : undefined}
          >
            <rect x={s.x} y={BAND_Y} width={s.breite} height={BAND_H} rx="2" />
            {/* Nummer nur, wenn der Streifen breit genug ist, sonst wird es Matsch */}
            {s.breite > 18 && (
              <text
                x={s.x + s.breite / 2}
                y={BAND_Y + BAND_H / 2 + 4}
                textAnchor="middle"
                className="streifen-nr"
              >
                {s.nr}
              </text>
            )}
            {s.breite > 34 && (
              <text
                x={s.x + s.breite / 2}
                y={HOEHE - 3}
                textAnchor="middle"
                className="streifen-mass"
              >
                {s.laenge.toLocaleString("de-AT")} m
              </text>
            )}
          </g>
        ))}
        {/* Gesamtmaßkette über dem Band */}
        <line x1="0" y1="7" x2={BREITE} y2="7" className="streifen-kette" />
        <line x1="0" y1="3" x2="0" y2="11" className="streifen-kette" />
        <line x1={BREITE} y1="3" x2={BREITE} y2="11" className="streifen-kette" />
      </svg>
      <div className="abschnitt-fuss">
        <strong>
          {aktiv < 0
            ? `Alle ${laengen.length} Abschnitte`
            : `Abschnitt ${aktiv + 1} von ${laengen.length}`}
        </strong>
        <span>Gesamtlänge {gesamt.toLocaleString("de-AT")} m</span>
      </div>
    </div>
  );
}
