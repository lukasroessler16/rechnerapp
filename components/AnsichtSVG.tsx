/**
 * SVG-Renderer für die abstrakten Bauteil-Ansichten (lib/bauteile/typen.ts).
 *
 * Das Bauteilmodul beschreibt seine Zeichnung einmal in Bauteilkoordinaten
 * (Meter, Ursprung links unten, y nach oben). Dieser Renderer bringt sie auf
 * den Bildschirm, der Renderer in lib/pdf/ansicht.ts auf Papier – dieselbe
 * Beschreibung, zwei Ausgaben, keine doppelte Zeichenlogik mehr.
 *
 * Mehrere Ansichten eines Bauteils (z. B. Längs- und Querschnitt einer
 * Stütze) werden im gleichen Maßstab nebeneinandergestellt.
 */

import { Ansicht, Stil, Zeichenelement } from "@/lib/bauteile/typen";

const M = 100; // SVG-Einheiten je Meter
const RAND = 120; // Platz für Maßketten und Beschriftungen je Ansicht
const ABSTAND = 60; // Abstand zwischen zwei Ansichten

const FARBE = {
  beton: "#e2e5e9",
  weiss: "#ffffff",
  kante: "#1c2430",
  mass: "#5a6472",
  akzent: "#e8590c",
};

/** Strichstärke und Farbe je Linienstil */
const STRICH: Record<Stil, { farbe: string; dicke: number; strichmuster?: string }> = {
  kante: { farbe: FARBE.kante, dicke: 2.4 },
  duenn: { farbe: FARBE.kante, dicke: 1.6 },
  hilfslinie: { farbe: FARBE.mass, dicke: 0.8 },
  strich: { farbe: FARBE.mass, dicke: 1.0, strichmuster: "6 4" },
  stahl: { farbe: FARBE.akzent, dicke: 1.8 },
};

/** Maßzahl-Formatierung: 2,455 → "2,46" (Plan-üblich in m) */
const f = (m: number) => m.toFixed(2).replace(".", ",");

/** doppelte Stützpunkte entfernen und sortieren */
const stuetzpunkte = (werte: number[]) =>
  [...new Set(werte.map((v) => Math.round(v * 1000) / 1000))].sort((a, b) => a - b);

/* ------------------------------------------------------------------ */
/* Einzelne Ansicht                                                    */
/* ------------------------------------------------------------------ */

function AnsichtGruppe({
  ansicht,
  ox,
  oy,
  m,
}: {
  ansicht: Ansicht;
  /** SVG-x der linken Bauteilkante */
  ox: number;
  /** SVG-y der UNTEREN Bauteilkante (y ist im SVG nach unten gerichtet) */
  oy: number;
  /** SVG-Einheiten je Meter dieser Ansicht */
  m: number;
}) {
  const X = (x: number) => ox + x * m;
  const Y = (y: number) => oy - y * m;
  const B = ansicht.breite * m;
  const H = ansicht.hoehe * m;

  /* ---------- Zeichenelemente ---------- */
  const zeichne = (e: Zeichenelement, i: number) => {
    switch (e.art) {
      case "flaeche":
        return (
          <rect
            key={i}
            x={X(e.x)}
            y={Y(e.y + e.h)}
            width={e.b * m}
            height={e.h * m}
            fill={e.ton === "beton" ? FARBE.beton : FARBE.weiss}
          />
        );
      case "rahmen": {
        const s = STRICH[e.stil ?? "kante"];
        return (
          <rect
            key={i}
            x={X(e.x)}
            y={Y(e.y + e.h)}
            width={e.b * m}
            height={e.h * m}
            fill="none"
            stroke={s.farbe}
            strokeWidth={s.dicke}
            strokeDasharray={s.strichmuster}
          />
        );
      }
      case "linie": {
        const s = STRICH[e.stil ?? "duenn"];
        return (
          <line
            key={i}
            x1={X(e.x1)}
            y1={Y(e.y1)}
            x2={X(e.x2)}
            y2={Y(e.y2)}
            stroke={s.farbe}
            strokeWidth={s.dicke}
            strokeDasharray={s.strichmuster}
          />
        );
      }
      case "polylinie": {
        const s = STRICH[e.stil ?? "duenn"];
        const d =
          e.punkte.map((p, j) => `${j === 0 ? "M" : "L"} ${X(p[0])} ${Y(p[1])}`).join(" ") +
          (e.geschlossen ? " Z" : "");
        return (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={s.farbe}
            strokeWidth={s.dicke}
            strokeDasharray={s.strichmuster}
          />
        );
      }
      case "kreis":
        // Bewehrungsstäbe wären maßstäblich unsichtbar → Mindestgröße
        return (
          <circle
            key={i}
            cx={X(e.x)}
            cy={Y(e.y)}
            r={Math.max(3.2, e.r * m)}
            fill={e.ton === "kante" ? FARBE.kante : FARBE.akzent}
          />
        );
      case "text": {
        const rolle = e.rolle ?? "normal";
        const groesse = rolle === "marke" ? 16 : rolle === "klein" ? 12 : 14;
        const farbe = rolle === "marke" ? FARBE.akzent : FARBE.mass;
        const px = X(e.x);
        const py = Y(e.y) + groesse / 3;
        return (
          <text
            key={i}
            x={px}
            y={py}
            fontSize={groesse}
            fontWeight={rolle === "marke" ? 600 : 400}
            fill={farbe}
            textAnchor={
              e.ausrichtung === "rechts" ? "end" : e.ausrichtung === "links" ? "start" : "middle"
            }
            transform={e.drehung ? `rotate(${-e.drehung} ${px} ${py})` : undefined}
          >
            {e.text}
          </text>
        );
      }
    }
  };

  /* ---------- Maßketten ---------- */
  const massH = () => {
    const punkte = stuetzpunkte(ansicht.massketteX ?? []);
    if (punkte.length < 2) return null;
    const y = oy + 40;
    return (
      <g stroke={FARBE.mass} strokeWidth="1.2" fill="none">
        <line x1={X(punkte[0])} y1={y} x2={X(punkte[punkte.length - 1])} y2={y} />
        {punkte.map((x) => (
          <g key={x}>
            <line x1={X(x)} y1={y - 6} x2={X(x)} y2={y + 6} />
            <line x1={X(x) - 5} y1={y + 5} x2={X(x) + 5} y2={y - 5} />
          </g>
        ))}
        {punkte.slice(0, -1).map((x, i) => {
          const b = punkte[i + 1] - x;
          return (
            <text
              key={i}
              x={X(x + b / 2)}
              y={y - 9}
              textAnchor="middle"
              fontSize="15"
              fill={FARBE.mass}
              stroke="none"
            >
              {f(b)}
            </text>
          );
        })}
      </g>
    );
  };

  const massV = () => {
    const punkte = stuetzpunkte(ansicht.massketteY ?? []);
    if (punkte.length < 2) return null;
    const x = ox - 46;
    return (
      <g stroke={FARBE.mass} strokeWidth="1.2" fill="none">
        <line x1={x} y1={Y(punkte[0])} x2={x} y2={Y(punkte[punkte.length - 1])} />
        {punkte.map((y) => (
          <g key={y}>
            <line x1={x - 6} y1={Y(y)} x2={x + 6} y2={Y(y)} />
            <line x1={x - 5} y1={Y(y) + 5} x2={x + 5} y2={Y(y) - 5} />
          </g>
        ))}
        {punkte.slice(0, -1).map((y, i) => {
          const b = punkte[i + 1] - y;
          const my = Y(y + b / 2);
          return (
            <text
              key={i}
              x={x - 9}
              y={my}
              textAnchor="middle"
              fontSize="15"
              fill={FARBE.mass}
              stroke="none"
              transform={`rotate(-90 ${x - 9} ${my})`}
            >
              {f(b)}
            </text>
          );
        })}
      </g>
    );
  };

  /* ---------- Randbeschriftungen ---------- */
  const rand = (ansicht.randtexte ?? []).filter((r) => r.text);
  const randPos = (seite: string) => {
    switch (seite) {
      case "unten":
        return { x: ox + B / 2, y: oy + 64, rot: false };
      case "oben":
        return { x: ox + B / 2, y: oy - H - 14, rot: false };
      case "links":
        return { x: ox - 76, y: oy - H / 2, rot: true };
      default:
        return { x: ox + B + 20, y: oy - H / 2, rot: true };
    }
  };

  return (
    <g>
      {ansicht.elemente.map(zeichne)}
      {massH()}
      {massV()}
      <g fontSize="13" fill={FARBE.akzent} fontWeight="600">
        {rand.map((r, i) => {
          const p = randPos(r.seite);
          return (
            <text
              key={i}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              transform={p.rot ? `rotate(-90 ${p.x} ${p.y})` : undefined}
            >
              {r.text}
            </text>
          );
        })}
      </g>
      <text x={ox + B / 2} y={oy - H - 40} textAnchor="middle" fontSize="16" fontWeight="600" fill={FARBE.kante}>
        {ansicht.eigenerMassstab ? `${ansicht.titel} (vergrößert)` : ansicht.titel}
      </text>
      {ansicht.fuss && (
        <text x={ox + B / 2} y={oy + 92} textAnchor="middle" fontSize="13" fill={FARBE.mass}>
          {ansicht.fuss}
        </text>
      )}
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Alle Ansichten nebeneinander                                        */
/* ------------------------------------------------------------------ */

/**
 * Detailschnitte (eigenerMassstab) werden vergrößert dargestellt – ein
 * Stützenquerschnitt wäre im Maßstab der Ansicht nur wenige Pixel groß.
 * Zielgröße in SVG-Einheiten für die längere Seite eines Detailschnitts:
 */
const DETAIL_ZIEL = 260;

/**
 * Ab diesem Seitenverhältnis wird die Zeichnung zweizeilig gesetzt.
 * Ein 6 m langer Träger neben seinem Querschnitt ergäbe sonst ein extrem
 * breites, flaches Bild, das im Skizzenfeld winzig herauskommt.
 */
const MAX_VERHAELTNIS = 1.8;

export default function AnsichtSVG({ ansichten }: { ansichten: Ansicht[] }) {
  if (ansichten.length === 0) return null;

  /** SVG-Einheiten je Meter für eine Ansicht */
  const faktor = (a: Ansicht) => {
    if (!a.eigenerMassstab) return M;
    const laengsteSeite = Math.max(a.breite, a.hoehe, 0.01);
    // nie kleiner als der Grundmaßstab, aber auch nicht beliebig groß
    return Math.min(Math.max(M, DETAIL_ZIEL / laengsteSeite), 12 * M);
  };

  const bloecke = ansichten.map((a) => {
    const m = faktor(a);
    return { a, m, breite: a.breite * m, hoehe: a.hoehe * m };
  });

  /* ---- ein- oder zweizeilig? ---- */
  const haupt = bloecke.filter((b) => !b.a.eigenerMassstab);
  const detail = bloecke.filter((b) => b.a.eigenerMassstab);
  const einzeiligB =
    bloecke.reduce((sum, b) => sum + b.breite + 2 * RAND, 0) + ABSTAND * (bloecke.length - 1);
  const einzeiligH = Math.max(...bloecke.map((b) => b.hoehe)) + 2 * RAND;
  const zweizeilig =
    haupt.length > 0 && detail.length > 0 && einzeiligB / einzeiligH > MAX_VERHAELTNIS;
  const reihen = zweizeilig ? [haupt, detail] : [bloecke];

  /* ---- Reihen vermessen ---- */
  const masse = reihen.map((reihe) => ({
    reihe,
    breite:
      reihe.reduce((sum, b) => sum + b.breite + 2 * RAND, 0) + ABSTAND * (reihe.length - 1),
    inhaltH: Math.max(...reihe.map((b) => b.hoehe)),
  }));
  const gesamtB = Math.max(...masse.map((r) => r.breite));
  const gesamtH =
    masse.reduce((sum, r) => sum + r.inhaltH + 2 * RAND, 0) + ABSTAND * (masse.length - 1);

  /* ---- Blöcke platzieren ---- */
  const platziert: { a: Ansicht; ox: number; oy: number; m: number }[] = [];
  let reihenOben = 0;
  for (const r of masse) {
    let cursor = (gesamtB - r.breite) / 2; // Reihe waagrecht mittig
    for (const b of r.reihe) {
      platziert.push({
        a: b.a,
        m: b.m,
        ox: cursor + RAND,
        // Unterkante der Ansicht; kleinere Ansichten hängen mittig in der Reihe
        oy: reihenOben + RAND + r.inhaltH - (r.inhaltH - b.hoehe) / 2,
      });
      cursor += b.breite + 2 * RAND + ABSTAND;
    }
    reihenOben += r.inhaltH + 2 * RAND + ABSTAND;
  }

  return (
    <svg viewBox={`0 0 ${gesamtB} ${gesamtH}`} preserveAspectRatio="xMidYMid meet">
      {platziert.map(({ a, ox, oy, m }) => (
        <AnsichtGruppe key={a.id} ansicht={a} ox={ox} oy={oy} m={m} />
      ))}
    </svg>
  );
}
