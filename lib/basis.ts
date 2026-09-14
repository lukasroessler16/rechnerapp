/**
 * Ermittelt die öffentliche Basis-URL der Anwendung.
 *
 * Bevorzugt NEXT_PUBLIC_BASIS_URL (nötig, wenn eine eigene Domain verwendet
 * wird), sonst der Ursprung des eingehenden Requests. Ein fehlendes Schema
 * wird ergänzt und ein abschließender Schrägstrich entfernt – Stripe lehnt
 * URLs ohne Schema ab, doppelte Schrägstriche brechen Download-Links.
 */

import { NextRequest } from "next/server";

export function basisUrl(req: NextRequest): string {
  const roh = (process.env.NEXT_PUBLIC_BASIS_URL || req.nextUrl.origin).trim();
  const ohneSlash = roh.replace(/\/+$/, "");
  return /^https?:\/\//i.test(ohneSlash) ? ohneSlash : `https://${ohneSlash}`;
}

/**
 * Öffentliche Basis-URL ohne vorliegenden Request – für Metadaten, robots.txt
 * und sitemap.xml, die beim Bauen erzeugt werden.
 *
 * Reihenfolge: ausdrücklich gesetzte Domain → von Vercel bereitgestellte
 * Deploy-Adresse → lokale Entwicklung.
 */
export function oeffentlicheBasis(): string {
  const gesetzt = process.env.NEXT_PUBLIC_BASIS_URL?.trim();
  if (gesetzt) {
    const ohneSlash = gesetzt.replace(/\/+$/, "");
    return /^https?:\/\//i.test(ohneSlash) ? ohneSlash : `https://${ohneSlash}`;
  }
  // Von Vercel gesetzt: die Produktionsdomain des Projekts bzw. der Deploy
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}
