/**
 * Adresy stron marka/model.
 *
 * Marki i modele przychodza z 26 zrodel w formie, w jakiej zapisal je
 * sprzedawca: "Škoda", "Mercedes-Benz", "Seria 3", "C-Class", "ID.4",
 * "500L Trekking". Zaden z tych ciagow nie nadaje sie na URL, wiec kazdy
 * dostaje slug.
 *
 * NIE trzymamy slugow w bazie. Zamiana jest jednokierunkowa i stratna
 * (spacja, kropka i myslnik daja ten sam znak), wiec droge powrotna robimy
 * przez porownanie: pobieramy liste marek — jest ich 74 — i szukamy tej,
 * ktorej slug pasuje. Przy tej skali to jedno tanie zapytanie, a schemat
 * zostaje bez dodatkowej kolumny, ktora trzeba by utrzymywac przy kazdym
 * przebiegu scrapera.
 */

/**
 * "Škoda" -> "skoda", "Mercedes-Benz" -> "mercedes-benz", "ID.4" -> "id-4".
 *
 * `ł` i `Ł` obslugujemy osobno, bo jako jedyne polskie litery NIE rozkladaja
 * sie w NFD na znak bazowy plus diakrytyk — to jest osobny znak Unicode i bez
 * tej podmianki wypadlby calkiem (z "Bielsko" zrobiloby sie "bieso").
 */
export function slugify(s: string): string {
  return s
    .replace(/[łŁ]/g, "l")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Adres strony marki, np. "BMW" -> "/bmw". */
export function makeHref(make: string): string {
  return `/${slugify(make)}`;
}

/** Adres strony modelu, np. ("BMW", "X3") -> "/bmw/x3". */
export function modelHref(make: string, model: string): string {
  return `/${slugify(make)}/${slugify(model)}`;
}

/**
 * Odwrotnosc slugify na zamknietej liscie wartosci z bazy.
 *
 * Dwie rozne nazwy moga dac ten sam slug ("C-Class" i "C Class"). Wygrywa
 * pierwsza z listy — a listy sortujemy malejaco po liczbie ofert, wiec przy
 * kolizji trafiamy na wariant zapisu, ktory wystepuje czesciej.
 */
export function resolveSlug(values: string[], slug: string): string | null {
  const wanted = slug.toLowerCase();
  return values.find((v) => slugify(v) === wanted) ?? null;
}

/**
 * WSZYSTKIE nazwy z bazy, ktore daja podany slug.
 *
 * Zrodla zapisuja ten sam model na kilka sposobow: w bazie stoi rownoczesnie
 * "XC60", "Xc60", "XC 60", "Xc-60" i "XC-60" — piec nazw, jeden adres
 * `/volvo/xc-60`. Dopoki strona modelu filtrowala po JEDNEJ nazwie, oferty
 * z pozostalych pisowni byly niewidoczne: 6644 ofert w 118 takich grupach.
 *
 * Dlatego strona bierze komplet aliasow i filtruje po `in (...)`, a nie po
 * rownosci. Do wyswietlenia sluzy `resolveSlug` — pierwszy z listy, czyli
 * wariant o najwiekszej liczbie ofert.
 */
export function resolveAliases(values: string[], slug: string): string[] {
  const wanted = modelKey(slug);
  return values.filter((v) => modelKey(v) === wanted);
}

/**
 * Klucz dopasowania modelu — slug BEZ separatorow.
 *
 * `slugify` daje "XC60" -> "xc60", ale "XC 60" -> "xc-60". To dwa rozne
 * adresy dla jednego auta i tak tez wygladalo w serwisie: `/volvo/xc60`
 * z 818 ofertami obok `/volvo/xc-60` z siedemnastoma. Zmierzone na calej
 * bazie: 16 modeli rozbitych w ten sposob, lacznie 1937 ofert.
 *
 * Dla wyszukiwarki dwie chude strony zamiast jednej mocnej to strata
 * podwojna — dziela miedzy siebie i tresc, i linki. Dopasowujemy wiec po
 * kluczu bez myslnikow, a adresem kanonicznym zostaje wariant zapisu
 * o najwiekszej liczbie ofert.
 */
export function modelKey(s: string): string {
  return slugify(s).replace(/-/g, "");
}

/**
 * Grupuje nazwy po slugu, zachowujac kolejnosc wejscia.
 *
 * Wejscie posortowane malejaco po liczbie ofert daje na wyjsciu grupy,
 * w ktorych pierwszy element jest wariantem dominujacym — tym, ktory
 * pokazujemy uzytkownikowi.
 */
export function groupBySlug<T>(items: T[], name: (item: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const it of items) {
    // Kluczem jest modelKey, nie slug: "XC60" i "XC 60" to jeden model.
    const k = modelKey(name(it));
    const arr = out.get(k);
    if (arr) arr.push(it);
    else out.set(k, [it]);
  }
  return out;
}
