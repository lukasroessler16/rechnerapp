# Projektnotizen (für nahtlose Fortsetzung in jeder Claude-Sitzung)

Stand: 2026-09-14 · Status: **funktional fertig, vor dem Live-Gang**
(Build ✓, `npm test` ✓, E2E ✓, Paywall-Negativtest ✓).

## Getroffene Entscheidungen (mit Lukas abgestimmt)

Next.js 16 Full-Stack (TypeScript, App Router) · Stripe Checkout
(Einmalzahlung) · Vercel-Hosting · Preis 29 € (`PREIS_CENT=2900`).
Fachliche Prüfung und die Abstimmung mit der Kammer macht Lukas' Partner
(selbständiger Ziviltechniker).

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

## Regelwerk AT/DE

`lib/regelwerk.ts` – der Umschalter ändert die Rechnung, nicht nur die Wörter:
B550/ÖNORM B 4707 gegen B500/DIN 488, Δc_dev 10 mm gegen 15 mm (XC1 in DE
10 mm), Wand-Mindestbewehrung 0,002·Ac gegen 0,0015·Ac, Normzitate über
`anNorm()`. Was bewusst **nicht** unterschieden wird und warum, steht im Kopf
der Datei. Regressionswerte: Musterwand AT 2,50 cm²/m je Lage / Q257A,
DE 1,88 cm²/m / Q188A.

## Betriebsabsicherungen (neu, September 2026)

* `lib/betrieb.ts` – Demo-Riegel (in Produktion nur mit `DEMO_MODUS=1`),
  `BetriebsFehler` mit kundentauglichem Text, `melde()` als einzige Stelle für
  die spätere Sentry-Anbindung, Fehler nach der Zahlung als `kritisch`.
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
Payload-Version, Rate-Limit, Schutz-Header, CI, robots/sitemap/OG-Bild.

**Software (offen):**

* Fehlerdienst tatsächlich einrichten (Sentry o. ä.) und in `melde()` anbinden.
* Datensparsame Statistik (Plausible/Umami) – ohne sie ist nicht erkennbar,
  wo Interessenten abspringen; rückwirkend nicht nachholbar.
* Eigene Domain in Resend verifizieren (SPF/DKIM/DMARC), sonst landen die
  Dokumenten-Mails im Spam.
* `NEXT_PUBLIC_KONTAKT_MAIL` setzen – steht sonst in keiner Fehlermeldung.
* Beispiele-Seite spricht noch von Wänden und Decken, kennt die anderen sechs
  Bauteile und den DIN-Modus nicht.
* Test auf echten Geräten (iPhone, Android) und ein Durchlauf mit einer
  Person, die die App nicht kennt.

**Nicht-Software (Lukas):**

* Impressum und Datenschutz: alle `<Platzhalter>` ausfüllen, AV-Verträge mit
  Vercel, Stripe und Resend tatsächlich abschließen.
* Umsatzsteuer: Kleinunternehmerregelung gegen die EU-weite 10.000-€-Schwelle
  für grenzüberschreitende B2C-Digitalleistungen (OSS) – mit Steuerberater
  klären, bevor deutsche Kunden kaufen.
* Rechnungsstellung in Stripe aktivieren und Pflichtangaben prüfen.
* Versicherung: ausdrücklich klären, ob die bestehende Haftpflicht ein
  Werkzeug abdeckt, aus dem Bauunterlagen entstehen.
* Preis als Bruttopreis inkl. USt ausweisen.
* Vercel-Plan: Hobby ist für nicht-kommerzielle Nutzung gedacht → Pro buchen.

**Fachlich (Partner):** Review aller Berechnungen und Konstruktionsregeln,
Abstimmung mit der Kammer.
