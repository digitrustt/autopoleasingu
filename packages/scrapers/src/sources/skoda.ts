import type { ListingRef, NormalizedListing, RawListing } from "@auta/core";
import {
  parseDrive,
  parseFuel,
  parseGearbox,
  parseInteger,
  parseRegistrationDate,
  parseVin,
  parseYear,
} from "@auta/core";
import { fetchJson } from "../http";
import type { SourceAdapter } from "../types";

const SITE = "https://www.skoda.pl";
const API = `${SITE}/apps/stock/456/pl-PL/api/search`;

/**
 * Škoda Plus (certyfikowane uzywane).
 *
 * Endpoint znaleziony przez podsluchanie ruchu ich wlasnej aplikacji stocku
 * (packages/scrapers/src/browser.ts, captureJson) — okazal sie zwyklym GET-em,
 * wiec Playwright jest tu niepotrzebny. robots.txt skoda.pl ma puste
 * "Disallow:", czyli zezwala na wszystko.
 *
 * CarType=U to auta uzywane (N byloby nowe). 943 pozycje, 12 na strone.
 */

interface Money {
  value?: number | null;
  unit?: string | null;
}

interface SkodaCar {
  id: string;
  vin?: string | null;
  brand?: string | null;
  model?: string | null;
  title?: string | null;
  subTitle?: string | null;
  bodyworkName?: string | null;
  modelYear?: number | null;
  initialReg?: string | null;
  salePrice?: Money | null;
  mileage?: { value?: string | number | null } | null;
  image?: string | null;
  colors?: { exterior?: { text?: string | null } | null } | null;
  dealer?: { city?: string | null } | null;
  technicalData?: {
    capacity?: { value?: string | number | null } | null;
    fuel?: string | null;
    gear?: string | null;
    drive?: string | null;
    engineName?: string | null;
  } | null;
}

interface SearchResponse {
  results?: {
    cars?: SkodaCar[];
    pageInfo?: { pageNo?: number; pageCount?: number; resultsCount?: number };
  };
}

export const skoda: SourceAdapter = {
  id: "skoda",
  name: "Škoda Plus",
  baseUrl: SITE,
  strategy: "http",
  delayMs: 1200,
  /** parse() czyta z ref.payload — bez discover nie ma czego odswiezac. */
  needsDiscoveryPayload: true,
  /** Discover kosztuje dziesiatki zadan — miedzy przelotami odswiezamy znane oferty. */
  discoverEveryMinutes: 30,

  async discover(): Promise<ListingRef[]> {
    const seen = new Map<string, ListingRef>();
    let pageCount = 1;

    for (let page = 1; page <= pageCount && page <= 200; page++) {
      const res = await fetchJson<SearchResponse>(
        `${API}?CarType=U&PageNo=${page}&SortDirection=1&SortKey=DATE_OFFER`,
        { delayMs: skoda.delayMs, timeoutMs: 45_000 },
      );
      const cars = res.results?.cars ?? [];
      if (cars.length === 0) break;

      pageCount = res.results?.pageInfo?.pageCount ?? pageCount;

      for (const car of cars) {
        if (!car.id || seen.has(car.id)) continue;
        seen.set(car.id, {
          sourceId: "skoda",
          externalId: car.id,
          url: `${SITE}/apps/stock/carDetail/${car.id}?CarType=U`,
          payload: car,
        });
      }
    }
    return [...seen.values()];
  },

  // Listing niesie komplet z VIN-em wlacznie — detal nic nie dodaje.
  async fetchDetail(ref: ListingRef): Promise<RawListing> {
    return { ref, body: JSON.stringify(ref.payload), fetchedAt: new Date() };
  },

  parse(raw: RawListing): NormalizedListing | null {
    const c = JSON.parse(raw.body) as SkodaCar | null;
    if (!c?.model) return null;

    const td = c.technicalData;

    /*
     * technicalData.motor podaje bzdure (14 przy 110 kW), ale engineName niesie
     * poprawna moc: "1,5 TSI m-HEV (150 KM) 110 kW".
     */
    const hp = td?.engineName?.match(/\((\d+)\s*KM\)/i)?.[1];

    // Dla auta uzywanego liczy sie rok pierwszej rejestracji, nie rocznik modelowy.
    const regYear = c.initialReg ? Number(c.initialReg.slice(0, 4)) : null;

    return {
      sourceId: raw.ref.sourceId,
      externalId: raw.ref.externalId,
      url: raw.ref.url,

      vin: parseVin(c.vin),
      firstRegistrationAt: parseRegistrationDate(c.initialReg),
      // Endpoint jest dedykowany dealerom Škody — w calej probce brand="BI" (kod Škody).
      make: "Skoda",
      model: c.model.trim(),
      trim: c.subTitle?.trim() || c.title?.trim() || null,

      year: parseYear(regYear) ?? parseYear(c.modelYear),
      mileageKm: parseInteger(String(c.mileage?.value ?? "").replace(/[\s ]/g, "")),
      priceGross: parseInteger(c.salePrice?.value),
      priceNet: null,

      fuel: parseFuel(td?.fuel),
      gearbox: parseGearbox(td?.gear),
      drive: parseDrive(td?.drive),
      powerHp: parseInteger(hp),
      engineCcm: parseInteger(String(td?.capacity?.value ?? "").replace(/[\s ]/g, "")),
      body: c.bodyworkName?.trim() || null,
      color: c.colors?.exterior?.text?.trim() || null,
      seats: null,
      city: c.dealer?.city?.trim() || null,

      thumbnailUrl: c.image ?? null,
    };
  },
};
