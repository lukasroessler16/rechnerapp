/**
 * Datensparsame Nutzungsstatistik.
 *
 * WOZU: Ohne Zahlen ist nicht erkennbar, ob Interessenten schon bei den
 * Maßen aussteigen, erst bei den Firmendaten oder genau an der Bezahlseite.
 * Das ist der Unterschied zwischen „das Werkzeug wird nicht gekauft“ und
 * „der sechste Schritt ist zu mühsam“. Rückwirkend lassen sich diese Zahlen
 * nicht erheben – deshalb gehört das vor den Start, nicht danach.
 *
 * WIE: Absichtlich an keinen bestimmten Anbieter gebunden. Erwartet wird ein
 * Dienst mit der verbreiteten, cookiefreien Zählweise von Plausible oder
 * Umami – beide setzen keine Cookies, speichern keine IP-Adressen und
 * brauchen deshalb kein Einwilligungsbanner. Eingeschaltet wird über zwei
 * Umgebungsvariablen:
 *
 *   NEXT_PUBLIC_STATISTIK_URL     Adresse des Zählskripts
 *   NEXT_PUBLIC_STATISTIK_DOMAIN  die eigene Domain bzw. Website-Kennung
 *
 * Fehlen sie, wird gar nichts geladen und jedes Ereignis verpufft folgenlos.
 * Die App funktioniert dadurch in der Entwicklung und bei abgeschalteter
 * Statistik unverändert.
 *
 * WAS NICHT ERFASST WIRD: keine Maße, keine Firmendaten, keine Adressen,
 * keine Beträge – nur welcher Schritt erreicht wurde und welches Bauteil
 * bzw. Regelwerk dabei gewählt war. Nichts davon lässt sich einer Person
 * zuordnen.
 */

/** Adresse des Zählskripts, falls eingerichtet */
export function statistikUrl(): string {
  return process.env.NEXT_PUBLIC_STATISTIK_URL?.trim() || "";
}

/** Website-Kennung beim Statistikdienst */
export function statistikDomain(): string {
  return process.env.NEXT_PUBLIC_STATISTIK_DOMAIN?.trim() || "";
}

/** Ist die Statistik überhaupt eingerichtet? */
export function statistikAktiv(): boolean {
  return !!statistikUrl() && !!statistikDomain();
}

/** Die beiden Zählweisen, die unterstützt werden */
interface StatistikFenster {
  plausible?: (name: string, opts?: { props?: Record<string, string> }) => void;
  umami?: { track?: (name: string, daten?: Record<string, string>) => void };
}

/**
 * Ein Ereignis melden. Ohne eingerichteten Dienst passiert nichts.
 *
 * Nur im Browser aufrufen. Die Werte in `daten` müssen frei von
 * personenbezogenen Angaben sein – siehe Kopf dieser Datei.
 */
export function ereignis(name: string, daten?: Record<string, string>): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as StatistikFenster;
  try {
    if (typeof w.plausible === "function") {
      w.plausible(name, daten ? { props: daten } : undefined);
    } else if (typeof w.umami?.track === "function") {
      w.umami.track(name, daten);
    }
  } catch {
    /* Statistik darf niemals die Anwendung stören */
  }
}
