import type { NextConfig } from "next";

/**
 * Schutz-Header für alle Auslieferungen.
 *
 * Die Anwendung zeigt keine fremden Inhalte an und bindet keine externen
 * Skripte ein – auch Stripe nicht, denn zum Bezahlen wird nur auf
 * checkout.stripe.com weitergeleitet. Die Regeln dürfen deshalb eng sein.
 *
 * Zu 'unsafe-inline' bei script-src: Next.js legt für die Hydration kleine
 * Inline-Skripte an. Ohne Nonce-Middleware lässt sich das nicht vermeiden.
 * Der wesentliche Schutz bleibt bestehen – Skripte von fremden Adressen sind
 * ausgeschlossen, und eigene Inhalte, die als HTML interpretiert würden, gibt
 * es in dieser App nicht (keine Stelle mit dangerouslySetInnerHTML). Wer es
 * später strenger will, ergänzt eine Middleware, die je Antwort einen Nonce
 * setzt, und ersetzt hier 'unsafe-inline' durch 'nonce-…'.
 */
/**
 * React braucht im Entwicklungsmodus eval() (Quellkarten, rekonstruierte
 * Aufrufketten). In Produktion niemals – deshalb hängt diese eine Erlaubnis
 * an NODE_ENV und kann im ausgelieferten Betrieb nicht aktiv sein.
 */
const entwicklung = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  // Formulare gehen ausschließlich an die eigene App
  "form-action 'self'",
  // Die Seite darf nirgends eingebettet werden (Clickjacking)
  "frame-ancestors 'none'",
  "object-src 'none'",
  `script-src 'self' 'unsafe-inline'${entwicklung ? " 'unsafe-eval'" : ""}`,
  // Inline-Styles nutzt sowohl Next.js als auch die Live-Skizze
  "style-src 'self' 'unsafe-inline'",
  // Firmenlogos kommen als data:-URL aus dem Browser des Nutzers
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // Nur eigene API-Aufrufe; die Zahlung ist eine Weiterleitung, kein fetch.
  // In der Entwicklung zusätzlich der WebSocket des Hot Reload.
  `connect-src 'self'${entwicklung ? " ws: wss:" : ""}`,
  // PDFs werden als Blob im selben Ursprung geöffnet
  "worker-src 'self' blob:",
  "upgrade-insecure-requests",
].join("; ");

const sicherheitsHeader = [
  { key: "Content-Security-Policy", value: csp },
  // Doppelt gemoppelt zu frame-ancestors, für ältere Browser
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    // Zwei Jahre HSTS inkl. Subdomains – erst einschalten, wenn die Domain
    // dauerhaft über HTTPS läuft (auf Vercel ist das der Fall).
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  // Verrät nicht unnötig, womit die Seite gebaut ist
  poweredByHeader: false,

  async headers() {
    return [
      {
        // Alle Pfade außer den Next.js-internen Assets
        source: "/:pfad*",
        headers: sicherheitsHeader,
      },
    ];
  },
};

export default nextConfig;
