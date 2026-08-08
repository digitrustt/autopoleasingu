import type { ListingRef, NormalizedListing, RawListing } from "@auta/core";
import {
  normalizeMake,
  normalizeModel,
  parseFuel,
  parseGearbox,
  parseInteger,
  parseVin,
  parseYear,
} from "@auta/core";
import { decodeEntities, extractJsonLd, fetchText } from "../http";
import type { SourceAdapter } from "../types";

const BASE = "https://uzywane.renault.pl";

/*
 * robots.txt zabrania WYLACZNIE "/*?CurrentSearchModel" — czyli formularza
 * filtrow. Paginacja przez SortBy + PageIndex jest poza ta regula i sprawdzona:
 * strony 0/1/2 zwracaja rozlaczne zbiory po 12 ofert. Sortowanie po cenie daje
 * stabilna kolejnosc, wiec nowe oferty nie przesuwaja listy w trakcie zaciagu.
 */
const LIST = `${BASE}/wyszukiwarkauzywane?SortBy=Price%7CASC&PageIndex=`;
const MAX_PAGES = 200;

/**
 * Renault Selection — portal aut uzywanych dealerow Grupy Renault. Wbrew nazwie
 * ma tez auta innych marek przyjete w rozliczeniu (Audi, Hyundai, Citroen),
 * dlatego marke bierzemy z danych oferty, a nie z domeny.
 *
 * Detal wystawia komplet w JSON-LD @type=Car. Blok jest domkniety nadmiarowym
 * "}};", ale extractJsonLd radzi sobie z takim ogonem (patrz http.ts).
 */

interface QuantitativeValue {
  value?: string | number | null;
}

interface PropertyValue {
  name?: string | null;
  value?: string | number | null;
}

interface CarLd {
  "@type"?: string;
  name?: string | null;
  image?: string | null;
  brand?: { name?: string | null } | null;
  category?: string | null;
  fuelType?: string | null;
  numberOfDoors?: string | number | null;
  vehicleEngine?: { engineDisplacement?: QuantitativeValue | null } | null;
  productionDate?: string | number | null;
  vehicleTransmission?: string | null;
  color?: string | null;
  mileageFromOdometer?: QuantitativeValue | null;
  additionalProperty?: PropertyValue[] | null;
  offers?: { price?: string | number | null; seller?: { name?: string | null } | null } | null;
}

/** Serwis wstawia encje HTML w wartosci JSON-a ("skrzynia bieg&#243;w"). */
function decode(v: string | null | undefined): string | null {
  if (!v) return null;
  return (
    v
      .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
      .replace(/&amp;/g, "&")
      .replace(/&lt;br&gt;/g, " ")
      .replace(/\s+/g, " ")
      .trim() || null
  );
}

function prop(car: CarLd, name: string): string | null {
  const hit = car.additionalProperty?.find((p) => decode(p.name)?.toLowerCase() === name);
  return hit?.value == null ? null : String(hit.value);
}

export const renault: SourceAdapter = {
  id: "renault",
  name: "Renault Selection",
  baseUrl: BASE,
  strategy: "http",
  delayMs: 1200,
  discoverEveryMinutes: 60,

  async discover(): Promise<ListingRef[]> {
    const seen = new Map<string, ListingRef>();
    let emptyStreak = 0;

    for (let page = 0; page < MAX_PAGES; page++) {
      const html = await fetchText(`${LIST}${page}`, {
        delayMs: renault.delayMs,
        timeoutMs: 45_000,
      });

      let fresh = 0;
      // /wyszukiwarkaszczegoly/{marka}/{model}/{rocznik}/{id}
      for (const m of html.matchAll(/\/wyszukiwarkaszczegoly\/[^"'\s]+?\/(\d+)(?=["'\s])/g)) {
        const id = m[1];
        if (seen.has(id)) continue;
        seen.set(id, { sourceId: "renault", externalId: id, url: `${BASE}${decodeEntities(m[0])}` });
        fresh++;
      }

      emptyStreak = fresh === 0 ? emptyStreak + 1 : 0;
      if (emptyStreak >= 3) break;
    }

    return [...seen.values()];
  },

  async fetchDetail(ref: ListingRef): Promise<RawListing> {
    const body = await fetchText(ref.url, { delayMs: renault.delayMs });
    return { ref, body, fetchedAt: new Date() };
  },

  parse(raw: RawListing): NormalizedListing | null {
    const car = extractJsonLd(raw.body).find(
      (d): d is CarLd => (d as CarLd)?.["@type"] === "Car",
    );
    if (!car?.name) return null;

    const make = decode(car.brand?.name);
    if (!make) return null;

    // "name" to "Audi A4" — model zostaje po odjeciu marki.
    const full = decode(car.name) ?? "";
    const model = full.toLowerCase().startsWith(make.toLowerCase())
      ? full.slice(make.length).trim()
      : full;
    if (!model) return null;

    const price = parseInteger(car.offers?.price);

    return {
      sourceId: raw.ref.sourceId,
      externalId: raw.ref.externalId,
      url: raw.ref.url,

      vin: parseVin(prop(car, "vin")),
      make: normalizeMake(make),
      model: normalizeModel(model) ?? model,
      trim: null,

      year: parseYear(car.productionDate),
      mileageKm: parseInteger(car.mileageFromOdometer?.value),
      // Dealerzy podaja cene brutto — patrz "Cena brutto" przy kwocie na stronie.
      priceGross: price,
      priceNet: null,

      fuel: parseFuel(decode(car.fuelType)),
      gearbox: parseGearbox(decode(car.vehicleTransmission)),
      drive: null,
      powerHp: parseInteger(prop(car, "konie mechaniczne")),
      engineCcm: parseInteger(car.vehicleEngine?.engineDisplacement?.value),
      body: decode(car.category),
      color: decode(car.color),
      seats: null,
      city: null,

      thumbnailUrl: car.image ?? null,
      // Portal zrzesza dealerow — warto wiedziec, u kogo auto stoi.
      seller: decode(car.offers?.seller?.name),
    };
  },
};
