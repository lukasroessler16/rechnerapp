import type { MetadataRoute } from "next";
import { oeffentlicheBasis } from "@/lib/basis";

/**
 * robots.txt
 *
 * Alles darf indiziert werden – bis auf die API und die Erfolgsseite.
 * Die Erfolgsseite trägt die Zahlungsreferenz in der Adresse; sie gehört
 * weder in einen Suchindex noch in ein Archiv.
 */
export default function robots(): MetadataRoute.Robots {
  const basis = oeffentlicheBasis();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/erfolg"],
    },
    sitemap: `${basis}/sitemap.xml`,
  };
}
