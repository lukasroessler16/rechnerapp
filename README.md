# Bewehrungsrechner

Öffentliche Webapp zur schnellen Ermittlung der Baustahlmenge (Bewehrung) für
Betonwände und Decken/Bodenplatten – mit Live-Skizze, Pay-per-Use über Stripe
und drei PDF-Dokumenten (Bauplan, Biegeliste, Stückliste).

**Zielgruppe:** Baumeister, Statiker, kleine Bauunternehmen (Österreich/EU).

---

## Inhalt

1. [Wie die App funktioniert](#1-wie-die-app-funktioniert)
2. [Installation auf macOS (Apple Silicon)](#2-installation-auf-macos-apple-silicon)
3. [Lokal testen (ohne Stripe, Demo-Modus)](#3-lokal-testen)
4. [Stripe einrichten (Testmodus → Livemodus)](#4-stripe-einrichten)
5. [Deployment auf Vercel (kostenlos starten)](#5-deployment-auf-vercel)
6. [Technische Entscheidungen & Architektur](#6-technische-entscheidungen--architektur)
7. [Fachliche Grundlagen & Grenzen](#7-fachliche-grundlagen--grenzen)
8. [Anpassungen (Preis, Texte, Sortimente)](#8-anpassungen)

---

## 1. Wie die App funktioniert

* **7-Schritte-Wizard:** Bauteil → Maße → Öffnungen → Anschlussdetails →
  Parameter (EC2/ÖNORM) → Firmendaten/Logo → Ergebnis.
* **Live-Skizze:** maßstäbliches SVG mit Maßketten, aktualisiert bei jeder Eingabe.
* **Kostenlos bis zur Vorschau:** Kennwerte, Gesamtgewicht und Warnhinweise sind
  sichtbar; die Positionsliste ist unscharf gestellt.
* **Pay-per-Use:** Ein Klick auf „Jetzt freischalten“ öffnet Stripe Checkout
  (Einmalzahlung, ohne Kundenkonto). Nach der Zahlung leitet Stripe zur
  Erfolgsseite zurück, wo die drei PDFs heruntergeladen werden.
* **Keine Registrierung, keine Datenbank:** Die Projektgeometrie wird beim
  Checkout komprimiert in den Stripe-Session-Metadata gespeichert. Der Server
  erzeugt die PDFs nur für **bezahlte** Sessions und liest die Daten aus der
  Session zurück – Manipulation oder Freischalten ohne Zahlung ist nicht möglich.
  Das Firmenlogo verlässt den Browser nur für die PDF-Erzeugung.

## 2. Installation auf macOS (Apple Silicon)

Alle Befehle im **Terminal** (Programme → Dienstprogramme → Terminal) ausführen.

**Schritt 1 – Homebrew** (Paketmanager für macOS):

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Danach die zwei Zeilen ausführen, die das Installationsskript am Ende anzeigt
(„Next steps“ – sie tragen Homebrew in den PATH ein). Bei Apple Silicon typisch:

```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

**Schritt 2 – Node.js, Git, Visual Studio Code:**

```bash
brew install node git
brew install --cask visual-studio-code
```

Prüfen:

```bash
node --version   # sollte v22 oder neuer zeigen
git --version
```

**Schritt 3 – Projekt entpacken und Abhängigkeiten installieren:**

Die gelieferte ZIP-Datei z. B. in den Ordner `~/Projekte` entpacken, dann:

```bash
cd ~/Projekte/bewehrungsrechner
npm install
```

## 3. Lokal testen

Die App läuft **ohne Stripe-Konfiguration automatisch im Demo-Modus**:
Der Bezahl-Button springt direkt zur Erfolgsseite und alle PDFs lassen sich
kostenlos erzeugen – ideal zum Ausprobieren.

```bash
npm run dev
```

Dann im Browser öffnen: <http://localhost:3000>

Zusätzliche Prüfskripte:

```bash
npx tsx scripts/test-berechnung.ts   # Berechnungskern (EC2-Werte, Payload)
npx tsx scripts/test-pdf.ts          # erzeugt Beispiel-PDFs unter /tmp
```

> **Wichtig:** Sobald in `.env.local` bzw. auf Vercel ein `STRIPE_SECRET_KEY`
> gesetzt ist, ist der Demo-Modus **abgeschaltet** und Dokumente gibt es nur
> noch gegen bezahlte Stripe-Session.

## 4. Stripe einrichten

**Warum Stripe Checkout?** Einmalzahlung ohne Kundenkonto, fertige gehostete
Bezahlseite (keine PCI-Pflichten), unterstützt Karten, Apple/Google Pay sowie
**EPS** und **Klarna** für Österreich; bester Testmodus, transparente Gebühren
(EU-Karten ca. 1,5 % + 0,25 €).

1. Konto anlegen: <https://dashboard.stripe.com/register> (E-Mail genügt für
   den Testmodus; für Live-Auszahlungen später Firmendaten + Bankkonto ergänzen).
2. Im Dashboard oben **„Testmodus“** aktivieren.
3. **API-Schlüssel holen:** Entwickler → API-Schlüssel → „Geheimschlüssel“
   (`sk_test_…`) kopieren.
4. Im Projektordner die Datei `.env.local` anlegen:

   ```bash
   cp .env.example .env.local
   ```

   und eintragen:

   ```
   STRIPE_SECRET_KEY=sk_test_DEIN_SCHLUESSEL
   PREIS_CENT=2900
   NEXT_PUBLIC_PREIS_EUR=29
   ```

5. `npm run dev` neu starten. Der Bezahl-Button führt jetzt zu Stripe.
   **Testkarte:** `4242 4242 4242 4242`, beliebiges Zukunftsdatum, beliebige CVC.
6. **Zahlungsmethoden** (EPS, Klarna, Apple Pay) aktivieren unter:
   Dashboard → Einstellungen → Zahlungsmethoden.
7. **Livegang:** Testmodus ausschalten, Live-Schlüssel (`sk_live_…`) erzeugen
   und in Vercel als `STRIPE_SECRET_KEY` hinterlegen (siehe unten).

Ein Stripe-Webhook ist **nicht erforderlich**: Der Server prüft beim
Dokumentabruf direkt bei Stripe, ob die Session bezahlt ist
(`payment_status === "paid"`). Das ist bei diesem zustandslosen Ansatz die
einfachste sichere Lösung.

## 5. Deployment auf Vercel

**Warum Vercel?** Next.js-Hersteller, perfekte Unterstützung inkl. Serverless
Functions (für Checkout- und PDF-Route), kostenloser **Hobby-Plan** zum Start,
automatisches HTTPS und Domain (`…vercel.app`). Upgrade auf **Pro (20 $/Monat)**
erst bei nennenswertem Traffic oder kommerziellen Anforderungen nötig
(Hinweis: Der Hobby-Plan ist offiziell für nicht-kommerzielle Nutzung gedacht –
zum Testen ideal, für den echten Verkaufsbetrieb Pro buchen).

**Variante A – über GitHub (empfohlen, mit Auto-Deploy):**

```bash
cd ~/Projekte/bewehrungsrechner
git init && git add -A && git commit -m "Bewehrungsrechner"
```

1. Auf <https://github.com/new> ein (privates) Repository anlegen, dann:

   ```bash
   git remote add origin https://github.com/DEIN_NAME/bewehrungsrechner.git
   git push -u origin main
   ```

2. Auf <https://vercel.com/signup> mit GitHub anmelden → „Add New Project“ →
   Repository importieren → Framework „Next.js“ wird automatisch erkannt →
   **Environment Variables** eintragen:
   `STRIPE_SECRET_KEY`, `PREIS_CENT`, `NEXT_PUBLIC_PREIS_EUR`,
   `NEXT_PUBLIC_BASIS_URL` (z. B. `https://bewehrungsrechner.vercel.app`)
   → Deploy. Fertig – jede weitere `git push`-Änderung deployt automatisch.

**Variante B – ohne GitHub, per CLI:**

```bash
npm install -g vercel
vercel login
vercel          # erstes Deployment (Fragen mit Enter bestätigen)
vercel env add STRIPE_SECRET_KEY
vercel --prod   # Produktions-Deployment
```

**Eigene Domain:** Vercel → Projekt → Settings → Domains (Domain z. B. bei
World4You/easyname kaufen und per CNAME verbinden).

## 6. Technische Entscheidungen & Architektur

| Entscheidung | Begründung |
|---|---|
| **Next.js 16 (App Router, TypeScript)** | Frontend + API-Routen in einer Codebasis; Serverless-tauglich; größtes Ökosystem; ein Deployment. |
| **Stripe Checkout** | Einmalzahlung ohne Kundenkonto, EPS/Klarna für AT, gehostete Bezahlseite, einfachster sicherer Weg. |
| **Vercel** | Kostenloser Start, natives Next.js-Hosting, skaliert automatisch. |
| **Keine Datenbank** | Projektdaten komprimiert in Stripe-Metadata → weniger Betriebskosten, keine DSGVO-Datenhaltung, kein Login. |
| **SVG für Live-Skizze** | Verlustfrei skalierbar, deklarativ aus React-State, kein Canvas-State-Handling. |
| **pdf-lib (serverseitig)** | PDFs entstehen erst **nach** Zahlungsprüfung auf dem Server – clientseitige Generierung wäre umgehbar. Reines JS, läuft in Serverless Functions ohne native Abhängigkeiten. |

```
app/
  page.tsx              Startseite → Wizard
  erfolg/page.tsx       Erfolgsseite mit PDF-Downloads (prüft Zahlung je Abruf)
  rechtliches/page.tsx  Haftung + Impressums-Platzhalter
  api/checkout/route.ts Stripe-Checkout-Session (Projekt → Metadata)
  api/dokumente/route.ts Zahlungsprüfung + PDF-Erzeugung
components/
  Wizard.tsx, steps.tsx, Vorschau.tsx, SkizzeSVG.tsx, DetailBilder.tsx
lib/
  types.ts              zentrale Typen
  normdaten.ts          Betonklassen, Expositionsklassen, Matten, Stahl (EC2/ÖNORM)
  bewehrung.ts          Berechnungskern (Mindestbewehrung, Positionen, Gewichte)
  payload.ts            Komprimierung/Validierung für Stripe-Metadata
  standardwerte.ts      Startwerte
  pdf/                  helpers, bauplan, biegeliste, stueckliste
scripts/
  test-berechnung.ts, test-pdf.ts, test-e2e.mjs
```

## 7. Fachliche Grundlagen & Grenzen

Berechnungsbasis (im Code in `lib/normdaten.ts` und `lib/bewehrung.ts`
dokumentiert und leicht anpassbar):

* **Wände** (EC2 9.6): vertikale Mindestbewehrung 0,002·Ac (beidseitig
  aufgeteilt), horizontal max(25 % davon; 0,001·Ac).
* **Decken/Platten** (EC2 9.2.1.1 / 9.3): As,min = max(0,26·fctm/fyk·b·d;
  0,0013·b·d), Querbewehrung ≥ 20 %.
* **Betondeckung** c_nom = c_min,dur (ÖNORM B 1992-1-1, Klasse S4) + 10 mm,
  aus der Expositionsklasse vorgeschlagen, überschreibbar.
* **Lagermatten** Q188A–Q636A (6,00 × 2,30 m), Stoß 35 cm, 10 % Verschnitt.
* **Konstruktive Details:** Anschlusseisen Ø10 im gewählten Raster (L-Form
  0,80/0,80 m), Eckwinkel, Steckbügel Ø8/25 an freien Rändern, Sturz-/
  Brüstungs-/Randzulagen 2Ø12 mit 50·ds-Verankerung, Schrägstäbe Ø12 an
  Öffnungsecken, Biegerollendurchmesser nach EC2 Tab. 8.1N.
* **Automatische Warnungen** (in Vorschau und PDFs): Stürze > 2,0 m,
  Deckenaussparungen > 1,0 m, Spannweiten > 4,5 m, fehlende Stützbewehrung,
  Wanddicke vs. Lagenzahl.

**Grenzen (bewusst):** Die App macht eine **Mengenermittlung auf Basis von
Mindestbewehrung und Konstruktionsregeln** – keine statische Bemessung
(Biegung, Querkraft, Knicken, Durchstanzen, Erdbeben, Brandschutz). Der
Haftungshinweis ist fix im Footer, in der Vorschau und in allen PDFs verankert.
**Vor einer echten Kommerzialisierung sollte ein:e Statiker:in die
hinterlegten Konstruktionsregeln einmal reviewen** – sie sind gängige Praxis,
aber regionale Gepflogenheiten unterscheiden sich.

**Vor Veröffentlichung außerdem:** Impressum in
`app/rechtliches/page.tsx` ausfüllen (ECG § 5), AGB/Widerrufstext rechtlich
prüfen lassen.

## 8. Anpassungen

* **Preis ändern:** `PREIS_CENT` (tatsächlicher Betrag) und
  `NEXT_PUBLIC_PREIS_EUR` (Anzeige) in `.env.local` bzw. Vercel.
* **Texte/Farben:** `app/globals.css` (Farbvariablen oben), Texte direkt in
  den Komponenten (alles Deutsch, alles kommentiert).
* **Sortimente/Normwerte:** `lib/normdaten.ts` – Matten, Durchmesser,
  Deckungswerte, Übergreifungslängen zentral an einer Stelle.
* **Konstruktionsregeln:** `lib/bewehrung.ts` – jede Position entsteht in
  einer klar benannten, kommentierten Funktion.
