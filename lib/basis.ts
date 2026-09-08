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
