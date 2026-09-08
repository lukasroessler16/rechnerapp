/**
 * Kleine SVG-Vorschauen der drei Dokumente für die Startseite.
 * Bewusst schematisch: Sie zeigen den Aufbau (Zeichnung, Tabelle, Schriftkopf),
 * ohne echte Inhalte vorwegzunehmen – die echten Muster gibt es als PDF.
 */

const linie = "#c8cdd4";
const kante = "#9aa4b2";
const akzent = "#e8590c";
const flaeche = "#eef0f3";

function Blatt({
  quer = false,
  children,
}: {
  quer?: boolean;
  children: React.ReactNode;
}) {
  const b = quer ? 148 : 105;
  const h = quer ? 105 : 148;
  return (
    <svg viewBox={`0 0 ${b} ${h}`} className="dokblatt" role="img">
      <rect x="0.5" y="0.5" width={b - 1} height={h - 1} fill="#fff" stroke={kante} />
      {children}
    </svg>
  );
}

/** Bauplan: Zeichnung mit Maßketten und Schriftkopf unten rechts */
export function VorschauBauplan() {
  return (
    <Blatt quer>
      {/* Wandansicht */}
      <rect x="18" y="26" width="86" height="34" fill={flaeche} stroke="#5a6472" strokeWidth="0.8" />
      <rect x="34" y="34" width="16" height="15" fill="#fff" stroke="#5a6472" strokeWidth="0.6" />
      <rect x="70" y="41" width="11" height="19" fill="#fff" stroke="#5a6472" strokeWidth="0.6" />
      {/* Maßkette unten */}
      <line x1="18" y1="68" x2="104" y2="68" stroke={linie} strokeWidth="0.6" />
      {[18, 34, 50, 70, 81, 104].map((x) => (
        <line key={x} x1={x} y1="66" x2={x} y2="70" stroke={linie} strokeWidth="0.6" />
      ))}
      {/* Maßkette links */}
      <line x1="12" y1="26" x2="12" y2="60" stroke={linie} strokeWidth="0.6" />
      {/* Bewehrungsangaben rechts */}
      {[14, 18, 22, 26, 30].map((y) => (
        <line key={y} x1="112" y1={y} x2="138" y2={y} stroke={linie} strokeWidth="1.4" />
      ))}
      {/* Schriftkopf */}
      <rect x="86" y="78" width="56" height="20" fill="none" stroke="#5a6472" strokeWidth="0.7" />
      <line x1="86" y1="85" x2="142" y2="85" stroke={linie} strokeWidth="0.5" />
      <line x1="86" y1="92" x2="142" y2="92" stroke={linie} strokeWidth="0.5" />
      <rect x="88" y="80" width="14" height="3.5" fill={akzent} opacity="0.8" />
    </Blatt>
  );
}

/** Biegeliste: Tabelle mit Biegeform-Skizzen je Zeile */
export function VorschauBiegeliste() {
  return (
    <Blatt>
      <rect x="10" y="10" width="40" height="4" fill="#1c2430" opacity="0.75" />
      <line x1="10" y1="20" x2="95" y2="20" stroke="#5a6472" strokeWidth="0.7" />
      <rect x="10" y="24" width="85" height="6" fill={flaeche} />
      {[34, 48, 62, 76, 90, 104, 118].map((y, i) => (
        <g key={y}>
          {/* Biegeform-Symbol */}
          {i % 3 === 0 ? (
            <path d={`M 26 ${y + 6} V ${y} H 40`} fill="none" stroke={akzent} strokeWidth="1.1" />
          ) : i % 3 === 1 ? (
            <line x1="26" y1={y + 3} x2="42" y2={y + 3} stroke={akzent} strokeWidth="1.1" />
          ) : (
            <path
              d={`M 26 ${y + 6} V ${y} H 40 V ${y + 6}`}
              fill="none"
              stroke={akzent}
              strokeWidth="1.1"
            />
          )}
          <line x1="14" y1={y + 3} x2="20" y2={y + 3} stroke={linie} strokeWidth="1.2" />
          {[50, 62, 74, 86].map((x) => (
            <line key={x} x1={x} y1={y + 3} x2={x + 7} y2={y + 3} stroke={linie} strokeWidth="1.2" />
          ))}
          <line x1="10" y1={y + 9} x2="95" y2={y + 9} stroke={linie} strokeWidth="0.4" />
        </g>
      ))}
      <line x1="10" y1="132" x2="95" y2="132" stroke="#5a6472" strokeWidth="0.7" />
      <rect x="10" y="136" width="30" height="3" fill="#1c2430" opacity="0.6" />
    </Blatt>
  );
}

/** Stückliste: Tabelle mit Mini-Skizze und Gewichtsspalten */
export function VorschauStueckliste() {
  return (
    <Blatt>
      <rect x="10" y="10" width="48" height="4" fill="#1c2430" opacity="0.75" />
      <line x1="10" y1="20" x2="95" y2="20" stroke="#5a6472" strokeWidth="0.7" />
      <rect x="10" y="24" width="85" height="6" fill={flaeche} />
      {/* Mattenzeile */}
      <g>
        <rect x="30" y="34" width="16" height="8" fill="none" stroke={linie} strokeWidth="0.5" />
        {[34, 38, 42].map((x) => (
          <line key={x} x1={x} y1="34" x2={x} y2="42" stroke={linie} strokeWidth="0.3" />
        ))}
        <line x1="30" y1="38" x2="46" y2="38" stroke={linie} strokeWidth="0.3" />
      </g>
      {[34, 48, 62, 76, 90, 104].map((y, i) => (
        <g key={y}>
          <line x1="14" y1={y + 4} x2="19" y2={y + 4} stroke={linie} strokeWidth="1.2" />
          {i > 0 &&
            (i % 2 === 0 ? (
              <line x1="30" y1={y + 4} x2="46" y2={y + 4} stroke={akzent} strokeWidth="1.1" />
            ) : (
              <path d={`M 32 ${y + 8} V ${y + 1} H 45`} fill="none" stroke={akzent} strokeWidth="1.1" />
            ))}
          {[52, 64, 74, 84].map((x) => (
            <line key={x} x1={x} y1={y + 4} x2={x + 8} y2={y + 4} stroke={linie} strokeWidth="1.2" />
          ))}
          <line x1="10" y1={y + 11} x2="95" y2={y + 11} stroke={linie} strokeWidth="0.4" />
        </g>
      ))}
      {/* Summenblock */}
      <rect x="10" y="122" width="85" height="14" fill={flaeche} />
      <rect x="14" y="126" width="24" height="3" fill="#1c2430" opacity="0.5" />
      <rect x="62" y="126" width="28" height="4" fill="#1c2430" opacity="0.75" />
    </Blatt>
  );
}
