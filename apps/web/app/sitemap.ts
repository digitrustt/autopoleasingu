import { KATEGORIE } from "@/lib/filtry";
import { PARY } from "@/lib/pary";
import { getSitemapEntries } from "@/lib/queries";
import { makeHref, modelHref, modelKey, slugify } from "@/lib/slug";
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
 * POJEDYNCZE OFERTY CELOWO TU NIE WCHODZA, mimo ze jest ich najwiecej.
 *
 * Bylo ich 15 tys. na 16,7 tys. wszystkich adresow — i to one psuly cala
 * mape. Oferta zyje krotko (w pierwszym tygodniu dzialania zniknelo 1288
 * sztuk), wiec robot dostawal mape, w ktorej wiekszosc wpisow prowadzi do
 * tresci juz nieaktualnej. Na domenie bez zadnego autorytetu budzet
 * indeksowania idzie wtedy na oferty, ktore za tydzien nie beda istniec,
 * zamiast na 664 strony modeli — jedyne, ktore maja szanse cokolwiek
 * rankowac i ktore sie NIE zmieniaja.
 *
 * Oferty zostaja dostepne i podlinkowane z kazdej strony modelu, wiec robot
 * i tak do nich dojdzie. Roznica jest taka, ze przestajemy je zglaszac jako
 * priorytet.
 *
 * Priorytety sa celowo rozne. Strony modeli sa najwazniejsze: to one
 * odpowiadaja na realne zapytania ("bmw x3 poleasingowy"), maja stabilna
 * tresc i nie znikaja z dnia na dzien.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { makes, models, vins, cities, srcs } = await getSitemapEntries();

  const statics: MetadataRoute.Sitemap = [
    { url: BASE, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/zrodla`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${BASE}/poleasingowe`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/porownaj`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/vin`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE}/dane`, changeFrequency: "daily", priority: 0.8 },
    {
      url: `${BASE}/analizy/ten-sam-vin-dwie-ceny`,
      changeFrequency: "daily",
      priority: 0.8,
    },
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

    /*
     * Jeden adres na model, nie jeden na pisownie. W bazie ten sam model bywa
     * zapisany na piec sposobow ("XC60", "XC 60", "Xc-60"); scalamy je kluczem
     * bez separatorow, a do mapy trafia wariant o NAJWIEKSZEJ liczbie ofert —
     * czyli ten, na ktory strona modelu przekierowuje pozostale. Zapytanie
     * zwraca wiersze posortowane malejaco, wiec wygrywa pierwszy napotkany.
     *
     * `new Map(entries)` przy powtorzonym kluczu zostawia OSTATNI wpis, nie
     * pierwszy — przy sortowaniu malejaco dawalo to wariant NAJMNIEJSZY.
     * Stad jawne `if (!has)` zamiast konstruktora z tablicy: do mapy trafial
     * `/volvo/xc-60` z jedenastoma ofertami zamiast `/volvo/xc60` z 814.
     */
    ...[
      ...models
        .reduce((acc, m) => {
          const key = `${slugify(m.make)}/${modelKey(m.model)}`;
          if (!acc.has(key)) {
            acc.set(key, { href: modelHref(m.make, m.model), updated: m.updated });
          }
          return acc;
        }, new Map<string, { href: string; updated: string }>())
        .values(),
    ].map((m) => ({
      url: `${BASE}${m.href}`,
      lastModified: when(m.updated),
      changeFrequency: "daily" as const,
      priority: 0.9,
    })),

    /*
     * Kategorie: progi cenowe, nadwozia, paliwa. Kazda odpowiada frazie,
     * ktora Google podpowiada ("auto poleasingowe do 50 tys", "poleasingowe
     * suv"), a wczesniej serwis odpowiadal na nie wylacznie parametrami
     * w adresie, ktorych wyszukiwarka nie indeksuje.
     */
    ...KATEGORIE.map((k) => ({
      url: `${BASE}/poleasingowe/${k.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.9,
    })),

    /*
     * Miasta maja najwyzszy priorytet po stronie glownej. Zmierzone w Planerze
     * slow kluczowych: "samochody poleasingowe warszawa" i "auta poleasingowe
     * warszawa" to po 1–10 tys. wyszukiwan miesiecznie, podczas gdy porownania
     * modeli mieszcza sie w 10–100. Warianty zapisu tej samej nazwy scalamy
     * kluczem slugu, tak jak przy modelach.
     */
    ...[
      ...cities
        .reduce((acc, c) => {
          const key = slugify(c.city ?? "");
          if (key && !acc.has(key)) acc.set(key, { key, updated: c.updated });
          return acc;
        }, new Map<string, { key: string; updated: string }>())
        .values(),
    ].map((c) => ({
      url: `${BASE}/poleasingowe/${c.key}`,
      lastModified: when(c.updated),
      changeFrequency: "daily" as const,
      priority: 0.9,
    })),

    /*
     * Leasingodawcy. "poleasingowe pko" to 1–10 tys. wyszukiwan miesiecznie
     * przy NISKIEJ konkurencji reklamowej — najlepszy stosunek wolumenu do
     * trudnosci w calym zestawie, stad priorytet rowny miastom.
     */
    ...srcs.map((s) => ({
      url: `${BASE}/leasingodawca/${s.id}`,
      lastModified: when(s.updated),
      changeFrequency: "daily" as const,
      priority: 0.9,
    })),

    /*
     * Porownania modeli. Nizej niz miasta i leasingodawcy, bo zmierzony
     * wolumen fraz typu "bmw x3 czy audi q5" to 10–100 wyszukiwan miesiecznie
     * wobec 1–10 tys. dla "samochody poleasingowe warszawa".
     */
    ...PARY.map((p) => ({
      url: `${BASE}/porownaj/${p.slug}`,
      changeFrequency: "weekly" as const,
      priority: p.obustronna ? 0.7 : 0.6,
    })),

    ...vins.map((v) => ({
      url: `${BASE}/vin/${v.vin}`,
      lastModified: when(v.updated),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
