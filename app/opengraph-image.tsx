import { ImageResponse } from "next/og";

/**
 * Vorschaubild für geteilte Links (WhatsApp, LinkedIn, Slack, Signal …).
 *
 * Ohne dieses Bild zeigt jede geteilte Adresse nur einen leeren grauen Kasten –
 * bei einem Werkzeug, das über Empfehlungen von Baumeister zu Baumeister
 * weitergereicht wird, ist das der erste Eindruck.
 *
 * Bewusst ohne externe Schriftart aufgebaut: Das Bild wird beim Bauen einmal
 * erzeugt und danach ausgeliefert, ohne Abhängigkeit von fremden Servern.
 */

export const alt =
  "Rösch Bewehrungsrechner – Baustahlmenge, Bauplan, Biegeliste und Stückliste";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TINTE = "#1c2430";
const AKZENT = "#e8590c";

export default async function Vorschaubild() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f4f5f7",
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Marke: dieselbe Geometrie wie das Logo, hier als reines SVG */}
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <svg width="88" height="88" viewBox="0 0 64 64" fill="none">
            <path
              d="M54 12 H30 A18 18 0 0 0 12 30 V54"
              stroke={TINTE}
              strokeWidth="5"
              strokeLinecap="round"
            />
            <path
              d="M54 22 H30 A8 8 0 0 0 22 30 V54"
              stroke={AKZENT}
              strokeWidth="5"
              strokeLinecap="round"
            />
          </svg>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: 44,
                fontWeight: 700,
                letterSpacing: 8,
                color: TINTE,
              }}
            >
              RÖSCH
            </div>
            <div style={{ fontSize: 20, letterSpacing: 4, color: "#5a6472" }}>
              BEWEHRUNGSRECHNER
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 62,
              fontWeight: 700,
              color: TINTE,
              lineHeight: 1.1,
              letterSpacing: -1,
            }}
          >
            Baustahlmenge berechnen –
          </div>
          <div
            style={{
              fontSize: 62,
              fontWeight: 700,
              color: AKZENT,
              lineHeight: 1.1,
              letterSpacing: -1,
            }}
          >
            in Minuten statt in Stunden
          </div>
          <div style={{ fontSize: 28, color: "#5a6472", marginTop: 20 }}>
            Bauplan · Biegeliste · Stückliste als PDF
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontSize: 22,
            color: "#5a6472",
            borderTop: "2px solid #d9dde3",
            paddingTop: 22,
          }}
        >
          <div style={{ display: "flex" }}>
            Eurocode 2 · ÖNORM B 1992-1-1 oder DIN EN 1992-1-1/NA
          </div>
          <div style={{ display: "flex" }}>ohne Registrierung</div>
        </div>
      </div>
    ),
    size
  );
}
