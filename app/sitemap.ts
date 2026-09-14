import type { MetadataRoute } from "next";
import { oeffentlicheBasis } from "@/lib/basis";

/**
 * sitemap.xml
 *
 * Nur die öffentlichen, dauerhaften Seiten. Rechner und Erfolgsseite sind
 * Arbeitsschritte, keine Zielseiten – sie stehen bewusst nicht darin.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const basis = oeffentlicheBasis();
  const stand = new Date();
  return [
    { url: basis, lastModified: stand, changeFrequency: "monthly", priority: 1 },
    { url: `${basis}/beispiele`, lastModified: stand, changeFrequency: "monthly", priority: 0.8 },
    { url: `${basis}/rechtliches`, lastModified: stand, changeFrequency: "yearly", priority: 0.3 },
    { url: `${basis}/impressum`, lastModified: stand, changeFrequency: "yearly", priority: 0.3 },
    { url: `${basis}/datenschutz`, lastModified: stand, changeFrequency: "yearly", priority: 0.3 },
  ];
}
