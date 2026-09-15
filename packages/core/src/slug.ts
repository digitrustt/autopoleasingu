import { slugify } from "./normalize";

/**
 * Klucz dopasowania modelu — slug BEZ separatorow.
 *
 * `slugify` daje "XC60" -> "xc60", ale "XC 60" -> "xc-60". To dwa rozne adresy
 * dla jednego auta i tak tez wygladalo w serwisie: `/volvo/xc60` z 818 ofertami
 * obok `/volvo/xc-60` z siedemnastoma. Dopasowujemy wiec po kluczu bez myslnikow.
 *
 * Mieszka w core obok `slugify`, bo potrzebuja tego oba pakiety: `apps/web`
 * do grupowania modeli w rodziny, `apps/worker` do dopasowania modelu
 * w powiadomieniach. Gdy worker mial wlasna kopie regul filtrowania, zapis
 * "powiadom o X3" lapal 132 oferty zamiast 353.
 */
export function modelKey(s: string): string {
  return slugify(s).replace(/-/g, "");
}
