/**
 * Bauteil: Stahlbetonwand (Ansicht).
 *
 * Bewehrung:
 *  – Flächenbewehrung aus Lagermatten, Mindestbewehrung nach EC2 9.6:
 *      vertikal   As,vmin = 0,002 · Ac
 *      horizontal As,hmin = max(0,25 · As,vmin ; 0,001 · Ac)
 *  – konstruktive Anschlüsse an den vier Rändern je nach gewähltem Detail
 *  – Öffnungsverstärkungen: Sturz-, Brüstungs- und Laibungszulagen sowie
 *    Schrägstäbe an den einspringenden Ecken (Rissbreitenbegrenzung)
 */

import { Kennwerte, Pruefmeldung, Projekt } from "../types";
import { uebergreifung } from "../normdaten";
import { Ansicht, Bauteilmodul, Kontext } from "./typen";
import {
  anschlusseisen,
  flaechenAnsicht,
  flaechenbewehrung,
  oeffnungsMarke,
  randeinfassung,
  stossEisen,
  stueckImRaster,
  zahl,
} from "./helfer";

/** Klartext der Detailauswahlen – für Plan und Skizze */
const NAMEN: Record<string, string> = {
  bodenplatte: "Anschluss Bodenplatte",
  streifenfundament: "Anschluss Streifenfundament",
  decke_unter: "Anschluss Decke unten",
  decke_ueber: "Anschluss Decke oben",
  wand_weiter: "Wand läuft weiter (Arbeitsfuge)",
  ecke: "Eckausbildung",
  wandstoss: "Wandstoß",
  frei: "freier Rand (Steckbügel)",
};

/** Bezeichnung des unteren Anschlusses in der Positionsliste */
const UNTEN_TEXT: Record<string, string> = {
  bodenplatte: "Bodenplatte",
  streifenfundament: "Streifenfundament",
  decke_unter: "Decke unten",
};

export const wand: Bauteilmodul = {
  id: "wand",
  name: "Wand",
  beschreibung: "Stahlbetonwand mit Fenster-/Türöffnungen",
  bildId: "icon_wand",
  hatOeffnungen: true,
  flaechenbewehrt: true,
  oeffnungsTypen: ["fenster", "tuer", "aussparung"],
  detailTitel: "Anschlussdetails",
  detailHilfe:
    "Wie schließt die Wand an angrenzende Bauteile an? Das Vorschaubild zeigt das gewählte Detail (Beton grau, Bewehrung orange).",
  planinhalt: "Bewehrungsplan Wand (Ansicht)",

  masse: [
    { schluessel: "laenge", label: "Länge", einheit: "m", min: 0.5, max: 100, standard: 5.0 },
    { schluessel: "hoehe", label: "Höhe", einheit: "m", min: 0.5, max: 100, standard: 2.75 },
    {
      schluessel: "dicke",
      label: "Dicke",
      einheit: "cm",
      min: 0.08,
      max: 1.0,
      schritt: 1,
      standard: 0.25,
      hinweis: "üblich: 20–30 cm",
    },
  ],

  details: [
    {
      schluessel: "unten",
      label: "Anschluss unten",
      standard: "bodenplatte",
      optionen: [
        { wert: "bodenplatte", titel: "Bodenplatte", bildId: "bodenplatte" },
        { wert: "streifenfundament", titel: "Streifenfundament", bildId: "streifenfundament" },
        { wert: "decke_unter", titel: "Decke (Wand steht auf Decke)", bildId: "decke_unter" },
        { wert: "frei", titel: "frei / ohne Anschluss", bildId: "freier_rand" },
      ],
    },
    {
      schluessel: "oben",
      label: "Anschluss oben",
      standard: "decke_ueber",
      optionen: [
        { wert: "decke_ueber", titel: "Deckenanschluss oben", bildId: "decke_ueber" },
        { wert: "wand_weiter", titel: "Wand läuft weiter (Arbeitsfuge)", bildId: "wand_weiter" },
        { wert: "frei", titel: "freier oberer Rand (Attika o. Ä.)", bildId: "freier_rand" },
      ],
    },
    {
      schluessel: "links",
      label: "Anschluss links",
      standard: "ecke",
      optionen: [
        { wert: "ecke", titel: "Eckausbildung (Außen-/Innenecke)", bildId: "ecke" },
        { wert: "wandstoss", titel: "Wandstoß (T-Anschluss)", bildId: "wandstoss" },
        { wert: "frei", titel: "freies Wandende", bildId: "freier_rand" },
      ],
    },
    {
      schluessel: "rechts",
      label: "Anschluss rechts",
      standard: "ecke",
      optionen: [
        { wert: "ecke", titel: "Eckausbildung (Außen-/Innenecke)", bildId: "ecke" },
        { wert: "wandstoss", titel: "Wandstoß (T-Anschluss)", bildId: "wandstoss" },
        { wert: "frei", titel: "freies Wandende", bildId: "freier_rand" },
      ],
    },
  ],

  masseText: (p) =>
    `Wand ${zahl(p.masse.laenge)} × ${zahl(p.masse.hoehe)} × ${zahl(p.masse.dicke)} m`,

  zeichnung(projekt: Projekt): Ansicht[] {
    const a = flaechenAnsicht(projekt, {
      id: "ansicht",
      titel: "Wandansicht",
      fuss: `d = ${zahl(projekt.masse.dicke)} m`,
    });
    const d = projekt.details;
    a.randtexte = [
      { seite: "unten", text: NAMEN[d.unten] ?? "" },
      { seite: "oben", text: NAMEN[d.oben] ?? "" },
      { seite: "links", text: NAMEN[d.links] ?? "" },
      { seite: "rechts", text: NAMEN[d.rechts] ?? "" },
    ];
    return [a];
  },

  oeffnungsHinweise(projekt, i) {
    const o = projekt.oeffnungen[i];
    const details: string[] = [];
    const reichtBisOben = o.y + o.hoehe >= projekt.masse.hoehe - 0.01;
    if (!reichtBisOben) details.push("Sturzbewehrung (Zulage über Öffnung)");
    if (o.y > 0.01) details.push("Brüstungszulage (unter Öffnung)");
    details.push("Seitliche Randzulagen");
    details.push("Schrägstäbe an den Öffnungsecken (Rissbreitenbegrenzung)");
    if (o.breite > 2.0)
      details.push("⚠ Sturz > 2,0 m: gesonderte statische Bemessung erforderlich");
    return details;
  },

  bewehrung(k: Kontext): Kennwerte {
    const { masse, oeffnungen, details } = k.projekt;
    const dickeCm = masse.dicke * 100;
    const ac = dickeCm * 100; // Ac je laufendem Meter [cm²/m]

    /* ---- 1) Mindestbewehrung EC2 9.6, Faktor je Nationalem Anhang ---- */
    // Österreich (Empfehlung des EC2): 0,002 · Ac · Deutschland: 0,0015 · Ac
    const asVminGesamt = k.regelwerk.wandVertikalFaktor * ac;
    const asHminGesamt = Math.max(0.25 * asVminGesamt, 0.001 * ac);
    const asMinHaupt = asVminGesamt / k.lagen;
    const asMinQuer = asHminGesamt / k.lagen;

    /* ---- 2) Flächenbewehrung ---- */
    const flaecheBrutto = masse.laenge * masse.hoehe;
    const flaecheNetto = Math.max(
      0,
      flaecheBrutto - oeffnungen.reduce((a, o) => a + o.breite * o.hoehe, 0)
    );
    // Q-Matten tragen in beide Richtungen gleich → maßgebend ist das Maximum
    const asErf = Math.max(asMinHaupt, asMinQuer);
    const matte = flaechenbewehrung(k, {
      asErf,
      flaeche: flaecheNetto,
      verwendung: `Flächenbewehrung Wand, ${k.lagen}-lagig`,
      kurz: "Fläche Wand",
    });

    /* ---- 3) Anschlüsse an den Rändern ---- */
    if (details.unten === "frei") {
      k.hinweise.push("⚠ Wand ohne unteren Anschluss – Lagesicherheit statisch klären.");
      randeinfassung(k, masse.laenge, "unten", masse.dicke);
    } else {
      anschlusseisen(
        k,
        masse.laenge,
        UNTEN_TEXT[details.unten] ?? "unten",
        "Anschluss unten"
      );
    }

    if (details.oben === "decke_ueber")
      anschlusseisen(k, masse.laenge, "Decke oben", "Anschluss oben");
    else if (details.oben === "wand_weiter")
      stossEisen(k, masse.laenge, "Wand oben", "Stoß oben");
    else randeinfassung(k, masse.laenge, "oben", masse.dicke);

    for (const seite of ["links", "rechts"] as const) {
      const art = details[seite];
      if (art === "ecke") {
        k.s.stab(
          10,
          "winkel",
          [0.8, 0.8],
          stueckImRaster(masse.hoehe, k.abst) * k.lagen,
          `Eckausbildung ${seite} (Eckwinkel Ø10/${k.abst / 10})`,
          `Ecke ${seite}`
        );
      } else if (art === "wandstoss")
        stossEisen(k, masse.hoehe, `Wandstoß ${seite}`, `Stoß ${seite}`);
      else randeinfassung(k, masse.hoehe, seite, masse.dicke);
    }

    /* ---- 4) Öffnungsverstärkungen ---- */
    const ls12 = uebergreifung(12); // Verankerung Ø12 ≈ 0,60 m
    oeffnungen.forEach((o, i) => {
      const nr = i + 1;
      const marke = oeffnungsMarke(o, i);
      const reichtBisOben = o.y + o.hoehe >= masse.hoehe - 0.01;
      const hatBruestung = o.y > 0.01;

      if (!reichtBisOben)
        k.s.stab(12, "gerade", [o.breite + 2 * ls12], 2 * k.lagen,
          `Sturzzulage Öffnung ${nr} (${marke})`, `Sturz ${marke}`);
      if (hatBruestung)
        k.s.stab(12, "gerade", [o.breite + 2 * ls12], 2 * k.lagen,
          `Brüstungszulage Öffnung ${nr} (${marke})`, `Brüstung ${marke}`);
      k.s.stab(12, "gerade", [o.hoehe + 2 * ls12], 2 * k.lagen,
        `Seitliche Zulage Öffnung ${nr} (${marke})`, `Laibung ${marke}`);

      // Schrägstäbe nur an echten einspringenden Ecken
      const ecken = (reichtBisOben ? 0 : 2) + (hatBruestung ? 2 : 0);
      if (ecken > 0)
        k.s.stab(12, "schraegstab", [1.0], ecken * k.lagen,
          `Schrägstäbe Öffnung ${nr} (${marke})`, `Diagonal ${marke}`);

      if (o.breite > 2.0)
        k.hinweise.push(
          `⚠ Öffnung ${nr}: Sturzbreite ${zahl(o.breite)} m > 2,0 m – Sturz gesondert statisch bemessen (ggf. Fertigteil-/Balkensturz).`
        );
    });

    /* ---- 5) Bauteilbezogene Hinweise ---- */
    if (masse.dicke < 0.15 && k.lagen === 2)
      k.hinweise.push(
        "⚠ Wanddicke < 15 cm: zweilagige Bewehrung ist schwer einbaubar – einlagig mittig prüfen."
      );
    if (masse.dicke >= 0.2 && k.lagen === 1)
      k.hinweise.push("Hinweis: Ab d ≥ 20 cm ist beidseitige (zweilagige) Bewehrung üblich.");
    k.hinweise.push(k.regelwerk.wandHinweis);

    return {
      ac,
      asMinHaupt: Math.round(asMinHaupt * 100) / 100,
      asMinQuer: Math.round(asMinQuer * 100) / 100,
      gewaehlteMatte: matte?.name ?? "–",
      asVorhanden: matte?.as ?? 0,
      cnom: k.cnom,
      flaecheNetto: Math.round(flaecheNetto * 100) / 100,
      hauptLabel: "erforderlich (As,min je Lage)",
      hauptEinheit: "cm²/m",
      wahlLabel: "Lagermatte",
      flaecheLabel: "Bewehrungsfläche netto",
    };
  },

  pruefe(): Pruefmeldung[] {
    return [];
  },
};
