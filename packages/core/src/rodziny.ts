import { slugify } from "./normalize";

/**
 * Rodziny modeli — scalanie "X3" z "X3 20d xDrive" i "X3 xDrive20d".
 *
 * PO CO: kazde z 26 zrodel zapisuje model po swojemu. Jedno wpisuje sama linie
 * modelowa ("X3"), inne dokleja silnik i wersje ("X3 20d xDrive"). W bazie stoi
 * to jako OSOBNE wartosci kolumny `model`, a filtr porownywal je przez rownosc.
 *
 * Zmierzone: wybranie "X3" pokazywalo 132 oferty zamiast 353. Mercedes "GL" mial
 * 2 oferty w rodzinie i 503 w wariantach. Toyota Proace wystepuje w trzech
 * pisowniach naraz. Czyli filtr po modelu — jeden z dwoch najwazniejszych
 * w calym serwisie — pokazywal ulamek asortymentu i nie bylo tego widac.
 *
 * REGULA: model M nalezy do rodziny N, jesli lista TOKENOW M zaczyna sie od
 * pelnej listy tokenow N. Rodzina to najkrotszy taki N.
 *
 * Tokenowo, nie znakowo — i to jest cala sztuczka. Gdyby porownywac zlepione
 * ciagi, "GL" pochlonaloby "GLA", "GLB", "GLC" i "GLE", czyli cztery zupelnie
 * rozne modele Mercedesa. Przy podziale na tokeny "gla" i "gl" to dwa rozne
 * slowa i nic sie nie skleja. Sprawdzone na calej bazie: GL, GLA, GLB, GLC
 * i GLE zostaja osobno, a X3 scala osiemnascie wariantow.
 */

/** Wyrazy, ktore same w sobie nie sa modelem — inaczej "Seria" pochlonelaby wszystkie serie. */
const GENERYCZNE = new Set(["seria", "serie", "klasa", "class", "model"]);

function tokeny(s: string): string[] {
  return slugify(s).split("-").filter(Boolean);
}

/**
 * Czy token modelu nalezy do tego samego oznaczenia co token rodziny.
 *
 * Rowny — oczywiscie tak. Ale w nomenklaturze BMW i Mercedesa oznaczenie
 * silnika dokleja sie do numeru: "330" ma warianty "330i", "330d" i "330e".
 * Przy samym porownaniu rownosci wpadaly do osobnych rodzin i filtr "330"
 * pokazywal 11 ofert zamiast 52.
 *
 * Doklejenie liter uznajemy za wariant TYLKO po czlonie czysto cyfrowym.
 * To jest wlasnie ta granica, ktora chroni Mercedesa: "GL" nie jest liczba,
 * wiec "GLA" nie zostanie uznane za jego wariant — a to dwa rozne modele.
 * Przyrostek ograniczamy do dwoch liter, zeby "3" nie pochlonelo "300SL".
 */
function tenSamCzlon(rodzina: string, model: string): boolean {
  if (rodzina === model) return true;
  if (!/^\d+$/.test(rodzina)) return false;
  return new RegExp(`^${rodzina}[a-z]{1,2}$`).test(model);
}

function jestPrefiksem(rodzina: string[], model: string[]): boolean {
  if (rodzina.length > model.length) return false;
  if (rodzina.length === model.length && rodzina.every((t, i) => t === model[i])) return false;
  return rodzina.every((t, i) => tenSamCzlon(t, model[i]));
}

export interface Rodzina {
  /** Nazwa pokazywana uzytkownikowi — wariant o najwiekszej liczbie ofert. */
  nazwa: string;
  /** Wszystkie zapisy modelu, ktore do niej naleza — do filtrowania przez `in (...)`. */
  warianty: string[];
  total: number;
}

/**
 * Grupuje modele jednej marki w rodziny.
 *
 * Wejscie posortowane malejaco po liczbie ofert daje rodziny, w ktorych
 * nazwa jest wariantem dominujacym.
 */
export function rodzinyModeli(modele: { model: string; total: number }[]): Rodzina[] {
  const tok = new Map(modele.map((m) => [m.model, tokeny(m.model)]));

  const rodzicOf = new Map<string, string>();
  for (const { model } of modele) {
    const tm = tok.get(model) ?? [];
    let najkrotszy: string | null = null;
    for (const { model: kand } of modele) {
      if (kand === model) continue;
      const tk = tok.get(kand) ?? [];
      if (!jestPrefiksem(tk, tm)) continue;
      // "Seria" nie jest rodzina dla "Seria 3" — to nie nazwa modelu, tylko slowo.
      if (tk.length === 1 && GENERYCZNE.has(tk[0])) continue;
      if (najkrotszy === null || tk.length < (tok.get(najkrotszy)?.length ?? 99)) najkrotszy = kand;
    }
    rodzicOf.set(model, najkrotszy ?? model);
  }

  const grupy = new Map<string, Rodzina>();
  for (const { model, total } of modele) {
    const rodzic = rodzicOf.get(model) ?? model;
    const g = grupy.get(rodzic);
    if (g) {
      g.warianty.push(model);
      g.total += total;
    } else {
      grupy.set(rodzic, { nazwa: rodzic, warianty: [model], total });
    }
  }
  return [...grupy.values()].sort((a, b) => b.total - a.total);
}

/** Warianty zapisu dla wybranej rodziny — do przekazania filtrowi. */
export function wariantyRodziny(rodziny: Rodzina[], wybrana: string): string[] {
  const r = rodziny.find((x) => x.nazwa === wybrana);
  return r ? r.warianty : [wybrana];
}

/* ────────────────────────────────────────────────────────────────────────────
 * Linie modelowe — "Seria 4" obejmujaca 430i, 420d i "Seria 4 Gran Coupe"
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Nazwa linii modelowej, do ktorej nalezy model — albo null.
 *
 * PO CO: rodziny scalaja pisownie TEGO SAMEGO modelu ("X3" i "X3 20d xDrive"),
 * ale nie scalaja RODZENSTWA. W bazie BMW stoja obok siebie "Seria 3" (105
 * ofert), "320d", "330i" i "318i" jako osobne pozycje, mimo ze dla kupujacego
 * to jedna linia. Zmierzone: po zgrupowaniu Seria 5 ma 383 oferty zamiast 94
 * widocznych pod ta nazwa, Seria 3 — 312 zamiast 105, a Seria 4 az 108 przy
 * ZERO widocznych, bo w bazie nie ma ani jednej oferty zapisanej jako
 * "Seria 4": sa same 430i i 420d.
 *
 * DZIALA TYLKO TAM, GDZIE OZNACZENIE NIESIE LINIE. U BMW pierwsza cyfra
 * trzycyfrowego oznaczenia to numer serii (118i -> 1, 530d -> 5). U Mercedesa
 * te sama role gra litera przed "Klasa" ("C Klasa", "C 180" -> Klasa C).
 * Audi ma A4, Q5 i tak dalej — tam model JEST juz linia, wiec nie ma czego
 * grupowac i funkcja zwraca null.
 *
 * SWIADOMIE NIE RUSZAMY X, Z ANI i. "X3" i "X5" to osobne auta, a nie warianty
 * jednej linii — grupowanie ich w "Serie X" byloby pomylka, nie ulatwieniem.
 */
export function liniaModelowa(make: string, model: string): string | null {
  const m = model.trim();

  if (/^bmw$/i.test(make)) {
    // "Seria 3", "Seria 3 Touring" — linia podana wprost.
    const wprost = m.match(/^seria\s*(\d)\b/i);
    if (wprost) return `Seria ${wprost[1]}`;
    /*
     * "530d xDrive", "118i" — pierwsza cyfra to seria. Wymagamy DOKLADNIE
     * trzech cyfr: "3" samo w sobie to nie oznaczenie, a czterocyfrowe liczby
     * to juz co innego (np. pojemnosc w starszych zapisach).
     */
    const oznaczenie = m.match(/^(\d)\d\d(?!\d)/);
    if (oznaczenie) return `Seria ${oznaczenie[1]}`;
    return null;
  }

  if (/^mercedes/i.test(make)) {
    // "C Klasa", "A Klasa" — litera przed slowem "Klasa".
    const klasa = m.match(/^([A-Z])\s*[-\s]?\s*klasa\b/i);
    if (klasa) return `Klasa ${klasa[1].toUpperCase()}`;
    // "C 180", "A 200" — litera i numer silnika.
    const zSilnikiem = m.match(/^([A-Z])\s+\d{3}\b/);
    if (zSilnikiem) return `Klasa ${zSilnikiem[1].toUpperCase()}`;
    return null;
  }

  return null;
}

export interface Linia {
  nazwa: string;
  /** Wszystkie zapisy modelu w tej linii — do filtrowania przez `in (...)`. */
  warianty: string[];
  total: number;
}

/**
 * Linie modelowe marki, posortowane malejaco po liczbie ofert.
 *
 * Zwraca TYLKO linie, ktore realnie cos scalaja — jesli linia ma jeden wariant
 * o tej samej nazwie co ona sama, nie wnosi nic ponad zwykla rodzine i tylko
 * dublowalaby pozycje na liscie filtra.
 */
export function linieModelowe(
  make: string,
  modele: { model: string; total: number }[],
): Linia[] {
  const grupy = new Map<string, Linia>();
  for (const { model, total } of modele) {
    const nazwa = liniaModelowa(make, model);
    if (!nazwa) continue;
    const g = grupy.get(nazwa);
    if (g) {
      g.warianty.push(model);
      g.total += total;
    } else {
      grupy.set(nazwa, { nazwa, warianty: [model], total });
    }
  }
  return [...grupy.values()]
    .filter((l) => l.warianty.length > 1 || l.warianty[0] !== l.nazwa)
    .sort((a, b) => b.total - a.total);
}
