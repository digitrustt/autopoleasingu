/**
 * Odczyt numeru VIN bez bazy: kraj z pierwszych dwoch znakow i rok modelowy
 * z dziesiatego. Czy dany producent NAPRAWDE zapisuje rok w 10. znaku,
 * mowi dopiero `getWmiStaty` — wiele marek tego nie robi (patrz poradnik
 * /poradnik/rok-produkcji-z-vin).
 */

/**
 * Kody roku modelowego z 10. znaku. Litery I, O, Q, U, Z i cyfra 0 nie sa
 * uzywane. Cykl powtarza sie co 30 lat (A = 1980 i 2010), wiec bierzemy
 * zakres 2001–2030 — starszych aut w serwisie nie ma.
 */
export const KODY_ROKU: [string, number][] = [
  ..."123456789".split("").map((c, i) => [c, 2001 + i] as [string, number]),
  ..."ABCDEFGHJKLMNPRSTVWXY".split("").map((c, i) => [c, 2010 + i] as [string, number]),
];

const ROK = new Map(KODY_ROKU);

export function rokZKodu(znak: string): number | null {
  return ROK.get(znak.toUpperCase()) ?? null;
}

/** 17 znakow, bez I, O i Q. */
export function poprawnyVin(vin: string): boolean {
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(vin.toUpperCase());
}

/*
 * Kraj wedlug zakresow ISO 3780 — kraj, w ktorym zarejestrowano kod
 * producenta, zwykle kraj fabryki. Tylko zakresy, ktore widac w naszych
 * danych i sa jednoznaczne. Nieznany zakres = null, bez zgadywania.
 *
 * Drugi znak liczy sie w kolejnosci ISO: A–Z bez I, O, Q, potem 1–9 i 0.
 */
const KOLEJNOSC = "ABCDEFGHJKLMNPRSTUVWXYZ1234567890";

const ZAKRESY: [string, string, string, string][] = [
  // [pierwszy znak, drugi od, drugi do, kraj]
  ["J", "A", "0", "Japonia"],
  ["K", "L", "R", "Korea Południowa"],
  ["L", "A", "0", "Chiny"],
  ["M", "A", "E", "Indie"],
  ["M", "F", "K", "Indonezja"],
  ["M", "L", "R", "Tajlandia"],
  ["N", "L", "R", "Turcja"],
  ["S", "A", "M", "Wielka Brytania"],
  ["S", "N", "T", "Niemcy"],
  ["S", "U", "Z", "Polska"],
  ["T", "A", "H", "Szwajcaria"],
  ["T", "J", "P", "Czechy"],
  ["T", "R", "V", "Węgry"],
  ["U", "U", "Z", "Rumunia"],
  ["U", "5", "7", "Słowacja"],
  ["V", "A", "E", "Austria"],
  ["V", "F", "R", "Francja"],
  ["V", "S", "W", "Hiszpania"],
  ["W", "A", "0", "Niemcy"],
  ["Y", "A", "E", "Belgia"],
  ["Y", "F", "K", "Finlandia"],
  ["Y", "S", "W", "Szwecja"],
  ["Z", "A", "R", "Włochy"],
  ["1", "A", "0", "USA"],
  ["4", "A", "0", "USA"],
  ["5", "A", "0", "USA"],
  ["2", "A", "0", "Kanada"],
  ["3", "A", "W", "Meksyk"],
];

export function krajZVin(vin: string): string | null {
  const [a, b] = vin.toUpperCase();
  const i = KOLEJNOSC.indexOf(b ?? "");
  if (i < 0) return null;
  for (const [p, od, doZ, kraj] of ZAKRESY) {
    if (p === a && i >= KOLEJNOSC.indexOf(od) && i <= KOLEJNOSC.indexOf(doZ)) return kraj;
  }
  return null;
}

/**
 * Jak pewny jest rok z 10. znaku dla danego kodu producenta, zmierzone na
 * naszych ofertach. Prog 90% / 20%: w danych kody leza prawie wylacznie
 * powyzej 95% albo ponizej 15%, a srodek (Mercedes, czesc Fiatow) to
 * producenci, ktorzy stosuja zapis tylko w czesci modeli.
 */
export type Werdykt = "zapisuje" | "nie-zapisuje" | "nie-zawsze";

export function werdykt(zgodnosc: number): Werdykt {
  if (zgodnosc >= 0.9) return "zapisuje";
  if (zgodnosc <= 0.2) return "nie-zapisuje";
  return "nie-zawsze";
}
