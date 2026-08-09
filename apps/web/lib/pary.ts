import surowe from "@/data/pary.json";
import { slugify } from "@/lib/slug";

/**
 * Pary modeli do stron porownawczych.
 *
 * Lista NIE JEST wymyslona ani wygenerowana kombinatorycznie. Powstala
 * z publicznego API podpowiedzi Google: dla kazdego modelu, ktory ma
 * w bazie co najmniej 15 ofert, odpytalismy "{marka} {model} czy" i wzielismy
 * te podpowiedzi, w ktorych druga strona porownania rowniez jest u nas
 * dostepna. Google podpowiada wylacznie frazy realnie wyszukiwane, wiec kazda
 * z tych stron odpowiada na pytanie, o ktorym wiadomo, ze ktos je zadaje.
 *
 * To jest roznica miedzy 313 stronami a 891, ktore wyszlyby z samego
 * "podobne nadwozie, podobna cena" — i miedzy trescia a stronami przelotowymi,
 * za ktore Google karze cala domene.
 *
 * `obustronna` znaczy, ze podpowiedz pojawila sie z obu stron ("octavia czy
 * corolla" ORAZ "corolla czy octavia") — najmocniejszy sygnal popytu.
 *
 * Plik jest zamrozony w repo, a nie liczony przy kazdym buildzie: odpytanie
 * podpowiedzi to kilkaset zapytan do Google, ktorych nie ma po co powtarzac
 * przy kazdym wdrozeniu. Odswieza sie recznie, gdy w bazie przybywa modeli.
 */
export interface Para {
  a: { make: string; model: string };
  b: { make: string; model: string };
  /** Podpowiedz pojawila sie z obu stron — mocniejszy sygnal popytu. */
  obustronna: boolean;
  /** Czlon adresu: "skoda-octavia-vs-toyota-corolla". */
  slug: string;
}

function slugPary(a: { make: string; model: string }, b: { make: string; model: string }): string {
  return `${slugify(`${a.make} ${a.model}`)}-vs-${slugify(`${b.make} ${b.model}`)}`;
}

/*
 * Deduplikacja po slugu.
 *
 * W bazie ten sam model bywa zapisany na kilka sposobow ("XC60" obok "XC 60",
 * "i30" obok "I30") i oba warianty przekraczaja prog 15 ofert — wiec ta sama
 * para trafiala na liste dwa razy i dawala szesnascie zdublowanych adresow
 * w mapie strony. Zostawiamy pierwsze wystapienie, ale wersja `obustronna`
 * zawsze wygrywa: to mocniejszy sygnal popytu i nie chcemy go zgubic przez
 * kolejnosc w pliku.
 */
export const PARY: Para[] = [
  ...(surowe as { para: [[string, string], [string, string]]; obustronna: boolean }[])
    .map(({ para, obustronna }) => {
      const a = { make: para[0][0], model: para[0][1] };
      const b = { make: para[1][0], model: para[1][1] };
      return { a, b, obustronna, slug: slugPary(a, b) };
    })
    .reduce((acc, p) => {
      const byl = acc.get(p.slug);
      if (!byl || (p.obustronna && !byl.obustronna)) acc.set(p.slug, p);
      return acc;
    }, new Map<string, Para>())
    .values(),
];

const WEDLUG_SLUGA = new Map(PARY.map((p) => [p.slug, p]));

export function znajdzPare(slug: string): Para | null {
  return WEDLUG_SLUGA.get(slug.toLowerCase()) ?? null;
}

/** Inne porownania z udzialem tego samego modelu — linkowanie poziome. */
export function sasiedniePary(p: Para, limit = 8): Para[] {
  const dotyczy = (x: Para, m: { make: string; model: string }) =>
    (x.a.make === m.make && x.a.model === m.model) ||
    (x.b.make === m.make && x.b.model === m.model);

  return PARY.filter((x) => x.slug !== p.slug && (dotyczy(x, p.a) || dotyczy(x, p.b))).slice(
    0,
    limit,
  );
}
