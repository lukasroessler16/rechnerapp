/**
 * Live-Skizze: maßstäbliche 2D-Darstellung des Bauteils mit Öffnungen
 * und Maßketten. Reines SVG, wird bei jeder Eingabe neu gerendert.
 *
 * Koordinaten: 1 m = 100 SVG-Einheiten. Ursprung der Bauteilfläche bei
 * (RAND, RAND); die y-Achse wird gespiegelt (Bauwesen: y nach oben).
 */

import { Projekt, Oeffnung } from "@/lib/types";

const M = 100; // Maßstab: SVG-Einheiten je Meter
const RAND = 120; // Platz für Maßketten

const farbe = {
  beton: "#e2e5e9",
  kante: "#1c2430",
  mass: "#5a6472",
  oeffnung: "#ffffff",
  akzent: "#e8590c",
};

/** Maßzahl-Formatierung: 2,455 → "2.46" (Plan-üblich in m) */
const f = (m: number) => m.toFixed(2).replace(".", ",");

/** Eine horizontale Maßkette mit Begrenzungsstrichen */
function MassketteH({ xs, y }: { xs: number[]; y: number }) {
  const sorted = [...new Set(xs.map((x) => Math.round(x * 1000) / 1000))].sort((a, b) => a - b);
  if (sorted.length < 2) return null;
  return (
    <g stroke={farbe.mass} strokeWidth="1.2" fill="none">
      <line x1={RAND + sorted[0] * M} y1={y} x2={RAND + sorted[sorted.length - 1] * M} y2={y} />
      {sorted.map((x) => (
        <g key={x}>
          <line x1={RAND + x * M} y1={y - 6} x2={RAND + x * M} y2={y + 6} />
          <line x1={RAND + x * M - 5} y1={y + 5} x2={RAND + x * M + 5} y2={y - 5} />
        </g>
      ))}
      {sorted.slice(0, -1).map((x, i) => {
        const b = sorted[i + 1] - x;
        return (
          <text
            key={i}
            x={RAND + (x + b / 2) * M}
            y={y - 9}
            textAnchor="middle"
            fontSize="15"
            fill={farbe.mass}
            stroke="none"
          >
            {f(b)}
          </text>
        );
      })}
    </g>
  );
}

/** Eine vertikale Maßkette (y-Werte in Bauteilkoordinaten, von unten) */
function MassketteV({ ys, x, hoehe }: { ys: number[]; x: number; hoehe: number }) {
  const sorted = [...new Set(ys.map((y) => Math.round(y * 1000) / 1000))].sort((a, b) => a - b);
  if (sorted.length < 2) return null;
  const Y = (y: number) => RAND + (hoehe - y) * M; // gespiegelt
  return (
    <g stroke={farbe.mass} strokeWidth="1.2" fill="none">
      <line x1={x} y1={Y(sorted[0])} x2={x} y2={Y(sorted[sorted.length - 1])} />
      {sorted.map((y) => (
        <g key={y}>
          <line x1={x - 6} y1={Y(y)} x2={x + 6} y2={Y(y)} />
          <line x1={x - 5} y1={Y(y) + 5} x2={x + 5} y2={Y(y) - 5} />
        </g>
      ))}
      {sorted.slice(0, -1).map((y, i) => {
        const b = sorted[i + 1] - y;
        return (
          <text
            key={i}
            x={x - 9}
            y={Y(y + b / 2)}
            textAnchor="middle"
            fontSize="15"
            fill={farbe.mass}
            stroke="none"
            transform={`rotate(-90 ${x - 9} ${Y(y + b / 2)})`}
          >
            {f(b)}
          </text>
        );
      })}
    </g>
  );
}

/** Darstellung einer Öffnung (Fenster: Kreuz, Tür: Schwelle offen) */
function OeffnungSVG({ o, hoehe, index }: { o: Oeffnung; hoehe: number; index: number }) {
  const x = RAND + o.x * M;
  const y = RAND + (hoehe - o.y - o.hoehe) * M;
  const w = o.breite * M;
  const h = o.hoehe * M;
  const label =
    (o.typ === "fenster" ? "F" : o.typ === "tuer" ? "T" : "A") + (index + 1);
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={farbe.oeffnung} stroke={farbe.kante} strokeWidth="1.6" />
      {o.typ !== "tuer" && (
        <g stroke={farbe.kante} strokeWidth="0.8">
          <line x1={x} y1={y} x2={x + w} y2={y + h} />
          <line x1={x + w} y1={y} x2={x} y2={y + h} />
        </g>
      )}
      {o.typ === "tuer" && (
        <path
          d={`M ${x + 4} ${y + h} A ${w - 8} ${w - 8} 0 0 1 ${x + w - 4} ${y + h - (w - 8)}`}
          fill="none"
          stroke={farbe.kante}
          strokeWidth="0.8"
          strokeDasharray="4 3"
        />
      )}
      <text x={x + w / 2} y={y + h / 2 + 5} textAnchor="middle" fontSize="16" fontWeight="600" fill={farbe.akzent}>
        {label}
      </text>
    </g>
  );
}

/** Beschriftung der Anschlussdetails an den Rändern */
function RandText({ projekt }: { projekt: Projekt }) {
  const { masse } = projekt;
  const B = masse.laenge * M;
  const H = masse.hoehe * M;
  const texte: { x: number; y: number; t: string; rot?: boolean }[] = [];
  if (projekt.bauteil === "wand") {
    const a = projekt.anschluesse;
    const namen: Record<string, string> = {
      bodenplatte: "Bodenplatte",
      streifenfundament: "Streifenfundament",
      decke_unter: "Decke unten",
      decke_ueber: "Decke oben",
      wand_weiter: "Wand läuft weiter",
      ecke: "Ecke",
      wandstoss: "Wandstoß",
      frei: "frei",
    };
    texte.push({ x: RAND + B / 2, y: RAND + H + 24, t: `Anschluss unten: ${namen[a.unten]}` });
    texte.push({ x: RAND + B / 2, y: RAND - 12, t: `Anschluss oben: ${namen[a.oben]}` });
    texte.push({ x: RAND - 14, y: RAND + H / 2, t: namen[a.links], rot: true });
    texte.push({ x: RAND + B + 16, y: RAND + H / 2, t: namen[a.rechts], rot: true });
  } else {
    const r = projekt.deckenRaender;
    const namen: Record<string, string> = { wand_auflager: "Auflager (Wand)", frei: "freier Rand" };
    texte.push({ x: RAND + B / 2, y: RAND + H + 24, t: namen[r.unten] });
    texte.push({ x: RAND + B / 2, y: RAND - 12, t: namen[r.oben] });
    texte.push({ x: RAND - 14, y: RAND + H / 2, t: namen[r.links], rot: true });
    texte.push({ x: RAND + B + 16, y: RAND + H / 2, t: namen[r.rechts], rot: true });
  }
  return (
    <g fontSize="13" fill={farbe.akzent} fontWeight="600">
      {texte.map((t, i) => (
        <text
          key={i}
          x={t.x}
          y={t.y}
          textAnchor="middle"
          transform={t.rot ? `rotate(-90 ${t.x} ${t.y})` : undefined}
        >
          {t.t}
        </text>
      ))}
    </g>
  );
}

export default function SkizzeSVG({ projekt }: { projekt: Projekt }) {
  const { masse, oeffnungen } = projekt;
  const B = masse.laenge * M;
  const H = masse.hoehe * M;
  const gesamtB = B + 2 * RAND;
  const gesamtH = H + 2 * RAND;

  // Maßketten-Stützpunkte: Bauteilränder + Öffnungsränder
  const xs = [0, masse.laenge, ...oeffnungen.flatMap((o) => [o.x, o.x + o.breite])];
  const ys = [0, masse.hoehe, ...oeffnungen.flatMap((o) => [o.y, o.y + o.hoehe])];

  return (
    <svg viewBox={`0 0 ${gesamtB} ${gesamtH}`} preserveAspectRatio="xMidYMid meet">
      {/* Bauteilfläche */}
      <rect x={RAND} y={RAND} width={B} height={H} fill={farbe.beton} stroke={farbe.kante} strokeWidth="2.4" />
      {/* Öffnungen */}
      {oeffnungen.map((o, i) => (
        <OeffnungSVG key={o.id} o={o} hoehe={masse.hoehe} index={i} />
      ))}
      {/* Maßketten */}
      <MassketteH xs={xs} y={RAND + H + 52} />
      <MassketteV ys={ys} x={RAND - 52} hoehe={masse.hoehe} />
      {/* Anschluss-Beschriftungen */}
      <RandText projekt={projekt} />
      {/* Bauteil-Info */}
      <text x={RAND} y={gesamtH - 14} fontSize="14" fill={farbe.mass}>
        {projekt.bauteil === "wand" ? "Wandansicht" : "Deckendraufsicht"} · d = {f(masse.dicke)} m ·
        M 1:{Math.round(Math.max(masse.laenge, masse.hoehe) * 20)} (Bildschirm)
      </text>
    </svg>
  );
}
