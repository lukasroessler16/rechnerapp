/**
 * Gemeinsame Zeichen-Helfer für die PDF-Erzeugung (pdf-lib).
 *
 * Konvention: Alle Koordinaten in Millimetern, Ursprung links unten
 * (wie im Bauwesen üblich). Der `Zeichner` kapselt eine PDF-Seite und
 * rechnet mm → PDF-Punkte um.
 */

import {
  PDFDocument,
  PDFFont,
  PDFPage,
  StandardFonts,
  degrees,
  rgb,
  RGB,
} from "pdf-lib";
import { Firmendaten, Position } from "../types";

export const SCHWARZ = rgb(0.11, 0.14, 0.19);
export const GRAU = rgb(0.55, 0.58, 0.62);
export const HELLGRAU = rgb(0.89, 0.9, 0.92);
export const ORANGE = rgb(0.91, 0.35, 0.05);

/** mm → PDF-Punkte */
export const mm = (v: number) => (v * 72) / 25.4;

/** Zahl im deutschen Format, z. B. 2,46 */
export const de = (v: number, stellen = 2) =>
  v.toLocaleString("de-AT", {
    minimumFractionDigits: stellen,
    maximumFractionDigits: stellen,
  });

/**
 * PDF-sichere Textersetzung. Die eingebetteten Standardschriften können nur
 * WinAnsi darstellen; alles darüber hinaus (⚠, Pfeile, typografische
 * Sonderzeichen) würde pdf-lib mit einer Ausnahme quittieren. Deshalb erst
 * die häufigen Zeichen sinnvoll ersetzen und danach alles Übrige, was
 * WinAnsi nicht kennt, auf "?" abbilden – ein Dokument darf nie an einem
 * einzelnen Zeichen scheitern.
 */
const WINANSI_ZUSATZ = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•—˜™š›œžŸ";
export const sicher = (s: string) =>
  s
    .replace(/⚠/g, "!")
    .replace(/[→⇒]/g, "->")
    .replace(/[←⇐]/g, "<-")
    .replace(/[–—]/g, "-")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/≈/g, "~")
    .replace(/±/g, "+/-")
    // Hoch­gestellte Ziffern kennt WinAnsi zwar, die eingebetteten
    // Standardschriften zeichnen sie aber nicht – im Plan stand dadurch
    // "2,57 cm /m" statt "cm²/m", also eine fehlende Einheit auf einem
    // Dokument, nach dem bestellt wird. "cm2" und "m3" sind auf technischen
    // Unterlagen ohnehin gebräuchlich und immer lesbar.
    .replace(/²/g, "2")
    .replace(/³/g, "3")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, (c) => (WINANSI_ZUSATZ.includes(c) ? c : "?"));

export interface Fonts {
  normal: PDFFont;
  fett: PDFFont;
}

export async function ladeFonts(doc: PDFDocument): Promise<Fonts> {
  return {
    normal: await doc.embedFont(StandardFonts.Helvetica),
    fett: await doc.embedFont(StandardFonts.HelveticaBold),
  };
}

/* ------------------------------------------------------------------ */
/* Mitschrift für die Layoutprüfung                                    */
/* ------------------------------------------------------------------ */

/**
 * Ein gezeichneter Text mit seinem Platzbedarf [mm].
 *
 * WOZU: Ob sich auf einem Plan zwei Beschriftungen überdecken, sieht man
 * im PDF erst, wenn man genau hinschaut – und auf einem Bauplan, den
 * jemand auf der Baustelle liest, ist eine überschriebene Maßzahl ein
 * echter Schaden. Die Mitschrift macht das prüfbar: `scripts/test-layout.ts`
 * zeichnet jedes Bauteil samt Grenzfällen und meldet jede Überdeckung,
 * ohne dass jemand Blätter vergleichen muss.
 */
export interface Textkasten {
  text: string;
  /** laufende Nummer des Zeichners = Seite */
  blatt: number;
  links: number;
  rechts: number;
  unten: number;
  oben: number;
  groesse: number;
  drehung: number;
}

let mitschrift: Textkasten[] | null = null;

/** Mitschrift einschalten; liefert die Liste, die sich dabei füllt */
export function starteMitschrift(): Textkasten[] {
  mitschrift = [];
  return mitschrift;
}

/** Mitschrift wieder abschalten (sonst wächst sie unbegrenzt weiter) */
export function endeMitschrift(): void {
  mitschrift = null;
}

/** fortlaufende Nummer je Zeichner – in mehrseitigen Listen die Seite */
let blattZaehler = 0;

/** Zeichen-Wrapper: mm-Koordinaten, Ursprung links unten */
export class Zeichner {
  /** Nummer dieses Zeichners; Texte verschiedener Blätter überdecken sich nie */
  readonly blatt = ++blattZaehler;

  constructor(
    public seite: PDFPage,
    public fonts: Fonts
  ) {}

  linie(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    dicke = 0.3,
    farbe: RGB = SCHWARZ,
    /** Strichmuster in mm, z. B. [1.6, 1.2] für gestrichelt */
    strich?: number[]
  ) {
    this.seite.drawLine({
      start: { x: mm(x1), y: mm(y1) },
      end: { x: mm(x2), y: mm(y2) },
      thickness: dicke,
      color: farbe,
      dashArray: strich?.map(mm),
    });
  }

  /** gefüllter Kreis, z. B. Bewehrungsstab im Querschnitt */
  kreis(x: number, y: number, r: number, farbe: RGB = SCHWARZ) {
    this.seite.drawCircle({ x: mm(x), y: mm(y), size: mm(r), color: farbe });
  }

  rechteck(
    x: number,
    y: number,
    b: number,
    h: number,
    opts: { fuellung?: RGB; rand?: RGB; dicke?: number; strich?: number[] } = {}
  ) {
    this.seite.drawRectangle({
      x: mm(x),
      y: mm(y),
      width: mm(b),
      height: mm(h),
      color: opts.fuellung,
      borderColor: opts.rand ?? (opts.fuellung ? undefined : SCHWARZ),
      borderWidth: opts.rand || !opts.fuellung ? (opts.dicke ?? 0.3) : undefined,
      borderDashArray: opts.strich?.map(mm),
    });
  }

  /** Breite eines Textes in mm (zum Ausrichten und Beschneiden) */
  textBreite(t: string, groesse = 9, fett = false) {
    const font = fett ? this.fonts.fett : this.fonts.normal;
    return (font.widthOfTextAtSize(sicher(t), groesse) * 25.4) / 72;
  }

  text(
    t: string,
    x: number,
    y: number,
    groesse = 9,
    opts: { fett?: boolean; farbe?: RGB; ausrichtung?: "links" | "mitte" | "rechts"; drehung?: number } = {}
  ) {
    const font = opts.fett ? this.fonts.fett : this.fonts.normal;
    const txt = sicher(t);
    const breite = font.widthOfTextAtSize(txt, groesse);
    let px = mm(x);
    if (opts.ausrichtung === "mitte") px -= breite / 2;
    if (opts.ausrichtung === "rechts") px -= breite;
    this.seite.drawText(txt, {
      x: px,
      y: mm(y),
      size: groesse,
      font,
      color: opts.farbe ?? SCHWARZ,
      rotate: opts.drehung ? degrees(opts.drehung) : undefined,
    });

    if (mitschrift && txt.trim()) {
      // Kasten um den Text [mm]. Die Höhe ist die Schriftgröße in mm; der
      // Bezugspunkt ist die Grundlinie, Unterlängen liegen darunter.
      const b = (breite * 25.4) / 72;
      const h = (groesse * 25.4) / 72;
      const links = (px * 25.4) / 72;
      const unten = y - h * 0.22;
      mitschrift.push(
        opts.drehung
          ? // 90° gedreht: Der Text läuft nach oben, die Schrifthöhe nach links.
            {
              text: txt,
              blatt: this.blatt,
              links: x - h * 0.78,
              rechts: x + h * 0.22,
              unten: y,
              oben: y + b,
              groesse,
              drehung: opts.drehung,
            }
          : {
              text: txt,
              blatt: this.blatt,
              links,
              rechts: links + b,
              unten,
              oben: unten + h,
              groesse,
              drehung: 0,
            }
      );
    }
  }
}

/* ------------------------------------------------------------------ */
/* Text, der in seine Spalte passt                                     */
/* ------------------------------------------------------------------ */

/**
 * Setzt einen Text so, dass er die Spaltenbreite nicht überschreitet.
 *
 * WOZU: In einer Tabelle ist die Spaltenbreite fest, der Inhalt nicht. Ein
 * Rechteckbügel liefert "0,23 / 0,23 / 0,23 / 0,23 / 0,16", ein Kunde einen
 * Firmennamen mit vier Wörtern. Läuft so etwas in die Nachbarspalte, steht
 * dort eine Stückzahl halb unter einer Maßangabe – und die Liste, nach der
 * bestellt wird, ist falsch lesbar.
 *
 * Der Reihe nach: erst kleiner setzen (bis `mindest`), dann an einem
 * Trennzeichen umbrechen, zuletzt kürzen. Gekürzt wird nur, was sonst
 * gar nicht darstellbar wäre.
 *
 * @param zeilenAbstand Abstand der zweiten Zeile [mm]
 * @returns Zahl der gesetzten Zeilen
 */
export function spaltenText(
  z: Zeichner,
  t: string,
  x: number,
  y: number,
  breite: number,
  groesse: number,
  opts: {
    fett?: boolean;
    farbe?: RGB;
    mindest?: number;
    zeilenAbstand?: number;
    /** nur eine Zeile zulassen (z. B. wenn darunter schon etwas steht) */
    einzeilig?: boolean;
  } = {}
): number {
  const mindest = opts.mindest ?? 6;
  const abstand = opts.zeilenAbstand ?? 3.4;
  const zeichne = (text: string, yy: number, g: number) =>
    z.text(text, x, yy, g, { fett: opts.fett, farbe: opts.farbe });

  if (z.textBreite(t, groesse, opts.fett) <= breite) {
    zeichne(t, y, groesse);
    return 1;
  }

  // 1) kleiner setzen
  for (let g = groesse - 0.5; g >= mindest; g -= 0.5) {
    if (z.textBreite(t, g, opts.fett) <= breite) {
      zeichne(t, y, g);
      return 1;
    }
  }

  // 2) umbrechen – bevorzugt an " / ", sonst an Leerzeichen
  const g = mindest;
  if (!opts.einzeilig) {
    const trenner = t.includes(" / ") ? " / " : " ";
    const teile = t.split(trenner);
    if (teile.length > 1) {
      let erste = teile[0];
      let i = 1;
      while (
        i < teile.length &&
        z.textBreite(erste + trenner + teile[i], g, opts.fett) <= breite
      ) {
        erste += trenner + teile[i];
        i++;
      }
      const zweite = teile.slice(i).join(trenner);
      if (i < teile.length && z.textBreite(zweite, g, opts.fett) <= breite) {
        zeichne(erste + (trenner === " / " ? " /" : ""), y, g);
        zeichne(zweite, y - abstand, g);
        return 2;
      }
    }
  }

  // 3) kürzen
  let kurz = t;
  while (kurz.length > 1 && z.textBreite(`${kurz}…`, g, opts.fett) > breite)
    kurz = kurz.slice(0, -1);
  zeichne(`${kurz}…`, y, g);
  return 1;
}

/* ------------------------------------------------------------------ */
/* Schriftkopf (Planschriftfeld, unten rechts)                         */
/* ------------------------------------------------------------------ */

export interface SchriftkopfDaten {
  firmendaten: Firmendaten;
  planinhalt: string;
  massstab: string;
  blatt: string;
}

/**
 * Zeichnet einen branchenüblichen Schriftkopf (Breite 120 mm, Höhe 40 mm)
 * mit Logo, Firmen- und Projektdaten an Position (x, y) = linke untere Ecke.
 */
export async function schriftkopf(
  doc: PDFDocument,
  z: Zeichner,
  x: number,
  y: number,
  d: SchriftkopfDaten
) {
  const B = 120;
  const H = 40;
  const fd = d.firmendaten;

  z.rechteck(x, y, B, H, { dicke: 0.7 });
  // Zeilenraster: Logo/Firma | Bauvorhaben | Planinhalt | Meta
  z.linie(x, y + 30, x + B, y + 30, 0.4);
  z.linie(x, y + 20, x + B, y + 20, 0.4);
  z.linie(x, y + 10, x + B, y + 10, 0.4);
  z.linie(x + 45, y + 30, x + 45, y + 40, 0.4);
  z.linie(x + 40, y, x + 40, y + 10, 0.4);
  z.linie(x + 80, y, x + 80, y + 10, 0.4);

  // Logo (falls vorhanden) in das linke obere Feld einpassen
  if (fd.logoDataUrl?.startsWith("data:image/")) {
    try {
      const b64 = fd.logoDataUrl.split(",")[1] ?? "";
      const bytes = Buffer.from(b64, "base64");
      const bild = fd.logoDataUrl.includes("png")
        ? await doc.embedPng(bytes)
        : await doc.embedJpg(bytes);
      const maxB = mm(42);
      const maxH = mm(8);
      const faktor = Math.min(maxB / bild.width, maxH / bild.height, 1);
      z.seite.drawImage(bild, {
        x: mm(x + 1.5),
        y: mm(y + 31),
        width: bild.width * faktor,
        height: bild.height * faktor,
      });
    } catch {
      /* fehlerhaftes Logo ignorieren */
    }
  } else {
    zelle(z, fd.firma || "—", x + 2, y + 34, 41, 9, { fett: true });
  }

  // rechte Zelle: bei vorhandenem Logo den Firmennamen als Text ergänzen
  if (fd.logoDataUrl) zelle(z, fd.firma || "", x + 47, y + 35.5, 71, 8, { fett: true });
  zelle(
    z,
    fd.planersteller ? `Erstellt: ${fd.planersteller}` : "",
    x + 47,
    y + 31.5,
    71,
    7,
    { farbe: GRAU }
  );

  z.text("Bauvorhaben", x + 2, y + 26.5, 6, { farbe: GRAU });
  zelle(z, fd.bauvorhaben || "—", x + 2, y + 21.5, B - 4, 9, { fett: true });

  z.text("Planinhalt", x + 2, y + 16.5, 6, { farbe: GRAU });
  zelle(z, d.planinhalt, x + 2, y + 11.5, B - 4, 9, { fett: true });

  // Die untere Zeile hat drei Zellen: 40 | 40 | 40 mm. Vor allem die Adresse
  // ist beliebig lang – ohne Begrenzung stand sie quer über Datum und Blatt.
  z.text("Adresse", x + 2, y + 6.5, 6, { farbe: GRAU });
  zelle(z, fd.adresse || "—", x + 2, y + 2, 37, 7.5);
  z.text("Datum / Maßstab", x + 42, y + 6.5, 6, { farbe: GRAU });
  zelle(z, `${fd.datum || ""}  ${d.massstab}`, x + 42, y + 2, 37, 7.5);
  z.text("Blatt", x + 82, y + 6.5, 6, { farbe: GRAU });
  zelle(z, d.blatt, x + 82, y + 2, 36, 7.5);
}

/** Eine Zelle des Schriftkopfs: eine Zeile, die ihr Feld nie verlässt */
function zelle(
  z: Zeichner,
  t: string,
  x: number,
  y: number,
  breite: number,
  groesse: number,
  opts: { fett?: boolean; farbe?: RGB } = {}
) {
  if (!t) return;
  spaltenText(z, t, x, y, breite, groesse, { ...opts, mindest: 5.5, einzeilig: true });
}

/* ------------------------------------------------------------------ */
/* Listen-Kopfzeile (Biegeliste/Stückliste)                            */
/* ------------------------------------------------------------------ */

export async function listenKopf(
  doc: PDFDocument,
  z: Zeichner,
  titel: string,
  fd: Firmendaten,
  seiteNr: number
) {
  const oben = 282; // A4 hoch: 297 − 15 Rand
  z.text(titel, 15, oben, 14, { fett: true });
  z.text(
    `${fd.bauvorhaben || "Bauvorhaben"} · ${fd.adresse || ""}`,
    15,
    oben - 6,
    9,
    { farbe: GRAU }
  );
  z.text(`${fd.firma || ""}  ${fd.planersteller ? "· " + fd.planersteller : ""}`, 15, oben - 11, 9, { farbe: GRAU });
  z.text(`Datum: ${fd.datum || ""}`, 195, oben, 9, { ausrichtung: "rechts" });
  z.text(`Seite ${seiteNr}`, 195, oben - 6, 9, { ausrichtung: "rechts", farbe: GRAU });

  // Logo rechts oben
  if (fd.logoDataUrl?.startsWith("data:image/")) {
    try {
      const b64 = fd.logoDataUrl.split(",")[1] ?? "";
      const bytes = Buffer.from(b64, "base64");
      const bild = fd.logoDataUrl.includes("png")
        ? await doc.embedPng(bytes)
        : await doc.embedJpg(bytes);
      const maxB = mm(35);
      const maxH = mm(12);
      const faktor = Math.min(maxB / bild.width, maxH / bild.height, 1);
      z.seite.drawImage(bild, {
        x: mm(195) - bild.width * faktor,
        y: mm(oben - 24),
        width: bild.width * faktor,
        height: bild.height * faktor,
      });
    } catch {
      /* ignorieren */
    }
  }
  z.linie(15, oben - 15, 195, oben - 15, 0.6);
}

/* ------------------------------------------------------------------ */
/* Mini-Skizzen der Stab-/Mattenformen (für Listen-Zellen)             */
/* ------------------------------------------------------------------ */

/**
 * Zeichnet die Biegeform einer Position in eine Zellbox (x, y, b, h in mm).
 * Schenkelmaße werden klein angeschrieben.
 */
/**
 * Endpunkte eines schräg eingebauten Stabes in seinem Skizzenkästchen.
 *
 * Der WINKEL ist maßgebend, nicht das Kästchen: Die Linie wird so lang
 * gezeichnet, wie sie unter diesem Winkel in das Kästchen passt – aber
 * niemals in einem anderen Winkel. Dieselbe Position sieht dadurch auf der
 * Stückliste und auf der Biegeliste gleich aus, obwohl die Spalten
 * verschieden breit sind. Gebaut wird nach der Gradzahl; eine Skizze, die
 * etwas anderes zeigt, führt in die Irre.
 *
 * Unten im Kästchen bleibt Platz für die Gradzahl, rechts für das Maß.
 */
export function schraegLinie(
  grad: number,
  x: number,
  y: number,
  b: number,
  h: number
): { x1: number; y1: number; x2: number; y2: number } {
  const bogen = (grad * Math.PI) / 180;
  const zahlH = 2.8;
  const breiteFrei = Math.max(2, b - 14);
  const hoeheFrei = Math.max(2, h - 3 - zahlH);
  const cos = Math.abs(Math.cos(bogen));
  const sin = Math.abs(Math.sin(bogen));
  const laenge = Math.min(
    cos > 0.01 ? breiteFrei / cos : breiteFrei,
    sin > 0.01 ? hoeheFrei / sin : hoeheFrei
  );
  const dx = (laenge * Math.cos(bogen)) / 2;
  const dy = (laenge * Math.sin(bogen)) / 2;
  const mx = x + 4 + breiteFrei / 2;
  const my = y + zahlH + (h - zahlH) / 2;
  return { x1: mx - dx, y1: my - dy, x2: mx + dx, y2: my + dy };
}

export function formSkizze(z: Zeichner, p: Position, x: number, y: number, b: number, h: number) {
  const cx = x + b / 2;
  const cy = y + h / 2;
  const s = p.segmente ?? [p.laenge];

  if (p.art === "matte") {
    // Mattensymbol: Rechteck mit Gitterlinien
    const mb = b - 8;
    const mh = h - 6;
    z.rechteck(x + 4, y + 3, mb, mh, { dicke: 0.4 });
    for (let i = 1; i < 4; i++) z.linie(x + 4 + (mb / 4) * i, y + 3, x + 4 + (mb / 4) * i, y + 3 + mh, 0.2, GRAU);
    for (let i = 1; i < 3; i++) z.linie(x + 4, y + 3 + (mh / 3) * i, x + 4 + mb, y + 3 + (mh / 3) * i, 0.2, GRAU);
    z.text(`${de(p.laenge)}×${de(p.breite ?? 0)}`, cx, y + h + 1, 5.5, { ausrichtung: "mitte", farbe: GRAU });
    return;
  }

  switch (p.form) {
    case "gerade": {
      z.linie(x + 4, cy, x + b - 4, cy, 0.9, ORANGE);
      z.text(de(s[0]), cx, cy + 1.5, 6, { ausrichtung: "mitte" });
      break;
    }
    case "schraegstab": {
      /*
       * Unter dem WIRKLICHEN Winkel zeichnen, nicht von Ecke zu Ecke des
       * Kästchens: Sonst zeigt dieselbe Position in der Stückliste 12° und
       * in der Biegeliste 8°, obwohl sie unter 45° eingebaut wird. Die
       * Länge der Linie ist schematisch (das Maß steht daneben), der
       * Winkel ist es nicht.
       */
      const grad = p.winkel ?? 45;
      const { x1, y1, x2, y2 } = schraegLinie(grad, x, y, b, h);
      z.linie(x1, y1, x2, y2, 0.9, ORANGE);
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const dx = (x2 - x1) / 2;
      const dy = (y2 - y1) / 2;
      // Winkelschenkel und Gradzahl: Der Winkel ist eine Angabe für die
      // Baustelle, keine Zeichenlaune. Die Gradzahl steht UNTER dem
      // waagrechten Schenkel – im Winkel selbst läge sie auf dem Stab.
      z.linie(mx - dx, my - dy, mx - dx + 4, my - dy, 0.25, GRAU);
      z.text(`${grad}°`, mx - dx + 0.6, my - dy - 2.3, 5, { farbe: GRAU });
      z.text(de(s[0]), x + b - 9, my - 1, 6);
      break;
    }
    case "winkel": {
      // L-Form: horizontaler + vertikaler Schenkel
      z.linie(x + 5, y + h - 4, x + 5, y + 4, 0.9, ORANGE);
      z.linie(x + 5, y + 4, x + b - 5, y + 4, 0.9, ORANGE);
      z.text(de(s[0]), x + 3, cy, 6, { drehung: 90 });
      z.text(de(s[1] ?? 0), cx + 2, y + 5.5, 6, { ausrichtung: "mitte" });
      break;
    }
    case "buegel_rechteck": {
      // geschlossener Bügel: Rechteck mit angedeutetem Haken in einer Ecke
      const rb = b - 12;
      const rh = h - 7;
      const rx = x + 6;
      const ry = y + 3.5;
      z.rechteck(rx, ry, rb, rh, { dicke: 0.9, rand: ORANGE });
      z.linie(rx + 1.5, ry + rh - 1.5, rx + 4.5, ry + rh - 4.5, 0.9, ORANGE); // Haken
      z.text(de(s[0]), rx + rb / 2, ry + rh / 2 - 1, 6, { ausrichtung: "mitte" });
      z.text(de(s[1] ?? 0), rx + rb + 2.5, ry + rh / 2 - 1, 6, { drehung: 90 });
      break;
    }
    case "buegel_u": {
      // U-Form (Steckbügel)
      z.linie(x + 6, y + h - 4, x + 6, y + 4, 0.9, ORANGE);
      z.linie(x + 6, y + 4, x + b - 6, y + 4, 0.9, ORANGE);
      z.linie(x + b - 6, y + 4, x + b - 6, y + h - 4, 0.9, ORANGE);
      z.text(de(s[0]), x + 4, cy + 1, 6, { drehung: 90 });
      z.text(de(s[1] ?? 0), cx, y + 5.5, 6, { ausrichtung: "mitte" });
      z.text(de(s[2] ?? 0), x + b - 2.5, cy + 1, 6, { drehung: 90 });
      break;
    }
  }
}
