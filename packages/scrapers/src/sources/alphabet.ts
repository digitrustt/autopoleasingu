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
  stripMakeModel,
  titleCase,
} from "@auta/core";
import { fetchJson } from "../http";
import type { SourceAdapter } from "../types";

const SITE = "https://poleasingowe.alphabet.pl";
const API = "https://poleasingowe-api.alphabet.pl";
const FILES = "https://stock-fileservice.alphabet.pl/api/Files";

/**
 * Alphabet (grupa BMW) wystawia publiczne JSON API stojace pod Angularowym SPA.
 * Jeden POST na /CarsRetail zwraca komplet ofert detalicznych wraz z przebiegiem,
 * moca i zdjeciem — dlatego caly listing jedzie w discover(), a fetchDetail()
 * dobiera juz tylko VIN i miasto z /Car.
 */

interface RetailCar {
  carId: number;
  makeDescription: string;
  modelDescription: string;
  shortDescription: string | null;
  retailerPrice: number | null;
  mileage: number | null;
  year: number | null;
  capacity: number | null;
  power: number | null;
  engineType: string | null;
  gearBox: string | null;
  drive: string | null;
  seats: string | number | null;
  firstPhoto: string | null;
}

interface CarDetail {
  carId: number;
  vin: string | null;
  city: string | null;
  registrationNumber: string | null;
  registrationDate: string | null;
}

interface CarsRetailResponse {
  count: number;
  result: RetailCar[];
}

/** Trasa Angulara: uzywane/oferta/:id/:desc. Slug jest kosmetyczny — liczy sie :id. */
function offerUrl(car: RetailCar): string {
  const desc = slugify(car.shortDescription ?? `${car.makeDescription} ${car.modelDescription}`);
  return `${SITE}/uzywane/oferta/${car.carId}/${desc}`;
}

export const alphabet: SourceAdapter = {
  id: "alphabet",
  name: "Alphabet Poleasingowe (BMW Group)",
  baseUrl: SITE,
  strategy: "http",
  delayMs: 1200,
  /** parse() czyta z ref.payload — bez discover nie ma czego odswiezac. */
  needsDiscoveryPayload: true,

  async discover(): Promise<ListingRef[]> {
    // Take celowo z zapasem — przy ~223 ofertach jedno zadanie wystarcza.
    const res = await fetchJson<CarsRetailResponse>(`${API}/CarsRetail`, {
      method: "POST",
      body: { FilterData: [], SortingData: [], Skip: 0, Take: 2000 },
      delayMs: 0,
      timeoutMs: 60_000,
    });

    return res.result.map((car) => ({
      sourceId: "alphabet",
      externalId: String(car.carId),
      url: offerUrl(car),
      payload: car,
    }));
  },

  async fetchDetail(ref: ListingRef): Promise<RawListing> {
    let detail: CarDetail | null = null;
    try {
      detail = await fetchJson<CarDetail>(`${API}/Car?id=${ref.externalId}`, {
        delayMs: alphabet.delayMs,
      });
    } catch {
      // VIN i miasto sa mile widziane, ale nie krytyczne — reszte mamy z listingu.
      detail = null;
    }
    return {
      ref,
      body: JSON.stringify({ list: ref.payload, detail }),
      fetchedAt: new Date(),
    };
  },

  parse(raw: RawListing): NormalizedListing | null {
    const { list, detail } = JSON.parse(raw.body) as {
      list: RetailCar | null;
      detail: CarDetail | null;
    };
    if (!list?.makeDescription || !list.modelDescription) return null;

    const make = normalizeMake(list.makeDescription);
    const model = titleCase(list.modelDescription);

    return {
      sourceId: raw.ref.sourceId,
      externalId: raw.ref.externalId,
      url: raw.ref.url,

      vin: parseVin(detail?.vin),
      make,
      model,
      trim: stripMakeModel(list.shortDescription, list.makeDescription, list.modelDescription),

      year: parseYear(list.year),
      mileageKm: parseInteger(list.mileage),
      priceGross: parseInteger(list.retailerPrice),
      priceNet: null,

      fuel: parseFuel(list.engineType),
      gearbox: parseGearbox(list.gearBox),
      drive: parseDrive(list.drive),
      powerHp: parseInteger(list.power),
      engineCcm: parseInteger(list.capacity),
      body: null,
      color: null,
      seats: parseInteger(list.seats),
      city: detail?.city?.trim() || null,

      thumbnailUrl: list.firstPhoto
        ? `${FILES}/GetImage?name=${encodeURIComponent(list.firstPhoto.trim())}`
        : null,
    };
  },
};
