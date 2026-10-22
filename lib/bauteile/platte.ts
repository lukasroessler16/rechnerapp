/**
 * Bauteile: Bodenplatte und Deckenplatte.
 *
 * Beide sind horizontale Flächentragwerke und teilen sich die Bewehrungs-
 * regeln; sie unterscheiden sich in der Randsituation, in den Hinweisen und
 * darin, dass nur die Deckenplatte Aussparungen kennt.
 *
 * Mindestbewehrung nach EC2 9.2.1.1 (Platten):
 *   As,min = max(0,26 · fctm/fyk · b · d ; 0,0013 · b · d)
 *   Querbewehrung ≥ 20 % der Hauptbewehrung (EC2 9.3.1.1)
 * Nutzhöhe d = h − c_nom − ds/2 (ds ≈ 8 mm angenommen).
 */

import { Kennwerte, Projekt } from "../types";
import { uebergreifung } from "../normdaten";
import { Ansicht, Bauteilmodul, Detailfeld, Kontext } from "./typen";
import { Bewehrungsstelle } from "../stahlwahl";
import {
  anschlusseisen,
  flaechenAnsicht,
  flaechenbewehrung,
  oeffnungsMarke,
  randeinfassung,
  STELLE,
  zahl,
} from "./helfer";

/** die vier Ränder in Zeichen- und Prüfreihenfolge */
const RAENDER = ["links", "rechts", "oben", "unten"] as const;
type Rand = (typeof RAENDER)[number];

/** Länge des jeweiligen Randes [m] */
const randLaenge = (p: Projekt, r: Rand) =>
  r === "links" || r === "rechts" ? p.masse.hoehe : p.masse.laenge;

/* ------------------------------------------------------------------ */
/* Gemeinsamer Berechnungskern                                         */
/* ------------------------------------------------------------------ */

interface PlattenArt {
  id: string;
  name: string;
  beschreibung: string;
  bildId: string;
  planinhalt: string;
  ansichtTitel: string;
  detailTitel: string;
  detailHilfe: string;
  hatOeffnungen: boolean;
  /** Beschriftung des zweiten Grundmaßes */
  querLabel: string;
  standardDicke: number;
  dickeHinweis: string;
  randOptionen: { wert: string; titel: string; bildId: string }[];
  randStandard: string;
  randName: Record<string, string>;
  /** setzt die Randbewehrung um und ergänzt Hinweise */
  randBewehrung(k: Kontext, rand: Rand, art: string, strecke: number): void;
  /**
   * Die Bewehrungsstellen desselben Randes – eine je Art von Stahl, die dort
   * liegt. Steht bewusst direkt neben randBewehrung(): Was die eine Funktion
   * erzeugt, muss die andere anbieten. Geprüft wird das in
   * scripts/test-berechnung.ts.
   */
  randStellen(projekt: Projekt, rand: Rand, art: string): Bewehrungsstelle[];
  /** zusätzliche fachliche Hinweise nach der Hauptberechnung */
  hinweise(k: Kontext): void;
  verwendungMatte(lagen: 1 | 2): string;
  kurzMatte: string;
}

function baue(art: PlattenArt): Bauteilmodul {
  const detailFelder: Detailfeld[] = RAENDER.map((r) => ({
    schluessel: r,
    label: `Rand ${r}`,
    standard: art.randStandard,
    optionen: art.randOptionen,
  }));

  return {
    id: art.id,
    name: art.name,
    beschreibung: art.beschreibung,
    // Beide Plattenarten stehen in derselben Kategorie – auch die
    // Bodenplatte, die zwar eine Flachgründung ist, aber wie eine Platte
    // gesucht und gerechnet wird.
    kategorie: "platten",
    bildId: art.bildId,
    hatOeffnungen: art.hatOeffnungen,
    flaechenbewehrt: true,
    oeffnungsTypen: ["aussparung"],
    detailTitel: art.detailTitel,
    detailHilfe: art.detailHilfe,
    planinhalt: art.planinhalt,

    masse: [
      { schluessel: "laenge", label: "Länge", einheit: "m", min: 0.5, max: 100, standard: 5.0 },
      {
        schluessel: "hoehe",
        label: art.querLabel,
        einheit: "m",
        min: 0.5,
        max: 100,
        standard: 4.0,
      },
      {
        schluessel: "dicke",
        label: "Dicke",
        einheit: "cm",
        min: 0.08,
        max: 1.0,
        schritt: 1,
        standard: art.standardDicke,
        hinweis: art.dickeHinweis,
      },
    ],

    details: detailFelder,

    masseText: (p) =>
      `${art.name} ${zahl(p.masse.laenge)} × ${zahl(p.masse.hoehe)} × ${zahl(p.masse.dicke)} m`,

    /** Plattenfläche mal Dicke, abzüglich der Aussparungen */
    betonvolumen: (p) => {
      const brutto = p.masse.laenge * p.masse.hoehe * p.masse.dicke;
      const loecher = p.oeffnungen.reduce(
        (summe, o) => summe + o.breite * o.hoehe * p.masse.dicke,
        0
      );
      return Math.max(0, brutto - loecher);
    },

    zeichnung(projekt: Projekt): Ansicht[] {
      const a = flaechenAnsicht(projekt, {
        id: "draufsicht",
        titel: art.ansichtTitel,
        fuss: `d = ${zahl(projekt.masse.dicke)} m`,
        mitOeffnungen: art.hatOeffnungen,
      });
      a.randtexte = RAENDER.map((r) => ({
        seite: r === "links" || r === "rechts" ? r : r,
        text: art.randName[projekt.details[r]] ?? "",
      }));
      return [a];
    },

    stellen(projekt) {
      const stellen = [
        STELLE.flaeche(
          projekt,
          "Flächenbewehrung",
          `Die Bewehrung der ${art.name.toLowerCase()} selbst – als Lagermatten oder als Stabstahl in beiden Richtungen.`
        ),
      ];
      for (const r of RAENDER)
        stellen.push(...art.randStellen(projekt, r, projekt.details[r]));
      projekt.oeffnungen.forEach((o, i) =>
        stellen.push(
          STELLE.oeffnung(
            `oef:${o.id}`,
            `Aussparung ${oeffnungsMarke(o, i)}`,
            "Wechselzulagen rundum und Schrägstäbe an den Ecken der Aussparung."
          )
        )
      );
      return stellen;
    },

    oeffnungsHinweise(projekt, i) {
      const o = projekt.oeffnungen[i];
      const details = [
        "Wechselbewehrung (Zulagen umlaufend)",
        "Schrägstäbe an den Aussparungsecken",
      ];
      if (o.breite > 1.0 || o.hoehe > 1.0)
        details.push("⚠ Aussparung > 1,0 m: Deckenwechsel statisch nachweisen");
      return details;
    },

    bewehrung(k: Kontext): Kennwerte {
      const { masse, oeffnungen, details } = k.projekt;
      const dickeCm = masse.dicke * 100;
      const ac = dickeCm * 100;

      /* ---- 1) Mindestbewehrung EC2 9.2.1.1 ---- */
      const nutzhoehe = dickeCm - k.cnom / 10 - 0.4;
      const asMin = Math.max(
        (0.26 * k.beton.fctm * 100 * nutzhoehe) / k.fyk,
        0.0013 * 100 * nutzhoehe
      );
      const asMinHaupt = asMin;
      const asMinQuer = 0.2 * asMin;

      /* ---- 2) Flächenbewehrung ---- */
      k.s.gruppe("Flächenbewehrung", "flaeche");
      const flaecheNetto = Math.max(
        0,
        masse.laenge * masse.hoehe -
          oeffnungen.reduce((a, o) => a + o.breite * o.hoehe, 0)
      );
      const flaeche = flaechenbewehrung(k, {
        asErf: Math.max(asMinHaupt, asMinQuer),
        flaeche: flaecheNetto,
        laenge: masse.laenge,
        hoehe: masse.hoehe,
        verwendung: art.verwendungMatte(k.lagen),
        kurz: art.kurzMatte,
      });

      /* ---- 3) Ränder ---- */
      // Jeder Rand ist eine eigene Stelle; randBewehrung() setzt die Gruppe
      // selbst, weil ein Rand je nach Detail auch zwei Arten Stahl bekommt.
      for (const r of RAENDER)
        art.randBewehrung(k, r, details[r], randLaenge(k.projekt, r));

      /* ---- 4) Aussparungen ---- */
      oeffnungen.forEach((o, i) => {
        const nr = i + 1;
        const marke = oeffnungsMarke(o, i);
        k.s.gruppe(`Aussparung ${marke}`, `oef:${o.id}`);
        const w = k.stahl();
        const ls = uebergreifung(w.durchmesser);
        k.s.stab(w.durchmesser, "gerade", [o.breite + 2 * ls], 2 * k.lagen,
          `Wechselzulage längs, Aussparung ${nr} (${marke})`, `Wechsel ${marke} längs`);
        k.s.stab(w.durchmesser, "gerade", [o.hoehe + 2 * ls], 2 * k.lagen,
          `Wechselzulage quer, Aussparung ${nr} (${marke})`, `Wechsel ${marke} quer`);
        k.s.stab(w.durchmesser, "schraegstab", [1.0], 4 * k.lagen,
          `Schrägstäbe Aussparung ${nr} (${marke})`, `Diagonal ${marke}`);
        if (o.breite > 1.0 || o.hoehe > 1.0)
          k.hinweise.push(`⚠ Aussparung ${nr} > 1,0 m: Deckenwechsel statisch nachweisen.`);
      });

      /* ---- 5) bauteilspezifische Hinweise ---- */
      art.hinweise(k);

      return {
        ac,
        nutzhoehe: Math.round(nutzhoehe * 10) / 10,
        asMinHaupt: Math.round(asMinHaupt * 100) / 100,
        asMinQuer: Math.round(asMinQuer * 100) / 100,
        gewaehlteMatte: flaeche.bezeichnung,
        asVorhanden: flaeche.asVorhanden,
        cnom: k.cnom,
        flaecheNetto: Math.round(flaecheNetto * 100) / 100,
        hauptLabel: "erforderlich (As,min Hauptrichtung)",
        hauptEinheit: "cm²/m",
        wahlLabel: flaeche.label,
        flaecheLabel: "Bewehrungsfläche netto",
      };
    },
  };
}

/* ------------------------------------------------------------------ */
/* Bodenplatte                                                         */
/* ------------------------------------------------------------------ */

export const bodenplatte = baue({
  id: "bodenplatte",
  name: "Bodenplatte",
  beschreibung: "Gründungsplatte auf Sauberkeitsschicht, ohne Aussparungen",
  bildId: "icon_bodenplatte",
  planinhalt: "Bewehrungsplan Bodenplatte (Draufsicht)",
  ansichtTitel: "Bodenplatte – Draufsicht",
  detailTitel: "Ränder der Bodenplatte",
  detailHilfe:
    "Was schließt an den jeweiligen Plattenrand an? Aufgehende Wände erhalten Anschlusseisen, freie Ränder eine Einfassung mit Steckbügeln.",
  hatOeffnungen: false,
  querLabel: "Breite",
  standardDicke: 0.25,
  dickeHinweis: "üblich: 20–30 cm",
  randStandard: "wand_darueber",
  randOptionen: [
    { wert: "wand_darueber", titel: "aufgehende Wand darüber", bildId: "bodenplatte" },
    { wert: "frostschuerze", titel: "Frostschürze / Randbalken", bildId: "streifenfundament" },
    { wert: "frei", titel: "freier Plattenrand", bildId: "freier_rand" },
  ],
  randName: {
    wand_darueber: "Wandanschluss",
    frostschuerze: "Frostschürze",
    frei: "freier Rand (Steckbügel)",
  },
  randBewehrung(k, rand, wahl, strecke) {
    k.s.gruppe(`Rand ${rand}`, `rand:${rand}`);
    if (wahl === "wand_darueber") {
      anschlusseisen(k, strecke, `Wand ${rand}`, `Anschluss ${rand}`);
    } else if (wahl === "frostschuerze") {
      anschlusseisen(k, strecke, `Frostschürze ${rand}`, `Schürze ${rand}`);
      k.hinweise.push(
        `Rand „${rand}“: Frostschürze/Randbalken ist ein eigenes Bauteil – Längsbewehrung und Bügel gesondert ermitteln.`
      );
    } else {
      randeinfassung(k, strecke, rand, k.projekt.masse.dicke);
    }
  },
  randStellen(projekt, rand, wahl) {
    const titel = `Rand ${rand}`;
    if (wahl === "wand_darueber")
      return [STELLE.anschluss(projekt, `rand:${rand}`, titel, "Anschlusseisen für die aufgehende Wand, abgewinkelt, je Lage.")];
    if (wahl === "frostschuerze")
      return [STELLE.anschluss(projekt, `rand:${rand}`, titel, "Anschlusseisen in die Frostschürze bzw. den Randbalken.")];
    return [STELLE.rand(`rand:${rand}`, titel, "Freier Plattenrand: Steckbügel fassen die Bewehrung ein.")];
  },
  hinweise(k) {
    if (k.lagen === 1)
      k.hinweise.push(
        "⚠ Bodenplatte einlagig: Bei Bettungsreaktion und Wandlasten entstehen auch obere Zugspannungen – obere Lage vom Statiker prüfen lassen."
      );
    k.hinweise.push(
      "⚠ Sohlspannung, Bettung und Setzungen sind nicht Teil dieser Ermittlung; die Plattendicke und die Bewehrung sind auf Basis eines Bodengutachtens statisch nachzuweisen."
    );
  },
  verwendungMatte: (lagen) =>
    lagen === 2
      ? "Flächenbewehrung Bodenplatte, obere + untere Lage"
      : "Flächenbewehrung Bodenplatte, untere Lage",
  kurzMatte: "Fläche Boden",
});

/* ------------------------------------------------------------------ */
/* Deckenplatte                                                        */
/* ------------------------------------------------------------------ */

export const deckenplatte = baue({
  id: "deckenplatte",
  name: "Deckenplatte",
  beschreibung: "Stahlbeton-Flachdecke mit Aussparungen",
  bildId: "icon_deckenplatte",
  planinhalt: "Bewehrungsplan Deckenplatte (Draufsicht)",
  ansichtTitel: "Deckenplatte – Draufsicht",
  detailTitel: "Auflagersituation der Ränder",
  detailHilfe:
    "Für jeden Deckenrand: auf einer Wand aufgelagert, in einen Unterzug eingebunden oder frei auskragend? Freie Ränder erhalten Steckbügel als Randeinfassung.",
  hatOeffnungen: true,
  querLabel: "Breite",
  standardDicke: 0.2,
  dickeHinweis: "üblich: 18–25 cm",
  randStandard: "wand_auflager",
  randOptionen: [
    { wert: "wand_auflager", titel: "auf Wand aufgelagert", bildId: "auflager" },
    { wert: "unterzug", titel: "in Unterzug eingebunden", bildId: "wandstoss" },
    { wert: "frei", titel: "freier Rand / Auskragung", bildId: "freier_rand" },
  ],
  randName: {
    wand_auflager: "Auflager (Wand)",
    unterzug: "Unterzug",
    frei: "freier Rand",
  },
  randBewehrung(k, rand, wahl, strecke) {
    k.s.gruppe(`Rand ${rand}`, `rand:${rand}`);
    randeinfassung(k, strecke, rand, k.projekt.masse.dicke);
    if (wahl === "wand_auflager" && k.lagen === 1)
      k.hinweise.push(
        `⚠ Auflagerrand „${rand}“: obere Stützbewehrung (Einspannung) statisch festlegen – hier nur untere Lage erfasst.`
      );
    if (wahl === "unterzug") {
      k.s.gruppe(`Unterzug ${rand}`, `uz:${rand}`);
      anschlusseisen(k, strecke, `Unterzug ${rand}`, `Unterzug ${rand}`);
      k.hinweise.push(
        `Rand „${rand}“: Unterzug ist ein eigenes Bauteil – Längsbewehrung und Bügel gesondert ermitteln (Bauteil „Träger“).`
      );
    }
    if (wahl === "frei")
      k.hinweise.push(
        `⚠ Rand „${rand}“ frei/auskragend: Kragmomente erzeugen obere Zugbewehrung – zwingend statisch bemessen.`
      );
  },
  randStellen(projekt, rand, wahl) {
    const stellen = [
      STELLE.rand(`rand:${rand}`, `Rand ${rand}`, "Randeinfassung des Deckenrands: Steckbügel umfassen die Bewehrung."),
    ];
    if (wahl === "unterzug")
      stellen.push(
        STELLE.anschluss(projekt, `uz:${rand}`, `Unterzug ${rand}`, "Anschlusseisen in den Unterzug, abgewinkelt, je Lage.")
      );
    return stellen;
  },
  hinweise(k) {
    const { masse } = k.projekt;
    if (Math.min(masse.laenge, masse.hoehe) > 4.5)
      k.hinweise.push(
        "⚠ Spannweite > 4,5 m: Deckenbewehrung (Feld-/Stützmomente, Durchbiegung) unbedingt statisch bemessen – Mindestbewehrung genügt hier i. d. R. NICHT."
      );
  },
  verwendungMatte: (lagen) =>
    lagen === 2
      ? "Flächenbewehrung Decke, obere + untere Lage"
      : "Flächenbewehrung Decke, untere Lage",
  kurzMatte: "Fläche Decke",
});
