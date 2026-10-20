import { filtryMarek } from "@/lib/cache-filtrow";
import { getModelsForFilter } from "@/lib/queries";
import { groupBySlug, resolveSlug, slugify } from "@/lib/slug";

/**
 * Wspolne dla /api/cena-rynkowa i /api/wycena: marka z adresu i modele tej
 * marki zebrane po slugu ("XC60", "Xc60" i "XC 60" to jeden wybor, z nazwa
 * najczestszej pisowni).
 */
export interface GrupaModelu {
  slug: string;
  nazwa: string;
  n: number;
  aliasy: string[];
}

export async function markaZAdresu(param: string | null): Promise<string | null> {
  return resolveSlug(await filtryMarek(), slugify(param ?? ""));
}

export async function modeleMarki(make: string): Promise<GrupaModelu[]> {
  const wiersze = await getModelsForFilter(make);
  return [...groupBySlug(wiersze, (w) => w.model)].map(([slug, ws]) => ({
    slug,
    nazwa: ws[0].model,
    n: ws.reduce((x, w) => x + w.total, 0),
    aliasy: ws.map((w) => w.model),
  }));
}

/** Rocznik z adresu albo null, gdy bez sensu. */
export function rokZAdresu(param: string | null): number | null {
  const y = Number(param);
  return Number.isInteger(y) && y >= 1990 && y <= 2100 ? y : null;
}

/**
 * Przebieg zaokraglony do 10 tys. km — zeby zapytania sie powtarzaly
 * i trafialy w cache CDN, zamiast liczyc kazdy kilometr osobno.
 */
export function kmZAdresu(param: string | null): number | undefined {
  if (!param) return undefined;
  const km = Math.round(Number(param) / 10_000) * 10_000;
  return Number.isFinite(km) && km >= 0 && km < 1_000_000 ? km : undefined;
}

export const PALIWA = ["petrol", "diesel", "hybrid", "phev", "electric", "lpg"] as const;

/** Naglowki: CDN trzyma dobe — dane zmieniaja sie z porannym zaciagiem. */
export const CACHE_DOBA = {
  "Vercel-CDN-Cache-Control": "s-maxage=86400, stale-while-revalidate=86400",
  "Cache-Control": "public, max-age=3600",
};
