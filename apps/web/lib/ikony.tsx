import {
  Banknote,
  Battery,
  Bus,
  Car,
  CarFront,
  Caravan,
  Cog,
  Flame,
  Fuel,
  Leaf,
  Plug,
  Sparkles,
  Truck,
  Zap,
} from "lucide-react";

/**
 * Ikona dla kategorii ze spisu /poleasingowe.
 *
 * Spis byl sciana jednakowych pigulek — czterdziesci pozycji roznicych sie
 * wylacznie napisem, bez zadnego punktu zaczepienia dla oka. Ikona nie niesie
 * nowej informacji, ale pozwala odnalezc pozycje wzrokiem zamiast czytac
 * wszystkie po kolei.
 *
 * Klucze odpowiadaja slugom z lib/filtry.ts. Krzyzowki ("do-80-tys-suv")
 * dopasowujemy po koncowce, zeby nie wypisywac dwudziestu dodatkowych wpisow.
 */
const WPROST: Record<string, typeof Car> = {
  suv: Car,
  kombi: Caravan,
  sedan: CarFront,
  hatchback: Car,
  van: Bus,
  dostawcze: Truck,
  hybrydy: Leaf,
  elektryki: Zap,
  phev: Plug,
  diesel: Fuel,
  benzyna: Flame,
  automat: Cog,
  okazje: Sparkles,
};

const PO_KONCOWCE: [string, typeof Car][] = [
  ["-suv", Car],
  ["-kombi", Caravan],
  ["-sedan", CarFront],
  ["-hatchback", Car],
  ["-automat", Cog],
  ["-benzyna", Flame],
];

export function ikonaKategorii(slug: string): typeof Car {
  const wprost = WPROST[slug];
  if (wprost) return wprost;
  for (const [koncowka, ikona] of PO_KONCOWCE) {
    if (slug.endsWith(koncowka)) return ikona;
  }
  // Progi cenowe ("do-50-tys") i wszystko, czego nie rozpoznalismy.
  return slug.startsWith("do-") ? Banknote : Battery;
}
