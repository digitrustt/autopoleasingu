import { slugify } from "@/lib/slug";

/**
 * Warianty zapisu miasta -> jedno miasto glowne.
 *
 * DLACZEGO (21.10.2026). Search Console: "samochody poleasingowe warszawa"
 * na pozycji ~75–79, Krakow ~42, Wroclaw ~36–62, Poznan ~27 — a Gdansk ~10.
 * Strony mialy ten sam szablon, wiec przyczyna lezala gdzie indziej: zrodla
 * zapisuja miasto po swojemu ("Warszawa - Wola", "Zeran", "Okecie",
 * "Dobrygowski Krakow", "Poznan - Lawica", "Wroclaw - Dlugoleka") i kazdy
 * wariant dostawal WLASNA strone. Na Warszawe wypadalo kilkanascie stron
 * walczacych o te sama fraze, a glowna miala 3657 z ~4800 ofert. W Gdansku
 * takiego rozbicia nie bylo.
 *
 * ZASADA: wariant trafia do miasta, gdy zawiera jego nazwe jako osobne slowo
 * ("Kraków - Zakopiańska", "Chodzeń Warszawa"), zapis "k. Krakowa", albo jest
 * dzielnica Warszawy. Okolice z WLASNYM ruchem z wyszukiwarki (Janki, Krze Duze,
 * Ozarow Mazowiecki, Piaseczno) zostaja osobno — ludzie wpisuja je z nazwy,
 * a strony rankuja. "Bielany Wroclawskie" to osobna miejscowosc, nie Wroclaw.
 */
const MIASTA: [nazwa: string, odmiany: string[], dopelniacz: string[]][] = [
  ["Warszawa", ["warszawa"], ["warszawy"]],
  ["Kraków", ["kraków", "krakow"], ["krakowa"]],
  ["Poznań", ["poznań", "poznan"], ["poznania"]],
  ["Wrocław", ["wrocław", "wroclaw"], ["wrocławia", "wroclawia"]],
  ["Gdańsk", ["gdańsk", "gdansk"], ["gdańska", "gdanska"]],
  ["Gdynia", ["gdynia"], ["gdyni"]],
  ["Łódź", ["łódź", "lodz"], ["łodzi", "lodzi"]],
  ["Katowice", ["katowice"], ["katowic"]],
  ["Szczecin", ["szczecin"], ["szczecina"]],
  ["Lublin", ["lublin"], ["lublina"]],
  ["Bydgoszcz", ["bydgoszcz"], ["bydgoszczy"]],
  ["Rzeszów", ["rzeszów", "rzeszow"], ["rzeszowa"]],
  ["Białystok", ["białystok", "bialystok"], ["białegostoku", "bialegostoku"]],
  ["Kielce", ["kielce"], ["kielc"]],
  ["Toruń", ["toruń", "torun"], ["torunia"]],
  ["Olsztyn", ["olsztyn"], ["olsztyna"]],
  ["Opole", ["opole"], ["opola"]],
  ["Częstochowa", ["częstochowa", "czestochowa"], ["częstochowy", "czestochowy"]],
  /*
   * 17.11.2026: miasta z setka i wiecej ofert, ktore dostawaly "w miejscowosci X"
   * (Kalisz 599, Plock 580, Myslowice 511…). Stare adresy wariantow ("bielsko")
   * przekierowuje przekierowanieMiasta w app/poleasingowe/[co].
   */
  ["Kalisz", ["kalisz"], ["kalisza"]],
  ["Płock", ["płock", "plock"], ["płocka", "plocka"]],
  ["Mysłowice", ["mysłowice", "myslowice"], ["mysłowic", "myslowic"]],
  ["Siedlce", ["siedlce"], ["siedlec"]],
  ["Rybnik", ["rybnik"], ["rybnika"]],
  ["Sosnowiec", ["sosnowiec"], ["sosnowca"]],
  ["Zielona Góra", ["zielona góra", "zielona gora"], ["zielonej góry", "zielonej gory"]],
  ["Leszno", ["leszno"], ["leszna"]],
  ["Tychy", ["tychy"], ["tychów", "tychow"]],
  ["Radom", ["radom"], ["radomia"]],
  ["Lubin", ["lubin"], ["lubina"]],
  ["Bytom", ["bytom"], ["bytomia"]],
  ["Wejherowo", ["wejherowo"], ["wejherowa"]],
  ["Gliwice", ["gliwice"], ["gliwic"]],
  ["Konin", ["konin"], ["konina"]],
  ["Chorzów", ["chorzów", "chorzow"], ["chorzowa"]],
  ["Ruda Śląska", ["ruda śląska", "ruda slaska"], ["rudy śląskiej", "rudy slaskiej"]],
  ["Bielsko-Biała", ["bielsko-biała", "bielsko-biala", "bielsko biała", "bielsko biala", "bielsko"], ["bielska-białej", "bielska-bialej", "bielska"]],
  ["Nowy Targ", ["nowy targ"], ["nowego targu"]],
  ["Grudziądz", ["grudziądz", "grudziadz"], ["grudziądza", "grudziadza"]],
  ["Koszalin", ["koszalin"], ["koszalina"]],
  ["Elbląg", ["elbląg", "elblag"], ["elbląga", "elblaga"]],
  ["Tarnów", ["tarnów", "tarnow"], ["tarnowa"]],
  ["Legnica", ["legnica"], ["legnicy"]],
  [
    "Gorzów Wielkopolski",
    ["gorzów wielkopolski", "gorzow wielkopolski", "gorzów wlkp", "gorzow wlkp"],
    ["gorzowa wielkopolskiego", "gorzowa wlkp"],
  ],
];

/** Dzielnice Warszawy zapisywane bez nazwy miasta (takze w nazwach dealerow). */
const DZIELNICE_WARSZAWY = [
  "żerań",
  "zeran",
  "okęcie",
  "okecie",
  "wilanów",
  "wilanow",
  "radość",
  "radosc",
  "bemowo",
  "chodzeń",
  "chodzen",
  "natolin",
  "ursynów",
  "mokotów",
];

/** Osobne slowo — `\b` w JS nie rozumie polskich liter, stad lookaroundy z \p{L}. */
const slowo = (s: string) => new RegExp(`(?<![\\p{L}])${s}(?![\\p{L}])`, "iu");

const REGULY: [RegExp, string][] = [
  ...MIASTA.flatMap(([nazwa, odmiany, dop]) => [
    ...odmiany.map((o) => [slowo(o), nazwa] as [RegExp, string]),
    ...dop.map((d) => [new RegExp(`k\\.\\s*${d}(?![\\p{L}])`, "iu"), nazwa] as [RegExp, string]),
  ]),
  ...DZIELNICE_WARSZAWY.map((d) => [slowo(d), "Warszawa"] as [RegExp, string]),
];

/** Inne miejscowosci, ktore zawieraja nazwe duzego miasta. */
const WYJATKI = /opole lubelskie|kalisz pomorski|bytom odrzański|bytom odrzanski/i;

/** "Warszawa - Wola" -> "Warszawa"; nazwa spoza listy zostaje bez zmian. */
export function nazwaGlowna(city: string): string {
  const c = city.trim();
  if (WYJATKI.test(c)) return c;
  for (const [re, nazwa] of REGULY) if (re.test(c)) return nazwa;
  return c;
}

/** Adresowy slug miasta po scaleniu wariantow: "Warszawa - Wola" -> "warszawa". */
export function slugMiasta(city: string): string {
  return slugify(nazwaGlowna(city));
}

/** Miejscownik dla miast z listy — "w Warszawie" zamiast "w mieście Warszawa". */
const MIEJSCOWNIK: Record<string, string> = {
  Warszawa: "w Warszawie",
  Kraków: "w Krakowie",
  Poznań: "w Poznaniu",
  Wrocław: "we Wrocławiu",
  Gdańsk: "w Gdańsku",
  Gdynia: "w Gdyni",
  Łódź: "w Łodzi",
  Katowice: "w Katowicach",
  Szczecin: "w Szczecinie",
  Lublin: "w Lublinie",
  Bydgoszcz: "w Bydgoszczy",
  Rzeszów: "w Rzeszowie",
  Białystok: "w Białymstoku",
  Kielce: "w Kielcach",
  Toruń: "w Toruniu",
  Olsztyn: "w Olsztynie",
  Opole: "w Opolu",
  Częstochowa: "w Częstochowie",
  Kalisz: "w Kaliszu",
  Płock: "w Płocku",
  Mysłowice: "w Mysłowicach",
  Siedlce: "w Siedlcach",
  Rybnik: "w Rybniku",
  Sosnowiec: "w Sosnowcu",
  "Zielona Góra": "w Zielonej Górze",
  Leszno: "w Lesznie",
  Tychy: "w Tychach",
  Radom: "w Radomiu",
  Lubin: "w Lubinie",
  Bytom: "w Bytomiu",
  Wejherowo: "w Wejherowie",
  Gliwice: "w Gliwicach",
  Konin: "w Koninie",
  Chorzów: "w Chorzowie",
  "Ruda Śląska": "w Rudzie Śląskiej",
  "Bielsko-Biała": "w Bielsku-Białej",
  "Nowy Targ": "w Nowym Targu",
  Grudziądz: "w Grudziądzu",
  Koszalin: "w Koszalinie",
  Elbląg: "w Elblągu",
  Tarnów: "w Tarnowie",
  Legnica: "w Legnicy",
  "Gorzów Wielkopolski": "w Gorzowie Wielkopolskim",
};

/** "w Warszawie"; dla miejscowosci spoza listy bezpieczne "w mieście X". */
export function wMiescie(nazwa: string): string {
  return MIEJSCOWNIK[nazwa] ?? `w miejscowości ${nazwa}`;
}
