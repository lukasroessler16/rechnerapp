import type { Metadata } from "next";
import Wizard from "@/components/Wizard";

export const metadata: Metadata = {
  title: "Bewehrung berechnen – Bewehrungsrechner",
  description:
    "Bauteil, Maße, Öffnungen und Parameter eingeben – Bauplan, Biegeliste und Stückliste erhalten.",
};

/**
 * Der eigentliche Rechner. Keine Registrierung, keine Server-Sitzung:
 * Jeder Aufruf beginnt ein eigenständiges Projekt (Zustand nur im Browser).
 */
export default function RechnerSeite() {
  return <Wizard />;
}
