import {
  Battery,
  Bus,
  Car,
  CarFront,
  Caravan,
  Cog,
  Flame,
  Fuel,
  Gauge,
  Leaf,
  Plug,
  Settings2,
  Truck,
  Zap,
} from "lucide-react";

/**
 * Jeden slownik specyfikacji dla calego serwisu.
 *
 * Powstal, bo mapy FUEL_PL i GEARBOX_PL byly przepisane w czterech plikach
 * (kafelek, strona VIN, strona oferty, strona modelu) i zdazyly sie juz
 * rozjechac — jedna miala "PHEV", druga "Hybryda plug-in". Kazde nowe
 * paliwo trzeba bylo dodawac cztery razy, wiec predzej czy pozniej gdzies
 * zostawaloby surowe "phev" z bazy.
 *
 * Ikona jest czescia opisu, nie ozdoba: przy dwunastu polach technicznych
 * to ona pozwala znalezc wzrokiem to jedno, ktorego sie szuka.
 */

export interface Spec {
  label: string;
  Icon: typeof Fuel;
}

const FUEL: Record<string, Spec> = {
  petrol: { label: "Benzyna", Icon: Fuel },
  diesel: { label: "Diesel", Icon: Flame },
  hybrid: { label: "Hybryda", Icon: Leaf },
  phev: { label: "PHEV", Icon: Plug },
  electric: { label: "Elektryk", Icon: Battery },
  lpg: { label: "LPG", Icon: Fuel },
  cng: { label: "CNG", Icon: Fuel },
  other: { label: "Inne", Icon: Fuel },
};

const GEARBOX: Record<string, Spec> = {
  manual: { label: "Manual", Icon: Settings2 },
  automatic: { label: "Automat", Icon: Cog },
  other: { label: "—", Icon: Settings2 },
};

const DRIVE: Record<string, Spec> = {
  fwd: { label: "Przód", Icon: Gauge },
  rwd: { label: "Tył", Icon: Gauge },
  awd: { label: "4×4", Icon: Gauge },
  other: { label: "—", Icon: Gauge },
};

/**
 * Nadwozia przychodza z 26 zrodel jako wolny tekst — w bazie jest ich 90
 * wariantow ("Kombi", "kombi", "Combi", "SUV / Terenowe"). Dopasowujemy po
 * fragmencie nazwy, bo slownik dokladnych wartosci nigdy nie bylby kompletny.
 */
const BODY_PATTERNS: [RegExp, typeof Car][] = [
  [/kombi|combi|estate|touring|variant/i, Caravan],
  [/suv|sav|terenow|crossover|cross/i, CarFront],
  [/van|bus|minibus|transporter/i, Bus],
  [/pick|dostawcz|furgon/i, Truck],
];

export function fuelSpec(v?: string | null): Spec | null {
  return v ? (FUEL[v] ?? { label: v, Icon: Fuel }) : null;
}

export function gearboxSpec(v?: string | null): Spec | null {
  return v ? (GEARBOX[v] ?? { label: v, Icon: Settings2 }) : null;
}

export function driveSpec(v?: string | null): Spec | null {
  return v ? (DRIVE[v] ?? { label: v, Icon: Gauge }) : null;
}

export function bodySpec(v?: string | null): Spec | null {
  if (!v) return null;
  const hit = BODY_PATTERNS.find(([re]) => re.test(v));
  return { label: v, Icon: hit?.[1] ?? Car };
}

/** Krotki opis mocy — uzywany tam, gdzie nie ma miejsca na pelne "155 KM". */
export const powerSpec = (hp?: number | null): Spec | null =>
  hp ? { label: `${hp} KM`, Icon: Zap } : null;
