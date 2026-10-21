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
const WYJATKI = /opole lubelskie/i;

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
