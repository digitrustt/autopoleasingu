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
  stripMakeModel,
} from "@auta/core";
import { fetchJson } from "../http";
import type { SourceAdapter } from "../types";

/**
 * VTP (Vehicle Trading Platform) — wspolna wyszukiwarka stocku grupy VW,
 * uzywana przez SEAT i CUPRA. Jeden kod, dwa adaptery: roznia sie wylacznie
 * kodem rynku, naglowkiem x-pattern i adresem sklepu.
 *
 * Škoda ma wlasny, prostszy stock (patrz skoda.ts), a VW PL kieruje do
 * niemieckiego VTP — dlatego tutaj sa tylko te dwie marki.
 *
 * DWIE PULAPKI, obie kosztowaly po kilkanascie prob:
 *
 * 1. **Filtry ida jako parametry MACIERZOWE, nie query.** `search/car;t_model=X`
 *    dziala, `search/car?t_model=X` jest po cichu ignorowane — API oddaje wtedy
 *    pelna liste i wyglada to na dzialajacy filtr, dopoki nie sprawdzi sie
 *    `selectedItems` w odpowiedzi.
 * 2. **Nie ma paginacji.** Endpoint ZAWSZE zwraca 10 pierwszych aut i ignoruje
 *    kazdy znany parametr stronicowania (start/offset/page/rows/limit...).
 *    Jedyna droga do kompletu to partycjonowanie filtrami: odpytujemy per
 *    dealer (t_partner), a gdy dealer ma wiecej niz 10 sztuk — schodzimy pietro
 *    nizej i tniemy jego pule po modelu (t_model). Odpowiedz sama podaje liczby
 *    w `possibleItems`, wiec wiadomo z gory, ktore kubelki wymagaja podzialu.
 */

const API = "https://vtpapi.seat.com/restapi/v1";
/** Zwrot API na jedno zapytanie. Stala serwisu, nie do zmiany parametrem. */
const PAGE_CAP = 10;

interface CriteriaItem {
  key: string;
  number?: number;
}

interface Criteria {
  criteria: { key: string };
  selectedItems?: CriteriaItem[];
  possibleItems?: CriteriaItem[];
}

interface VtpItem {
  key: string;
  value?: string;
  values?: unknown;
}

interface VtpCar {
  key: string;
  carid: string;
  items?: VtpItem[];
  images?: {
    key: string;
    imageGroup?: { images?: { image?: { href?: string | null } | null }[] | null } | null;
  }[] | null;
  hypermediadealer?: { dealer?: { items?: VtpItem[] } | null } | null;
}

interface VtpResponse {
  criteria?: { search?: { criterias?: Criteria[] } | null } | null;
  results?: { result?: { cars?: { car: VtpCar }[] } | null } | null;
}

export interface VtpConfig {
  id: string;
  name: string;
  /** Kod rynku i typu stocku, np. "stplgwb" = SEAT PL gebrauchtwagen. */
  stockType: string;
  /** Wartosc naglowka x-pattern; bez niej API oddaje 403. */
  pattern: string;
  /** Publiczna witryna marki — Origin/Referer oraz baza adresow ofert. */
  site: string;
  /** Sciezka listy ofert na witrynie; adres oferty budujemy z jej parametrem. */
  offerPath: string;
  /** Marka do wpisania w bazie. Stock jest dedykowany marce, wiec jest stala. */
  make: string;
}

function headers(cfg: VtpConfig): Record<string, string> {
  return {
    "x-pattern": cfg.pattern,
    Origin: cfg.site,
    Referer: `${cfg.site}/`,
  };
}

/** Buduje adres z parametrami macierzowymi: `search/car;t_partner=X;t_model=Y`. */
function searchUrl(cfg: VtpConfig, filters: Record<string, string> = {}): string {
  const matrix = Object.entries(filters)
    .map(([k, v]) => `;${k}=${encodeURIComponent(v)}`)
    .join("");
  return `${API}/${cfg.stockType}/search/car${matrix}`;
}

function criteria(res: VtpResponse, key: string): CriteriaItem[] {
  return (
    res.criteria?.search?.criterias?.find((c) => c.criteria.key === key)?.possibleItems ?? []
  );
}

function itemValue(items: VtpItem[] | undefined, key: string): string | null {
  const v = items?.find((i) => i.key === key)?.value;
  return typeof v === "string" ? v.trim() || null : null;
}

interface VtpNested {
  key?: string;
  value?: string;
  values?: VtpNested[];
}

/**
 * Pola zagniezdzone. Sciezka bywa dwupoziomowa: motor[capacity] siedzi plytko,
 * ale kolor to color -> exterior -> generic.
 */
function nested(items: VtpItem[] | undefined, group: string, ...path: string[]): string | null {
  let level = items?.find((i) => i.key === group)?.values;
  let value: string | null = null;

  for (const step of path) {
    if (!Array.isArray(level)) return null;
    const hit = (level as VtpNested[]).find((e) => e?.key === step);
    if (!hit) return null;
    value = typeof hit.value === "string" ? hit.value : null;
    level = hit.values;
  }
  return value?.trim() || null;
}

async function search(cfg: VtpConfig, filters: Record<string, string>): Promise<VtpResponse> {
  return fetchJson<VtpResponse>(searchUrl(cfg, filters), {
    delayMs: 1200,
    timeoutMs: 45_000,
    headers: headers(cfg),
  });
}

function collect(cfg: VtpConfig, res: VtpResponse, into: Map<string, ListingRef>): number {
  let fresh = 0;
  for (const wrapper of res.results?.result?.cars ?? []) {
    const car = wrapper.car;
    if (!car?.carid || into.has(car.carid)) continue;
    into.set(car.carid, {
      sourceId: cfg.id,
      externalId: car.carid,
      url: `${cfg.site}${cfg.offerPath}${encodeURIComponent(car.key)}`,
      payload: car,
    });
    fresh++;
  }
  return fresh;
}

export function makeVtpAdapter(cfg: VtpConfig): SourceAdapter {
  return {
    id: cfg.id,
    name: cfg.name,
    baseUrl: cfg.site,
    strategy: "http",
    delayMs: 1200,
    /** parse() czyta z ref.payload — bez discover nie ma czego odswiezac. */
    needsDiscoveryPayload: true,

    async discover(): Promise<ListingRef[]> {
      const seen = new Map<string, ListingRef>();

      const base = await search(cfg, {});
      collect(cfg, base, seen);

      for (const dealer of criteria(base, "t_partner")) {
        const perDealer = await search(cfg, { t_partner: dealer.key });
        collect(cfg, perDealer, seen);

        // Dealer miesci sie w jednej odpowiedzi — nie ma czego dzielic.
        if ((dealer.number ?? 0) <= PAGE_CAP) continue;

        for (const model of criteria(perDealer, "t_model")) {
          const bucket = await search(cfg, { t_partner: dealer.key, t_model: model.key });
          collect(cfg, bucket, seen);
        }
      }

      return [...seen.values()];
    },

    // Listing niesie komplet — osobny detal nie dodaje ani jednego pola.
    async fetchDetail(ref: ListingRef): Promise<RawListing> {
      return { ref, body: JSON.stringify(ref.payload), fetchedAt: new Date() };
    },

    parse(raw: RawListing): NormalizedListing | null {
      const car = JSON.parse(raw.body) as VtpCar | null;
      const items = car?.items;
      const model = itemValue(items, "model");
      if (!model) return null;

      /*
       * VIN-u to API nie podaje w ogole — ani na liscie, ani w szczegolach.
       * Dedup miedzyportalowy oprze sie tu na fingerprincie i pHashu zdjec.
       */
      const price = nested(items, "prices", "sale");

      const dealerItems = car?.hypermediadealer?.dealer?.items;
      const photo = car?.images?.[0]?.imageGroup?.images?.[0]?.image?.href ?? null;

      const make = normalizeMake(itemValue(items, "manuf") ?? cfg.make);

      /*
       * "cartitle" to zwykle "CUPRA Formentor", czyli marka + model, ktore mamy
       * juz osobno. Za wersje robi dopiero to, co zostaje po ich odcieciu —
       * inaczej trim dublowalby model przy kazdej ofercie.
       */
      const trim = stripMakeModel(itemValue(items, "cartitle"), make, model);

      return {
        sourceId: raw.ref.sourceId,
        externalId: raw.ref.externalId,
        url: raw.ref.url,

        vin: parseVin(itemValue(items, "vin")),
        firstRegistrationAt: parseRegistrationDate(itemValue(items, "initialreg")),
        make,
        model: normalizeModel(model) ?? model,
        trim,

        // initialreg to pelna data ISO; rocznik modelowy jest zapasem.
        year:
          parseYear(itemValue(items, "initialreg")?.slice(0, 4)) ??
          parseYear(itemValue(items, "modelyear")),
        mileageKm: parseInteger(itemValue(items, "mileage")?.replace(/[\s ]/g, "")),
        priceGross: parseInteger(price?.replace(/[\s ]/g, "")),
        priceNet: null,

        fuel: parseFuel(nested(items, "motor", "fuel")),
        gearbox: parseGearbox(itemValue(items, "gear")),
        drive: parseDrive(itemValue(items, "drive")),
        powerHp: parseInteger(nested(items, "motor", "power.ps")),
        engineCcm: parseInteger(nested(items, "motor", "capacity")?.replace(/[\s ]/g, "")),
        body: null,
        color: nested(items, "color", "exterior", "generic"),
        seats: null,
        city: itemValue(dealerItems, "city"),

        thumbnailUrl: photo,
      };
    },
  };
}

export const seat = makeVtpAdapter({
  id: "seat",
  name: "SEAT Das WeltAuto",
  stockType: "stplgwb",
  pattern: "seatwebfe",
  site: "https://www.seat.pl",
  offerPath: "/oferta/auta-od-reki/szczegoly?car=",
  make: "Seat",
});

export const cupra = makeVtpAdapter({
  id: "cupra",
  name: "CUPRA Approved",
  stockType: "cuplgwb",
  pattern: "cuprawebfe",
  site: "https://www.cupraofficial.pl",
  offerPath: "/oferta/cupra-approved/szczegoly?car=",
  make: "Cupra",
});
