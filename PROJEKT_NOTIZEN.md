# Projektnotizen (für nahtlose Fortsetzung in jeder Claude-Sitzung)

Stand: 2026-10-14 · Status: **funktional fertig, Berechnungen fachlich
geprüft, vor dem Live-Gang** (Build ✓, `npm test` ✓, E2E ✓,
Paywall-Negativtest ✓).

## Getroffene Entscheidungen (mit Lukas abgestimmt)

Next.js 16 Full-Stack (TypeScript, App Router) · Stripe Checkout
(Einmalzahlung) · Vercel-Hosting · Preis 29 € (`PREIS_CENT=2900`), bei
geteilten Wänden **je Abschnitt**. Fachliche Prüfung und die Abstimmung mit
der Kammer macht Lukas' Partner (selbständiger Ziviltechniker); die
Berechnungen hat er im Oktober 2026 durchgesehen und freigegeben.

## Architektur-Kernidee

Zustandslos, keine DB. Wizard-State im Browser (sessionStorage). Beim Checkout
wird die Projektgeometrie deflate+base64url-komprimiert in Stripe-Session-
Metadata gechunkt (`lib/payload.ts`), zusammen mit Formatversion (`v`) und
Code-Stand (`b`). `/api/dokumente` prüft `payment_status === "paid"` und liest
das Projekt aus der Session zurück → Paywall nicht umgehbar, Daten nicht
tauschbar. Logo/Firmendaten sind kosmetisch und kommen vom Client.

## Bauteil-Register

Acht Bauteile, jedes ein eigenständiges Modul in `lib/bauteile/`: wand,
deckenplatte, bodenplatte (platte.ts), stuetze, traeger, streifenfundament,
einzelfundament, stuetzmauer. Der Kern enthält **keine** `if (bauteil === …)`-
Verzweigungen; ein neues Bauteil ist reine Ergänzung. Eine abstrakte
Zeichnungsbeschreibung (`Ansicht[]`) wird zweimal gerendert: `AnsichtSVG.tsx`
(Bildschirm) und `lib/pdf/ansicht.ts` (PDF).

Bewusst gegen Doppelzählung entschieden: Anschlussstäbe Decke→Träger gehören
zur Deckenplatte, Wandanschlusseisen zur Wand, Stützenanschluss zur Stütze.
Jedes Bauteil, dem dadurch etwas „fehlt“, gibt dazu einen Hinweis aus.

Sonderfall Stützmauer: als einziges Bauteil eine **Vorbemessung aus Erddruck**
(Rankine, γ_G = 1,35 / γ_Q = 1,50), weil reine Mindestbewehrung dort falsche
Mengen liefern würde. Eigener `abschlussHinweis` und `planHinweis`.

## Wände in Abschnitten (Oktober 2026)

Eine lange Wand wird in Betonierabschnitte geteilt. `lib/abschnitte.ts` ist
die einzige Stelle, die davon weiß: `Bauvorhaben = Projekt[]`, höchstens
`MAX_ABSCHNITTE = 8`, teilbar nur, was im Bauteilmodul `teilbar: true` setzt
(heute allein die Wand). Berechnungskern, Bauteilmodule, Zeichnungen und
Validierung blieben **unberührt** – sie rechnen weiterhin genau einen
Abschnitt. Bewusst ein Wrapper statt eines Umbaus von `Projekt`.

* Je Abschnitt eigene Maße, Öffnungen und Ränder; Bauteil, bautechnische
  Parameter und Firmendaten gehören dem Bauvorhaben und werden in
  `vereinheitliche()` erzwungen – nicht nur in der Oberfläche, damit auch eine
  manipulierte Anfrage keine Mischung aus zwei Regelwerken erzeugt.
* Beim Anlegen eines Abschnitts wird an der neuen Fuge beidseits
  `wand_weiter` gesetzt (sonst bekämen beide Teile eine Randeinfassung, die es
  nicht gibt), und der Wizard springt in den neuen Abschnitt zum Maß-Schritt.
* `PAYLOAD_VERSION = 2` mit Migration 1 → 2 (einzelnes Projekt → Liste). Alte
  bezahlte Links bleiben dauerhaft einlösbar; `scripts/test-betrieb.ts` prüft
  das mit echten Version-1-Daten. Acht Abschnitte brauchen dank Kompression
  genauso viele Metadata-Felder wie einer (2).
* Preis: `quantity = Abschnitte` in der Stripe-Session.
* Grafik „Abschnitt 2 von 4“: Geometrie in `abschnittsStreifen()`, gerendert
  von `components/AbschnittSVG.tsx` (Bildschirm) und
  `lib/pdf/abschnittsgrafik.ts` (PDF) – proportional zu den Längen, weil genau
  das die Information ist. `aktiv = -1` = kein Abschnitt hervorgehoben
  (Gesamtliste).
* `lib/dokumente.ts` ist die einzige Antwort auf „welche Dateien bekommt der
  Kunde?“: je Abschnitt Bauplan/Biegeliste/Stückliste, ab zwei Abschnitten
  zusätzlich `lib/pdf/gesamtliste.ts` (Bestellmengen über alles, nach
  Erzeugnis zusammengefasst – das Blatt für den Händler). Ausgeliefert wird
  **eine ZIP-Datei** (jszip, `compression: "STORE"`), die auf der Erfolgsseite
  von selbst lädt; `/api/dokumente` kennt zusätzlich `plan: true` (Dateiliste)
  und den Einzelabruf. Dateinamen mit führender Abschnittsnummer, damit im
  Download-Ordner nicht vier gleich heißende Baupläne liegen.

## Regelwerk AT/DE

`lib/regelwerk.ts` – der Umschalter ändert die Rechnung, nicht nur die Wörter:
B550/ÖNORM B 4707 gegen B500/DIN 488, Δc_dev 10 mm gegen 15 mm (XC1 in DE
10 mm), Wand-Mindestbewehrung 0,002·Ac gegen 0,0015·Ac, Normzitate über
`anNorm()`. Was bewusst **nicht** unterschieden wird und warum, steht im Kopf
der Datei. Regressionswerte: Musterwand AT 2,50 cm²/m je Lage / Q257A,
DE 1,88 cm²/m / Q188A.

## Betriebsabsicherungen (neu, September 2026)

* `lib/betrieb.ts` – Demo-Riegel (in Produktion nur mit `DEMO_MODUS=1`),
  `BetriebsFehler` mit kundentauglichem Text, `melde()` als einzige Meldestelle.
  Fehler nach der Zahlung gelten als `kritisch` und lösen eine Alarmmail an
  `ALARM_MAIL` aus (Sperrfrist 10 min je Fehlerart). Sentry kann später
  zusätzlich in `melde()` angebunden werden.
* `lib/statistik.ts` – cookiefreie Zählung (Plausible/Umami), vier Ereignisse:
  schritt, checkout_gestartet, dokument_geladen, dokument_fehler. Ohne
  `NEXT_PUBLIC_STATISTIK_URL` passiert nichts.
* `lib/version.ts` – `PAYLOAD_VERSION`, `MIGRATIONEN`, Code-Stand auf dem PDF.
* `lib/ratelimit.ts` – Zähler je IP und Route, im Arbeitsspeicher der Instanz.
* `next.config.ts` – CSP und Schutz-Header (`unsafe-eval` nur in Entwicklung).
* `.github/workflows/pruefen.yml` – Typen, Stil, Tests, Build bei jedem Push.

## Tests

`npm test` (Typen, Stil, Berechnung, Betrieb, PDFs) · `npm run pruefen`
(zusätzlich Build) · `npm run test:e2e -- 3000` bei laufendem Server.
Die Wand ist der Regressionsfall: **446,7 kg, 12 Positionen** – ändert sich
das beim Anfassen eines anderen Bauteils, ist etwas kaputt.

## Offen vor dem Live-Gang

**Software (erledigt):** Git-Historie, Demo-Riegel, Fehleralarm,
Payload-Version, Rate-Limit, Schutz-Header, CI, robots/sitemap/OG-Bild,
Preis- und Leistungstexte auf Startseite, Beispiele und Nutzungsbedingungen
an die abschnittsweise Abrechnung angepasst.

**Software (offen):**

* Eigene Domain in Resend verifizieren (SPF/DKIM/DMARC) – davon hängen jetzt
  beide Mailwege ab: Dokumentenlink an den Kunden UND Alarmmail an Lukas.
* `ALARM_MAIL` und `NEXT_PUBLIC_KONTAKT_MAIL` setzen.
* Statistikdienst buchen und die zwei Variablen eintragen (der Code steht).
* Test auf echten Geräten (iPhone, Android) und ein Durchlauf mit einer
  Person, die die App nicht kennt.
* Push auf GitHub, damit die CI den Stand sieht.

**Nicht-Software (Lukas):**

* Impressum und Datenschutz: alle `<Platzhalter>` ausfüllen, AV-Verträge mit
  Vercel, Stripe und Resend tatsächlich abschließen.
* Umsatzsteuer: Kleinunternehmerregelung gegen die EU-weite 10.000-€-Schwelle
  für grenzüberschreitende B2C-Digitalleistungen (OSS) – mit Steuerberater
  klären, bevor deutsche Kunden kaufen.
* Rechnungsstellung in Stripe aktivieren und Pflichtangaben prüfen.
* Versicherung: ausdrücklich klären, ob die bestehende Haftpflicht ein
  Werkzeug abdeckt, aus dem Bauunterlagen entstehen.
* Preis als Bruttopreis inkl. USt ausweisen – und die Platzhalter in
  Abschnitt 3 der Nutzungsbedingungen ausfüllen (dort steht jetzt auch die
  Abrechnung je Wandabschnitt).
* Vercel-Plan: Hobby ist für nicht-kommerzielle Nutzung gedacht → Pro buchen.

**Fachlich (Partner):** Review aller Berechnungen und Konstruktionsregeln
erledigt; offen bleibt die Abstimmung mit der Kammer.
