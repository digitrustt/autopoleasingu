/**
 * Grupy nadwozi — jedna definicja dla wyszukiwarki i dla powiadomien.
 *
 * Zrodla opisuja nadwozie dowolnie: "SUV", "SAV", "Crossover", "terenowy" to
 * u nas jedna grupa. Filtrowanie po `ilike` jednego ciagu gubi polowe, wiec
 * kazda grupa jest wyrazeniem regularnym dopasowywanym operatorem `~*`.
 *
 * Mieszka w core, a nie w apps/web, bo potrzebuja tego DWA miejsca: wyszukiwarka
 * (lib/queries) i worker skladajacy powiadomienia (alerts.ts). Gdy worker mial
 * wlasna, niepelna kopie regul filtrowania, zapis "powiadom o kombi do 60 tys."
 * przechodzil, ale mail przychodzil z czymkolwiek — obietnica ze strony byla
 * pusta. Jedno zrodlo prawdy jest jedynym sposobem, zeby to sie nie rozjechalo.
 */
export const BODY_GROUPS: Record<string, string> = {
  suv: "suv|sav|terenow|crossover",
  kombi: "kombi|combi|estate|touring|variant",
  sedan: "sedan|limuzyn",
  hatchback: "hatch|kompakt",
  van: "van|bus|minivan",
  coupe: "coupe|cabrio|roadster",
  dostawcze: "dostawcz|furgon|pick",
};
