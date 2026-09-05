# Projektnotizen (für nahtlose Fortsetzung in jeder Claude-Sitzung)

Stand: 2026-08-16 · Status: **v1 fertig, gebaut & getestet** (Build ✓,
Berechnungstests ✓, E2E-Test im Headless-Browser ✓, Paywall-Negativtest ✓).

## Getroffene Entscheidungen (mit Lukas abgestimmt)
Next.js 16 Full-Stack (TypeScript, App Router) · Stripe Checkout
(Einmalzahlung) · Vercel-Hosting · Preis 29 € (`PREIS_CENT=2900`).

## Architektur-Kernidee
Zustandslos, keine DB. Wizard-State im Browser (sessionStorage). Beim Checkout
wird die Projektgeometrie deflate+base64url-komprimiert in Stripe-Session-
Metadata gechunkt (`lib/payload.ts`). `/api/dokumente` prüft
`payment_status === "paid"` und liest das Projekt aus der Session zurück →
Paywall nicht umgehbar, Daten nicht tauschbar. Logo/Firmendaten sind kosmetisch
und kommen vom Client. Ohne `STRIPE_SECRET_KEY` läuft ein Demo-Modus
(Dokumente ohne Zahlung, nur lokal gedacht).

## Fachliche Basis
EC2/ÖNORM B 1992-1-1 Mindestbewehrung (Wand 9.6, Platte 9.2.1.1),
c_nom = c_min,dur(S4)+10, Q-Lagermatten 6,00×2,30, Übergreifung ≈ 50·ds,
Details: Anschlusseisen Ø10 L-0,80/0,80, Steckbügel Ø8/25, Zulagen 2Ø12,
Schrägstäbe Ø12 L=1,00. KEINE statische Bemessung → Warnhinweise überall.

## Offene Punkte / mögliche v2
- Impressum in `app/rechtliches/page.tsx` ausfüllen (Platzhalter!).
- Statiker-Review der Konstruktionsregeln vor Live-Verkauf.
- Mögliche Erweiterungen: mehrere Bauteile je Projekt, Stützbewehrung Decke
  (obere Lage Auflagerstreifen), E-Mail-Versand der PDFs (z. B. Resend),
  Stripe-Webhook + Rechnungserstellung, AT-USt/Steuer via Stripe Tax.

## Tests
`npx tsx scripts/test-berechnung.ts` · `npx tsx scripts/test-pdf.ts` (PDFs → /tmp)
· `node scripts/test-e2e.mjs` (Server auf :3100, Playwright, Demo-Flow + 402-Check).
