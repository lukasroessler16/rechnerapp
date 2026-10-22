"use client";

/**
 * Schritt „Bewehrung": je Bewehrungsstelle ein Unterpunkt, in dem der Kunde
 * den Stahl wählt.
 *
 * Welche Unterpunkte es gibt, sagt das Bauteilmodul (modul.stellen()) – sie
 * hängen von den gewählten Anschlüssen und Öffnungen ab und sind dieselben
 * Blöcke, die später auf Stückliste und Plan stehen.
 *
 * WAS HIER NICHT PASSIERT: Stückzahlen. Der Kunde sagt, was verlegt wird;
 * wie viel davon nötig ist, rechnet das Programm und zeigt es unter jedem
 * Unterpunkt an. Wo eine Mindestbewehrung gilt, steht daneben, ob die
 * getroffene Wahl sie deckt – eine zu dünne Bewehrung wird nicht
 * stillschweigend korrigiert, sondern gemeldet.
 */

import { useMemo } from "react";
import { Projekt } from "@/lib/types";
import { bauteilModul } from "@/lib/bauteile";
import { berechneBewehrung } from "@/lib/bewehrung";
import { stabflaeche, LAGERMATTEN, MATTEN_STOESSE, MATTEN_STOSS_MAX, MATTEN_STOSS_MIN } from "@/lib/normdaten";
import {
  ABSTAENDE,
  ABSTAND_MAX,
  ABSTAND_MIN,
  Bewehrungsstelle,
  DURCHMESSER,
  Stahlwahl,
  abweichend,
  stahlwahlFuer,
} from "@/lib/stahlwahl";
import { Erklaerung } from "./Erklaerung";

type Setzer = (fn: (p: Projekt) => Projekt) => void;

/** Vorhandene Bewehrung aus Durchmesser und Abstand [cm²/m] */
const asAus = (durchmesser: number, abstand: number) =>
  (stabflaeche(durchmesser) * 1000) / abstand;

/** Zahl in deutscher Schreibweise */
const de = (v: number, stellen = 2) =>
  v.toLocaleString("de-AT", { minimumFractionDigits: stellen, maximumFractionDigits: stellen });

/** 250 mm → "25 cm" */
const cm = (mm: number) => `${(mm / 10).toLocaleString("de-AT", { maximumFractionDigits: 1 })} cm`;

export default function Bewehrungsschritt({
  projekt,
  set,
  nr,
  lage,
}: {
  projekt: Projekt;
  set: Setzer;
  nr: number;
  lage?: { nr: number; von: number };
}) {
  const modul = bauteilModul(projekt.bauteil);
  const stellen = useMemo(() => modul.stellen(projekt), [modul, projekt]);
  const ergebnis = useMemo(() => berechneBewehrung(projekt), [projekt]);

  /** eine einzelne Angabe einer Stelle ändern */
  const setzeWahl = (id: string, teil: Partial<Stahlwahl>) =>
    set((p) => ({ ...p, stahl: { ...p.stahl, [id]: { ...p.stahl?.[id], ...teil } } }));

  /** zurück auf die Vorgabe des Programms */
  const zuruecksetzen = (id: string) =>
    set((p) => {
      const rest = { ...p.stahl };
      delete rest[id];
      return { ...p, stahl: rest };
    });

  const warnungen = ergebnis.hinweise.filter((h) => h.startsWith("⚠"));

  return (
    <>
      <h2 className="schritt-titel">
        {nr} · Bewehrung
        {lage && (
          <span className="titel-zusatz">
            Abschnitt {lage.nr} von {lage.von}
          </span>
        )}
      </h2>
      <p className="schritt-hilfe">
        Für jede Stelle ist vorgeschlagen, was dort üblich ist. Sie können den
        Stahl überall ändern – die Stückzahl rechnet das Programm neu.
      </p>

      {stellen.map((stelle, i) => (
        <StellenBlock
          key={stelle.id}
          nummer={i + 1}
          stelle={stelle}
          projekt={projekt}
          onWahl={(teil) => setzeWahl(stelle.id, teil)}
          onZurueck={() => zuruecksetzen(stelle.id)}
          flaechenInfo={
            stelle.flaeche
              ? {
                  wahl: ergebnis.kennwerte.gewaehlteMatte,
                  vorhanden: ergebnis.kennwerte.asVorhanden,
                  erforderlich: Math.max(
                    ergebnis.kennwerte.asMinHaupt,
                    ergebnis.kennwerte.asMinQuer
                  ),
                }
              : undefined
          }
        />
      ))}

      <div className="kennwert-gitter" style={{ marginTop: 18 }}>
        <div className="kennwert">
          <div className="kw-wert">{ergebnis.gesamtgewicht.toLocaleString("de-AT")} kg</div>
          <div className="kw-name">Baustahl mit dieser Wahl</div>
        </div>
        <div className="kennwert">
          <div className="kw-wert">{ergebnis.positionen.length}</div>
          <div className="kw-name">Positionen</div>
        </div>
        <div className="kennwert">
          <div className="kw-wert">{ergebnis.beton.bewehrungsgrad} kg/m³</div>
          <div className="kw-name">Bewehrungsgrad</div>
        </div>
      </div>

      {warnungen.map((w, i) => (
        <div className="warnbox" key={i}>
          {w.replace(/^⚠\s*/, "")}
        </div>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Ein Unterpunkt                                                      */
/* ------------------------------------------------------------------ */

function StellenBlock({
  nummer,
  stelle,
  projekt,
  onWahl,
  onZurueck,
  flaechenInfo,
}: {
  nummer: number;
  stelle: Bewehrungsstelle;
  projekt: Projekt;
  onWahl: (teil: Partial<Stahlwahl>) => void;
  onZurueck: () => void;
  /** nur für die Fläche: was die Berechnung daraus gemacht hat */
  flaechenInfo?: { wahl: string; vorhanden: number; erforderlich: number };
}) {
  const wahl = stahlwahlFuer(stelle, projekt.stahl);
  const geaendert = abweichend(stelle, projekt.stahl);
  const mitMatten = stelle.flaeche && wahl.art === "matte";
  // Angebotene Durchmesser: die der Stelle, ergänzt um den gewählten, damit
  // eine ältere Wahl nie aus der Liste fällt.
  const auswahl = [...new Set([...(stelle.durchmesser ?? DURCHMESSER), wahl.durchmesser])].sort(
    (a, b) => a - b
  );
  const as = asAus(wahl.durchmesser, wahl.abstand);
  // Ohne Verlegeabstand ergibt eine Bewehrung je Meter keinen Sinn – dort
  // zählt die Stückzahl, und die rechnet das Programm.
  const mitAbstand = !stelle.ohneAbstand && !mitMatten;
  /*
   * Die erforderliche Bewehrung einer Fläche hängt von Bauteil und Maßen ab
   * und wird im Berechnungskern ermittelt; sie kommt deshalb aus dem
   * Ergebnis und nicht aus der Stellendefinition.
   */
  const erforderlich = stelle.asErf ?? (stelle.flaeche ? flaechenInfo?.erforderlich : undefined);
  const zuWenig = mitAbstand && erforderlich !== undefined && as < erforderlich - 0.005;

  return (
    <section className={`stelle${geaendert ? " geaendert" : ""}`}>
      <div className="stelle-kopf">
        <h3>
          <span className="stelle-nr">{nummer}</span> {stelle.titel}
        </h3>
        {geaendert && (
          <button type="button" className="stelle-zurueck" onClick={onZurueck}>
            Vorgabe wiederherstellen
          </button>
        )}
      </div>
      <p className="stelle-erklaerung">{stelle.erklaerung}</p>

      {/* Flächen: zuerst die Grundsatzfrage Matte oder Stab */}
      {stelle.flaeche && (
        <div className="art-wahl">
          {(["matte", "stab"] as const).map((a) => (
            <label key={a} className={wahl.art === a ? "aktiv" : undefined}>
              <input
                type="radio"
                name={`art-${stelle.id}`}
                checked={wahl.art === a}
                onChange={() => onWahl({ art: a })}
              />
              {a === "matte" ? "Lagermatten" : "Stabbewehrung"}
            </label>
          ))}
        </div>
      )}

      <div className="reihe">
        {mitMatten ? (
          <>
            <div className="feld">
              <label>
                Lagermatte
                <Erklaerung thema="matte" />
              </label>
              <select value={wahl.matte} onChange={(e) => onWahl({ matte: e.target.value })}>
                <option value="auto">automatisch (kleinste ausreichende)</option>
                {LAGERMATTEN.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name} – {m.as} cm²/m
                  </option>
                ))}
              </select>
              <div className="hinweis">
                {wahl.matte === "auto"
                  ? "wird aus der Mindestbewehrung ermittelt"
                  : "feste Vorgabe – die Deckung wird geprüft"}
              </div>
            </div>

            <div className="feld">
              <label>
                Übergreifungsstoß
                <Erklaerung thema="mattenstoss" />
              </label>
              <div className="mit-einheit">
                <input
                  type="number"
                  min={MATTEN_STOSS_MIN / 10}
                  max={MATTEN_STOSS_MAX / 10}
                  step={1}
                  value={Math.round((wahl.stoss ?? 350) / 10)}
                  onChange={(e) => onWahl({ stoss: Math.round(Number(e.target.value) * 10) })}
                />
                <span>cm</span>
              </div>
              <div className="vorschlaege">
                {MATTEN_STOESSE.map((m) => (
                  <button
                    key={m.wert}
                    type="button"
                    className={wahl.stoss === m.wert ? "aktiv" : undefined}
                    onClick={() => onWahl({ stoss: m.wert })}
                    title={m.titel}
                  >
                    {(m.wert / 10).toLocaleString("de-AT")}
                  </button>
                ))}
              </div>
              <div className="hinweis">
                geht in Länge und Breite ab – wirkt doppelt auf die Mattenzahl
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="feld">
              <label>Durchmesser</label>
              <select
                value={wahl.durchmesser}
                onChange={(e) => onWahl({ durchmesser: Number(e.target.value) })}
              >
                {auswahl.map((d) => (
                  <option key={d} value={d}>
                    Ø {d} mm
                  </option>
                ))}
              </select>
              <div className="hinweis">Vorgabe: Ø {stelle.standard.durchmesser} mm</div>
            </div>

            {mitAbstand && (
            <div className="feld">
              <label>Abstand</label>
              <div className="mit-einheit">
                <input
                  type="number"
                  min={ABSTAND_MIN / 10}
                  max={ABSTAND_MAX / 10}
                  step={0.5}
                  value={Math.round((wahl.abstand / 10) * 10) / 10}
                  onChange={(e) => onWahl({ abstand: Math.round(Number(e.target.value) * 10) })}
                />
                <span>cm</span>
              </div>
              <div className="vorschlaege">
                {ABSTAENDE.map((a) => (
                  <button
                    key={a}
                    type="button"
                    className={wahl.abstand === a ? "aktiv" : undefined}
                    onClick={() => onWahl({ abstand: a })}
                  >
                    {(a / 10).toLocaleString("de-AT")}
                  </button>
                ))}
              </div>
              <div className="hinweis">Vorgabe: {cm(stelle.standard.abstand)}</div>
            </div>
            )}
          </>
        )}
      </div>

      {/* Rückmeldung: was ergibt die Wahl? */}
      {mitMatten && flaechenInfo ? (
        <div
          className={`stelle-ergebnis${
            flaechenInfo.vorhanden < flaechenInfo.erforderlich - 0.005 ? " zuwenig" : ""
          }`}
        >
          gewählt <strong>{flaechenInfo.wahl}</strong> mit {de(flaechenInfo.vorhanden)} cm²/m ·
          erforderlich {de(flaechenInfo.erforderlich)} cm²/m
          {flaechenInfo.vorhanden < flaechenInfo.erforderlich - 0.005
            ? " – das reicht nicht"
            : " ✓"}
        </div>
      ) : mitAbstand ? (
        <div className={`stelle-ergebnis${zuWenig ? " zuwenig" : ""}`}>
          ergibt <strong>{de(as)} cm²/m</strong>
          {erforderlich !== undefined && (
            <>
              {" "}
              · erforderlich {de(erforderlich)} cm²/m
              {zuWenig ? " – das reicht nicht" : " ✓"}
            </>
          )}
        </div>
      ) : (
        !mitMatten && (
          <div className="stelle-ergebnis">
            Die Stückzahl ergibt sich aus
            {stelle.asErf !== undefined
              ? ` der erforderlichen Bewehrung von ${de(stelle.asErf)} cm² und dem gewählten Durchmesser.`
              : " der Bauteilgeometrie."}
          </div>
        )
      )}
    </section>
  );
}
