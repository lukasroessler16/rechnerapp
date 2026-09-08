/**
 * Bildmarke und Wortmarken-Kombinationen für Rösch.
 *
 * Die Marke zeigt zwei exakt parallel gebogene Eckeisen – die Eckausbildung,
 * die der Rechner selbst ermittelt. Sie ist rein geometrisch aufgebaut
 * (zwei konzentrische Bögen um denselben Mittelpunkt) und bleibt dadurch
 * bis in Favicon-Größe lesbar.
 *
 * Farben: äußerer Stab in Textfarbe (bzw. Weiß auf dunklem Grund),
 * innerer Stab im Akzentorange. Für Prägung, Fax und Graustufen gibt es
 * die einfarbige Variante.
 */

export interface LogoProps {
  /** Kantenlänge in Pixel */
  groesse?: number;
  /** Farbe des äußeren Stabs (Standard: aktuelle Textfarbe) */
  farbe?: string;
  /** Farbe des inneren Stabs (Standard: Akzentorange) */
  akzent?: string;
  /** einfarbig: innerer Stab nur abgeschwächt statt orange */
  einfarbig?: boolean;
  className?: string;
}

/** Reine Bildmarke ohne Text */
export function LogoMarke({
  groesse = 40,
  farbe = "currentColor",
  akzent = "#e8590c",
  einfarbig = false,
  className,
}: LogoProps) {
  return (
    <svg
      width={groesse}
      height={groesse}
      viewBox="0 0 64 64"
      fill="none"
      strokeLinecap="round"
      className={className}
      role="img"
      aria-label="Rösch"
    >
      {/* äußeres Eckeisen: Bogen mit Radius 18 um den Mittelpunkt (30|30) */}
      <path d="M54 12 H30 A18 18 0 0 0 12 30 V54" stroke={farbe} strokeWidth="5" />
      {/* inneres Eckeisen: gleicher Mittelpunkt, Radius 8 – dadurch exakt parallel */}
      <path
        d="M54 22 H30 A8 8 0 0 0 22 30 V54"
        stroke={einfarbig ? farbe : akzent}
        strokeWidth="5"
        opacity={einfarbig ? 0.38 : 1}
      />
    </svg>
  );
}

/**
 * Wort-Bild-Marke übereinander: Zeichen oben, Name darunter.
 * Für Startseite, Briefkopf und Visitenkarte.
 */
export function LogoGestapelt({
  groesse = 72,
  zusatz,
  ...rest
}: LogoProps & { zusatz?: string }) {
  return (
    <div className="logo-gestapelt">
      <LogoMarke groesse={groesse} {...rest} />
      <div className="logo-name">RÖSCH</div>
      {zusatz && <div className="logo-zusatz">{zusatz}</div>}
    </div>
  );
}

/** Zeile für die Kopfleiste: Zeichen, Name, Produktname */
export function LogoZeile({ groesse = 30, ...rest }: LogoProps) {
  return (
    <span className="logo-zeile">
      <LogoMarke groesse={groesse} {...rest} />
      <b>Rösch</b>
      <em>Bewehrungsrechner</em>
    </span>
  );
}
