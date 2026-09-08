/**
 * Live-Skizze des Wizards.
 *
 * Die eigentliche Zeichenlogik liegt beim Bauteilmodul (lib/bauteile/): es
 * beschreibt seine Ansichten abstrakt, AnsichtSVG bringt sie auf den
 * Bildschirm. Diese Komponente ist nur noch die Brücke dazwischen und wird
 * an allen Stellen verwendet, die "die Skizze zum Projekt" anzeigen.
 */

import { Projekt } from "@/lib/types";
import { bauteilModul } from "@/lib/bauteile";
import AnsichtSVG from "./AnsichtSVG";

export default function SkizzeSVG({ projekt }: { projekt: Projekt }) {
  const modul = bauteilModul(projekt.bauteil);
  return <AnsichtSVG ansichten={modul.zeichnung(projekt)} />;
}
