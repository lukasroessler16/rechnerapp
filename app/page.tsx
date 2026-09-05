import Wizard from "@/components/Wizard";

/**
 * Startseite = Wizard. Keine Registrierung, keine Sitzung auf dem Server:
 * Jeder Aufruf beginnt ein eigenständiges Projekt (Zustand nur im Browser).
 */
export default function Startseite() {
  return <Wizard />;
}
