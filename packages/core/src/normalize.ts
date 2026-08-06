import type { Drive, Fuel, Gearbox } from "./types";

/**
 * Slowniki sa celowo szersze niz potrzeby jednego zrodla — kazdy portal nazywa
 * to samo inaczej, a mapowanie jest tanie. Wpisy dokladamy, gdy dojdzie zrodlo.
 */

const FUEL: Record<string, Fuel> = {
  pb: "petrol", benzyna: "petrol", petrol: "petrol", gasoline: "petrol",
  on: "diesel", diesel: "diesel", olejnapedowy: "diesel", ropa: "diesel",
  hybryda: "hybrid", hybrid: "hybrid", hev: "hybrid",
  phev: "phev", hybrydaplugin: "phev", pluginhybrid: "phev",
  elektryczny: "electric", ev: "electric", electric: "electric", bev: "electric",
  // Kody mauto.pl: PB/ON juz sa wyzej, EL i H sa ich odpowiednikami dla prądu i hybrydy.
  el: "electric", h: "hybrid",
  lpg: "lpg", benzynalpg: "lpg", cng: "cng",
};

const GEARBOX: Record<string, Gearbox> = {
  manualna: "manual", manualnaskrzynia: "manual", manual: "manual", mt: "manual",
  automatyczna: "automatic", automat: "automatic", automatic: "automatic", at: "automatic",
  polautomatyczna: "automatic", dsg: "automatic", cvt: "automatic",
};

const DRIVE: Record<string, Drive> = {
  frontwheeldriveconfiguration: "fwd", przedni: "fwd", przod: "fwd", fwd: "fwd", "2wd": "fwd",
  rearwheeldriveconfiguration: "rwd", tylny: "rwd", tyl: "rwd", rwd: "rwd",
  allwheeldriveconfiguration: "awd", quattro: "awd", "4x4": "awd", awd: "awd", "4wd": "awd",
  napednaczterykola: "awd", "4motion": "awd", xdrive: "awd",
};

/** Usuwa polskie znaki, spacje i interpunkcje — zeby "Olej napedowy" == "olejnapedowy". */
function key(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[łŁ]/g, "l")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function lookup<T>(dict: Record<string, T>, raw: string | null | undefined): T | null {
  if (!raw) return null;
  const k = key(raw);
  if (dict[k]) return dict[k];
  // schema.org podaje pelne URL-e (".../FrontWheelDriveConfiguration") — bierzemy ostatni segment
  const tail = key(raw.split("/").pop() ?? "");
  return dict[tail] ?? null;
}

/**
 * Paliwo bywa opisowe ("Plug-in Hybrid benzyna", "Hybryda (benzyna/elektryczny)"),
 * wiec po nieudanym trafieniu w slownik sprawdzamy zawieranie — od najbardziej
 * szczegolowego, bo "pluginhybrid" zawiera tez "hybrid", a PHEV != HEV.
 */
const FUEL_CONTAINS: [string, Fuel][] = [
  ["pluginhybrid", "phev"],
  ["hybrydaplugin", "phev"],
  ["phev", "phev"],
  /*
   * Samo "plugin" musi wyprzedzac "electric": Volvo opisuje PHEV jako
   * "Hybrid Petrol/Electric Plug-in", wiec dopasowanie do "electric" wpisaloby
   * hybryde jako auto w pelni elektryczne.
   */
  ["plugin", "phev"],
  ["elektryczn", "electric"],
  ["electric", "electric"],
  ["hybryd", "hybrid"],
  ["hybrid", "hybrid"],
  ["diesel", "diesel"],
  ["olejnapedowy", "diesel"],
  ["benzyn", "petrol"],
  ["lpg", "lpg"],
];

export function parseFuel(v?: string | null): Fuel | null {
  const direct = lookup(FUEL, v);
  if (direct) return direct;
  if (!v) return null;
  const k = key(v);
  for (const [needle, fuel] of FUEL_CONTAINS) {
    if (k.includes(needle)) return fuel;
  }
  return null;
}
/**
 * Skrzynia i naped tez bywaja opisowe ("Automatyczna skrzynia biegow",
 * "Naped na przednie kola"), wiec po slowniku probujemy zawierania.
 * Kolejnosc ma znaczenie: "napednaprzedniekola" zawiera "przednie", a nie "przedni".
 */
const GEARBOX_CONTAINS: [string, Gearbox][] = [
  ["automatyczn", "automatic"],
  ["automat", "automatic"],
  ["dsg", "automatic"],
  ["cvt", "automatic"],
  ["manualn", "manual"],
  ["manual", "manual"],
];

const DRIVE_CONTAINS: [string, Drive][] = [
  ["czterykola", "awd"],
  ["wszystkiekola", "awd"],
  ["4x4", "awd"],
  ["4motion", "awd"],
  ["quattro", "awd"],
  ["xdrive", "awd"],
  // Zapisy angielskie — Volvo podaje "All Wheel Drive" / "Front Wheel Drive".
  ["allwheeldrive", "awd"],
  ["frontwheeldrive", "fwd"],
  ["rearwheeldrive", "rwd"],
  ["przedni", "fwd"],
  ["przod", "fwd"],
  ["tylne", "rwd"],
  ["tylny", "rwd"],
  ["tyl", "rwd"],
];

function withContains<T>(
  dict: Record<string, T>,
  contains: [string, T][],
  v: string | null | undefined,
): T | null {
  const direct = lookup(dict, v);
  if (direct) return direct;
  if (!v) return null;
  const k = key(v);
  for (const [needle, val] of contains) {
    if (k.includes(needle)) return val;
  }
  return null;
}

export const parseGearbox = (v?: string | null) => withContains(GEARBOX, GEARBOX_CONTAINS, v);
export const parseDrive = (v?: string | null) => withContains(DRIVE, DRIVE_CONTAINS, v);

/**
 * Wyciaga pierwsza liczbe calkowita. Radzi sobie z "77 905 km", "1 234,56", "120 KM".
 * Separator tysiecy (spacja/kropka) usuwamy, przecinek dziesietny ucina czesc ulamkowa.
 */
export function parseNumber(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const cleaned = v.replace(/[\u00a0\u202f]/g, " ").replace(/(\d)[ .](?=\d{3}\b)/g, "$1").replace(",", ".");
  const m = cleaned.match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number.parseFloat(m[0]);
  return Number.isFinite(n) ? n : null;
}

export function parseInteger(v: string | number | null | undefined): number | null {
  const n = parseNumber(v);
  return n == null ? null : Math.round(n);
}

/** VIN: 17 znakow, bez I/O/Q. Odrzucamy maskowane ("WVW********"). */
export function parseVin(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = v.trim().toUpperCase();
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(s) ? s : null;
}

/** "HYUNDAI" -> "Hyundai", ale skroty zostawiamy ("BMW", "KIA" -> "Kia" jest OK). */
export function titleCase(v: string): string {
  return v
    .toLowerCase()
    .replace(/(^|[\s\-/])([a-zà-ž])/g, (_, sep, ch) => sep + ch.toUpperCase());
}

// Kia pisze sie "Kia", nie "KIA" — dlatego jej tu nie ma, mimo ze wyglada na skrot.
const KNOWN_ACRONYMS = new Set([
  "BMW", "DS", "MG", "GMC", "SEAT", "MINI", "RAM", "MAN", "BAIC", "BYD",
]);

/**
 * Ta sama marka bywa nazywana rozne w kazdym zrodle. Bez ujednolicenia filtr
 * "Volkswagen" nie pokazalby aut z BMW (ktore podaje "VW"), a dedup miedzy
 * portalami by ich nie polaczyl.
 */
const MAKE_ALIASES: Record<string, string> = {
  vw: "Volkswagen",
  volkswagen: "Volkswagen",
  "mercedes benz": "Mercedes-Benz",
  mercedes: "Mercedes-Benz",
  mb: "Mercedes-Benz",
  // titleCase zrobilby z tego "Mercedes-Amg" — akronimy po myslniku wymagaja aliasu
  "mercedes amg": "Mercedes-AMG",
  "mercedes maybach": "Mercedes-Maybach",
  skoda: "Skoda",
  "land rover": "Land Rover",
  landrover: "Land Rover",
  "alfa romeo": "Alfa Romeo",
  alfaromeo: "Alfa Romeo",
  vauxhall: "Opel",
  // Bez tego "CITROËN" (Toyota) i "CITROEN" (reszta) zyja w bazie jako dwie marki.
  citroen: "Citroën",
  "rolls royce": "Rolls-Royce",
  "aston martin": "Aston Martin",
  "great wall": "Great Wall",
};

export function normalizeMake(v: string): string {
  /*
   * Niektore zrodla dopisuja do marki zabudowcę ("RENAULT/CARPOL", "IVECO/BMB")
   * albo grupe kapitalowa w nawiasie kwadratowym ("MINI [BMW]", Automarket
   * i Dawro). Dla nas liczy sie sama marka — reszta to szum psujacy filtr.
   */
  const s = v
    .replace(/\s*\[[^\]]*\]/g, " ")
    .trim()
    .split("/")[0]
    .trim();
  // Dopasowanie bez diakrytykow: Alphabet podaje "Škoda", Arval "Skoda".
  const lookupKey = s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ");
  const alias = MAKE_ALIASES[lookupKey];
  if (alias) return alias;
  if (KNOWN_ACRONYMS.has(s.toUpperCase())) return s.toUpperCase();
  return titleCase(s);
}

/**
 * Czesc zrodel podaje model KAPITALIKAMI ("ASTRA", "F-PACE"), inne normalnie
 * ("Astra"). Ten sam samochod wygladalby wtedy na dwa rozne.
 *
 * Ruszamy WYLACZNIE zapisy bez ani jednej malej litery — inaczej zepsulibysmy
 * konwencje producenta tam, gdzie jest celowa (Mercedes "C 220 d", BMW "xDrive").
 *
 * W srodku zostawiamy nietkniete trzy rodzaje tokenow, bo titleCase psuje kazdy
 * z nich: z cyfra ("XC60" -> "Xc60"), krotkie akronimy ("EQB" -> "Eqb") oraz
 * liczby rzymskie ("GOLF VIII" -> "Golf Viii").
 */
const ROMAN = /^[IVXLCDM]+$/;

export function normalizeModel(v: string | null | undefined): string | null {
  const s = v?.trim().replace(/\s+/g, " ");
  if (!s) return null;
  if (/[a-zà-ž]/.test(s)) return s;
  return s
    .split(" ")
    .map((token) =>
      /\d/.test(token) || token.length <= 3 || ROMAN.test(token) ? token : titleCase(token),
    )
    .join(" ");
}

/**
 * Marki dwuczlonowe. Ciecie tytulu po pierwszej spacji dawaloby dla nich marke
 * "Land" i model "Rover Discovery" — dokladnie tak zachowywala sie CarArena.
 */
const MULTI_WORD_MAKES = [
  "alfa romeo",
  "aston martin",
  "great wall",
  "land rover",
  "mercedes amg",
  "mercedes benz",
  "mercedes maybach",
  "rolls royce",
];

/**
 * Rozbija "Land Rover Discovery Sport" na marke i model. Gdy zrodlo udostepnia
 * wlasna liste marek (autoprzetarg, mAuto), lepiej uzyc jej — tu radzimy sobie
 * bez slownika, wiec obslugujemy tylko marki wieloczlonowe znane z gory.
 */
export function splitMakeModel(title: string): { make: string; model: string } | null {
  const t = title.trim().replace(/\s+/g, " ");
  if (!t) return null;

  const key = t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/-/g, " ");

  const multi = MULTI_WORD_MAKES.find((m) => key.startsWith(`${m} `));
  if (multi) {
    const model = t.slice(multi.length).trim();
    return model ? { make: normalizeMake(t.slice(0, multi.length)), model } : null;
  }

  const [first, ...rest] = t.split(" ");
  if (rest.length === 0) return null;
  return { make: normalizeMake(first), model: rest.join(" ") };
}

/** "FORD Focus 1.0 EcoBoost" -> "ford-focus-1-0-ecoboost". Do budowania URL-i ofert. */
export function slugify(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[łŁ]/g, "l")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Ucina z opisu prefiks marki i modelu ("FORD Focus 1.0 EcoBoost" przy
 * make=Ford, model=Focus -> "1.0 EcoBoost"). Zrodla lubia powtarzac oba.
 */
export function stripMakeModel(
  description: string | null | undefined,
  make: string,
  model: string,
): string | null {
  let d = description?.trim();
  if (!d) return null;
  for (const token of [make, model]) {
    const t = token.trim();
    if (t && d.toLowerCase().startsWith(t.toLowerCase())) {
      d = d.slice(t.length).trim();
    }
  }
  return d.length > 0 ? d : null;
}

/** Rocznik sanity-check — odrzuca daty produkcji zapisane jako pelna data. */
export function parseYear(v: string | number | null | undefined): number | null {
  const n = parseInteger(v);
  if (n == null) return null;
  const year = n > 9999 ? Math.floor(n / 10000) : n;
  return year >= 1950 && year <= new Date().getFullYear() + 1 ? year : null;
}

/**
 * Data pierwszej rejestracji z formatow spotykanych w zrodlach:
 * "2020-12-09", "09-12-2021", "2021.10.06", "2024-11-18T00:00:00Z".
 *
 * Potrzebna w pelnej postaci, nie jako sam rok: historiapojazdu.gov.pl wymaga
 * dokladnej daty, wiec obcinanie do rocznika (jak robilismy wczesniej)
 * uniemozliwialo sprawdzenie historii pojazdu.
 */
export function parseRegistrationDate(v: string | null | undefined): Date | null {
  const s = v?.trim();
  if (!s) return null;

  // ISO albo "2021.10.06" — rok na poczatku.
  const iso = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (iso) {
    const d = new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // "09-12-2021" albo "09.12.2021" — dzien na poczatku.
  const pl = s.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})/);
  if (pl) {
    const d = new Date(Date.UTC(+pl[3], +pl[2] - 1, +pl[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Numer rejestracyjny: 4-8 znakow, litery i cyfry. Odrzuca maski i puste. */
export function parseRegistration(v: string | null | undefined): string | null {
  const s = v?.trim().toUpperCase().replace(/\s+/g, " ");
  if (!s || s.length < 4 || s.length > 9) return null;
  return /^[A-Z0-9 ]+$/.test(s) && /[A-Z]/.test(s) && /\d/.test(s) ? s : null;
}
