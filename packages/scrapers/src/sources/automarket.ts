import type { ListingRef, NormalizedListing, RawListing } from "@auta/core";
import {
  normalizeMake,
  parseDrive,
  parseFuel,
  parseGearbox,
  parseInteger,
  parseVin,
  parseYear,
} from "@auta/core";
import { extractJsonLd, extractSitemapLocs, fetchText } from "../http";
import type { SourceAdapter } from "../types";

const BASE = "https://automarket.pl";
const SITEMAP = `${BASE}/media/sitemap/sitemap_allcars.xml`;

/** /oferta/{marka}/{model}/{id}/{wariant-finansowania} */
const OFFER_RE = /^https:\/\/automarket\.pl\/oferta\/[^/]+\/[^/]+\/(\d+)\/([a-z-]+)$/;

/**
 * Kazde auto wystawione jest w kilku wariantach finansowania, ale tylko w
 * "zakup" pole offers.price jest cena auta. W pozostalych siedzi tam RATA
 * MIESIECZNA — sprawdzone na Hyundaiu i30 (id 306380), ktory ma oba warianty:
 * /zakup daje 62 850, /pozyczka 1 482. Wrzucenie tego drugiego jako ceny
 * zatrulo by caly model wyceny.
 */
const CASH_VARIANT = "zakup";

/**
 * Wariant zapasowy dla aut, ktorych Automarket NIE sprzedaje za gotowke —
 * dla nich /zakup zwraca 404 (sprawdzone). W sitemapie jest 9431 aut, a tylko
 * 2276 ma wariant gotowkowy; reszta zylaby poza baza.
 *
 * Bierzemy je, ale z priceGross = null, NIGDY z rata. Bez ceny nie da sie ich
 * wycenic, za to widac je w wyszukiwarce i — co wazniejsze — biora udzial
 * w zestawianiu po VIN: ta sama sztuka bywa u innego sprzedawcy z cena "kup
 * teraz", a wtedy dopiero widac, ile naprawde kosztuje.
 */
const FALLBACK_VARIANTS = ["pozyczka", "leasing", "wynajem-dlugoterminowy"];

interface JsonLdCar {
  "@type"?: string;
  brand?: string;
  model?: string;
  description?: string;
  bodyType?: string;
  color?: string;
  countryOfOrigin?: string;
  driveWheelConfiguration?: string;
  vehicleIdentificationNumber?: string;
  vehicleModelDate?: number | string;
  vehicleTransmission?: string;
  vehicleSeatingCapacity?: string | number;
  mileageFromOdometer?: { value?: string | number };
  offers?: { price?: number | string; category?: string; priceCurrency?: string };
  vehicleEngine?: { engineDisplacement?: string; enginePower?: string; fuelType?: string };
  image?: { "@id"?: string };
}

interface JsonLdImage {
  "@type"?: string;
  "@id"?: string;
  url?: string;
  contentUrl?: string;
}

/**
 * Automarket koduje sciezke obrazka base64 i wstrzykuje "/" co 16 znakow.
 * Nie mozna po prostu usunac wszystkich "/", bo alfabet base64 sam go zawiera —
 * kasujemy tylko te na pozycjach separatora.
 */
function unchunk(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "/" && (i + 1) % 17 === 0) continue;
    out += s[i];
  }
  return out;
}

function decodeImageUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  const toUrl = (path: string) => (path.startsWith("/") ? `${BASE}${path}` : `${BASE}/${path}`);

  let url: string;
  if (raw.startsWith("http")) {
    url = raw;
  } else {
    try {
      const decoded = Buffer.from(unchunk(raw), "base64").toString("utf8");
      if (!decoded.startsWith("local://")) return null;
      url = toUrl(decoded.slice("local://".length));
    } catch {
      return null;
    }
  }

  // "Oferta w przygotowaniu" — wolimy null i wlasny placeholder w UI niz cudzy.
  return url.includes("/placeholder/") ? null : url;
}

/**
 * description bywa powtorzeniem modelu ("i30 1.0 T-GDI Smart" przy modelu "i30").
 * Na kafelku model i tak jest osobno, wiec ucinamy prefiks.
 */
function cleanTrim(description: string | undefined, model: string): string | null {
  const d = description?.trim();
  if (!d) return null;
  const m = model.trim();
  if (d.toLowerCase().startsWith(m.toLowerCase())) {
    const rest = d.slice(m.length).trim();
    return rest.length > 0 ? rest : null;
  }
  return d;
}

function findGraph(docs: unknown[]): unknown[] {
  for (const doc of docs) {
    const g = (doc as { "@graph"?: unknown[] })?.["@graph"];
    if (Array.isArray(g)) return g;
  }
  return [];
}

export const automarket: SourceAdapter = {
  id: "automarket",
  name: "Automarket (PKO Leasing)",
  baseUrl: BASE,
  strategy: "http",
  delayMs: 1200,

  async discover(): Promise<ListingRef[]> {
    const xml = await fetchText(SITEMAP, { delayMs: 0, timeoutMs: 60_000 });

    /*
     * Auto wystepuje w sitemapie raz na wariant finansowania. Zbieramy najpierw
     * wszystkie warianty per auto, a dopiero potem wybieramy jeden adres —
     * zawsze preferujac gotowkowy, bo tylko on niesie cene.
     */
    const variantsById = new Map<string, Map<string, string>>();

    for (const loc of extractSitemapLocs(xml)) {
      const m = loc.match(OFFER_RE);
      if (!m) continue;
      const [, id, variant] = m;
      const forId = variantsById.get(id) ?? new Map<string, string>();
      forId.set(variant, loc);
      variantsById.set(id, forId);
    }

    const refs: ListingRef[] = [];
    for (const [id, variants] of variantsById) {
      const url =
        variants.get(CASH_VARIANT) ??
        FALLBACK_VARIANTS.map((v) => variants.get(v)).find((u) => u != null);
      if (!url) continue;
      refs.push({ sourceId: "automarket", externalId: id, url });
    }
    return refs;
  },

  async fetchDetail(ref: ListingRef): Promise<RawListing> {
    const body = await fetchText(ref.url, { delayMs: automarket.delayMs });
    return { ref, body, fetchedAt: new Date() };
  },

  parse(raw: RawListing): NormalizedListing | null {
    const graph = findGraph(extractJsonLd(raw.body));

    const car = graph.find((n) => (n as JsonLdCar)?.["@type"] === "Car") as JsonLdCar | undefined;
    if (!car?.brand || !car.model) return null;

    // Oferta zdjeta ze sprzedazy potrafi jeszcze wisiec w sitemapie z pustym Car.
    const offer = car.offers;
    const isCash = offer?.category === CASH_VARIANT;

    const imgRef = car.image?.["@id"];
    const imgNode = graph.find(
      (n) => (n as JsonLdImage)?.["@type"] === "ImageObject" &&
        (!imgRef || (n as JsonLdImage)["@id"] === imgRef),
    ) as JsonLdImage | undefined;

    return {
      sourceId: raw.ref.sourceId,
      externalId: raw.ref.externalId,
      url: raw.ref.url,

      vin: parseVin(car.vehicleIdentificationNumber),
      make: normalizeMake(car.brand),
      model: car.model.trim(),
      trim: cleanTrim(car.description, car.model),

      year: parseYear(car.vehicleModelDate),
      mileageKm: parseInteger(car.mileageFromOdometer?.value),
      priceGross: isCash ? parseInteger(offer?.price) : null,
      priceNet: null,

      fuel: parseFuel(car.vehicleEngine?.fuelType),
      gearbox: parseGearbox(car.vehicleTransmission),
      drive: parseDrive(car.driveWheelConfiguration),
      powerHp: parseInteger(car.vehicleEngine?.enginePower),
      engineCcm: parseInteger(car.vehicleEngine?.engineDisplacement),
      body: car.bodyType?.trim() || null,
      color: car.color?.trim() || null,
      seats: parseInteger(car.vehicleSeatingCapacity),
      city: car.countryOfOrigin?.trim() || null,

      thumbnailUrl: decodeImageUrl(imgNode?.url ?? imgNode?.contentUrl),
    };
  },
};
