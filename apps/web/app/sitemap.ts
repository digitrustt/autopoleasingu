import { getSitemapEntries } from "@/lib/queries";
import { makeHref, modelHref } from "@/lib/slug";
import type { MetadataRoute } from "next";

const BASE = "https://autopoleasingu.pl";

/*
 * Mapa liczy sie raz na dobe. Zaciag chodzi o 3:00, wiec czesciej nie ma
 * czego zglaszac, a kazde przeliczenie to cztery agregacje po calej tabeli.
 */
export const revalidate = 86_400;

/** Bez daty Google i tak sobie poradzi, ale z data wraca po zmianie szybciej. */
function when(v: string | Date | null): Date {
  if (v instanceof Date) return v;
  return v ? new Date(v) : new Date();
}

/**
 * Mapa strony.
 *
 * Progi (>=3 oferty na segment, VIN u wiecej niz jednego zrodla) siedza
 * w zapytaniu — patrz getSitemapEntries. Chodzi o to, zeby nie zglaszac
 * adresow, ktore znikna przy najblizszym przebiegu scrapera i zostawia po
 * sobie bledy 404 w indeksie.
 *
 * Priorytety sa celowo rozne. Strony modeli sa najwazniejsze: to one
 * odpowiadaja na realne zapytania ("bmw x3 poleasingowy"), maja stabilna
 * tresc i nie znikaja z dnia na dzien. Pojedyncze oferty sa najnizej —
 * jest ich najwiecej, ale zyja srednio kilkanascie dni.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { makes, models, vins, offers } = await getSitemapEntries();

  const statics: MetadataRoute.Sitemap = [
    { url: BASE, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/zrodla`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${BASE}/regulamin`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/polityka-prywatnosci`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/cookies`, changeFrequency: "yearly", priority: 0.2 },
  ];

  return [
    ...statics,

    ...makes.map((m) => ({
      url: `${BASE}${makeHref(m.make)}`,
      lastModified: when(m.updated),
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),

    ...models.map((m) => ({
      url: `${BASE}${modelHref(m.make, m.model)}`,
      lastModified: when(m.updated),
      changeFrequency: "daily" as const,
      priority: 0.9,
    })),

    ...vins.map((v) => ({
      url: `${BASE}/vin/${v.vin}`,
      lastModified: when(v.updated),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),

    ...offers.map((o) => ({
      url: `${BASE}/oferta/${o.id}`,
      lastModified: when(o.updated),
      changeFrequency: "daily" as const,
      priority: 0.5,
    })),
  ];
}
