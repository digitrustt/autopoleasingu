import { slugify } from "@/lib/slug";

/**
 * Wojewodztwa — strony /poleasingowe/mazowieckie itd.
 *
 * Google podpowiada "auta poleasingowe dolnośląskie", a serwis mial wylacznie
 * strony miast. Czlowiek spod Legnicy nie wpisze "Lubin" ani "Wrocław", tylko
 * region — i nie mial dokad trafic.
 *
 * SKAD PRZYPISANIE. Zrodla nie podaja wojewodztwa, tylko miejsce wystawienia,
 * zapisane po swojemu: "Poznań - Ławica", "Walder Gdynia Chwaszczyno",
 * "Dakar Toyota Rzeszów sp. z o.o. sp. k.". Dopasowujemy wiec po SLOWACH
 * w nazwie, nie po calej nazwie: fragment "gdynia" lapie wszystkie trzy
 * pisownie salonu w Gdyni.
 *
 * Miejsc niejednoznacznych NIE przypisujemy nigdzie ("Gaj", "Pępowo",
 * "Bolesławice" — sa takie wsie w kilku wojewodztwach). Lepiej, zeby auto
 * nie pojawilo sie na stronie regionu, niz zeby strona "pomorskie" pokazywala
 * plac spod Gostynia. Lista powstala z 209 nazw, ktore byly w bazie 3.10.2026;
 * nowe miejsce, ktorego tu nie ma, po prostu nie trafia do zadnego regionu.
 */
export interface Wojewodztwo {
  slug: string;
  /** "mazowieckie" — do zdan typu "w województwie mazowieckim" uzywamy `wMiejscowniku`. */
  nazwa: string;
  wMiejscowniku: string;
  /** Fragmenty nazw miejsc, zapisane jak slug (bez polskich znakow, z myslnikami). */
  miejsca: string[];
}

export const WOJEWODZTWA: Wojewodztwo[] = [
  {
    slug: "mazowieckie",
    nazwa: "mazowieckie",
    wMiejscowniku: "mazowieckim",
    miejsca: [
      "warszawa", "plock", "ozarow-mazowiecki", "krze-duze", "pecice", "minsk", "siedlce",
      "moscieska", "mosciska", "marki", "falenty", "natolin", "janki", "nowe-gulczewo",
      "jawczyce", "jawrzyce", "radom", "lomianki", "lomianski", "dziekanow-lesny", "nadarzyn",
      "piaseczno", "okecie", "zeran", "bemowo", "klaudyn", "wlochy", "mory", "stare-babice",
      "chodzen", "slomczyn", "raszyn", "radosc", "jozefow", "ostroleka", "wilanow",
      "wisniewski", "wola", "tarczyn", "wesola", "sekocin-nowy", "czosnow", "ciechanow",
      "sulejowek", "konstancin-jeziorna",
    ],
  },
  {
    slug: "dolnoslaskie",
    nazwa: "dolnośląskie",
    wMiejscowniku: "dolnośląskim",
    miejsca: [
      "wroclaw", "bielany-wroclawskie", "bielany-nowakowski", "dlugoleka", "lubin",
      "dzierzoniow", "jelenia-gora", "walbrzych", "olesnica", "polkowice",
    ],
  },
  {
    slug: "wielkopolskie",
    nazwa: "wielkopolskie",
    wMiejscowniku: "wielkopolskim",
    miejsca: [
      "poznan", "kalisz", "komorniki", "swadzim", "opatowek", "przezmierowo", "swarzedz",
      "nowe-skalmierzyce", "ociaz", "leszno", "goleczewo", "suchy-las", "baranowo", "pila",
      "konin", "ujscie", "jelonek", "nowy-tomysl", "jankowo-dolne", "kozmin",
    ],
  },
  {
    slug: "slaskie",
    nazwa: "śląskie",
    wMiejscowniku: "śląskim",
    miejsca: [
      "myslowice", "katowice", "czestochowa", "sosnowiec", "ruda-slaska", "gliwice", "bytom",
      "tychy", "mikolow", "bielsko", "bielsko-biala", "chorzow", "rybnik", "dabrowa-gornicza",
      "swietochlowice", "tarnowskie-gory", "zabrze", "zawiercie",
    ],
  },
  {
    slug: "malopolskie",
    nazwa: "małopolskie",
    wMiejscowniku: "małopolskim",
    miejsca: [
      "krakow", "krakowa", "nowy-targ", "modlnica", "modlniczka", "lukanowice", "wieloglowy",
      "nowy-sacz", "tarnow", "wojnicz", "myslenice", "oswiecim", "jawornik",
    ],
  },
  {
    slug: "pomorskie",
    nazwa: "pomorskie",
    wMiejscowniku: "pomorskim",
    miejsca: [
      "gdansk", "gdynia", "wejherowo", "rumia", "slupsk", "trojmiasto", "starogard-gdanski",
    ],
  },
  {
    slug: "lodzkie",
    nazwa: "łódzkie",
    wMiejscowniku: "łódzkim",
    miejsca: [
      "lodz", "lyszkowice", "dobron", "belchatow", "piotrkow-trybunalski", "pabianice",
      "sieradz",
    ],
  },
  {
    slug: "kujawsko-pomorskie",
    nazwa: "kujawsko-pomorskie",
    wMiejscowniku: "kujawsko-pomorskim",
    miejsca: [
      "bydgoszcz", "torun", "lubicz-dolny", "grudziadz", "wloclawek", "osielsko", "lipno",
      "mogilno",
    ],
  },
  {
    slug: "zachodniopomorskie",
    nazwa: "zachodniopomorskie",
    wMiejscowniku: "zachodniopomorskim",
    miejsca: ["szczecin", "koszalin", "biesiekierz", "stare-bielice", "nowogard"],
  },
  {
    slug: "lubelskie",
    nazwa: "lubelskie",
    wMiejscowniku: "lubelskim",
    miejsca: ["lublin", "swidnik", "motycz", "biala-podlaska"],
  },
  {
    slug: "podkarpackie",
    nazwa: "podkarpackie",
    wMiejscowniku: "podkarpackim",
    miejsca: ["rzeszow", "grebow", "krasne", "jaslo", "sacar", "rudna-mala", "lubenia", "zrecin"],
  },
  {
    slug: "swietokrzyskie",
    nazwa: "świętokrzyskie",
    wMiejscowniku: "świętokrzyskim",
    miejsca: ["kielce"],
  },
  {
    slug: "podlaskie",
    nazwa: "podlaskie",
    wMiejscowniku: "podlaskim",
    miejsca: ["bialystok", "bialytok", "suwalki"],
  },
  {
    slug: "warminsko-mazurskie",
    nazwa: "warmińsko-mazurskie",
    wMiejscowniku: "warmińsko-mazurskim",
    miejsca: ["olsztyn", "elblag", "elk"],
  },
  {
    slug: "lubuskie",
    nazwa: "lubuskie",
    wMiejscowniku: "lubuskim",
    miejsca: ["zielona-gora", "gorzow-wielkopolski"],
  },
  {
    slug: "opolskie",
    nazwa: "opolskie",
    wMiejscowniku: "opolskim",
    miejsca: ["opole", "kedzierzyn"],
  },
];

const WEDLUG_SLUGA = new Map(WOJEWODZTWA.map((w) => [w.slug, w]));

export function znajdzWojewodztwo(slug: string): Wojewodztwo | null {
  return WEDLUG_SLUGA.get(slug.toLowerCase()) ?? null;
}

/** Czy fragment wystepuje w nazwie jako CALE slowo (lub ciag slow), nie jako kawalek. */
function zawieraSlowa(nazwa: string, fragment: string): boolean {
  return `-${nazwa}-`.includes(`-${fragment}-`);
}

/**
 * Wojewodztwo dla miejsca z bazy albo null, gdy nie wiemy.
 *
 * Wygrywa NAJDLUZSZY pasujacy fragment: "Bielany Wrocławskie" maja trafic na
 * Dolny Slask, mimo ze "Bielany Warszawa" sa na Mazowszu, a "Gorzów
 * Wielkopolski" — do lubuskiego, nie do wielkopolskiego.
 */
const FRAGMENTY = WOJEWODZTWA.flatMap((w) => w.miejsca.map((m) => ({ m, w }))).sort(
  (a, b) => b.m.length - a.m.length,
);

export function wojewodztwoMiejsca(miejsce: string): Wojewodztwo | null {
  const nazwa = slugify(miejsce);
  if (!nazwa) return null;
  return FRAGMENTY.find((f) => zawieraSlowa(nazwa, f.m))?.w ?? null;
}
