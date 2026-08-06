import type { ListingRef, NormalizedListing, RawListing } from "@auta/core";
import {
  normalizeMake,
  normalizeModel,
  parseDrive,
  parseFuel,
  parseGearbox,
  parseInteger,
  parseVin,
  parseYear,
  titleCase,
} from "@auta/core";
import { fetchText } from "../http";
import type { SourceAdapter } from "../types";
import { field, largestPhoto, offerLinks, vehicleData } from "./famat";

const BASE = "https://poleasingowe.carefleet.pl";
/*
 * Numer strony DZIALA TYLKO z parametrami filtra — samo /oferty/strona-N/ oddaje
 * w kolko te sama pierwsza dwunastke. Do tego "kategoria=osobowe" odsiewa
 * dostawcze po stronie serwera, a sortowanie po cenie daje stabilna kolejnosc
 * (przy sortowaniu po dacie nowe oferty przesuwaja liste w trakcie zaciagu).
 */
const LIST = `${BASE}/oferty/strona-`;
const QUERY = "?kategoria=osobowe&sort=price-desc";
const MAX_PAGES = 40;

/**
 * Carefleet (grupa Credit Agricole) — CFM z pierwotnej listy zrodel. Dlugo nie
 * bylo wiadomo, czy w ogole sprzedaja online; adres znalazl sie dopiero w stopce
 * carefleet.pl jako poddomena "poleasingowe.".
 *
 * robots.txt: "Allow: /" plus wskazanie sitemapy.
 *
 * NIE uzywamy sitemapy do discovery, mimo ze jest: zawiera 524 adresy, w tym
 * oferty ZAKONCZONE (sprawdzone — pierwszy wpis to auto z adnotacja "Oferta
 * zakonczona"). Listing oddaje tylko aktywne, wiec jest wiarygodniejszy.
 */

/**
 * Strona pokazuje obok siebie "ZAKUP" i "LEASING" w identycznym markupie.
 * Bierzemy WYLACZNIE kafelek ZAKUP — LEASING to rata miesieczna i wpisanie jej
 * jako ceny auta zatrulo by cala baze (6 180 zl zamiast 244 200 zl).
 */
function purchasePrice(html: string): { value: number | null; gross: boolean } {
  for (const block of html.split('class="single_head_part')) {
    if (!/head_label">\s*ZAKUP/.test(block)) continue;
    const amount = block.match(/class="[^"]*curr_price[^"]*">([^<]+)</)?.[1];
    if (!amount) break;
    return {
      value: parseInteger(amount.replace(/[\s ]/g, "")),
      gross: /brutto/i.test(block),
    };
  }
  return { value: null, gross: true };
}

export const carefleet: SourceAdapter = {
  id: "carefleet",
  name: "Carefleet (Credit Agricole)",
  baseUrl: BASE,
  strategy: "http",
  delayMs: 1200,

  async discover(): Promise<ListingRef[]> {
    const seen = new Map<string, ListingRef>();
    let emptyStreak = 0;

    for (let page = 1; page <= MAX_PAGES; page++) {
      const html = await fetchText(`${LIST}${page}/${QUERY}`, {
        delayMs: carefleet.delayMs,
        timeoutMs: 45_000,
      });

      let fresh = 0;
      for (const { id, url } of offerLinks(html, "poleasingowe\\.carefleet\\.pl")) {
        if (seen.has(id)) continue;
        seen.set(id, { sourceId: "carefleet", externalId: id, url: `${BASE}${url}` });
        fresh++;
      }

      emptyStreak = fresh === 0 ? emptyStreak + 1 : 0;
      if (emptyStreak >= 3) break;
    }

    return [...seen.values()];
  },

  async fetchDetail(ref: ListingRef): Promise<RawListing> {
    const body = await fetchText(ref.url, { delayMs: carefleet.delayMs });
    return { ref, body, fetchedAt: new Date() };
  },

  parse(raw: RawListing): NormalizedListing | null {
    const html = raw.body;

    // Oferty sprzedane zostaja pod tym samym adresem — nie chcemy ich w bazie.
    if (html.includes("Oferta zakończona") || html.includes("ZAREZERWOWANY")) return null;

    const d = vehicleData(html);
    const make = field(d, "marka");
    const model = field(d, "model");
    if (!make || !model) return null;

    const price = purchasePrice(html);
    const mileage = field(d, "przebieg");
    const capacity = field(d, "pojemnosc");

    return {
      sourceId: raw.ref.sourceId,
      externalId: raw.ref.externalId,
      url: raw.ref.url,

      vin: parseVin(field(d, "vin")),
      make: normalizeMake(make),
      model: normalizeModel(model) ?? titleCase(model),
      trim: null,

      year: parseYear(field(d, "rokprodukcji")),
      mileageKm: parseInteger(mileage?.replace(/[\s ]/g, "")),
      priceGross: price.gross ? price.value : null,
      priceNet: price.gross ? null : price.value,

      fuel: parseFuel(field(d, "paliwo")),
      gearbox: parseGearbox(field(d, "skrzyniabiegow")),
      drive: parseDrive(field(d, "rodzajnapedu")),
      powerHp: parseInteger(field(d, "mocsilnika")),
      engineCcm: parseInteger(capacity?.replace(/[\s ]/g, "")),
      body: field(d, "segment"),
      color: field(d, "kolor"),
      seats: null,
      city: null,

      thumbnailUrl: largestPhoto(html, BASE),
      seller: "Carefleet",
    };
  },
};
