"use client";

/**
 * Eingabeschritte des Wizards.
 *
 * Die Schritte 1–4 sind vollständig registergesteuert: Welche Maßfelder und
 * welche Detailauswahlen es gibt, sagt das Bauteilmodul (lib/bauteile/).
 * Ein neues Bauteil erscheint dadurch automatisch in der Bauteilwahl und
 * bringt seine eigenen Eingabefelder mit – hier ist dafür nichts zu ändern.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Oeffnung, Parameter, Projekt } from "@/lib/types";
import {
  BAUTEILE,
  bauteilModul,
  standardDetails,
  standardMasse,
} from "@/lib/bauteile";
import { Massfeld, feldFaktor } from "@/lib/bauteile/typen";
import { BETONKLASSEN, LAGERMATTEN } from "@/lib/normdaten";
import { REGELWERKE, cnomAusExposition, regelwerkVon } from "@/lib/regelwerk";
import { berechneBewehrung, oeffnungsDetails } from "@/lib/bewehrung";
import { Pruefmeldung, fehlerZu, oeffnungsMarke, pruefeProjekt } from "@/lib/validierung";
import { Detailbild } from "./DetailBilder";
import { Erklaerung } from "./Erklaerung";

export type Setzer = (fn: (p: Projekt) => Projekt) => void;
interface StepProps {
  projekt: Projekt;
  set: Setzer;
  /** Nummer in der (bauteilabhängigen) Schrittfolge, 1-basiert */
  nr: number;
}

/* ------------------------------------------------------------------ */
/* Wiederverwendbare Felder                                            */
/* ------------------------------------------------------------------ */

function ZahlFeld({
  label,
  einheit,
  wert,
  min,
  max,
  schritt = 0.01,
  onChange,
  hinweis,
  fehler,
  erklaerung,
}: {
  label: string;
  einheit: string;
  wert: number;
  min: number;
  max: number;
  schritt?: number;
  onChange: (v: number) => void;
  hinweis?: string;
  /** Meldung aus der Plausibilitätsprüfung */
  fehler?: string;
  /** Schlüssel eines Erklärungstextes, falls der Begriff erklärt werden soll */
  erklaerung?: string;
}) {
  /**
   * Eigener Textzustand: Nur so lässt sich das Feld mit der Rücktaste ganz
   * leeren. Würde direkt der Zahlenwert angezeigt, schriebe React beim
   * ersten ungültigen Zwischenstand sofort den alten Wert zurück.
   */
  const [text, setText] = useState(() => String(wert));
  const letzterWert = useRef(wert);

  // Änderungen von außen übernehmen (Vorbelegung, Typwechsel, Zurücksetzen)
  useEffect(() => {
    if (wert !== letzterWert.current) {
      letzterWert.current = wert;
      setText(String(wert));
    }
  }, [wert]);

  const aendern = (roh: string) => {
    setText(roh);
    const v = parseFloat(roh.replace(",", "."));
    if (isFinite(v)) {
      letzterWert.current = v;
      onChange(v);
    }
  };

  // Leeres Feld beim Verlassen auf den letzten gültigen Wert zurücksetzen
  const verlassen = () => {
    if (!isFinite(parseFloat(text.replace(",", ".")))) setText(String(wert));
  };

  const leer = text.trim() === "";
  const meldung = leer ? "Bitte einen Wert eintragen." : fehler;

  return (
    <div className="feld">
      <label>
        {label} <span className="einheit">[{einheit}]</span>
        {erklaerung && <Erklaerung thema={erklaerung} />}
      </label>
      <input
        type="number"
        inputMode="decimal"
        className={meldung ? "ungueltig" : undefined}
        value={text}
        min={min}
        max={max}
        step={schritt}
        onChange={(e) => aendern(e.target.value)}
        onBlur={verlassen}
      />
      {meldung ? (
        <div className="feldfehler">{meldung}</div>
      ) : hinweis ? (
        <div className="hinweis">{hinweis}</div>
      ) : null}
    </div>
  );
}

/** Ein Maßfeld des Bauteils – rechnet zwischen Speicher- (m) und Anzeigeeinheit um */
function MassFeld({
  feld,
  projekt,
  set,
  fehler,
}: {
  feld: Massfeld;
  projekt: Projekt;
  set: Setzer;
  fehler?: string;
}) {
  const faktor = feldFaktor(feld);
  const roh = projekt.masse[feld.schluessel] ?? feld.standard;
  // Rundung vermeidet Anzeigefehler wie 24,999999 cm
  const anzeige = Math.round(roh * faktor * 1000) / 1000;
  return (
    <ZahlFeld
      label={feld.label}
      einheit={feld.einheit}
      wert={anzeige}
      min={feld.min * faktor}
      max={feld.max * faktor}
      schritt={feld.schritt ?? (faktor === 100 ? 1 : 0.01)}
      hinweis={feld.hinweis}
      fehler={fehler}
      onChange={(v) =>
        set((p) => ({ ...p, masse: { ...p.masse, [feld.schluessel]: v / faktor } }))
      }
    />
  );
}

/* ------------------------------------------------------------------ */
/* Schritt 1: Bauteilwahl                                              */
/* ------------------------------------------------------------------ */

export function Step1Bauteil({ projekt, set, nr }: StepProps) {
  /**
   * Beim Wechsel werden Maße und Details auf die Standardwerte des neuen
   * Bauteils gesetzt – die Feldschlüssel unterscheiden sich je Bauteil
   * (eine Stütze hat kein "laenge"), alte Werte wären also sinnlos.
   */
  const waehle = (id: string) =>
    set((p) => {
      if (p.bauteil === id) return p;
      const modul = bauteilModul(id);
      return {
        ...p,
        bauteil: id,
        masse: standardMasse(modul),
        details: standardDetails(modul),
        oeffnungen: modul.hatOeffnungen ? p.oeffnungen : [],
      };
    });

  return (
    <>
      <h2 className="schritt-titel">{nr} · Bauteil wählen</h2>
      <p className="schritt-hilfe">
        Für welches Bauteil soll die Bewehrung ermittelt werden?
      </p>
      <div className="karten">
        {BAUTEILE.map((b) => (
          <div
            key={b.id}
            className={`karte ${projekt.bauteil === b.id ? "gewaehlt" : ""}`}
            onClick={() => waehle(b.id)}
          >
            <Detailbild bildId={b.bildId} />
            <div className="karte-titel">{b.name}</div>
            <div className="karte-text">{b.beschreibung}</div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Schritt 2: Grundmaße                                                */
/* ------------------------------------------------------------------ */

export function Step2Masse({ projekt, set, nr }: StepProps) {
  const modul = bauteilModul(projekt.bauteil);
  const meldungen = useMemo(() => pruefeProjekt(projekt), [projekt]);
  return (
    <>
      <h2 className="schritt-titel">{nr} · Grundmaße</h2>
      <p className="schritt-hilfe">
        Maße für {modul.name}. Die Skizze rechts aktualisiert sich live.
      </p>
      {/* Bei vier Maßfeldern wirkt ein 2×2-Raster ruhiger als 3 + 1 */}
      <div className={modul.masse.length === 4 ? "reihe" : "reihe3"}>
        {modul.masse.map((f) => (
          <MassFeld
            key={f.schluessel}
            feld={f}
            projekt={projekt}
            set={set}
            fehler={fehlerZu(meldungen, f.schluessel)}
          />
        ))}
      </div>
      {meldungen
        .filter((m) => m.schwere === "warnung" && !m.feld.startsWith("oef:"))
        .map((m, i) => (
          <div className="warnbox" key={i}>
            {m.text}
          </div>
        ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Schritt 3: Öffnungen                                                */
/* ------------------------------------------------------------------ */

export function Step3Oeffnungen({ projekt, set, nr }: StepProps) {
  const modul = bauteilModul(projekt.bauteil);
  const typen = modul.oeffnungsTypen ?? ["aussparung"];
  const vorschlaege = oeffnungsDetails(projekt);
  const meldungen: Pruefmeldung[] = useMemo(() => pruefeProjekt(projekt), [projekt]);

  const neu = () =>
    set((p) => {
      const fenster = typen.includes("fenster");
      return {
        ...p,
        oeffnungen: [
          ...p.oeffnungen,
          {
            id: String(Date.now()),
            typ: fenster ? "fenster" : typen[0],
            x: 1,
            y: fenster ? 0.9 : 1,
            breite: fenster ? 1.2 : 0.6,
            hoehe: fenster ? 1.4 : 0.6,
          } as Oeffnung,
        ],
      };
    });

  const aendere = (id: string, teil: Partial<Oeffnung>) =>
    set((p) => ({
      ...p,
      oeffnungen: p.oeffnungen.map((o) => (o.id === id ? { ...o, ...teil } : o)),
    }));

  const loesche = (id: string) =>
    set((p) => ({ ...p, oeffnungen: p.oeffnungen.filter((o) => o.id !== id) }));

  return (
    <>
      <h2 className="schritt-titel">{nr} · Öffnungen</h2>
      <p className="schritt-hilfe">
        Position jeweils als Abstand der linken unteren Öffnungsecke vom linken bzw.
        unteren Bauteilrand. Erforderliche Verstärkungen (Sturz, Schrägstäbe …) werden
        automatisch vorgeschlagen und in der Berechnung berücksichtigt.
      </p>
      {projekt.oeffnungen.map((o, i) => {
        const v = vorschlaege.find((x) => x.oeffnungId === o.id);
        return (
          <div className="oeffnung-block" key={o.id}>
            <div className="oeffnung-kopfzeile">
              <strong>
                {oeffnungsMarke(o, i)} ·{" "}
                {o.typ === "fenster" ? "Fenster" : o.typ === "tuer" ? "Tür" : "Aussparung"}
              </strong>
              <button className="knopf klein" onClick={() => loesche(o.id)}>
                entfernen
              </button>
            </div>
            {typen.length > 1 && (
              <div className="feld">
                <label>Typ</label>
                <select
                  value={o.typ}
                  onChange={(e) => {
                    const typ = e.target.value as Oeffnung["typ"];
                    // Tür: sinnvollerweise auf Bauteilunterkante setzen
                    aendere(o.id, typ === "tuer" ? { typ, y: 0 } : { typ });
                  }}
                >
                  {typen.includes("fenster") && <option value="fenster">Fenster</option>}
                  {typen.includes("tuer") && <option value="tuer">Tür</option>}
                  {typen.includes("aussparung") && (
                    <option value="aussparung">Aussparung</option>
                  )}
                </select>
              </div>
            )}
            <div className="reihe">
              <ZahlFeld label="Position x" einheit="m" wert={o.x} min={0} max={100}
                onChange={(v2) => aendere(o.id, { x: v2 })}
                fehler={fehlerZu(meldungen, `oef:${o.id}:x`)} />
              <ZahlFeld label="Position y" einheit="m" wert={o.y} min={0} max={100}
                onChange={(v2) => aendere(o.id, { y: v2 })}
                fehler={fehlerZu(meldungen, `oef:${o.id}:y`)} />
            </div>
            <div className="reihe">
              <ZahlFeld label="Breite" einheit="m" wert={o.breite} min={0.1} max={20}
                onChange={(v2) => aendere(o.id, { breite: v2 })}
                fehler={fehlerZu(meldungen, `oef:${o.id}:breite`)} />
              <ZahlFeld label="Höhe" einheit="m" wert={o.hoehe} min={0.1} max={20}
                onChange={(v2) => aendere(o.id, { hoehe: v2 })}
                fehler={fehlerZu(meldungen, `oef:${o.id}:hoehe`)} />
            </div>

            {/* Meldungen, die die Öffnung als Ganzes betreffen
                (Überschneidungen, zu schmale Restpfeiler) */}
            {meldungen
              .filter((m) => m.feld === `oef:${o.id}`)
              .map((m, k) => (
                <div
                  key={k}
                  className={m.schwere === "fehler" ? "feldfehler block" : "warnbox"}
                >
                  {m.text}
                </div>
              ))}
            {v && (
              <div className="detail-vorschlag">
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ width: 64 }}>
                    <Detailbild bildId="sturz" />
                  </div>
                  <div>
                    <strong>Automatisch berücksichtigte Details:</strong>
                    <ul>
                      {v.details.map((d, j) => (
                        <li key={j}>{d}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
      <button className="knopf" onClick={neu}>
        + Öffnung hinzufügen
      </button>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Schritt 4: Anschluss-/Detailauswahl                                 */
/* ------------------------------------------------------------------ */

function DetailWahl({
  label,
  wert,
  optionen,
  onChange,
}: {
  label: string;
  wert: string;
  optionen: { wert: string; titel: string; bildId: string }[];
  onChange: (v: string) => void;
}) {
  const aktiv = optionen.find((o) => o.wert === wert) ?? optionen[0];
  return (
    <div className="detail-wahl">
      <div className="bild">
        <Detailbild bildId={aktiv.bildId} />
      </div>
      <div className="wahl feld" style={{ marginBottom: 0 }}>
        <label>{label}</label>
        <select value={wert} onChange={(e) => onChange(e.target.value)}>
          {optionen.map((o) => (
            <option key={o.wert} value={o.wert}>
              {o.titel}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function Step4Anschluesse({ projekt, set, nr }: StepProps) {
  const modul = bauteilModul(projekt.bauteil);
  const meldungen = useMemo(() => pruefeProjekt(projekt), [projekt]);
  return (
    <>
      <h2 className="schritt-titel">{nr} · {modul.detailTitel}</h2>
      <p className="schritt-hilfe">{modul.detailHilfe}</p>
      {modul.details.map((f) => (
        <DetailWahl
          key={f.schluessel}
          label={f.label}
          wert={projekt.details[f.schluessel] ?? f.standard}
          optionen={f.optionen}
          onChange={(v) =>
            set((p) => ({ ...p, details: { ...p.details, [f.schluessel]: v } }))
          }
        />
      ))}

      {/* Zusatzkennwerte, z. B. Bodenkennwerte einer Stützmauer */}
      {modul.zusatz && (
        <section className="gruppe" style={{ marginTop: 16 }}>
          <h3 className="gruppe-titel">{modul.zusatz.titel}</h3>
          {modul.zusatz.hilfe && <p className="schritt-hilfe">{modul.zusatz.hilfe}</p>}
          <div className="reihe3">
            {modul.zusatz.felder.map((f) => (
              <MassFeld
                key={f.schluessel}
                feld={f}
                projekt={projekt}
                set={set}
                fehler={fehlerZu(meldungen, f.schluessel)}
              />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Schritt 5: Bautechnische Parameter                                  */
/* ------------------------------------------------------------------ */

export function Step5Parameter({ projekt, set, nr }: StepProps) {
  const par = projekt.parameter;
  const modul = bauteilModul(projekt.bauteil);
  /** Bauteile ohne Flächenbewehrung brauchen weder Matte, Lagen noch Raster */
  const mitMatten = modul.flaechenbewehrt;

  /** Kurzschreibweise: einzelne Parameter ändern */
  const setPar = (teil: Partial<Parameter>) =>
    set((p) => ({ ...p, parameter: { ...p.parameter, ...teil } }));

  /** Live-Rückmeldung: was ergibt sich aus der aktuellen Auswahl? */
  const kennwerte = useMemo(() => berechneBewehrung(projekt).kennwerte, [projekt]);

  /** Nationaler Anhang: bestimmt Stahlsorten, Deckung und Mindestbewehrung */
  const regelwerk = regelwerkVon(par.regelwerk);

  /** Normprüfung: erfüllt die Betonklasse die Expositionsklasse? */
  const expo = regelwerk.expositionsklassen.find((x) => x.name === par.expositionsklasse);
  const iGewaehlt = BETONKLASSEN.findIndex((b) => b.name === par.betonklasse);
  const iMindest = BETONKLASSEN.findIndex((b) => b.name === expo?.minBeton);
  const betonZuNiedrig = iMindest >= 0 && iGewaehlt >= 0 && iGewaehlt < iMindest;

  const vorschlagDeckung = cnomAusExposition(regelwerk, par.expositionsklasse);
  const deckungAbweichend = par.betondeckung !== vorschlagDeckung;

  /**
   * Regelwerkswechsel: Stahlsorte und Expositionsklasse müssen im neuen Anhang
   * überhaupt existieren, und die Betondeckung folgt dessen Werten – sonst
   * würde stillschweigend mit einer Mischung aus zwei Normen gerechnet.
   */
  const wechsleRegelwerk = (id: string) => {
    const neu = regelwerkVon(id);
    const sorte =
      neu.stahlsorten.find((s) => s.name.slice(-1) === par.stahlguete.slice(-1)) ??
      neu.stahlsorten[0];
    const klasse = neu.expositionsklassen.some((x) => x.name === par.expositionsklasse)
      ? par.expositionsklasse
      : neu.expositionsklassen[0].name;
    setPar({
      regelwerk: neu.id,
      stahlguete: sorte.name,
      expositionsklasse: klasse,
      betondeckung: cnomAusExposition(neu, klasse),
    });
  };

  return (
    <>
      <h2 className="schritt-titel">{nr} · Bautechnische Parameter</h2>
      <p className="schritt-hilfe">
        Vorgaben nach {regelwerk.normKurz}. Alle Felder sind sinnvoll vorbelegt –
        Sie müssen nur ändern, was von Ihrem Projekt abweicht. Das Fragezeichen
        neben einem Feld erklärt den Begriff.
      </p>

      {/* ---------------- Gruppe 0: Regelwerk ---------------- */}
      <section className="gruppe">
        <h3 className="gruppe-titel">Regelwerk</h3>
        <div className="feld">
          <label>
            Nationaler Anhang zum Eurocode 2
            <Erklaerung thema="regelwerk" />
          </label>
          <div className="regelwerk-wahl">
            {REGELWERKE.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`regelwerk-knopf${r.id === regelwerk.id ? " aktiv" : ""}`}
                aria-pressed={r.id === regelwerk.id}
                onClick={() => wechsleRegelwerk(r.id)}
              >
                <span className="rw-land">{r.land}</span>
                <span className="rw-norm">{r.normKurz}</span>
              </button>
            ))}
          </div>
          <div className="hinweis">
            Bestimmt Betonstahl ({regelwerk.stahlsorten.map((s) => s.name).join(" / ")},{" "}
            {regelwerk.betonstahlNorm}), Betondeckung und Mindestbewehrung. Ein Wechsel
            ändert die Ergebnisse.
          </div>
        </div>
      </section>

      {/* ---------------- Gruppe 1: Beton ---------------- */}
      <section className="gruppe">
        <h3 className="gruppe-titel">Beton</h3>

        <div className="feld">
          <label>
            Expositionsklasse (Umgebungsbedingungen)
            <Erklaerung thema="expositionsklasse" />
          </label>
          <select
            value={par.expositionsklasse}
            onChange={(e) => {
              const wahl = e.target.value;
              // Betondeckung automatisch mitführen, solange sie dem Vorschlag folgt
              setPar({
                expositionsklasse: wahl,
                betondeckung: deckungAbweichend
                  ? par.betondeckung
                  : cnomAusExposition(regelwerk, wahl),
              });
            }}
          >
            {regelwerk.expositionsklassen.map((x) => (
              <option key={x.name} value={x.name}>
                {x.name} – {x.beschreibung}
              </option>
            ))}
          </select>
          <div className="hinweis">
            Bestimmt Mindestbetondeckung und die empfohlene Betonklasse.
          </div>
        </div>

        <div className="reihe">
          <div className="feld">
            <label>
              Betonklasse
              <Erklaerung thema="betonklasse" />
            </label>
            <select
              value={par.betonklasse}
              onChange={(e) => setPar({ betonklasse: e.target.value })}
            >
              {BETONKLASSEN.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
            <div className="hinweis">
              empfohlen für {par.expositionsklasse}: mindestens {expo?.minBeton}
            </div>
          </div>

          <ZahlFeld
            label="Betondeckung c_nom"
            einheit="mm"
            erklaerung="betondeckung"
            wert={par.betondeckung}
            min={10}
            max={80}
            schritt={5}
            onChange={(v) => setPar({ betondeckung: v })}
            hinweis={
              deckungAbweichend
                ? `abweichend – Normvorschlag: ${vorschlagDeckung} mm`
                : `Normvorschlag für ${par.expositionsklasse}`
            }
          />
        </div>

        {betonZuNiedrig && (
          <div className="warnbox" style={{ marginTop: 4 }}>
            {par.betonklasse} liegt unter der für {par.expositionsklasse} empfohlenen
            Mindestklasse {expo?.minBeton}. Bitte Betonklasse anheben oder mit der
            Tragwerksplanung abstimmen.
          </div>
        )}
      </section>

      {/* ---------------- Gruppe 2: Bewehrung ---------------- */}
      <section className="gruppe">
        <h3 className="gruppe-titel">Bewehrung</h3>

        <div className="reihe">
          <div className="feld">
            <label>
              Betonstahl
              <Erklaerung thema="betonstahl" />
            </label>
            <select
              value={par.stahlguete}
              onChange={(e) => setPar({ stahlguete: e.target.value })}
            >
              {regelwerk.stahlsorten.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.titel}
                </option>
              ))}
            </select>
            <div className="hinweis">
              nach {regelwerk.betonstahlNorm} · f_yk ={" "}
              {regelwerk.stahlsorten.find((s) => s.name === par.stahlguete)?.fyk ??
                regelwerk.stahlsorten[0].fyk}{" "}
              N/mm²
            </div>
          </div>

          {mitMatten && (
            <div className="feld">
              <label>
                Bewehrungslagen
                <Erklaerung thema="lagen" />
              </label>
              <select
                value={par.lagen}
                onChange={(e) => setPar({ lagen: Number(e.target.value) as 1 | 2 })}
              >
                <option value={1}>einlagig (mittig bzw. unten)</option>
                <option value={2}>zweilagig (beidseitig)</option>
              </select>
              <div className="hinweis">ab d ≥ 20 cm üblicherweise zweilagig</div>
            </div>
          )}
        </div>

        <div className="reihe">
          {mitMatten && (
            <div className="feld">
              <label>
                Lagermatte
                <Erklaerung thema="matte" />
              </label>
              <select value={par.matte} onChange={(e) => setPar({ matte: e.target.value })}>
                <option value="auto">automatisch (wirtschaftlichste)</option>
                {LAGERMATTEN.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name} ({m.as} cm²/m)
                  </option>
                ))}
              </select>
              <div className="hinweis">
                {par.matte === "auto"
                  ? "kleinste ausreichende Matte"
                  : "feste Vorgabe – Deckung wird geprüft"}
              </div>
            </div>
          )}

          {mitMatten && (
          <div className="feld">
            <label>
              Raster Anschlussbewehrung
              <Erklaerung thema="stababstand" />
            </label>
            <select
              value={par.stababstand}
              onChange={(e) => setPar({ stababstand: Number(e.target.value) })}
            >
              <option value={150}>Ø10 / 15 cm (eng)</option>
              <option value={200}>Ø10 / 20 cm</option>
              <option value={250}>Ø10 / 25 cm (Standard)</option>
            </select>
          </div>
          )}
        </div>

        {!mitMatten && (
          <div className="hinweis">
            Längsbewehrung und Bügel der Stütze ergeben sich aus Querschnitt und
            Betondeckung – sie werden automatisch nach EC2 9.5 gewählt.
          </div>
        )}
      </section>

      {/* ---------------- Live-Ergebnis dieser Auswahl ---------------- */}
      <h3 className="gruppe-titel" style={{ marginBottom: 8 }}>
        Ergebnis dieser Auswahl
      </h3>
      <div className="kennwert-gitter">
        <div className="kennwert">
          <div className="kw-wert">
            {kennwerte.asMinHaupt.toLocaleString("de-AT")} {kennwerte.hauptEinheit}
          </div>
          <div className="kw-name">{kennwerte.hauptLabel}</div>
        </div>
        <div className="kennwert">
          <div className="kw-wert">{kennwerte.gewaehlteMatte}</div>
          <div className="kw-name">
            {kennwerte.wahlLabel} · vorhanden:{" "}
            {kennwerte.asVorhanden.toLocaleString("de-AT")} {kennwerte.hauptEinheit}
          </div>
        </div>
        <div className="kennwert">
          <div className="kw-wert">{kennwerte.cnom} mm</div>
          <div className="kw-name">Betondeckung c_nom</div>
        </div>
      </div>
      {kennwerte.asVorhanden < kennwerte.asMinHaupt && (
        <div className="warnbox">
          Die gewählte Bewehrung deckt die Mindestbewehrung nicht ab. Bitte eine
          stärkere Matte wählen oder auf „automatisch“ stellen.
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Schritt 6: Firmendaten & Logo                                       */
/* ------------------------------------------------------------------ */

export function Step6Firmendaten({ projekt, set, nr }: StepProps) {
  const fd = projekt.firmendaten;
  const text = (feld: keyof typeof fd) => (e: React.ChangeEvent<HTMLInputElement>) =>
    set((p) => ({ ...p, firmendaten: { ...p.firmendaten, [feld]: e.target.value } }));

  const logoLaden = (e: React.ChangeEvent<HTMLInputElement>) => {
    const datei = e.target.files?.[0];
    if (!datei) return;
    if (datei.size > 500_000) {
      alert("Logo bitte kleiner als 500 kB (PNG oder JPG).");
      return;
    }
    const leser = new FileReader();
    leser.onload = () =>
      set((p) => ({
        ...p,
        firmendaten: { ...p.firmendaten, logoDataUrl: String(leser.result) },
      }));
    leser.readAsDataURL(datei);
  };

  return (
    <>
      <h2 className="schritt-titel">{nr} · Projekt- &amp; Firmendaten</h2>
      <p className="schritt-hilfe">
        Diese Angaben erscheinen im Schriftkopf aller Dokumente. Das Logo bleibt auf
        Ihrem Gerät und wird nur für die PDF-Erstellung übertragen.
      </p>
      <div className="reihe">
        <div className="feld">
          <label>Firma</label>
          <input value={fd.firma} onChange={text("firma")} placeholder="Muster Bau GmbH" />
        </div>
        <div className="feld">
          <label>Planersteller:in</label>
          <input value={fd.planersteller} onChange={text("planersteller")} placeholder="M. Muster" />
        </div>
      </div>
      <div className="feld">
        <label>Bauvorhaben</label>
        <input value={fd.bauvorhaben} onChange={text("bauvorhaben")} placeholder="EFH Familie Muster" />
      </div>
      <div className="reihe">
        <div className="feld">
          <label>Adresse</label>
          <input value={fd.adresse} onChange={text("adresse")} placeholder="Mustergasse 1, 1010 Wien" />
        </div>
        <div className="feld">
          <label>Datum</label>
          <input type="date" value={fd.datum} onChange={text("datum")} />
        </div>
      </div>
      <div className="feld">
        <label>Firmenlogo (PNG/JPG, max. 500 kB)</label>
        <input type="file" accept="image/png,image/jpeg" onChange={logoLaden} />
        {fd.logoDataUrl && (
          <div style={{ marginTop: 8 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fd.logoDataUrl} alt="Logo-Vorschau" className="logo-vorschau" />
            <div>
              <button
                className="knopf klein"
                onClick={() =>
                  set((p) => ({ ...p, firmendaten: { ...p.firmendaten, logoDataUrl: undefined } }))
                }
              >
                Logo entfernen
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
