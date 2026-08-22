import type { Filters } from "@/lib/queries";

/**
 * Strony kategorii pod adresem /poleasingowe/…
 *
 * Kazda pozycja odpowiada frazie, ktora Google PODPOWIADA — czyli takiej,
 * ktora ludzie realnie wpisuja: "auto poleasingowe do 50 tys", "poleasingowe
 * suv", "poleasingowe hybrydy", "auta poleasingowe 7 osobowe". Do tej pory
 * serwis odpowiadal na to wylacznie parametrami w adresie (`/?priceMax=50000`),
 * ktorych wyszukiwarka nie indeksuje i nie powinna.
 *
 * Lista jest KROTKA celowo. Kusi, zeby wygenerowac krzyzowki typu
 * "mercedes suv poleasingowe do 100 tys" — 60 marek razy 7 nadwozi razy
 * 7 progow to kilka tysiecy stron, w wiekszosci z kilkoma ofertami. To jest
 * podrecznikowa definicja stron przelotowych, za ktore Google karze cala
 * domene. Zostaja wiec same kategorie, kazda z realnym pokryciem w bazie.
 */
export interface Kategoria {
  slug: string;
  /** Naglowek H1. */
  h1: string;
  /** Krotka nazwa do list i okruszkow. */
  nazwa: string;
  /** Zdanie pod naglowkiem — uzupelniane liczbami na stronie. */
  opis: string;
  filtry: Filters;
}

/** Progi cenowe. Wartosci wprost z podpowiedzi Google, nie z zaokraglen. */
const PROGI = [30, 40, 50, 60, 80, 100, 150] as const;

const cenowe: Kategoria[] = PROGI.map((tys) => ({
  slug: `do-${tys}-tys`,
  nazwa: `do ${tys} tys. zł`,
  h1: `Samochody poleasingowe do ${tys} tys. zł`,
  opis:
    `Auta poleasingowe w cenie do ${tys} 000 zł. Wyłącznie oferty „kup teraz” — ` +
    `licytacje odpadają, bo ich stawka jeszcze urośnie i nie jest ceną zakupu.`,
  filtry: { priceMax: tys * 1000, withPrice: "1", kind: "fixed" },
}));

const nadwozia: Kategoria[] = [
  { slug: "suv", nazwa: "SUV", h1: "SUV-y poleasingowe", grupa: "suv" },
  { slug: "kombi", nazwa: "Kombi", h1: "Kombi poleasingowe", grupa: "kombi" },
  { slug: "sedan", nazwa: "Sedan", h1: "Sedany poleasingowe", grupa: "sedan" },
  {
    slug: "hatchback",
    nazwa: "Hatchback",
    h1: "Hatchbacki poleasingowe",
    grupa: "hatchback",
  },
  { slug: "van", nazwa: "Van", h1: "Vany poleasingowe", grupa: "van" },
  {
    slug: "dostawcze",
    nazwa: "Dostawcze",
    h1: "Samochody dostawcze poleasingowe",
    grupa: "dostawcze",
  },
].map((x) => ({
  slug: x.slug,
  nazwa: x.nazwa,
  h1: x.h1,
  opis: `Wszystkie ${x.nazwa.toLowerCase()} po leasingu, zebrane z 26 źródeł naraz.`,
  filtry: { bodyGroup: x.grupa },
}));

const paliwa: Kategoria[] = [
  { slug: "hybrydy", nazwa: "Hybrydy", h1: "Hybrydy poleasingowe", fuel: "hybrid" },
  { slug: "elektryki", nazwa: "Elektryki", h1: "Samochody elektryczne poleasingowe", fuel: "electric" },
  { slug: "phev", nazwa: "PHEV", h1: "Hybrydy plug-in poleasingowe", fuel: "phev" },
  { slug: "diesel", nazwa: "Diesel", h1: "Diesle poleasingowe", fuel: "diesel" },
  { slug: "benzyna", nazwa: "Benzyna", h1: "Samochody benzynowe poleasingowe", fuel: "petrol" },
].map((x) => ({
  slug: x.slug,
  nazwa: x.nazwa,
  h1: x.h1,
  opis: `${x.nazwa} po leasingu z 26 źródeł — firm leasingowych, CFM i programów dealerskich.`,
  filtry: { fuel: x.fuel },
}));

const pozostale: Kategoria[] = [
  {
    slug: "automat",
    nazwa: "Automat",
    h1: "Samochody poleasingowe z automatem",
    opis:
      "Auta po leasingu ze skrzynią automatyczną. Flotowe egzemplarze to w większości " +
      "automaty, więc wybór jest tu szerszy niż na rynku prywatnym.",
    filtry: { gearbox: "automatic" },
  },
  {
    slug: "okazje",
    nazwa: "Okazje",
    h1: "Okazje poleasingowe — ceny poniżej rynku",
    opis:
      "Oferty co najmniej 15% poniżej mediany rynkowej dla tego samego rocznika, przedziału " +
      "przebiegu, paliwa i skrzyni. Medianę liczymy z wszystkich 26 źródeł naraz.",
    filtry: { dealMin: "15", withPrice: "1", kind: "fixed" },
  },
];

/*
 * Prog cenowy skrzyzowany z cecha — "do 50 tys. automat", "do 80 tys. SUV".
 *
 * Google podpowiada nie samo "auto do 50 tys", tylko wlasnie te krzyzowki:
 * automat, suv, benzyna. Sa one CELOWO ograniczone do dwoch wymiarow i do par,
 * ktore maja w bazie co najmniej kilkadziesiat ofert — pelna krzyzowka marka
 * razy nadwozie razy prog dalaby tysiace stron po kilka ofert, czyli dokladnie
 * te strony przelotowe, za ktore Google karze cala domene.
 */
const KRZYZOWKI: Kategoria[] = [
  { prog: 50, cecha: "hatchback", nazwa: "hatchback" },
  { prog: 50, cecha: "kombi", nazwa: "kombi" },
  { prog: 50, cecha: "automat", nazwa: "automat" },
  { prog: 60, cecha: "hatchback", nazwa: "hatchback" },
  { prog: 60, cecha: "kombi", nazwa: "kombi" },
  { prog: 60, cecha: "sedan", nazwa: "sedan" },
  { prog: 60, cecha: "automat", nazwa: "automat" },
  { prog: 80, cecha: "hatchback", nazwa: "hatchback" },
  { prog: 80, cecha: "kombi", nazwa: "kombi" },
  { prog: 80, cecha: "suv", nazwa: "SUV" },
  { prog: 80, cecha: "sedan", nazwa: "sedan" },
  { prog: 80, cecha: "automat", nazwa: "automat" },
  { prog: 80, cecha: "benzyna", nazwa: "benzyna" },
  { prog: 100, cecha: "suv", nazwa: "SUV" },
  { prog: 100, cecha: "kombi", nazwa: "kombi" },
  { prog: 100, cecha: "hatchback", nazwa: "hatchback" },
  { prog: 100, cecha: "sedan", nazwa: "sedan" },
  { prog: 100, cecha: "automat", nazwa: "automat" },
  { prog: 150, cecha: "suv", nazwa: "SUV" },
  { prog: 150, cecha: "automat", nazwa: "automat" },
].map(({ prog, cecha, nazwa }) => {
  const filtry: Filters = { priceMax: prog * 1000, withPrice: "1", kind: "fixed" };
  if (cecha === "automat") filtry.gearbox = "automatic";
  else if (cecha === "benzyna") filtry.fuel = "petrol";
  else filtry.bodyGroup = cecha;

  return {
    slug: `do-${prog}-tys-${cecha}`,
    nazwa: `do ${prog} tys. — ${nazwa}`,
    h1: `Samochody poleasingowe do ${prog} tys. zł — ${nazwa}`,
    opis:
      `Auta poleasingowe w cenie do ${prog} 000 zł, wyłącznie ${nazwa}. Ceny „kup teraz”, ` +
      "bez licytacji.",
    filtry,
  };
});

export const KATEGORIE: Kategoria[] = [
  ...cenowe,
  ...nadwozia,
  ...paliwa,
  ...pozostale,
  ...KRZYZOWKI,
];

const WEDLUG_SLUGA = new Map(KATEGORIE.map((k) => [k.slug, k]));

export function znajdzKategorie(slug: string): Kategoria | null {
  return WEDLUG_SLUGA.get(slug.toLowerCase()) ?? null;
}

export const GRUPY: { tytul: string; pozycje: Kategoria[] }[] = [
  { tytul: "Według ceny", pozycje: cenowe },
  { tytul: "Cena i nadwozie", pozycje: KRZYZOWKI },
  { tytul: "Według nadwozia", pozycje: nadwozia },
  { tytul: "Według paliwa", pozycje: paliwa },
  { tytul: "Pozostałe", pozycje: pozostale },
];
