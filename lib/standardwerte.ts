/**
 * Standard-Startwerte für ein neues Projekt (clientseitig).
 */
import { Projekt } from "./types";
import { cnomAusExposition } from "./normdaten";

export function neuesProjekt(): Projekt {
  const heute = new Date().toISOString().slice(0, 10);
  return {
    bauteil: "wand",
    masse: { laenge: 5.0, hoehe: 2.75, dicke: 0.25 },
    oeffnungen: [],
    anschluesse: { unten: "bodenplatte", oben: "decke_ueber", links: "ecke", rechts: "ecke" },
    deckenRaender: {
      links: "wand_auflager",
      rechts: "wand_auflager",
      oben: "wand_auflager",
      unten: "wand_auflager",
    },
    parameter: {
      betonklasse: "C25/30",
      expositionsklasse: "XC2",
      betondeckung: cnomAusExposition("XC2"),
      stahlguete: "B550B",
      lagen: 2,
      matte: "auto",
      stababstand: 250,
    },
    firmendaten: {
      firma: "",
      planersteller: "",
      bauvorhaben: "",
      adresse: "",
      datum: heute,
    },
  };
}
