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
 *
 * Beschriftungsmaßstab: Das SVG wird auf die Breite des Skizzenfelds
 * eingepasst. Ein 10 m langes Streifenfundament ergibt eine viel weitere
 * viewBox als eine 3 m hohe Stütze – bei fester Schriftgröße käme die
 * Beschriftung dort nur halb so groß heraus. Deshalb werden Schriftgrößen,
 * Strichstärken und Randabstände mit dem Faktor `k` mitskaliert, sodass die
 * Beschriftung auf dem Bildschirm bei jedem Bauteil etwa gleich groß wirkt.
 */

import { Ansicht, Stil, Zeichenelement } from "@/lib/bauteile/typen";

const M = 100; // SVG-Einheiten je Meter
const ABSTAND = 60; // Abstand zwischen zwei Ansichten

/**
 * Platzbedarf der Beschriftung je Seite einer Ansicht (in SVG-Einheiten,
 * bei Beschriftungsmaßstab k = 1). Bewusst richtungsabhängig: unten stehen
 * Maßkette, Randtext und Fußzeile übereinander, rechts nur ein gedrehter
 * Randtext. Ein rundum gleicher Rand würde kleine Bauteile – ein 1,5 m
 * großes Einzelfundament etwa – auf einen Bruchteil der Fläche schrumpfen.
 */
const RAND = { links: 84, rechts: 34, oben: 58, unten: 100 };

/**
 * Zusätzlicher Platz, sobald eine zweite Maßkette mit dem Gesamtmaß
 * hinzukommt (sobald eine Öffnung die innere Kette unterteilt).
 */
const RAND_GESAMT = { links: 38, unten: 46 };

/** Inhaltsbreite, auf die der Beschriftungsmaßstab k = 1 abgestimmt ist */
const BEZUGSBREITE = 420;

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
  k,
}: {
  ansicht: Ansicht;
  /** SVG-x der linken Bauteilkante */
  ox: number;
  /** SVG-y der UNTEREN Bauteilkante (y ist im SVG nach unten gerichtet) */
  oy: number;
  /** SVG-Einheiten je Meter dieser Ansicht */
  m: number;
  /** Beschriftungsmaßstab: skaliert Schrift, Striche und Randabstände */
  k: number;
}) {
  const X = (x: number) => ox + x * m;
  const Y = (y: number) => oy - y * m;
  const B = ansicht.breite * m;
  const H = ansicht.hoehe * m;
  /** Hilfsfunktion: feste Maße auf den Beschriftungsmaßstab bringen */
  const p = (wert: number) => wert * k;

  // Unterteilte Kette → zusätzlich das Gesamtmaß als äußere Kette
  const punkteX = stuetzpunkte(ansicht.massketteX ?? []);
  const punkteY = stuetzpunkte(ansicht.massketteY ?? []);
  const gesamtX = punkteX.length > 2;
  const gesamtY = punkteY.length > 2;

  /**
   * Versatzreihe je Maßzahl: 0 = auf der Maßkette. Ist eine Zahl breiter als
   * ihr Feld, wandert sie nach außen – benachbarte enge Felder abwechselnd auf
   * zwei Reihen, damit sich nichts überschreibt. Die Textbreite wird grob aus
   * der Zeichenzahl geschätzt; das reicht für diese Entscheidung.
   */
  const versatz = (felder: number[]) => {
    let reihe = 0;
    return felder.map((b) => {
      const geschaetzt = f(b).length * 0.58 * p(15);
      const passt = geschaetzt <= b * m;
      reihe = passt ? 0 : reihe === 1 ? 2 : 1;
      return reihe;
    });
  };

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
            strokeWidth={p(s.dicke)}
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
            strokeWidth={p(s.dicke)}
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
            strokeWidth={p(s.dicke)}
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
            r={Math.max(p(3.2), e.r * m)}
            fill={e.ton === "kante" ? FARBE.kante : FARBE.akzent}
          />
        );
      case "text": {
        const rolle = e.rolle ?? "normal";
        const groesse = p(rolle === "marke" ? 16 : rolle === "klein" ? 12 : 14);
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
    const punkte = punkteX;
    if (punkte.length < 2) return null;
    const y = oy + p(40);
    return (
      <g stroke={FARBE.mass} strokeWidth={p(1.2)} fill="none">
        <line x1={X(punkte[0])} y1={y} x2={X(punkte[punkte.length - 1])} y2={y} />
        {punkte.map((x) => (
          <g key={x}>
            <line x1={X(x)} y1={y - p(6)} x2={X(x)} y2={y + p(6)} />
            <line x1={X(x) - p(5)} y1={y + p(5)} x2={X(x) + p(5)} y2={y - p(5)} />
          </g>
        ))}
        {punkte.slice(0, -1).map((x, i, alle) => {
          const b = punkte[i + 1] - x;
          // Passt die Zahl nicht in ihr Feld, wandert sie versetzt nach außen
          const reihe = versatz(alle.map((v, j) => punkte[j + 1] - v))[i];
          return (
            <text
              key={i}
              x={X(x + b / 2)}
              // Reihe 1 liegt zwischen Kette und Bauteil, Reihe 2 außerhalb –
              // so bleibt der Platzbedarf unter der Kette klein.
              y={y + (reihe === 0 ? -p(9) : reihe === 1 ? -p(25) : p(13))}
              textAnchor="middle"
              fontSize={p(15)}
              fill={FARBE.mass}
              stroke="#fff"
              strokeWidth={p(3.5)}
              paintOrder="stroke"
            >
              {f(b)}
            </text>
          );
        })}
        {/*
          Gesamtmaß als zweite, äußere Kette: Sobald eine Öffnung die Kette
          unterteilt, stünden sonst nur Teilmaße da – die Gesamtlänge müsste
          man addieren. Die Maßzahl steht UNTER der Linie, damit sie den
          ausgewichenen Teilmaßen nicht in die Quere kommt.
        */}
        {gesamtX && (
          <g>
            <line
              x1={X(punkte[0])}
              y1={oy + p(78)}
              x2={X(punkte[punkte.length - 1])}
              y2={oy + p(78)}
            />
            {[punkte[0], punkte[punkte.length - 1]].map((x) => (
              <g key={x}>
                <line x1={X(x)} y1={oy + p(72)} x2={X(x)} y2={oy + p(84)} />
                <line x1={X(x) - p(5)} y1={oy + p(83)} x2={X(x) + p(5)} y2={oy + p(73)} />
              </g>
            ))}
            <text
              x={X((punkte[0] + punkte[punkte.length - 1]) / 2)}
              y={oy + p(95)}
              textAnchor="middle"
              fontSize={p(16)}
              fontWeight={600}
              fill={FARBE.mass}
              stroke="#fff"
              strokeWidth={p(3.5)}
              paintOrder="stroke"
            >
              {f(punkte[punkte.length - 1] - punkte[0])}
            </text>
          </g>
        )}
      </g>
    );
  };

  const massV = () => {
    const punkte = punkteY;
    if (punkte.length < 2) return null;
    const x = ox - p(46);
    return (
      <g stroke={FARBE.mass} strokeWidth={p(1.2)} fill="none">
        <line x1={x} y1={Y(punkte[0])} x2={x} y2={Y(punkte[punkte.length - 1])} />
        {punkte.map((y) => (
          <g key={y}>
            <line x1={x - p(6)} y1={Y(y)} x2={x + p(6)} y2={Y(y)} />
            <line x1={x - p(5)} y1={Y(y) + p(5)} x2={x + p(5)} y2={Y(y) - p(5)} />
          </g>
        ))}
        {punkte.slice(0, -1).map((y, i, alle) => {
          const b = punkte[i + 1] - y;
          const my = Y(y + b / 2);
          const reihe = versatz(alle.map((v, j) => punkte[j + 1] - v))[i];
          const mx = x + (reihe === 0 ? -p(9) : reihe === 1 ? p(14) : -p(27));
          return (
            <text
              key={i}
              x={mx}
              y={my}
              textAnchor="middle"
              fontSize={p(15)}
              fill={FARBE.mass}
              stroke="#fff"
              strokeWidth={p(3.5)}
              paintOrder="stroke"
              transform={`rotate(-90 ${mx} ${my})`}
            >
              {f(b)}
            </text>
          );
        })}
        {/* Gesamthöhe als zweite Kette – gleiche Überlegung wie waagrecht */}
        {gesamtY && (
          <g>
            <line
              x1={ox - p(84)}
              y1={Y(punkte[0])}
              x2={ox - p(84)}
              y2={Y(punkte[punkte.length - 1])}
            />
            {[punkte[0], punkte[punkte.length - 1]].map((y) => (
              <g key={y}>
                <line x1={ox - p(90)} y1={Y(y)} x2={ox - p(78)} y2={Y(y)} />
                <line
                  x1={ox - p(89)}
                  y1={Y(y) + p(5)}
                  x2={ox - p(79)}
                  y2={Y(y) - p(5)}
                />
              </g>
            ))}
            <text
              x={ox - p(94)}
              y={Y((punkte[0] + punkte[punkte.length - 1]) / 2)}
              textAnchor="middle"
              fontSize={p(16)}
              fontWeight={600}
              fill={FARBE.mass}
              stroke="#fff"
              strokeWidth={p(3.5)}
              paintOrder="stroke"
              transform={`rotate(-90 ${ox - p(94)} ${Y((punkte[0] + punkte[punkte.length - 1]) / 2)})`}
            >
              {f(punkte[punkte.length - 1] - punkte[0])}
            </text>
          </g>
        )}
      </g>
    );
  };

  /* ---------- Randbeschriftungen ---------- */
  // Sie stehen außerhalb der Maßketten; wie weit außen, hängt davon ab, ob
  // es dort eine zweite Kette gibt.
  const rand = (ansicht.randtexte ?? []).filter((r) => r.text);
  const randPos = (seite: string) => {
    switch (seite) {
      case "unten":
        return { x: ox + B / 2, y: oy + p(gesamtX ? 112 : 64), rot: false };
      case "oben":
        return { x: ox + B / 2, y: oy - H - p(14), rot: false };
      case "links":
        return { x: ox - p(gesamtY ? 110 : 76), y: oy - H / 2, rot: true };
      default:
        return { x: ox + B + p(20), y: oy - H / 2, rot: true };
    }
  };

  return (
    <g>
      {ansicht.elemente.map(zeichne)}
      {massH()}
      {massV()}
      <g fontSize={p(13)} fill={FARBE.akzent} fontWeight="600">
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
      <text x={ox + B / 2} y={oy - H - p(40)} textAnchor="middle" fontSize={p(16)} fontWeight="600" fill={FARBE.kante}>
        {ansicht.eigenerMassstab ? `${ansicht.titel} (vergrößert)` : ansicht.titel}
      </text>
      {ansicht.fuss && (
        <text
          x={ox + B / 2}
          y={oy + p(gesamtX ? 130 : 92)}
          textAnchor="middle"
          fontSize={p(13)}
          fill={FARBE.mass}
        >
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

  // Zielgröße eines Detailschnitts: fix, mindestens aber knapp die Hälfte der
  // Hauptansicht – sonst wirkt er neben einer langen Ansicht verloren.
  const hauptBreite = Math.max(
    ...ansichten.filter((a) => !a.eigenerMassstab).map((a) => a.breite * M),
    DETAIL_ZIEL
  );
  const detailZiel = Math.max(DETAIL_ZIEL, 0.45 * hauptBreite);

  /** SVG-Einheiten je Meter für eine Ansicht */
  const faktor = (a: Ansicht) => {
    if (!a.eigenerMassstab) return M;
    const laengsteSeite = Math.max(a.breite, a.hoehe, 0.01);
    // nie kleiner als der Grundmaßstab, aber auch nicht beliebig groß
    return Math.min(Math.max(M, detailZiel / laengsteSeite), 12 * M);
  };

  const bloecke = ansichten.map((a) => {
    const m = faktor(a);
    // Eine unterteilte Kette bekommt zusätzlich das Gesamtmaß – dafür braucht
    // die betreffende Seite mehr Rand. Je Ansicht gerechnet, damit ein
    // Querschnitt ohne Öffnungen nicht unnötig Platz verschenkt.
    const zusatzL = stuetzpunkte(a.massketteY ?? []).length > 2 ? RAND_GESAMT.links : 0;
    const zusatzU = stuetzpunkte(a.massketteX ?? []).length > 2 ? RAND_GESAMT.unten : 0;
    return { a, m, breite: a.breite * m, hoehe: a.hoehe * m, zusatzL, zusatzU };
  });

  /* ---- ein- oder zweizeilig? ---- */
  const haupt = bloecke.filter((b) => !b.a.eigenerMassstab);
  const detail = bloecke.filter((b) => b.a.eigenerMassstab);
  const einzeiligB = bloecke.reduce((sum, b) => sum + b.breite, 0);
  const einzeiligH = Math.max(...bloecke.map((b) => b.hoehe));
  const zweizeilig =
    haupt.length > 0 && detail.length > 0 && einzeiligB / einzeiligH > MAX_VERHAELTNIS;
  const reihen = zweizeilig ? [haupt, detail] : [bloecke];

  /**
   * Beschriftungsmaßstab: Ein sehr breites Bauteil ergibt eine weite viewBox
   * und damit eine optisch kleine Beschriftung. Der Faktor gleicht das aus,
   * indem Schrift, Striche und Ränder proportional mitwachsen. Bezug ist
   * allein die gezeichnete Breite – die Ränder hängen selbst von k ab und
   * dürfen deshalb nicht in die Ermittlung eingehen.
   */
  const inhaltB = Math.max(
    ...reihen.map((r) => r.reduce((sum, b) => sum + b.breite, 0) + ABSTAND * (r.length - 1))
  );
  const k = Math.min(3, Math.max(0.85, inhaltB / BEZUGSBREITE));
  const rand = {
    links: RAND.links * k,
    rechts: RAND.rechts * k,
    oben: RAND.oben * k,
    unten: RAND.unten * k,
  };
  const luft = ABSTAND * k;

  /* ---- Reihen vermessen ---- */
  const masse = reihen.map((reihe) => ({
    reihe,
    breite:
      reihe.reduce(
        (sum, b) => sum + b.breite + rand.links + b.zusatzL * k + rand.rechts,
        0
      ) + luft * (reihe.length - 1),
    inhaltH: Math.max(...reihe.map((b) => b.hoehe)),
    // Der untere Rand der Reihe richtet sich nach der Ansicht mit dem
    // größten Bedarf; sonst ragte eine zweite Maßkette in die nächste Reihe.
    randU: rand.unten + Math.max(...reihe.map((b) => b.zusatzU)) * k,
  }));
  const gesamtB = Math.max(...masse.map((r) => r.breite));
  const gesamtH =
    masse.reduce((sum, r) => sum + r.inhaltH + rand.oben + r.randU, 0) +
    luft * (masse.length - 1);

  /* ---- Blöcke platzieren ---- */
  const platziert: { a: Ansicht; ox: number; oy: number; m: number }[] = [];
  let reihenOben = 0;
  for (const r of masse) {
    let cursor = (gesamtB - r.breite) / 2; // Reihe waagrecht mittig
    for (const b of r.reihe) {
      platziert.push({
        a: b.a,
        m: b.m,
        ox: cursor + rand.links + b.zusatzL * k,
        // Unterkante der Ansicht; kleinere Ansichten hängen mittig in der Reihe
        oy: reihenOben + rand.oben + r.inhaltH - (r.inhaltH - b.hoehe) / 2,
      });
      cursor += b.breite + rand.links + b.zusatzL * k + rand.rechts + luft;
    }
    reihenOben += r.inhaltH + rand.oben + r.randU + luft;
  }

  return (
    <svg viewBox={`0 0 ${gesamtB} ${gesamtH}`} preserveAspectRatio="xMidYMid meet">
      {platziert.map(({ a, ox, oy, m }) => (
        <AnsichtGruppe key={a.id} ansicht={a} ox={ox} oy={oy} m={m} k={k} />
      ))}
    </svg>
  );
}
