import type { ListingRef, NormalizedListing, RawListing } from "@auta/core";
import {
  normalizeMake,
  parseDrive,
  parseFuel,
  parseGearbox,
  parseInteger,
  parseVin,
  parseYear,
  slugify,
  titleCase,
} from "@auta/core";
import { extractNextPageProps, fetchText } from "../http";
import type { SourceAdapter } from "../types";

const BASE = "https://store.vwfs.pl";
const PER_PAGE = 100;

/**
 * Volkswagen Financial Services. Listing to Next.js (Pages Router) z pelnym
 * stanem w __NEXT_DATA__ — paginacja parametrami po polsku: ?strona=N.
 * Sitemapy celowo NIE uzywamy: wystawia glownie oferty "w przygotowaniu",
 * ktore maja zerowe ceny i zero zdjec.
 */

interface Localized {
  pl?: string | null;
  en?: string | null;
}

interface Tail {
  auctionId: number;
  make: string;
  model: string;
  type: string | null;
  year: number | null;
  mileage: number | null;
  engineCapacity: number | null;
  powerHP: number | null;
  seatsCount: number | null;
  fuelType: Localized | null;
  gearBoxType: Localized | null;
  bodyType: Localized | null;
  drivetrain: string | null;
  totalPriceBrutto: number | null;
  totalPriceNetto: number | null;
  isSold: boolean;
  inPreparation: boolean;
  mainPhotoUrl: {
    thumbnailReference?: string | null;
    bigThumbnailReference?: string | null;
    fullSizeReference?: string | null;
  } | null;
}

interface OffersBlock {
  count: number;
  page: number;
  resultsPerPage: number;
  tails: Tail[];
}

interface Details {
  vin: string | null;
  color: Localized | null;
  /**
   * Cena gotowkowa. Bywa WYZSZA niz totalPriceBrutto, bo VWFS dolicza
   * amountOfIncreaseCashPrice przy platnosci bez finansowania — eksponowana
   * cena zaklada rate. Do porownan miedzy portalami liczy sie ta gotowkowa.
   */
  finalTotalPriceBruttoForCash: number | null;
  finalTotalPriceNettoForCash: number | null;
  totalPriceBrutto: number | null;
  totalPriceNetto: number | null;
}

function offerUrl(t: Pick<Tail, "auctionId" | "make" | "model">): string {
  return `${BASE}/oferta/${slugify(t.make)}-${slugify(t.model)}-id-${t.auctionId}`;
}

export const vwfs: SourceAdapter = {
  id: "vwfs",
  name: "VW FS Store (Volkswagen Financial Services)",
  baseUrl: BASE,
  strategy: "http",
  delayMs: 1200,
  /** parse() czyta z ref.payload — bez discover nie ma czego odswiezac. */
  needsDiscoveryPayload: true,

  async discover(): Promise<ListingRef[]> {
    const refs: ListingRef[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const html = await fetchText(
        `${BASE}/oferty?strona=${page}&elementowNaStronie=${PER_PAGE}`,
        { delayMs: vwfs.delayMs, timeoutMs: 45_000 },
      );
      const pp = extractNextPageProps<{ offers?: OffersBlock }>(html);
      const offers = pp?.offers;
      if (!offers?.tails) break;

      totalPages = Math.ceil(offers.count / PER_PAGE);

      for (const t of offers.tails) {
        // Sprzedane i "w przygotowaniu" maja cene 0 i brak zdjec — nie marnujemy
        // na nie zadan detalu.
        if (t.isSold || t.inPreparation) continue;
        refs.push({
          sourceId: "vwfs",
          externalId: String(t.auctionId),
          url: offerUrl(t),
          payload: t,
        });
      }
      page++;
    } while (page <= totalPages);

    return refs;
  },

  async fetchDetail(ref: ListingRef): Promise<RawListing> {
    let details: Details | null = null;
    try {
      const html = await fetchText(ref.url, { delayMs: vwfs.delayMs });
      details = extractNextPageProps<{ details?: Details }>(html)?.details ?? null;
    } catch {
      // VIN i cena gotowkowa sa cenne, ale listing sam w sobie juz wystarcza.
      details = null;
    }
    return {
      ref,
      body: JSON.stringify({ list: ref.payload, details }),
      fetchedAt: new Date(),
    };
  },

  parse(raw: RawListing): NormalizedListing | null {
    const { list, details } = JSON.parse(raw.body) as {
      list: Tail | null;
      details: Details | null;
    };
    if (!list?.make || !list.model) return null;

    const cash = parseInteger(details?.finalTotalPriceBruttoForCash);
    const listed = parseInteger(list.totalPriceBrutto);
    const priceGross = cash && cash > 0 ? cash : listed && listed > 0 ? listed : null;

    const cashNet = parseInteger(details?.finalTotalPriceNettoForCash);
    const listedNet = parseInteger(list.totalPriceNetto);
    const priceNet = cashNet && cashNet > 0 ? cashNet : listedNet && listedNet > 0 ? listedNet : null;

    // VWFS zwraca puste stringi zamiast null — pusty src renderowalby zepsute zdjecie.
    const photo =
      [
        list.mainPhotoUrl?.bigThumbnailReference,
        list.mainPhotoUrl?.thumbnailReference,
        list.mainPhotoUrl?.fullSizeReference,
      ].find((u) => typeof u === "string" && u.trim().length > 0) ?? null;

    return {
      sourceId: raw.ref.sourceId,
      externalId: raw.ref.externalId,
      url: raw.ref.url,

      vin: parseVin(details?.vin),
      make: normalizeMake(list.make),
      model: titleCase(list.model),
      trim: list.type?.trim() || null,

      year: parseYear(list.year),
      mileageKm: parseInteger(list.mileage),
      priceGross,
      priceNet,

      fuel: parseFuel(list.fuelType?.pl),
      gearbox: parseGearbox(list.gearBoxType?.pl),
      drive: parseDrive(list.drivetrain),
      powerHp: parseInteger(list.powerHP),
      engineCcm: parseInteger(list.engineCapacity),
      body: list.bodyType?.pl?.trim() || null,
      color: details?.color?.pl?.trim() || null,
      seats: parseInteger(list.seatsCount),
      city: null,

      thumbnailUrl: photo,
    };
  },
};
