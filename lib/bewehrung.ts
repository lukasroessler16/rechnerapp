/**
 * Berechnungskern der Bewehrungsermittlung.
 *
 * Ermittelt für Wände und Decken/Bodenplatten:
 *  – Mindest-Flächenbewehrung nach EC2/ÖNORM B 1992-1-1 (Lagermatten)
 *  – konstruktive Stabstahl-Positionen (Anschlüsse, Ecken, Ränder,
 *    Sturz- und Öffnungsverstärkungen, Schrägstäbe)
 *  – Stück-/Biegeliste mit Gewichten
 *
 * HINWEIS: Dieses Modul liefert eine Mengen- und Konstruktionsermittlung
 * auf Basis von Mindestbewehrung und anerkannten Konstruktionsregeln.
 * Es ersetzt KEINE statische Bemessung (Biegung, Querkraft, Knicken,
 * Durchstanzen, Erdbeben). Entsprechende Hinweise werden im Ergebnis
 * ausgegeben und müssen dem Nutzer angezeigt werden.
 */

import {
  Projekt,
  Ergebnis,
  Position,
  Oeffnung,
  Biegeform,
} from "./types";
import {
  BETONKLASSEN,
  FYK,
  LAGERMATTEN,
  MATTEN_STOSS,
  VERSCHNITT_FAKTOR,
  matteWaehlen,
  metergewicht,
  biegerolle,
  uebergreifung,
} from "./normdaten";

/* ------------------------------------------------------------------ */
/* Hilfsfunktionen                                                     */
/* ------------------------------------------------------------------ */

/** auf ganze cm runden (Aufmaß Biegeliste) */
const cm = (m: number) => Math.round(m * 100) / 100;

/** Stückzahl von Stäben im Raster über eine Strecke */
const stueckImRaster = (strecke: number, abstandMm: number) =>
  Math.max(2, Math.ceil(strecke / (abstandMm / 1000)) + 1);

/** interner Positions-Sammler: fasst identische Positionen zusammen */
class Sammler {
  positionen: Omit<Position, "pos">[] = [];

  matte(
    name: string,
    laenge: number,
    breite: number,
    stueck: number,
    gewichtProM2: number,
    verwendung: string,
    kurz: string
  ) {
    const gewichtJeStueck = Math.round(laenge * breite * gewichtProM2 * 10) / 10;
    this.positionen.push({
      art: "matte",
      bezeichnung: name,
      laenge: cm(laenge),
      breite: cm(breite),
      stueck,
      gewichtJeStueck,
      gewichtGesamt: Math.round(gewichtJeStueck * stueck * 10) / 10,
      verwendung,
      kurz,
    });
  }

  stab(
    d: number,
    form: Biegeform,
    segmente: number[],
    stueck: number,
    verwendung: string,
    kurz: string
  ) {
    const laenge = cm(segmente.reduce((a, b) => a + b, 0));
    const seg = segmente.map(cm);
    // gleiche Stäbe (Form, Ø, Schenkel, Verwendung) zusammenfassen
    const key = (p: Omit<Position, "pos">) =>
      p.art === "stab" &&
      p.durchmesser === d &&
      p.form === form &&
      p.laenge === laenge &&
      JSON.stringify(p.segmente) === JSON.stringify(seg) &&
      p.verwendung === verwendung;
    const vorhanden = this.positionen.find(key);
    if (vorhanden) {
      vorhanden.stueck += stueck;
      vorhanden.gewichtGesamt =
        Math.round(vorhanden.gewichtJeStueck * vorhanden.stueck * 100) / 100;
      return;
    }
    const gewichtJeStueck = Math.round(laenge * metergewicht(d) * 100) / 100;
    this.positionen.push({
      art: "stab",
      bezeichnung: `Ø${d}`,
      durchmesser: d,
      form,
      segmente: seg,
      biegerolle: form === "gerade" || form === "schraegstab" ? undefined : biegerolle(d),
      laenge,
      stueck,
      gewichtJeStueck,
      gewichtGesamt: Math.round(gewichtJeStueck * stueck * 100) / 100,
      verwendung,
      kurz,
    });
  }

  /** nummerierte Positionsliste: erst Matten, dann Stäbe nach Ø */
  fertig(): Position[] {
    const sortiert = [...this.positionen].sort((a, b) => {
      if (a.art !== b.art) return a.art === "matte" ? -1 : 1;
      return (a.durchmesser ?? 0) - (b.durchmesser ?? 0);
    });
    return sortiert.map((p, i) => ({ ...p, pos: i + 1 }));
  }
}

/* ------------------------------------------------------------------ */
/* Detailvorschläge für Öffnungen (Schritt 3/4 des Wizards)            */
/* ------------------------------------------------------------------ */

export interface OeffnungsDetail {
  oeffnungId: string;
  details: string[];
}

/**
 * Ermittelt je Öffnung automatisch die erforderlichen Verstärkungsdetails
 * (wird im Wizard als Vorschlag angezeigt und in der Berechnung umgesetzt).
 */
export function oeffnungsDetails(projekt: Projekt): OeffnungsDetail[] {
  const { masse } = projekt;
  return projekt.oeffnungen.map((o) => {
    const details: string[] = [];
    const reichtBisOben = o.y + o.hoehe >= masse.hoehe - 0.01;
    const hatBruestung = o.y > 0.01;
    if (projekt.bauteil === "wand") {
      if (!reichtBisOben) details.push("Sturzbewehrung (Zulage über Öffnung)");
      if (hatBruestung) details.push("Brüstungszulage (unter Öffnung)");
      details.push("Seitliche Randzulagen");
      details.push("Schrägstäbe an den Öffnungsecken (Rissbreitenbegrenzung)");
      if (o.breite > 2.0)
        details.push("⚠ Sturz > 2,0 m: gesonderte statische Bemessung erforderlich");
    } else {
      details.push("Wechselbewehrung (Zulagen umlaufend)");
      details.push("Schrägstäbe an den Aussparungsecken");
      if (o.breite > 1.0 || o.hoehe > 1.0)
        details.push("⚠ Aussparung > 1,0 m: Deckenwechsel statisch nachweisen");
    }
    return { oeffnungId: o.id, details };
  });
}

/* ------------------------------------------------------------------ */
/* Hauptberechnung                                                     */
/* ------------------------------------------------------------------ */

export function berechneBewehrung(projekt: Projekt): Ergebnis {
  const { bauteil, masse, oeffnungen, anschluesse, deckenRaender, parameter } = projekt;
  const s = new Sammler();
  const hinweise: string[] = [];

  const beton =
    BETONKLASSEN.find((b) => b.name === parameter.betonklasse) ?? BETONKLASSEN[1];
  const cnom = parameter.betondeckung; // [mm]
  const dickeCm = masse.dicke * 100;
  const lagen = parameter.lagen;

  /* ---------- 1) Flächen ---------- */
  const flaecheBrutto = masse.laenge * masse.hoehe;
  const flaecheOeffnungen = oeffnungen.reduce((a, o) => a + o.breite * o.hoehe, 0);
  const flaecheNetto = Math.max(0, flaecheBrutto - flaecheOeffnungen);

  /* ---------- 2) Mindestbewehrung [cm²/m] ---------- */
  // Bruttoquerschnitt je m Bauteilbreite: Ac = dicke · 100 cm
  const ac = dickeCm * 100;

  let asMinHaupt: number;
  let asMinQuer: number;
  let nutzhoehe: number | undefined;

  if (bauteil === "wand") {
    // EC2 9.6.2/9.6.3: vertikal As,min = 0,002·Ac (gesamt, beide Seiten),
    // horizontal max(25 % der Vertikalbewehrung; 0,001·Ac)
    const asVminGesamt = 0.002 * ac;
    const asHminGesamt = Math.max(0.25 * asVminGesamt, 0.001 * ac);
    asMinHaupt = asVminGesamt / lagen;
    asMinQuer = asHminGesamt / lagen;
  } else {
    // EC2 9.2.1.1 (Platten): As,min = 0,26·fctm/fyk·b·d ≥ 0,0013·b·d
    // b = 100 cm; d = h − c_nom − d_s/2 (d_s ≈ 8 mm angenommen)
    nutzhoehe = dickeCm - cnom / 10 - 0.4;
    const asMin = Math.max(
      (0.26 * beton.fctm * 100 * nutzhoehe) / FYK,
      0.0013 * 100 * nutzhoehe
    );
    asMinHaupt = asMin; // Hauptrichtung, untere Lage
    asMinQuer = 0.2 * asMin; // Querbewehrung ≥ 20 % (EC2 9.3.1.1)
  }

  /* ---------- 3) Mattenwahl ---------- */
  // Q-Matten tragen in beide Richtungen gleich → maßgebend ist das Maximum
  const asErf = Math.max(asMinHaupt, asMinQuer);
  const matte =
    parameter.matte === "auto"
      ? matteWaehlen(asErf)
      : LAGERMATTEN.find((m) => m.name === parameter.matte) ?? matteWaehlen(asErf);

  if (!matte) {
    hinweise.push(
      "⚠ Erforderliche Bewehrung übersteigt das Lagermatten-Programm – Stabstahlbewehrung durch Statiker festlegen."
    );
  } else {
    if (matte.as < asErf)
      hinweise.push(
        `⚠ Gewählte Matte ${matte.name} (${matte.as} cm²/m) liegt unter der Mindestbewehrung von ${asErf.toFixed(
          2
        )} cm²/m – Auswahl prüfen!`
      );
    // Mattenbedarf: Nettofläche · Lagen · Stoß-/Verschnittzuschlag
    const effektiveMattenflaeche =
      (matte.laenge - MATTEN_STOSS) * (matte.breite - MATTEN_STOSS);
    const bedarfM2 = flaecheNetto * lagen * VERSCHNITT_FAKTOR;
    const anzahl = Math.max(1, Math.ceil(bedarfM2 / effektiveMattenflaeche));
    s.matte(
      matte.name,
      matte.laenge,
      matte.breite,
      anzahl,
      matte.gewicht,
      bauteil === "wand"
        ? `Flächenbewehrung Wand, ${lagen}-lagig`
        : lagen === 2
          ? "Flächenbewehrung Decke, obere + untere Lage"
          : "Flächenbewehrung Decke, untere Lage",
      bauteil === "wand" ? "Fläche Wand" : "Fläche Decke"
    );
  }

  /* ---------- 4) Konstruktive Stabstahl-Positionen ---------- */
  const abst = parameter.stababstand; // [mm]
  const lsAnschluss = uebergreifung(10); // Übergreifung Ø10 ≈ 0,50 m
  const stegU = Math.max(0.05, masse.dicke - (2 * cnom) / 1000); // U-Bügel-Steg

  /** Steckbügel (U-Form) entlang eines freien Randes */
  const randeinfassung = (strecke: number, wo: string) => {
    s.stab(
      8,
      "buegel_u",
      [0.5, stegU, 0.5],
      stueckImRaster(strecke, 250),
      `Randeinfassung ${wo} (Steckbügel Ø8/25)`,
      `Rand ${wo}`
    );
  };

  /** L-förmige Anschlusseisen entlang eines Randes (je Lage) */
  const anschlusseisen = (strecke: number, wo: string, kurz: string) => {
    s.stab(
      10,
      "winkel",
      [0.8, 0.8],
      stueckImRaster(strecke, abst) * lagen,
      `Anschlussbewehrung ${wo} (Ø10/${abst / 10})`,
      kurz
    );
  };

  /** gerade Übergreifungseisen (Wand läuft weiter / Wandstoß) */
  const stossEisen = (strecke: number, wo: string, kurz: string) => {
    s.stab(
      10,
      "gerade",
      [2 * lsAnschluss],
      stueckImRaster(strecke, abst) * lagen,
      `Übergreifungsstoß ${wo} (Ø10/${abst / 10})`,
      kurz
    );
  };

  if (bauteil === "wand") {
    // unterer Anschluss
    if (anschluesse.unten === "frei") {
      hinweise.push("⚠ Wand ohne unteren Anschluss – Lagesicherheit statisch klären.");
      randeinfassung(masse.laenge, "unten");
    } else {
      anschlusseisen(
        masse.laenge,
        {
          bodenplatte: "Bodenplatte",
          streifenfundament: "Streifenfundament",
          decke_unter: "Decke unten",
        }[anschluesse.unten],
        "Anschluss unten"
      );
    }
    // oberer Anschluss
    if (anschluesse.oben === "decke_ueber")
      anschlusseisen(masse.laenge, "Decke oben", "Anschluss oben");
    else if (anschluesse.oben === "wand_weiter")
      stossEisen(masse.laenge, "Wand oben", "Stoß oben");
    else randeinfassung(masse.laenge, "oben");
    // seitliche Anschlüsse
    for (const seite of ["links", "rechts"] as const) {
      const art = anschluesse[seite];
      if (art === "ecke") {
        s.stab(
          10,
          "winkel",
          [0.8, 0.8],
          stueckImRaster(masse.hoehe, abst) * lagen,
          `Eckausbildung ${seite} (Eckwinkel Ø10/${abst / 10})`,
          `Ecke ${seite}`
        );
      } else if (art === "wandstoss")
        stossEisen(masse.hoehe, `Wandstoß ${seite}`, `Stoß ${seite}`);
      else randeinfassung(masse.hoehe, seite);
    }
  } else {
    // Decke: Randeinfassung an allen Rändern, Hinweis auf Stützbewehrung
    const raender: [string, number, string][] = [
      ["links", masse.hoehe, deckenRaender.links],
      ["rechts", masse.hoehe, deckenRaender.rechts],
      ["oben", masse.laenge, deckenRaender.oben],
      ["unten", masse.laenge, deckenRaender.unten],
    ];
    for (const [wo, strecke, art] of raender) {
      randeinfassung(strecke, wo);
      if (art === "wand_auflager" && lagen === 1)
        hinweise.push(
          `⚠ Auflagerrand „${wo}“: obere Stützbewehrung (Einspannung) statisch festlegen – hier nur untere Lage erfasst.`
        );
    }
    if (Math.min(masse.laenge, masse.hoehe) > 4.5)
      hinweise.push(
        "⚠ Spannweite > 4,5 m: Deckenbewehrung (Feld-/Stützmomente, Durchbiegung) unbedingt statisch bemessen – Mindestbewehrung genügt hier i. d. R. NICHT."
      );
  }

  /* ---------- 5) Öffnungsverstärkungen ---------- */
  const ls12 = uebergreifung(12); // Verankerung Ø12 ≈ 0,60 m
  oeffnungen.forEach((o: Oeffnung, i: number) => {
    const nr = i + 1;
    // Planmarke wie in Skizze und Bauplan: F = Fenster, T = Tür, A = Aussparung
    const marke = (o.typ === "fenster" ? "F" : o.typ === "tuer" ? "T" : "A") + nr;
    const reichtBisOben = o.y + o.hoehe >= masse.hoehe - 0.01;
    const hatBruestung = o.y > 0.01;

    if (bauteil === "wand") {
      // Sturzzulage: 2 Ø12 je Lage über der Öffnung
      if (!reichtBisOben)
        s.stab(
          12,
          "gerade",
          [o.breite + 2 * ls12],
          2 * lagen,
          `Sturzzulage Öffnung ${nr} (${marke})`,
          `Sturz ${marke}`
        );
      // Brüstungszulage: 2 Ø12 je Lage unter der Öffnung
      if (hatBruestung)
        s.stab(
          12,
          "gerade",
          [o.breite + 2 * ls12],
          2 * lagen,
          `Brüstungszulage Öffnung ${nr} (${marke})`,
          `Brüstung ${marke}`
        );
      // seitliche Zulagen: je Seite 1 Ø12 je Lage
      s.stab(
        12,
        "gerade",
        [o.hoehe + 2 * ls12],
        2 * lagen,
        `Seitliche Zulage Öffnung ${nr} (${marke})`,
        `Laibung ${marke}`
      );
      // Schrägstäbe an einspringenden Ecken (je Ecke, je Lage 1 Ø12, L = 1,00 m)
      const ecken =
        (reichtBisOben ? 0 : 2) + (hatBruestung ? 2 : 0); // nur echte einspringende Ecken
      if (ecken > 0)
        s.stab(
          12,
          "schraegstab",
          [1.0],
          ecken * lagen,
          `Schrägstäbe Öffnung ${nr} (${marke})`,
          `Diagonal ${marke}`
        );
      if (o.breite > 2.0)
        hinweise.push(
          `⚠ Öffnung ${nr}: Sturzbreite ${o.breite.toFixed(2)} m > 2,0 m – Sturz gesondert statisch bemessen (ggf. Fertigteil-/Balkensturz).`
        );
    } else {
      // Decke: Wechselbewehrung umlaufend + Schrägstäbe
      s.stab(
        12,
        "gerade",
        [o.breite + 2 * ls12],
        2 * lagen,
        `Wechselzulage längs, Aussparung ${nr} (${marke})`,
        `Wechsel ${marke} längs`
      );
      s.stab(
        12,
        "gerade",
        [o.hoehe + 2 * ls12],
        2 * lagen,
        `Wechselzulage quer, Aussparung ${nr} (${marke})`,
        `Wechsel ${marke} quer`
      );
      s.stab(
        12,
        "schraegstab",
        [1.0],
        4 * lagen,
        `Schrägstäbe Aussparung ${nr} (${marke})`,
        `Diagonal ${marke}`
      );
      if (o.breite > 1.0 || o.hoehe > 1.0)
        hinweise.push(
          `⚠ Aussparung ${nr} > 1,0 m: Deckenwechsel statisch nachweisen.`
        );
    }
  });

  /* ---------- 6) Allgemeine Hinweise ---------- */
  hinweise.push(
    "Diese Ermittlung basiert auf Mindestbewehrung nach EC2/ÖNORM B 1992-1-1 und anerkannten Konstruktionsregeln. Lastabhängige Bewehrung (Biegung, Querkraft, Knicksicherheit, Erdbeben, Durchstanzen) ist NICHT enthalten und muss von einer Statikerin/einem Statiker nachgewiesen werden."
  );
  if (bauteil === "wand" && masse.dicke < 0.15 && lagen === 2)
    hinweise.push("⚠ Wanddicke < 15 cm: zweilagige Bewehrung ist schwer einbaubar – einlagig mittig prüfen.");
  if (bauteil === "wand" && masse.dicke >= 0.2 && lagen === 1)
    hinweise.push("Hinweis: Ab d ≥ 20 cm ist beidseitige (zweilagige) Bewehrung üblich.");

  /* ---------- 7) Ergebnis zusammenstellen ---------- */
  const positionen = s.fertig();
  const mattenGewicht =
    Math.round(
      positionen.filter((p) => p.art === "matte").reduce((a, p) => a + p.gewichtGesamt, 0) * 10
    ) / 10;
  const stabstahlGewicht =
    Math.round(
      positionen.filter((p) => p.art === "stab").reduce((a, p) => a + p.gewichtGesamt, 0) * 10
    ) / 10;

  return {
    positionen,
    gesamtgewicht: Math.round((mattenGewicht + stabstahlGewicht) * 10) / 10,
    mattenGewicht,
    stabstahlGewicht,
    kennwerte: {
      ac,
      nutzhoehe,
      asMinHaupt: Math.round(asMinHaupt * 100) / 100,
      asMinQuer: Math.round(asMinQuer * 100) / 100,
      gewaehlteMatte: matte?.name ?? "–",
      asVorhanden: matte?.as ?? 0,
      cnom,
      flaecheNetto: Math.round(flaecheNetto * 100) / 100,
    },
    hinweise,
  };
}
