"use client";

/**
 * Eingabeschritte 1–6 des Wizards.
 * Jeder Schritt erhält den Projekt-Zustand und eine Update-Funktion
 * `set`, die eine Producer-Funktion (alt → neu) entgegennimmt.
 */

import { Projekt, Oeffnung } from "@/lib/types";
import {
  BETONKLASSEN,
  EXPOSITIONSKLASSEN,
  LAGERMATTEN,
  cnomAusExposition,
} from "@/lib/normdaten";
import { oeffnungsDetails } from "@/lib/bewehrung";
import {
  IconWand,
  IconDecke,
  ANSCHLUSS_UNTEN,
  ANSCHLUSS_OBEN,
  ANSCHLUSS_SEITE,
  DECKEN_RAND,
  DetailSturz,
} from "./DetailBilder";

export type Setzer = (fn: (p: Projekt) => Projekt) => void;
interface StepProps {
  projekt: Projekt;
  set: Setzer;
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
}: {
  label: string;
  einheit: string;
  wert: number;
  min: number;
  max: number;
  schritt?: number;
  onChange: (v: number) => void;
  hinweis?: string;
}) {
  return (
    <div className="feld">
      <label>
        {label} <span className="einheit">[{einheit}]</span>
      </label>
      <input
        type="number"
        inputMode="decimal"
        value={wert}
        min={min}
        max={max}
        step={schritt}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (isFinite(v)) onChange(v);
        }}
      />
      {hinweis && <div className="hinweis">{hinweis}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Schritt 1: Bauteilwahl                                              */
/* ------------------------------------------------------------------ */

export function Step1Bauteil({ projekt, set }: StepProps) {
  return (
    <>
      <h2 className="schritt-titel">1 · Bauteil wählen</h2>
      <p className="schritt-hilfe">
        Für welches Bauteil soll die Bewehrung ermittelt werden?
      </p>
      <div className="karten">
        <div
          className={`karte ${projekt.bauteil === "wand" ? "gewaehlt" : ""}`}
          onClick={() => set((p) => ({ ...p, bauteil: "wand" }))}
        >
          <IconWand />
          <div className="karte-titel">Wand</div>
          <div className="karte-text">Stahlbetonwand mit Fenster-/Türöffnungen</div>
        </div>
        <div
          className={`karte ${projekt.bauteil === "decke" ? "gewaehlt" : ""}`}
          onClick={() => set((p) => ({ ...p, bauteil: "decke" }))}
        >
          <IconDecke />
          <div className="karte-titel">Decke / Bodenplatte</div>
          <div className="karte-text">Flachdecke oder Bodenplatte mit Aussparungen</div>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Schritt 2: Grundmaße                                                */
/* ------------------------------------------------------------------ */

export function Step2Masse({ projekt, set }: StepProps) {
  const wand = projekt.bauteil === "wand";
  return (
    <>
      <h2 className="schritt-titel">2 · Grundmaße</h2>
      <p className="schritt-hilfe">
        Alle Maße in Metern. Die Skizze rechts aktualisiert sich live.
      </p>
      <div className="reihe3">
        <ZahlFeld
          label="Länge"
          einheit="m"
          wert={projekt.masse.laenge}
          min={0.5}
          max={100}
          onChange={(v) => set((p) => ({ ...p, masse: { ...p.masse, laenge: v } }))}
        />
        <ZahlFeld
          label={wand ? "Höhe" : "Breite"}
          einheit="m"
          wert={projekt.masse.hoehe}
          min={0.5}
          max={100}
          onChange={(v) => set((p) => ({ ...p, masse: { ...p.masse, hoehe: v } }))}
        />
        <ZahlFeld
          label="Dicke"
          einheit="cm"
          wert={Math.round(projekt.masse.dicke * 100)}
          min={8}
          max={100}
          schritt={1}
          onChange={(v) => set((p) => ({ ...p, masse: { ...p.masse, dicke: v / 100 } }))}
          hinweis={wand ? "üblich: 20–30 cm" : "üblich: 18–25 cm"}
        />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Schritt 3: Öffnungen                                                */
/* ------------------------------------------------------------------ */

export function Step3Oeffnungen({ projekt, set }: StepProps) {
  const wand = projekt.bauteil === "wand";
  const vorschlaege = oeffnungsDetails(projekt);

  const neu = () =>
    set((p) => ({
      ...p,
      oeffnungen: [
        ...p.oeffnungen,
        {
          id: String(Date.now()),
          typ: wand ? "fenster" : "aussparung",
          x: 1,
          y: wand ? 0.9 : 1,
          breite: wand ? 1.2 : 0.6,
          hoehe: wand ? 1.4 : 0.6,
        } as Oeffnung,
      ],
    }));

  const aendere = (id: string, teil: Partial<Oeffnung>) =>
    set((p) => ({
      ...p,
      oeffnungen: p.oeffnungen.map((o) => (o.id === id ? { ...o, ...teil } : o)),
    }));

  const loesche = (id: string) =>
    set((p) => ({ ...p, oeffnungen: p.oeffnungen.filter((o) => o.id !== id) }));

  return (
    <>
      <h2 className="schritt-titel">3 · Öffnungen</h2>
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
                Öffnung {i + 1} ({o.typ === "fenster" ? "Fenster" : o.typ === "tuer" ? "Tür" : "Aussparung"})
              </strong>
              <button className="knopf klein" onClick={() => loesche(o.id)}>
                entfernen
              </button>
            </div>
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
                {wand && <option value="fenster">Fenster</option>}
                {wand && <option value="tuer">Tür</option>}
                <option value="aussparung">Aussparung</option>
              </select>
            </div>
            <div className="reihe">
              <ZahlFeld label="Position x" einheit="m" wert={o.x} min={0} max={100}
                onChange={(v2) => aendere(o.id, { x: v2 })} />
              <ZahlFeld label="Position y" einheit="m" wert={o.y} min={0} max={100}
                onChange={(v2) => aendere(o.id, { y: v2 })} />
            </div>
            <div className="reihe">
              <ZahlFeld label="Breite" einheit="m" wert={o.breite} min={0.1} max={20}
                onChange={(v2) => aendere(o.id, { breite: v2 })} />
              <ZahlFeld label="Höhe" einheit="m" wert={o.hoehe} min={0.1} max={20}
                onChange={(v2) => aendere(o.id, { hoehe: v2 })} />
            </div>
            {v && (
              <div className="detail-vorschlag">
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ width: 64 }}>
                    <DetailSturz />
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
/* Schritt 4: Anschlussdetails                                         */
/* ------------------------------------------------------------------ */

function DetailWahl<T extends string>({
  label,
  wert,
  optionen,
  onChange,
}: {
  label: string;
  wert: T;
  optionen: readonly { wert: string; titel: string; bild: React.ReactNode }[];
  onChange: (v: T) => void;
}) {
  const aktiv = optionen.find((o) => o.wert === wert) ?? optionen[0];
  return (
    <div className="detail-wahl">
      <div className="bild">{aktiv.bild}</div>
      <div className="wahl feld" style={{ marginBottom: 0 }}>
        <label>{label}</label>
        <select value={wert} onChange={(e) => onChange(e.target.value as T)}>
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

export function Step4Anschluesse({ projekt, set }: StepProps) {
  if (projekt.bauteil === "wand") {
    const a = projekt.anschluesse;
    return (
      <>
        <h2 className="schritt-titel">4 · Anschlussdetails</h2>
        <p className="schritt-hilfe">
          Wie schließt die Wand an angrenzende Bauteile an? Das Vorschaubild zeigt das
          gewählte Detail (Beton grau, Bewehrung orange).
        </p>
        <DetailWahl label="Anschluss unten" wert={a.unten} optionen={ANSCHLUSS_UNTEN}
          onChange={(v) => set((p) => ({ ...p, anschluesse: { ...p.anschluesse, unten: v } }))} />
        <DetailWahl label="Anschluss oben" wert={a.oben} optionen={ANSCHLUSS_OBEN}
          onChange={(v) => set((p) => ({ ...p, anschluesse: { ...p.anschluesse, oben: v } }))} />
        <DetailWahl label="Anschluss links" wert={a.links} optionen={ANSCHLUSS_SEITE}
          onChange={(v) => set((p) => ({ ...p, anschluesse: { ...p.anschluesse, links: v } }))} />
        <DetailWahl label="Anschluss rechts" wert={a.rechts} optionen={ANSCHLUSS_SEITE}
          onChange={(v) => set((p) => ({ ...p, anschluesse: { ...p.anschluesse, rechts: v } }))} />
      </>
    );
  }
  const r = projekt.deckenRaender;
  return (
    <>
      <h2 className="schritt-titel">4 · Auflagersituation der Ränder</h2>
      <p className="schritt-hilfe">
        Für jeden Deckenrand: aufgelagert (Wand) oder frei? Freie Ränder erhalten
        Steckbügel als Randeinfassung.
      </p>
      {(["links", "rechts", "oben", "unten"] as const).map((seite) => (
        <DetailWahl
          key={seite}
          label={`Rand ${seite}`}
          wert={r[seite]}
          optionen={DECKEN_RAND}
          onChange={(v) =>
            set((p) => ({ ...p, deckenRaender: { ...p.deckenRaender, [seite]: v } }))
          }
        />
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Schritt 5: Bautechnische Parameter                                  */
/* ------------------------------------------------------------------ */

export function Step5Parameter({ projekt, set }: StepProps) {
  const par = projekt.parameter;
  return (
    <>
      <h2 className="schritt-titel">5 · Bautechnische Parameter</h2>
      <p className="schritt-hilfe">
        Auswahl nach EC2/ÖNORM. Die Betondeckung wird aus der Expositionsklasse
        vorgeschlagen (c<sub>min,dur</sub> + 10 mm) und kann überschrieben werden.
      </p>
      <div className="reihe">
        <div className="feld">
          <label>Betonklasse</label>
          <select
            value={par.betonklasse}
            onChange={(e) =>
              set((p) => ({ ...p, parameter: { ...p.parameter, betonklasse: e.target.value } }))
            }
          >
            {BETONKLASSEN.map((b) => (
              <option key={b.name} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="feld">
          <label>Expositionsklasse</label>
          <select
            value={par.expositionsklasse}
            onChange={(e) => {
              const expo = e.target.value;
              set((p) => ({
                ...p,
                parameter: {
                  ...p.parameter,
                  expositionsklasse: expo,
                  betondeckung: cnomAusExposition(expo),
                },
              }));
            }}
          >
            {EXPOSITIONSKLASSEN.map((x) => (
              <option key={x.name} value={x.name}>
                {x.name} – {x.beschreibung}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="reihe">
        <ZahlFeld
          label="Betondeckung c_nom"
          einheit="mm"
          wert={par.betondeckung}
          min={10}
          max={80}
          schritt={5}
          onChange={(v) => set((p) => ({ ...p, parameter: { ...p.parameter, betondeckung: v } }))}
          hinweis={`Vorschlag für ${par.expositionsklasse}: ${cnomAusExposition(par.expositionsklasse)} mm`}
        />
        <div className="feld">
          <label>Betonstahl</label>
          <select
            value={par.stahlguete}
            onChange={(e) =>
              set((p) => ({
                ...p,
                parameter: { ...p.parameter, stahlguete: e.target.value as "B550A" | "B550B" },
              }))
            }
          >
            <option value="B550B">B550B (Stabstahl, duktil)</option>
            <option value="B550A">B550A (Matten)</option>
          </select>
        </div>
      </div>
      <div className="reihe">
        <div className="feld">
          <label>Bewehrungslagen</label>
          <select
            value={par.lagen}
            onChange={(e) =>
              set((p) => ({ ...p, parameter: { ...p.parameter, lagen: Number(e.target.value) as 1 | 2 } }))
            }
          >
            <option value={1}>einlagig (mittig / nur unten)</option>
            <option value={2}>zweilagig (beidseitig / oben+unten)</option>
          </select>
          <div className="hinweis">Wände ab d ≥ 20 cm üblicherweise zweilagig</div>
        </div>
        <div className="feld">
          <label>Lagermatte</label>
          <select
            value={par.matte}
            onChange={(e) =>
              set((p) => ({ ...p, parameter: { ...p.parameter, matte: e.target.value } }))
            }
          >
            <option value="auto">automatisch (wirtschaftlichste)</option>
            {LAGERMATTEN.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name} ({m.as} cm²/m)
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="reihe">
        <div className="feld">
          <label>Raster Anschlussbewehrung</label>
          <select
            value={par.stababstand}
            onChange={(e) =>
              set((p) => ({ ...p, parameter: { ...p.parameter, stababstand: Number(e.target.value) } }))
            }
          >
            <option value={150}>Ø10 / 15 cm</option>
            <option value={200}>Ø10 / 20 cm</option>
            <option value={250}>Ø10 / 25 cm</option>
          </select>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Schritt 6: Firmendaten & Logo                                       */
/* ------------------------------------------------------------------ */

export function Step6Firmendaten({ projekt, set }: StepProps) {
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
      <h2 className="schritt-titel">6 · Projekt- &amp; Firmendaten</h2>
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
