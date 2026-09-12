import { slugify } from "@/lib/slug";

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
