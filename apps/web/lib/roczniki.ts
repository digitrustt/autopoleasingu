import { getRocznikiLiczniki } from "@/lib/queries";
import { modelHref, modelKey, slugify } from "@/lib/slug";
import { unstable_cache } from "next/cache";

/**
 * Prog strony rocznika: aktywne oferty "kup teraz" plus zniknięcia z 180 dni.
 *
 * Ponizej tej liczby strona rocznika powtarzalaby wiersz tabeli ze strony
 * modelu, a Google i tak nie indeksuje cienkich stron — 81% stron VIN wisi
 * w "zeskanowane, niezindeksowane". Przy 20 sztukach jest z czego policzyc
 * przebiegi, wersje i zmiany ceny (31.10.2026: ~400 kombinacji).
 */
export const MIN_ROCZNIK = 20;

export function rocznikHref(make: string, model: string, year: number): string {
  return `${modelHref(make, model)}/${year}`;
}

/** Czy rocznik ma dosc danych na wlasna strone. */
export function rocznikOk(aktywne: number, sprzedane: number): boolean {
  return aktywne + sprzedane >= MIN_ROCZNIK;
}

/**
 * Roczniki z wlasna strona, kluczowane jak strony modeli: `marka/kluczModelu`.
 * Pisownie modelu ("XC60", "XC 60") scalamy, sumujac liczniki — tak samo,
 * jak strona rocznika filtruje po komplecie aliasow. Doba, jak menu.
 */
export const getRocznikiZeStrona = unstable_cache(
  async () => {
    const wiersze = await getRocznikiLiczniki();
    const suma = new Map<string, { make: string; year: number; aktywne: number; sprzedane: number }>();
    for (const w of wiersze) {
      const klucz = `${slugify(w.make)}/${modelKey(w.model)}/${w.year}`;
      const s = suma.get(klucz) ?? { make: w.make, year: w.year, aktywne: 0, sprzedane: 0 };
      s.aktywne += w.aktywne;
      s.sprzedane += w.sprzedane;
      suma.set(klucz, s);
    }
    return [...suma.entries()]
      .filter(([, s]) => rocznikOk(s.aktywne, s.sprzedane))
      .map(([klucz, s]) => ({ klucz: klucz.slice(0, klucz.lastIndexOf("/")), year: s.year }));
  },
  ["roczniki-ze-strona"],
  { revalidate: 86_400 },
);
