import type { ListingRef, NormalizedListing, RawListing } from "@auta/core";
import {
  normalizeModel,
  parseFuel,
  parseGearbox,
  parseInteger,
  parseVin,
  parseYear,
  splitMakeModel,
} from "@auta/core";
import { fetchText } from "../http";
import type { SourceAdapter } from "../types";

const BASE = "https://pewneauto.pl";
const CARD = '<div class="o-bx"';
const MAX_PAGES = 400;

/**
 * Toyota Pewne Auto — najwiekszy pojedynczy zbior w projekcie (~6 tys. ofert).
 *
 * Listing (20 na strone, ?strona=N) niesie juz cene, rocznik, przebieg, paliwo
 * i pojemnosc. Detal dokłada VIN, moc, skrzynie, nadwozie i kolor — a robi to
 * czystymi microdanymi (itemprop), wiec parser jest odporny na zmiany layoutu.
 *
 * Rozmiaru strony nie da sie zwiekszyc (limit/perPage/size sa ignorowane), wiec
 * pelny discover to ~300 zadan. Dlatego discoverEveryMinutes: pipeline przechodzi
 * cala liste raz na godzine, a miedzy przelotami odswieza detale znanych ofert.
 */

export interface ToyotaCard {
  externalId: string;
  url: string;
  title: string | null;
  trim: string | null;
  city: string | null;
  year: number | null;
  mileageKm: number | null;
  fuel: string | null;
  engineCcm: number | null;
  priceGross: number | null;
  thumbnailUrl: string | null;
}

function text(html: string): string {
  return html
    .replace(/<sup>[\s\S]*?<\/sup>/gi, "")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function lines(html: string): string[] {
  return text(html)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Wartosc pola microdata: <strong itemprop="X">wartosc</strong>. */
function itemprop(html: string, name: string): string | null {
  const m = html.match(new RegExp(`itemprop="${name}"[^>]*>([^<]{0,80})`));
  return m ? m[1].replace(/&nbsp;/g, " ").trim() || null : null;
}

function parseCard(chunk: string): ToyotaCard | null {
  const id = chunk.match(/offer-id="(\d+)"/);
  const href = chunk.match(/href="(\/oferta\/[^"]+)"/);
  if (!id || !href) return null;

  // Dopasowanie musi zaczynac sie od "<div", nie od nazwy klasy — inaczej
  // resztka atrybutu ('o-bx__title">') trafia do tekstu jako pierwsza linia.
  const titleBlock = chunk.match(/<div class="o-bx__title"[\s\S]*?<\/div>/);
  const tl = titleBlock ? lines(titleBlock[0]) : [];

  const infoBlock = chunk.match(/<div class="o-bx__info"[\s\S]*?<\/ul>/);
  const il = infoBlock ? lines(infoBlock[0]) : [];

  const priceBlock = chunk.match(/<div class="o-bx__price"[\s\S]*?<\/div>/);
  const priceRaw = priceBlock?.[0].match(/([\d\s ]+)\s*zł/);

  const img = chunk.match(/<img[^>]+src="(https:\/\/[^"]+)"/);

  // o-bx__info: [miasto, rocznik, "76 891 km", paliwo, "998 cm"]
  const cityLine = il[0] ?? null;
  const yearLine = il[1] ?? null;
  const kmLine = il.find((l) => /\bkm\b/.test(l)) ?? null;
  const ccmLine = il.find((l) => /\bcm\b/.test(l)) ?? null;
  const fuelLine = il.find((l) => /benzyn|diesel|hybry|elektr|lpg/i.test(l)) ?? null;

  return {
    externalId: id[1],
    url: `${BASE}${href[1]}`,
    title: tl[0] ?? null,
    trim: tl[1] ?? null,
    city: cityLine,
    year: parseYear(yearLine),
    mileageKm: parseInteger(kmLine?.replace(/[\s ]/g, "")),
    fuel: fuelLine,
    engineCcm: parseInteger(ccmLine?.replace(/[\s ]/g, "")),
    priceGross: parseInteger(priceRaw?.[1].replace(/[\s ]/g, "")),
    thumbnailUrl: img?.[1] ?? null,
  };
}

export const toyota: SourceAdapter = {
  id: "toyota",
  name: "Toyota Pewne Auto",
  baseUrl: BASE,
  strategy: "http",
  delayMs: 1200,
  /** parse() czyta z ref.payload — bez discover nie ma czego odswiezac. */
  needsDiscoveryPayload: true,
  discoverEveryMinutes: 60,

  async discover(): Promise<ListingRef[]> {
    const seen = new Map<string, ListingRef>();

    let emptyStreak = 0;
    let failStreak = 0;

    for (let page = 1; page <= MAX_PAGES; page++) {
      /*
       * Za ostatnia strona serwis zwraca 404, a nie pusta liste — to jest koniec,
       * nie awaria. Ale przerywanie na PIERWSZYM bledzie jest zdradliwe: lista ma
       * ~300 stron, wiec jeden timeout w polowie po cichu urywal polowe oferty.
       * Prawdziwy koniec listy daje 404 na kazdej kolejnej stronie, wiec dopiero
       * trzy bledy z rzedu traktujemy jako koniec.
       */
      let html: string;
      try {
        html = await fetchText(`${BASE}/oferty?strona=${page}`, {
          delayMs: toyota.delayMs,
          timeoutMs: 45_000,
          retries: 1,
        });
        failStreak = 0;
      } catch {
        if (++failStreak >= 3) break;
        continue;
      }

      let fresh = 0;
      for (const chunk of html.split(CARD).slice(1)) {
        const card = parseCard(chunk);
        if (!card || seen.has(card.externalId)) continue;
        seen.set(card.externalId, {
          sourceId: "toyota",
          externalId: card.externalId,
          url: card.url,
          payload: card,
        });
        fresh++;
      }
      // Patrz cararena: przerwanie na pierwszej stronie bez nowosci gubi reszte listy.
      emptyStreak = fresh === 0 ? emptyStreak + 1 : 0;
      if (emptyStreak >= 3) break;
    }

    return [...seen.values()];
  },

  async fetchDetail(ref: ListingRef): Promise<RawListing> {
    let detail = "";
    try {
      detail = await fetchText(ref.url, { delayMs: toyota.delayMs, timeoutMs: 45_000 });
    } catch {
      // Kafelek sam w sobie wystarcza — VIN i moc sa mile widziane, nie krytyczne.
    }
    return {
      ref,
      body: JSON.stringify({ card: ref.payload ?? null, detail }),
      fetchedAt: new Date(),
    };
  },

  parse(raw: RawListing): NormalizedListing | null {
    const { card, detail } = JSON.parse(raw.body) as {
      card: ToyotaCard | null;
      detail: string;
    };
    if (!card?.title) return null;

    /*
     * "Toyota Yaris" -> marka + model. Nie tniemy po pierwszej spacji: serwis
     * ma tez auta przyjete w rozliczeniu, wiec trafia sie "Land Rover", ktory
     * dawalby marke "Land" i model "Rover Discovery".
     */
    const mm = splitMakeModel(card.title);
    if (!mm) return null;

    const d = detail || "";

    return {
      sourceId: raw.ref.sourceId,
      externalId: raw.ref.externalId,
      url: raw.ref.url,

      vin: parseVin(itemprop(d, "vehicleIdentificationNumber")),
      make: mm.make,
      model: normalizeModel(mm.model) ?? mm.model,
      trim: card.trim,

      year: card.year ?? parseYear(itemprop(d, "productionDate")),
      mileageKm: card.mileageKm,
      priceGross: card.priceGross,
      priceNet: null,

      fuel: parseFuel(card.fuel ?? itemprop(d, "fuelType")),
      gearbox: parseGearbox(itemprop(d, "vehicleTransmission")),
      drive: null,
      powerHp: parseInteger(itemprop(d, "horsepower")),
      engineCcm: card.engineCcm ?? parseInteger(itemprop(d, "engineDisplacement")),
      body: itemprop(d, "bodyType"),
      color: itemprop(d, "color"),
      seats: parseInteger(itemprop(d, "numberOfSeats")),
      city: card.city,

      thumbnailUrl: card.thumbnailUrl,
    };
  },
};
