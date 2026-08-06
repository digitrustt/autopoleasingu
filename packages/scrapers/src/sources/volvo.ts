import type { ListingRef, NormalizedListing, RawListing } from "@auta/core";
import {
  normalizeMake,
  normalizeModel,
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

const SITE = "https://selekt.volvocars.pl";
const API = "https://services.codeweavers.net/api";

/**
 * Volvo Selekt — certyfikowane uzywane Volvo, ~1230 sztuk.
 *
 * Sklep stoi na platformie Codeweavers (services.codeweavers.net), a strona to
 * Angular SPA — listing nie istnieje w HTML-u, wiec jedziemy po tym samym API,
 * o ktore prosi sama strona. Znalezione przez `sniff`.
 *
 * robots.txt selekt.volvocars.pl zezwala na "/*​/vehicles*" (blokuje tylko
 * warianty z filtrami w query, /retailer/ i /print). services.codeweavers.net
 * blokuje wylacznie /forms/ i /navigator/.
 *
 * UWIERZYTELNIENIE: kazde zapytanie wymaga naglowka x-cw-customertoken, a token
 * wydaje POST /guest/initialise/proposal — z publicznym kluczem API wpisanym na
 * stale w bundlu sklepu. Losowy GUID dostaje 401, wiec tokenu nie da sie
 * zmyslic; bierzemy go raz na przebieg i uzywamy do wszystkich stron.
 */

/** Klucz publiczny sklepu, jawny w bundlu Angulara. Nie jest sekretem — identyfikuje witryne. */
const API_KEY = "V8n765hYRgR528iaM5";
/** Referencja sklepu Volvo Selekt PL i jej numer organizacji w Codeweavers. */
const STORE_REF = "032d1107-6159-437f-b567-92050226e7ac";
const ORG_REF = "55389";

const PAGE_SIZE = 24;
const MAX_PAGES = 80;

function headers(token?: string): Record<string, string> {
  return {
    "x-cw-digitalretailstorereference": STORE_REF,
    "x-cw-applicationname": "Storefront",
    "x-cw-accept-language": "pl-pl",
    "x-cw-apikey": `Codeweavers-${API_KEY}`,
    Origin: SITE,
    Referer: `${SITE}/`,
    ...(token ? { "x-cw-customertoken": token } : {}),
  };
}

interface Colour {
  Description?: string | null;
  Value?: string | null;
}

interface VolvoVehicle {
  Reference?: string | null;
  /** Base64 identyfikatora stocku — tego uzywa adres oferty w sklepie. */
  Hash?: string | null;
  Images?: { Url?: string | null }[] | null;
  Physical?: {
    Vin?: string | null;
    Status?: string | null;
    Mileage?: number | null;
    IsReserved?: boolean | null;
    NoLongerAvailable?: boolean | null;
    OnTheRoadPrice?: number | null;
    ExteriorColour?: Colour | null;
    CodeweaversStockIdentifier?: string | null;
    DateOfManufacture?: string | null;
    Registration?: { DateRegisteredWithDvla?: string | null } | null;
  } | null;
  Specification?: {
    OnTheRoadPrice?: number | null;
    Manufacturer?: string | null;
    Model?: string | null;
    Variant?: string | null;
    FuelType?: string | null;
    Transmission?: string | null;
    Drive?: string | null;
    BodyStyle?: string | null;
    EngineSize?: number | null;
    BrakeHorsePower?: number | null;
    Seats?: number | null;
  } | null;
  Retailer?: { Address?: { TownCity?: string | null } | null } | null;
}

interface SearchResponse {
  Groups?: { HeadlineVehicle?: { Vehicle?: VolvoVehicle | null } | null }[] | null;
  TotalPages?: number | null;
  NumberOfMatchingVehiclesAcrossAllGroups?: number | null;
}

/** Token jest wazny w obrebie przebiegu; discover pobiera go raz i podaje dalej. */
async function guestToken(): Promise<string> {
  const res = await fetchJson<Record<string, unknown>>(`${API}/guest/initialise/proposal`, {
    method: "POST",
    delayMs: 0,
    timeoutMs: 30_000,
    headers: headers(),
    body: {
      ApiKey: API_KEY,
      OrganisationIdentifier: { Type: "CodeweaversReference", Value: ORG_REF },
    },
  });

  // Odpowiedz opakowuje token roznie w zaleznosci od wersji API — szukamy po nazwie klucza.
  const stack: unknown[] = [res];
  while (stack.length > 0) {
    const node = stack.pop();
    if (Array.isArray(node)) {
      stack.push(...node);
    } else if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node)) {
        if (typeof v === "string" && /token/i.test(k)) return v;
        if (v && typeof v === "object") stack.push(v);
      }
    }
  }
  throw new Error("Volvo: brak tokenu w odpowiedzi guest/initialise");
}

function searchBody(page: number) {
  return {
    SortBy: "Relevance",
    Page: page,
    ResultsPerPage: PAGE_SIZE,
    IncludeNoFinanceOption: true,
    Filters: {
      Vehicle: { Query: null, IncludeReservedVehicles: false, SelectedFacets: {} },
      DigitalRetailStore: { Page: { Slug: "all" } },
      Location: { Latitude: null, Longitude: null, Distance: null },
    },
    OrganisationIdentifier: { Type: "CodeweaversReference", Value: ORG_REF },
    Intention: "PublicWebsite",
  };
}

export const volvo: SourceAdapter = {
  id: "volvo",
  name: "Volvo Selekt",
  baseUrl: SITE,
  strategy: "http",
  delayMs: 1200,
  /** parse() czyta z ref.payload — bez discover nie ma czego odswiezac. */
  needsDiscoveryPayload: true,
  /** Discover to ~50 zadan — miedzy przelotami odswiezamy oferty juz znane. */
  discoverEveryMinutes: 30,

  async discover(): Promise<ListingRef[]> {
    const token = await guestToken();
    const seen = new Map<string, ListingRef>();

    let totalPages = 1;
    let emptyStreak = 0;

    for (let page = 1; page <= totalPages && page <= MAX_PAGES; page++) {
      const res = await fetchJson<SearchResponse>(`${API}/vehicles/search-with-facets/groups`, {
        method: "POST",
        delayMs: volvo.delayMs,
        timeoutMs: 45_000,
        headers: headers(token),
        body: searchBody(page),
      });

      totalPages = res.TotalPages ?? totalPages;

      let fresh = 0;
      for (const group of res.Groups ?? []) {
        const v = group.HeadlineVehicle?.Vehicle;
        /*
         * Jako externalId bierzemy identyfikator stocku, nie Reference: ten drugi
         * jest przypisywany per wycena i zmienia sie miedzy przebiegami, wiec
         * kazda oferta trafialaby do bazy jako nowa.
         */
        const id = v?.Physical?.CodeweaversStockIdentifier ?? v?.Reference;
        if (!v || !id || seen.has(id)) continue;
        // Sklep adresuje oferty polem Hash (base64 identyfikatora stocku), nie GUID-em.
        const slug = v.Hash ?? id;
        seen.set(id, {
          sourceId: "volvo",
          externalId: id,
          url: `${SITE}/pl-pl/store/all/vehicles/${slug}`,
          payload: v,
        });
        fresh++;
      }
      // Patrz cararena: pojedyncza strona bez nowosci nie oznacza konca listy.
      emptyStreak = fresh === 0 ? emptyStreak + 1 : 0;
      if (emptyStreak >= 3) break;
    }

    return [...seen.values()];
  },

  // Listing niesie komplet z VIN-em wlacznie — detal nic nie dodaje.
  async fetchDetail(ref: ListingRef): Promise<RawListing> {
    return { ref, body: JSON.stringify(ref.payload), fetchedAt: new Date() };
  },

  parse(raw: RawListing): NormalizedListing | null {
    const v = JSON.parse(raw.body) as VolvoVehicle | null;
    const spec = v?.Specification;
    const phys = v?.Physical;
    if (!spec?.Manufacturer || !spec.Model) return null;

    // Sprzedane i zarezerwowane zostaja w API — do bazy ich nie chcemy.
    if (phys?.NoLongerAvailable || phys?.IsReserved) return null;

    /*
     * Sklep miesza uzywane z nowymi (Status: PreOwned vs New). Nowe auto nie ma
     * przebiegu ani historii, wiec zaburzaloby wycene rynkowa uzywanych.
     */
    if (phys?.Status && phys.Status !== "PreOwned") return null;

    // Rok pierwszej rejestracji jest wazniejszy niz data produkcji przy uzywanym.
    const regYear = phys?.Registration?.DateRegisteredWithDvla?.slice(0, 4);

    return {
      sourceId: raw.ref.sourceId,
      externalId: raw.ref.externalId,
      url: raw.ref.url,

      vin: parseVin(phys?.Vin),
      firstRegistrationAt: parseRegistrationDate(phys?.Registration?.DateRegisteredWithDvla),
      make: normalizeMake(spec.Manufacturer),
      model: normalizeModel(spec.Model) ?? spec.Model,
      trim: spec.Variant?.trim() || null,

      year: parseYear(regYear) ?? parseYear(phys?.DateOfManufacture?.slice(0, 4)),
      mileageKm: parseInteger(phys?.Mileage),
      priceGross: parseInteger(spec.OnTheRoadPrice ?? phys?.OnTheRoadPrice),
      priceNet: null,

      fuel: parseFuel(spec.FuelType),
      gearbox: parseGearbox(spec.Transmission),
      drive: parseDrive(spec.Drive),
      powerHp: parseInteger(spec.BrakeHorsePower),
      engineCcm: parseInteger(spec.EngineSize),
      body: spec.BodyStyle?.trim() || null,
      // Description jest po polsku ("Biały"), Value po angielsku ("White").
      color: phys?.ExteriorColour?.Description?.trim() || null,
      seats: parseInteger(spec.Seats),
      city: v?.Retailer?.Address?.TownCity?.trim() || null,

      thumbnailUrl: v?.Images?.[0]?.Url ?? null,
      seller: "Volvo Selekt",
    };
  },
};
