import { BODY_GROUPS } from "@auta/core";
import { KATEGORIE } from "@/lib/filtry";

export interface LinkOferty {
  href: string;
  tekst: string;
}

const PROGI = KATEGORIE.flatMap((k) => {
  const m = /^do-(\d+)-tys$/.exec(k.slug);
  return m ? [Number(m[1])] : [];
}).sort((a, b) => a - b);

const PALIWO_SLUG: Record<string, string> = {
  petrol: "benzyna",
  diesel: "diesel",
  hybrid: "hybrydy",
  phev: "phev",
  electric: "elektryki",
};

/**
 * Kategorie, do ktorych pasuje TA oferta: prog cenowy, nadwozie, paliwo, skrzynia.
 *
 * Oferty to najwiecej wejsc z Google (128 w tygodniu), a do kategorii cenowych
 * i nadwoziowych prowadzily tylko menu i strona glowna. Link z oferty mowi
 * Google, ze np. "do 50 tys. SUV" jest stroną o autach, ktore ludzie faktycznie
 * ogladaja. Linkujemy WYLACZNIE do slugow z KATEGORIE, wiec zaden nie konczy
 * sie 404, a anchor to H1 kategorii, czyli fraza z wyszukiwarki.
 */
export function kategorieOferty(o: {
  priceGross: number | null;
  body: string | null;
  fuel: string | null;
  gearbox: string | null;
}): LinkOferty[] {
  const wedlugSluga = new Map(KATEGORIE.map((k) => [k.slug, k]));
  const wynik: LinkOferty[] = [];
  const dodaj = (slug: string | undefined) => {
    const k = slug ? wedlugSluga.get(slug) : undefined;
    if (k) wynik.push({ href: `/poleasingowe/${k.slug}`, tekst: k.h1 });
  };

  const prog = o.priceGross != null ? PROGI.find((p) => p * 1000 >= o.priceGross!) : undefined;
  const grupa = o.body
    ? Object.entries(BODY_GROUPS).find(([, re]) => new RegExp(re, "i").test(o.body!))?.[0]
    : undefined;

  if (prog) {
    dodaj(`do-${prog}-tys`);
    if (grupa) dodaj(`do-${prog}-tys-${grupa}`);
    if (o.gearbox === "automatic") dodaj(`do-${prog}-tys-automat`);
  }
  dodaj(grupa);
  dodaj(o.fuel ? PALIWO_SLUG[o.fuel] : undefined);
  if (o.gearbox === "automatic") dodaj("automat");

  return wynik.slice(0, 6);
}
