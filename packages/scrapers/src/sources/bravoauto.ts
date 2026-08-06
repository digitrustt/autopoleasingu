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
} from "@auta/core";
import { fetchRendered } from "../browser";
import { extractJsonLd, fetchText } from "../http";
import type { SourceAdapter } from "../types";

const BASE = "https://bravoauto.pl";
const LIST = `${BASE}/samochody`;
const MAX_PAGES = 40;

/**
 * Bravoauto (grupa Inchcape) — sieciowy sprzedawca aut uzywanych, w duzej czesci
 * pokontraktowych i poleasingowych.
 *
 * JEDYNE zrodlo w projekcie, ktore naprawde potrzebuje przegladarki — i tylko
 * do discovery. Listing `/samochody` dociaga kafelki po stronie klienta, wiec
 * w surowym HTML-u nie ma ani jednego linku do oferty. Strony ofert sa juz
 * serwerowe, wiec detale chodza zwyklym HTTP.
 *
 * To jest wlasciwy przypadek na `strategy: "browser"` z Fazy 6: serwis nas nie
 * blokuje (robots.txt ma sama sitemape, zero Disallow) — po prostu renderuje
 * liste JS-em. Kosztuje to ~18 renderow na przebieg zamiast ~500.
 *
 * Sitemapa jest bezuzyteczna: ma trzy wpisy (strona glowna i listing), zadnej oferty.
 *
 * Strona oferty niesie komplet w JSON-LD `OfferForPurchase` -> `Car`, z VIN-em
 * wlacznie, wiec nie parsujemy DOM-u w ogole.
 */

interface Quantity {
  value?: string | number | null;
}

interface CarLd {
  "@type"?: string;
  name?: string | null;
  brand?: { name?: string | null } | null;
  model?: string | null;
  vehicleConfiguration?: string | null;
  vehicleIdentificationNumber?: string | null;
  productionDate?: number | string | null;
  vehicleModelDate?: number | string | null;
  mileageFromOdometer?: Quantity | null;
  bodyType?: string | null;
  color?: string | null;
  fuelType?: string | null;
  vehicleTransmission?: string | null;
  driveWheelConfiguration?: string | null;
  seatingCapacity?: number | null;
  image?: string | null;
  itemCondition?: string | null;
  offers?: { price?: number | string | null } | null;
  vehicleEngine?: {
    engineDisplacement?: number | string | null;
    enginePower?: number | string | null;
  } | null;
}

interface OfferLd {
  "@type"?: string;
  price?: number | string | null;
  image?: string | null;
  itemOffered?: CarLd | null;
  availableAtOrFrom?: { address?: { addressLocality?: string | null } | null } | null;
}

/** Wyluskuje blok OfferForPurchase z tablic JSON-LD, ktore serwis zagniezdza. */
function findOffer(html: string): OfferLd | null {
  for (const block of extractJsonLd(html)) {
    for (const node of Array.isArray(block) ? block : [block]) {
      const o = node as OfferLd;
      if (o?.["@type"] === "OfferForPurchase" && o.itemOffered) return o;
    }
  }
  return null;
}

export const bravoauto: SourceAdapter = {
  id: "bravoauto",
  name: "Bravoauto (Inchcape)",
  baseUrl: BASE,
  strategy: "browser",
  delayMs: 1200,
  // Render kosztuje wiecej niz fetch, wiec nie przechodzimy listy co przebieg.
  discoverEveryMinutes: 60,

  async discover(): Promise<ListingRef[]> {
    const seen = new Map<string, ListingRef>();
    let emptyStreak = 0;

    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = page === 1 ? LIST : `${LIST}?page=${page}`;
      const html = await fetchRendered(url, { settleMs: 6000, timeoutMs: 60_000 });

      let fresh = 0;
      // /samochody/bmw-218-2022-104073 — koncowa liczba to id oferty.
      for (const m of html.matchAll(/href="(\/samochody\/([a-z0-9-]+-(\d+)))"/g)) {
        const [, href, , id] = m;
        if (seen.has(id)) continue;
        seen.set(id, { sourceId: "bravoauto", externalId: id, url: `${BASE}${href}` });
        fresh++;
      }

      // Patrz cararena: pojedyncza strona bez nowosci nie oznacza konca listy.
      emptyStreak = fresh === 0 ? emptyStreak + 1 : 0;
      if (emptyStreak >= 3) break;
    }

    return [...seen.values()];
  },

  // Strona oferty jest serwerowa — tutaj przegladarka jest juz niepotrzebna.
  async fetchDetail(ref: ListingRef): Promise<RawListing> {
    const body = await fetchText(ref.url, { delayMs: bravoauto.delayMs, timeoutMs: 45_000 });
    return { ref, body, fetchedAt: new Date() };
  },

  parse(raw: RawListing): NormalizedListing | null {
    const offer = findOffer(raw.body);
    const car = offer?.itemOffered;
    if (!car?.brand?.name || !car.model) return null;

    // Serwis prowadzi tez sprzedaz aut nowych — te zaburzylyby wycene rynkowa.
    if (car.itemCondition && !/used/i.test(car.itemCondition)) return null;

    const engine = car.vehicleEngine;

    return {
      sourceId: raw.ref.sourceId,
      externalId: raw.ref.externalId,
      url: raw.ref.url,

      vin: parseVin(car.vehicleIdentificationNumber),
      make: normalizeMake(car.brand.name),
      model: normalizeModel(String(car.model)) ?? String(car.model),
      trim: car.vehicleConfiguration?.trim() || null,

      year: parseYear(car.productionDate) ?? parseYear(car.vehicleModelDate),
      mileageKm: parseInteger(car.mileageFromOdometer?.value),
      priceGross: parseInteger(car.offers?.price ?? offer?.price),
      priceNet: null,

      fuel: parseFuel(car.fuelType),
      gearbox: parseGearbox(car.vehicleTransmission),
      drive: parseDrive(car.driveWheelConfiguration),
      powerHp: parseInteger(engine?.enginePower),
      engineCcm: parseInteger(engine?.engineDisplacement),
      body: car.bodyType?.trim() || null,
      color: car.color?.trim() || null,
      seats: parseInteger(car.seatingCapacity),
      // "Wrocław, Polska" — zostawiamy samo miasto.
      city: offer?.availableAtOrFrom?.address?.addressLocality?.split(",")[0]?.trim() || null,

      thumbnailUrl: car.image ?? offer?.image ?? null,
      seller: "Bravoauto",
    };
  },
};
