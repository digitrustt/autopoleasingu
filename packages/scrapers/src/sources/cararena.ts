import type { ListingRef, NormalizedListing, RawListing } from "@auta/core";
import { parseFuel, parseInteger, parseYear, splitMakeModel, titleCase } from "@auta/core";
import { fetchText } from "../http";
import type { SourceAdapter } from "../types";

const BASE = "https://cararena.pl";
const LIST = `${BASE}/aukcje/samochody-osobowe`;
const WRAPPER = '<div class="offers-item__wrapper"';
/**
 * Kazda oferta renderuje sie dwa razy (wariant desktop i mobile), wiec kroczymy
 * offsetem 9 i scalamy po id. Nadmiarowe nakladanie sie stron jest nieszkodliwe —
 * dedup zalatwia Map, a stop nastepuje gdy strona nie wnosi nic nowego.
 */
const STEP = 9;
const MAX_PAGES = 200;

function stripToLines(html: string): string[] {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export interface ArenaCard {
  externalId: string;
  url: string;
  title: string | null;
  body: string | null;
  year: number | null;
  mileageKm: number | null;
  fuel: string | null;
  priceGross: number | null;
  priceNet: number | null;
  city: string | null;
  endsAt: string | null;
  thumbnailUrl: string | null;
}

/** Etykieta w wariancie mobilnym: "Przebieg:" a w nastepnej linii wartosc. */
function labelled(lines: string[], label: string): string | null {
  const i = lines.findIndex((l) => l === label);
  return i >= 0 ? (lines[i + 1] ?? null) : null;
}

function parseWrapper(chunk: string): ArenaCard | null {
  const link = chunk.match(/cararena\.pl\/(\d+)-([a-z0-9-]+)/);
  if (!link) return null;

  const lines = stripToLines(chunk);
  const text = lines.join(" ");

  // "4 000 | PLN | brutto" — waluta i typ ceny stoja tuz za kwota.
  const priceIdx = lines.findIndex((l) => l === "PLN");
  const rawPrice = priceIdx > 0 ? lines[priceIdx - 1] : null;
  const isNet = priceIdx >= 0 && lines[priceIdx + 1]?.toLowerCase().startsWith("netto");
  const price = rawPrice ? parseInteger(rawPrice.replace(/[\s ]/g, "")) : null;

  const img = chunk.match(/background-image:\s*url\('([^']+)'\)/);
  const iso = text.match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);

  // Tytul stoi zaraz po klauzuli o oplacie aukcyjnej albo jest pierwsza dluzsza linia.
  const feeIdx = lines.findIndex((l) => l.includes("Opłata aukcyjna"));
  const title = feeIdx >= 0 ? (lines[feeIdx + 1] ?? null) : null;

  /*
   * Tylko z etykiety. Pozycja tuz za tytulem jest zawodna: w wariancie desktop
   * bywa tam rocznik, w mobilnym etykieta "Rok produkcji:". Lepiej null niz smiec.
   */
  const body = labelled(lines, "Nadwozie:");

  /*
   * Rocznik bierzemy z etykiety, a w zapasie z konca sluga ("...-benzyna-2016").
   * Zadnego luznego szukania 4 cyfr w tekscie: pierwsze trafienie to data
   * zakonczenia aukcji, co dawalo rocznik 2026 dla auta z 2016.
   */
  const slugYear = link[2].match(/-((?:19|20)\d{2})$/)?.[1];

  return {
    externalId: link[1],
    url: `${BASE}/${link[1]}-${link[2]}`,
    title,
    body,
    year: parseYear(labelled(lines, "Rok produkcji:") ?? slugYear),
    mileageKm: parseInteger((labelled(lines, "Przebieg:") ?? "").replace(/[\s ]/g, "")),
    fuel: labelled(lines, "Paliwo:"),
    priceGross: isNet ? null : price,
    priceNet: isNet ? price : null,
    city: labelled(lines, "Lokalizacja:"),
    endsAt: iso?.[1] ?? null,
    thumbnailUrl: img?.[1] ?? null,
  };
}

/** Scala wariant desktop i mobile jednej oferty — kazdy niesie inny podzbior pol. */
function merge(a: ArenaCard, b: ArenaCard): ArenaCard {
  const pick = <K extends keyof ArenaCard>(k: K): ArenaCard[K] =>
    (a[k] ?? null) !== null ? a[k] : b[k];
  return {
    externalId: a.externalId,
    url: a.url,
    title: pick("title"),
    body: pick("body"),
    year: pick("year"),
    mileageKm: pick("mileageKm"),
    fuel: pick("fuel"),
    priceGross: pick("priceGross"),
    priceNet: pick("priceNet"),
    city: pick("city"),
    endsAt: pick("endsAt"),
    thumbnailUrl: pick("thumbnailUrl"),
  };
}

export const cararena: SourceAdapter = {
  id: "cararena",
  name: "CarArena (aukcje)",
  baseUrl: BASE,
  strategy: "http",
  delayMs: 1200,
  /** parse() czyta z ref.payload — bez discover nie ma czego odswiezac. */
  needsDiscoveryPayload: true,
  /** Discover kosztuje dziesiatki zadan — miedzy przelotami odswiezamy znane oferty. */
  discoverEveryMinutes: 30,

  async discover(): Promise<ListingRef[]> {
    const cards = new Map<string, ArenaCard>();
    /*
     * Nie przerywamy na pierwszej stronie bez nowych ofert. Kroczymy offsetem 9,
     * a kazda oferta renderuje sie dwukrotnie, wiec pojedyncza strona potrafi
     * calkowicie pokryc sie z poprzednia i dac fresh=0 w srodku listy. Wczesniej
     * konczylo to zaciag przedwczesnie — stad 79 zamiast 224 ofert w bazie.
     */
    let emptyStreak = 0;

    for (let page = 0; page < MAX_PAGES; page++) {
      const url = page === 0 ? LIST : `${LIST}?offset=${page * STEP}`;
      const html = await fetchText(url, { delayMs: cararena.delayMs, timeoutMs: 45_000 });

      let fresh = 0;
      for (const chunk of html.split(WRAPPER).slice(1)) {
        const card = parseWrapper(chunk);
        if (!card) continue;
        const prev = cards.get(card.externalId);
        if (prev) {
          cards.set(card.externalId, merge(prev, card));
        } else {
          cards.set(card.externalId, card);
          fresh++;
        }
      }
      emptyStreak = fresh === 0 ? emptyStreak + 1 : 0;
      if (emptyStreak >= 3) break;
    }

    return [...cards.values()].map((c) => ({
      sourceId: "cararena",
      externalId: c.externalId,
      url: c.url,
      payload: c,
    }));
  },

  // Kafelek niesie komplet — detal nie wnosi nic, wiec nie ruszamy sieci.
  async fetchDetail(ref: ListingRef): Promise<RawListing> {
    return { ref, body: JSON.stringify(ref.payload), fetchedAt: new Date() };
  },

  parse(raw: RawListing): NormalizedListing | null {
    const c = JSON.parse(raw.body) as ArenaCard | null;
    if (!c?.title) return null;

    // "Volkswagen Caddy" -> marka + model. Nie tniemy po pierwszej spacji, bo
    // "Land Rover Discovery" dawaloby marke "Land" i model "Rover Discovery".
    const mm = splitMakeModel(c.title);
    if (!mm) return null;

    const ends = c.endsAt ? new Date(c.endsAt.replace(" ", "T")) : null;

    return {
      sourceId: raw.ref.sourceId,
      externalId: raw.ref.externalId,
      url: raw.ref.url,

      vin: null,
      make: mm.make,
      model: titleCase(mm.model),
      trim: null,

      year: c.year,
      mileageKm: c.mileageKm,
      priceGross: c.priceGross,
      priceNet: c.priceNet,

      fuel: parseFuel(c.fuel),
      gearbox: null,
      drive: null,
      powerHp: null,
      engineCcm: null,
      body: c.body,
      color: null,
      seats: null,
      city: c.city,

      thumbnailUrl: c.thumbnailUrl,

      offerKind: "auction",
      auctionEndsAt: ends && !Number.isNaN(ends.getTime()) ? ends : null,
    };
  },
};
