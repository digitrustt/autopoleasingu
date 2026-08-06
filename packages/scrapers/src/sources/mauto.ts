import type { ListingRef, NormalizedListing, RawListing } from "@auta/core";
import {
  normalizeMake,
  normalizeModel,
  parseFuel,
  parseGearbox,
  parseInteger,
  parseYear,
  slugify,
} from "@auta/core";
import { fetchJson } from "../http";
import type { SourceAdapter } from "../types";

const SITE = "https://mauto.pl";
const API = "https://as-mleasing-mauto-api-prod.azurewebsites.net/api";

/**
 * mAuto.pl — poleasingowe mLeasingu (grupa mBanku).
 *
 * Endpoint znaleziony przez `pnpm --filter @auta/worker sniff`. Cala oferta
 * miesci sie w JEDNYM POST-cie: ResultsPerPage=10000 oddaje komplet 615 aut,
 * wiec zrodlo kosztuje jedno zapytanie zamiast dziesiatek stron.
 *
 * robots.txt mauto.pl to "Allow:/", a host API nie ma robots.txt (404).
 *
 * UWAGA na pulapke rat: LeasePrice (1080) i RentPriceNetto to miesieczne raty,
 * NIE cena auta. Cena gotowkowa to TotalPrice/FinalPrice.
 */

/** Status "Poleasingowy" odsiewa nowe i "perfect" (demo) — chcemy tylko poleasing. */
const FILTER = {
  MakesAndModels: [],
  Status: ["Poleasingowy"],
  ResultsPerPage: 10_000,
  SortType: 0,
};

interface Tail {
  AuctionId: number;
  MakeModel?: string | null;
  Type?: string | null;
  Year?: string | null;
  Mileage?: number | null;
  PowerHP?: number | null;
  EngineCapacity?: number | null;
  FuelType?: string | null;
  GearBoxType?: string | null;
  FinalPriceBrutto?: number | null;
  FinalPriceNetto?: number | null;
  TotalPriceBrutto?: number | null;
  TotalPriceNetto?: number | null;
  MainPhotoUrl?: string | null;
  IsWebP?: boolean | null;
}

interface OffersResponse {
  Tails?: Tail[];
  Count?: number;
}

/**
 * MakeModel to jeden string ("MERCEDES-BENZ EQB", "ALFA ROMEO GIULIA"), a marki
 * bywaja dwuczlonowe — ciecie po pierwszej spacji dawaloby model "ROMEO GIULIA".
 * Bierzemy wiec liste marek z ich wlasnego filtra i szukamy najdluzszego prefiksu.
 */
let brands: string[] = [];

async function loadBrands(): Promise<string[]> {
  const data = await fetchJson<{ Make?: string }[]>(`${API}/OffersFilterData/MakeAndModels`, {
    delayMs: mauto.delayMs,
  });
  return data
    .map((d) => (d.Make ?? "").toUpperCase())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
}

function splitMakeModel(makeModel: string): { make: string; model: string } | null {
  const s = makeModel.trim().replace(/\s+/g, " ");
  const upper = s.toUpperCase();
  const hit = brands.find((b) => upper === b || upper.startsWith(`${b} `));
  if (!hit) {
    // Nowa marka, jeszcze nieobecna w filtrze — bierzemy pierwszy czlon.
    const [first, ...rest] = s.split(" ");
    return rest.length > 0 ? { make: normalizeMake(first), model: rest.join(" ") } : null;
  }
  const model = s.slice(hit.length).trim();
  return { make: normalizeMake(hit), model: model || hit };
}

export const mauto: SourceAdapter = {
  id: "mauto",
  name: "mAuto.pl (mLeasing)",
  baseUrl: SITE,
  strategy: "http",
  delayMs: 1500,
  /** parse() czyta z ref.payload — bez discover nie ma czego odswiezac. */
  needsDiscoveryPayload: true,
  /** Discover kosztuje dziesiatki zadan — miedzy przelotami odswiezamy znane oferty. */
  discoverEveryMinutes: 30,

  async discover(): Promise<ListingRef[]> {
    brands = await loadBrands();

    const res = await fetchJson<OffersResponse>(`${API}/Offers/AfterLease`, {
      method: "POST",
      body: FILTER,
      delayMs: mauto.delayMs,
      timeoutMs: 120_000,
      headers: { Origin: SITE },
    });

    const tails = res.Tails ?? [];
    return tails
      .filter((t) => t.AuctionId && t.MakeModel)
      .map((t) => ({
        sourceId: "mauto",
        externalId: String(t.AuctionId),
        // Publiczny adres oferty: /samochody-poleasingowe/{slug-marki-modelu}-id-{id}
        url: `${SITE}/samochody-poleasingowe/${slugify(t.MakeModel ?? "")}-id-${t.AuctionId}`,
        payload: t,
      }));
  },

  // Lista niesie komplet — osobny detal nie dolozylby nic poza ruchem.
  async fetchDetail(ref: ListingRef): Promise<RawListing> {
    return { ref, body: JSON.stringify(ref.payload), fetchedAt: new Date() };
  },

  parse(raw: RawListing): NormalizedListing | null {
    const t = JSON.parse(raw.body) as Tail | null;
    if (!t?.MakeModel) return null;

    const mm = splitMakeModel(t.MakeModel);
    if (!mm) return null;

    /*
     * MainPhotoUrl przychodzi z placeholderem "[size]" — serwis wystawia warianty
     * 320 i 640 px. Bierzemy 640 (ostrzejsze na ekranach retina, dalej lekkie),
     * a rozszerzenie zalezy od flagi IsWebP.
     */
    const photo = t.MainPhotoUrl
      ? `${t.MainPhotoUrl.replace("[size]", "640")}${t.IsWebP ? ".webp" : ".jpg"}`
      : null;

    return {
      sourceId: raw.ref.sourceId,
      externalId: raw.ref.externalId,
      url: raw.ref.url,

      vin: null, // API nie podaje VIN-u.
      make: mm.make,
      model: normalizeModel(mm.model) ?? mm.model,
      trim: t.Type?.trim() || null,

      year: parseYear(t.Year),
      mileageKm: parseInteger(t.Mileage),
      priceGross: parseInteger(t.FinalPriceBrutto ?? t.TotalPriceBrutto),
      priceNet: parseInteger(t.FinalPriceNetto ?? t.TotalPriceNetto),

      fuel: parseFuel(t.FuelType),
      gearbox: parseGearbox(t.GearBoxType),
      drive: null,
      powerHp: parseInteger(t.PowerHP),
      // Elektryki maja EngineCapacity=0 — to brak danych, nie silnik zerowej pojemnosci.
      engineCcm: t.EngineCapacity ? parseInteger(t.EngineCapacity) : null,
      body: null,
      color: null,
      seats: null,
      city: null,

      thumbnailUrl: photo,
      seller: "mLeasing",
    };
  },
};
