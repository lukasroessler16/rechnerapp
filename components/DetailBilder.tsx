/**
 * Kleine technische Referenzbilder (SVG) für die Detailauswahl.
 * Bewusst schematisch: Beton grau schraffiert, Bewehrung orange.
 */

const beton = "#c8cdd4";
const stahl = "#e8590c";
const kante = "#1c2430";

/** Rahmen-Hilfskomponente für alle Detailbilder */
function Bild({ children, titel }: { children: React.ReactNode; titel: string }) {
  return (
    <svg viewBox="0 0 80 60" role="img" aria-label={titel}>
      <rect x="0" y="0" width="80" height="60" fill="#fff" />
      {children}
    </svg>
  );
}

/* ---------- Bauteilwahl ---------- */

export function IconWand() {
  return (
    <svg viewBox="0 0 90 70" width="90" height="70" aria-label="Wand">
      <rect x="25" y="8" width="40" height="54" fill={beton} stroke={kante} />
      <line x1="33" y1="10" x2="33" y2="60" stroke={stahl} strokeWidth="2" />
      <line x1="57" y1="10" x2="57" y2="60" stroke={stahl} strokeWidth="2" />
      {[18, 30, 42, 54].map((y) => (
        <line key={y} x1="27" y1={y} x2="63" y2={y} stroke={stahl} strokeWidth="1.4" />
      ))}
    </svg>
  );
}

export function IconDecke() {
  return (
    <svg viewBox="0 0 90 70" width="90" height="70" aria-label="Decke/Boden">
      <rect x="8" y="26" width="74" height="18" fill={beton} stroke={kante} />
      <line x1="10" y1="40" x2="80" y2="40" stroke={stahl} strokeWidth="2" />
      <line x1="10" y1="30" x2="80" y2="30" stroke={stahl} strokeWidth="1.4" />
      {[20, 35, 50, 65].map((x) => (
        <circle key={x} cx={x} cy="35" r="1.6" fill={stahl} />
      ))}
    </svg>
  );
}

/* ---------- Anschlussdetails Wand ---------- */

/** Wand auf Bodenplatte: L-förmige Anschlusseisen */
export function DetailBodenplatte() {
  return (
    <Bild titel="Anschluss Bodenplatte">
      <rect x="6" y="42" width="68" height="14" fill={beton} stroke={kante} />
      <rect x="30" y="6" width="16" height="36" fill={beton} stroke={kante} />
      <path d="M 36 10 V 46 H 62" fill="none" stroke={stahl} strokeWidth="2.4" />
      <path d="M 40 10 V 50 H 62" fill="none" stroke={stahl} strokeWidth="2.4" opacity="0.55" />
    </Bild>
  );
}

/** Wand auf Streifenfundament */
export function DetailStreifenfundament() {
  return (
    <Bild titel="Anschluss Streifenfundament">
      <rect x="16" y="42" width="46" height="14" fill={beton} stroke={kante} />
      <rect x="30" y="6" width="16" height="36" fill={beton} stroke={kante} />
      <path d="M 36 10 V 50 H 56" fill="none" stroke={stahl} strokeWidth="2.4" />
      <path d="M 40 10 V 50 H 22" fill="none" stroke={stahl} strokeWidth="2.4" opacity="0.55" />
    </Bild>
  );
}

/** Wand steht auf Decke */
export function DetailDeckeUnter() {
  return (
    <Bild titel="Anschluss Decke unten">
      <rect x="4" y="44" width="72" height="12" fill={beton} stroke={kante} />
      <rect x="30" y="6" width="16" height="38" fill={beton} stroke={kante} />
      <path d="M 36 12 V 52 H 18" fill="none" stroke={stahl} strokeWidth="2.4" />
      <path d="M 40 12 V 52 H 58" fill="none" stroke={stahl} strokeWidth="2.4" opacity="0.55" />
    </Bild>
  );
}

/** Deckenanschluss oben */
export function DetailDeckeUeber() {
  return (
    <Bild titel="Anschluss Decke oben">
      <rect x="4" y="6" width="72" height="12" fill={beton} stroke={kante} />
      <rect x="30" y="18" width="16" height="38" fill={beton} stroke={kante} />
      <path d="M 36 52 V 10 H 18" fill="none" stroke={stahl} strokeWidth="2.4" />
      <path d="M 40 52 V 10 H 58" fill="none" stroke={stahl} strokeWidth="2.4" opacity="0.55" />
    </Bild>
  );
}

/** Wand läuft weiter (Arbeitsfuge mit Übergreifung) */
export function DetailWandWeiter() {
  return (
    <Bild titel="Wand läuft weiter">
      <rect x="30" y="4" width="16" height="52" fill={beton} stroke={kante} />
      <line x1="26" y1="30" x2="50" y2="30" stroke={kante} strokeDasharray="3 2" />
      <line x1="36" y1="8" x2="36" y2="40" stroke={stahl} strokeWidth="2.4" />
      <line x1="40" y1="20" x2="40" y2="52" stroke={stahl} strokeWidth="2.4" opacity="0.55" />
    </Bild>
  );
}

/** freier Rand mit Steckbügel (U) */
export function DetailFreierRand() {
  return (
    <Bild titel="Freier Rand mit Steckbügeln">
      <rect x="30" y="4" width="16" height="52" fill={beton} stroke={kante} />
      <path d="M 34 34 V 10 H 42 V 34" fill="none" stroke={stahl} strokeWidth="2.4" />
      <line x1="34" y1="18" x2="34" y2="52" stroke={stahl} strokeWidth="1.6" opacity="0.5" />
      <line x1="42" y1="18" x2="42" y2="52" stroke={stahl} strokeWidth="1.6" opacity="0.5" />
    </Bild>
  );
}

/** Eckausbildung mit Eckwinkeln */
export function DetailEcke() {
  return (
    <Bild titel="Eckausbildung">
      <path d="M 12 4 H 28 V 40 H 76 V 56 H 12 Z" fill={beton} stroke={kante} />
      <path d="M 18 8 V 48 H 70" fill="none" stroke={stahl} strokeWidth="2.4" />
      <path d="M 24 8 V 44 H 70" fill="none" stroke={stahl} strokeWidth="2.4" opacity="0.55" />
    </Bild>
  );
}

/** T-Stoß / Wandanschluss */
export function DetailWandstoss() {
  return (
    <Bild titel="Wandstoß (T-Anschluss)">
      <rect x="4" y="24" width="52" height="14" fill={beton} stroke={kante} />
      <rect x="56" y="4" width="16" height="52" fill={beton} stroke={kante} />
      <line x1="30" y1="29" x2="66" y2="29" stroke={stahl} strokeWidth="2.4" />
      <line x1="30" y1="33" x2="66" y2="33" stroke={stahl} strokeWidth="2.4" opacity="0.55" />
    </Bild>
  );
}

/** Deckenrand auf Wand aufgelagert */
export function DetailAuflager() {
  return (
    <Bild titel="Auflager auf Wand">
      <rect x="4" y="20" width="60" height="14" fill={beton} stroke={kante} />
      <rect x="48" y="34" width="16" height="22" fill={beton} stroke={kante} />
      <line x1="8" y1="30" x2="60" y2="30" stroke={stahl} strokeWidth="2.4" />
      <path d="M 40 24 H 58 V 30" fill="none" stroke={stahl} strokeWidth="2" opacity="0.6" />
    </Bild>
  );
}

/** Sturz über Öffnung (für Vorschlagsliste) */
export function DetailSturz() {
  return (
    <Bild titel="Sturzbewehrung">
      <rect x="6" y="4" width="68" height="52" fill={beton} stroke={kante} />
      <rect x="24" y="22" width="32" height="34" fill="#fff" stroke={kante} />
      <line x1="12" y1="16" x2="68" y2="16" stroke={stahl} strokeWidth="2.6" />
      <line x1="18" y1="26" x2="30" y2="14" stroke={stahl} strokeWidth="2" />
      <line x1="62" y1="26" x2="50" y2="14" stroke={stahl} strokeWidth="2" />
    </Bild>
  );
}

/* ---------- Auswahl-Kataloge (Wert, Titel, Bild) ---------- */

export const ANSCHLUSS_UNTEN = [
  { wert: "bodenplatte", titel: "Bodenplatte", bild: <DetailBodenplatte /> },
  { wert: "streifenfundament", titel: "Streifenfundament", bild: <DetailStreifenfundament /> },
  { wert: "decke_unter", titel: "Decke (Wand steht auf Decke)", bild: <DetailDeckeUnter /> },
  { wert: "frei", titel: "frei / ohne Anschluss", bild: <DetailFreierRand /> },
] as const;

export const ANSCHLUSS_OBEN = [
  { wert: "decke_ueber", titel: "Deckenanschluss oben", bild: <DetailDeckeUeber /> },
  { wert: "wand_weiter", titel: "Wand läuft weiter (Arbeitsfuge)", bild: <DetailWandWeiter /> },
  { wert: "frei", titel: "freier oberer Rand (Attika o. Ä.)", bild: <DetailFreierRand /> },
] as const;

export const ANSCHLUSS_SEITE = [
  { wert: "ecke", titel: "Eckausbildung (Außen-/Innenecke)", bild: <DetailEcke /> },
  { wert: "wandstoss", titel: "Wandstoß (T-Anschluss)", bild: <DetailWandstoss /> },
  { wert: "frei", titel: "freies Wandende", bild: <DetailFreierRand /> },
] as const;

export const DECKEN_RAND = [
  { wert: "wand_auflager", titel: "auf Wand aufgelagert", bild: <DetailAuflager /> },
  { wert: "frei", titel: "freier Rand", bild: <DetailFreierRand /> },
] as const;
