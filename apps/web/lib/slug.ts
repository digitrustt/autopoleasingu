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
