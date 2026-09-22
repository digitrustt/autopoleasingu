/**
 * Nazwa zrodla skrocona do UI. Pelne nazwy z bazy miewaja 43 znaki
 * ("VW FS Store (Volkswagen Financial Services)") i rozpychaly kafelek poza
 * siatke — ucinamy dopisek w nawiasie oraz wszystko po myslniku
 * ("Otomoto — sklepy leasingodawcow" -> "Otomoto").
 *
 * Pelna nazwa zostaje w atrybucie title tam, gdzie tekst jest przyciety.
 */
export function shortSource(name: string): string {
  return name
    .replace(/\s*\(.*\)$/, "")
    .split(/\s+[—–-]\s+/)[0]
    .trim();
}

/**
 * Polska odmiana rzeczownika po liczbie — "1 oferta", "2 oferty", "5 ofert".
 *
 * Potrzebne, bo tytuly i opisy stron trafiaja WPROST do wynikow wyszukiwania,
 * a "132 ofert" albo "2 ofert" widac tam golym okiem i wyglada jak generowana
 * maszynowo tresc. Przy stronach, ktore maja podnosic CTR, to nie jest
 * drobiazg.
 *
 * Regula: 1 -> pojedyncza; koncowka 2-4 (ale NIE 12-14) -> mnoga "few";
 * reszta -> dopelniacz.
 */
export function odmien(n: number, pojedyncza: string, kilka: string, wiele: string): string {
  if (n === 1) return pojedyncza;
  const ost = n % 10;
  const ostDwie = n % 100;
  const few = ost >= 2 && ost <= 4 && !(ostDwie >= 12 && ostDwie <= 14);
  return few ? kilka : wiele;
}

/** Skrot dla najczestszego przypadku w serwisie. */
export function oferty(n: number): string {
  return odmien(n, "oferta", "oferty", "ofert");
}
