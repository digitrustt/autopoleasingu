import { nazwaGlowna } from "@/lib/miasta";
import { getCitiesWithCounts, getMakesWithCounts, getSources } from "@/lib/queries";
import { unstable_cache } from "next/cache";

/**
 * Dane do megamenu — marki, miasta i leasingodawcy z licznikami.
 *
 * MUSZA byc buforowane, i to ostro. Menu siedzi w naglowku, czyli w layoucie
 * wspolnym dla WSZYSTKICH stron — takze tych z `force-dynamic` (strona glowna,
 * /dane, /zrodla, analizy). Bez bufora kazde wejscie na serwis odpalaloby trzy
 * agregacje po calej tabeli ofert. To dokladnie ten wzorzec, ktory raz juz
 * wyczerpal limit transferu bazy i zdjal serwis na trzy dni.
 *
 * Doba wystarczy: zaciag chodzi raz dziennie, a lista marek i miast zmienia sie
 * duzo wolniej niz same oferty. Liczniki moga byc o kilka sztuk nieaktualne —
 * to menu nawigacyjne, nie raport.
 */
export const getMenuData = unstable_cache(
  async () => {
    const [marki, miasta, zrodla] = await Promise.all([
      getMakesWithCounts(),
      getCitiesWithCounts(60),
      getSources(),
    ]);
    return {
      marki: marki.slice(0, 24),
      // Warianty jednego miasta ("Warszawa", "Zeran") jako jedna pozycja — patrz lib/miasta.ts.
      miasta: [
        ...miasta
          .reduce((acc, m) => {
            const nazwa = nazwaGlowna(m.city ?? "");
            const juz = acc.get(nazwa);
            if (juz) juz.total += m.total;
            else acc.set(nazwa, { ...m, city: nazwa });
            return acc;
          }, new Map<string, (typeof miasta)[number]>())
          .values(),
      ]
        .sort((a, b) => b.total - a.total)
        .slice(0, 16),
      zrodla: zrodla.filter((z) => z.active > 0).slice(0, 10),
    };
  },
  ["menu-nawigacja"],
  { revalidate: 86_400, tags: ["oferty"] },
);

export type MenuData = Awaited<ReturnType<typeof getMenuData>>;
