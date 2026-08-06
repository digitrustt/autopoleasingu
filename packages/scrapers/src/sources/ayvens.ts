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
import { extractJsonLd, extractSitemapLocs, fetchText } from "../http";
import type { SourceAdapter } from "../types";

const BASE = "https://usedcars.ayvens.com";
const SITEMAP_INDEX = `${BASE}/pl-pl/sitemap_index.xml`;

/**
 * Ayvens (fuzja LeasePlan + ALD) — detaliczna sprzedaz aut poleasingowych.
 *
 * To NIE jest carmarket.ayvens.com (odrzucone w README: platforma aukcyjna
 * B2B za logowaniem). usedcars.ayvens.com to zwykly sklep Salesforce Commerce
 * Cloud, renderowany serwerowo, bez logowania — inny produkt tej samej firmy.
 *
 * robots.txt ma jeden ogolny blok "User-agent: *": disallow obejmuje
 * search/cart/checkout/stores/finansowanie/parametry filtrow, ale NIE strony
 * produktow ani sitemape. Sitemapa jest podana wprost (osobna per kraj),
 * 739 pozycji dla pl-pl w chwili rekonesansu.
 */

interface LdOffer {
  price?: string;
  availability?: string;
}

interface LdProduct {
  name?: string;
  description?: string;
  brand?: { name?: string };
  offers?: LdOffer;
}

function decode(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&oacute;/g, "ó")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** Pola specyfikacji: <div class="detail-container X">...<span class="value ml-0">WARTOSC</span>. */
function field(html: string, cls: string): string | null {
  const re = new RegExp(
    `detail-container ${cls}"[\\s\\S]{0,300}?<span class="value ml-0">\\s*([\\s\\S]*?)\\s*</span>`,
  );
  const m = html.match(re);
  return m ? decode(m[1]) || null : null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/*
 * robots.txt blokuje "*vehicle-master-catalog*" ogolnie, ale jawnie odblokowuje
 * warianty z "sw=400" (miniatury). Bierzemy pierwsze zdjecie galerii i wymuszamy
 * ten wariant zamiast pelnowymiarowego, ktory strona laduje domyslnie.
 */
function thumbnail(html: string): string | null {
  const m = html.match(/<img[^>]+src="(https:\/\/[^"]+vehicle-master-catalog[^"]+\/gallery\/[^"?]+)\?[^"]*"/);
  return m ? `${m[1]}?sw=400&sh=300&sm=fit` : null;
}

export const ayvens: SourceAdapter = {
  id: "ayvens",
  name: "Ayvens (LeasePlan/ALD)",
  baseUrl: BASE,
  strategy: "http",
  delayMs: 1200,

  async discover(): Promise<ListingRef[]> {
    const index = await fetchText(SITEMAP_INDEX, { delayMs: 0, timeoutMs: 45_000 });
    const maps = extractSitemapLocs(index);

    const seen = new Map<string, ListingRef>();
    for (const map of maps) {
      const xml = await fetchText(map, { delayMs: ayvens.delayMs, timeoutMs: 60_000 });
      for (const loc of extractSitemapLocs(xml)) {
        // /pl-pl/bmw-5/2516901-pl-bmw-5.html — numer przed "-pl-" to nasz externalId.
        const m = loc.match(/\/(\d+)-pl-[a-z0-9-]+\.html$/i);
        if (!m) continue;
        seen.set(m[1], { sourceId: "ayvens", externalId: m[1], url: loc });
      }
    }
    return [...seen.values()];
  },

  async fetchDetail(ref: ListingRef): Promise<RawListing> {
    const body = await fetchText(ref.url, { delayMs: ayvens.delayMs, timeoutMs: 45_000 });
    return { ref, body, fetchedAt: new Date() };
  },

  parse(raw: RawListing): NormalizedListing | null {
    const html = raw.body;

    const ld = extractJsonLd(html).find(
      (b): b is LdProduct => typeof b === "object" && b !== null && "offers" in b,
    );
    if (!ld?.brand?.name || !ld.name) return null;
    if (ld.offers?.availability && !ld.offers.availability.includes("InStock")) return null;

    const rawMake = ld.brand.name.trim();
    const make = normalizeMake(rawMake);
    const modelRaw = ld.name.trim().replace(new RegExp(`^${escapeRegex(rawMake)}\\s*`, "i"), "").trim();
    if (!modelRaw) return null;

    return {
      sourceId: raw.ref.sourceId,
      externalId: raw.ref.externalId,
      url: raw.ref.url,

      vin: parseVin(field(html, "vin")),
      make,
      model: normalizeModel(modelRaw) ?? modelRaw,
      trim: ld.description?.trim() || null,

      year: parseYear(field(html, "constructionYear")),
      mileageKm: parseInteger(field(html, "mileage")),
      // "Zawiera 23% VAT" jest stalym dopiskiem przy cenie — zrodlo podaje brutto.
      priceGross: parseInteger(ld.offers?.price),
      priceNet: null,

      fuel: parseFuel(field(html, "fuelType")),
      gearbox: parseGearbox(field(html, "gearType")),
      drive: parseDrive(field(html, "wheelDrive")),
      powerHp: parseInteger(field(html, "performanceHP")),
      engineCcm: parseInteger(field(html, "engineSize")),
      body: field(html, "vehicleType"),
      color: field(html, "refinementColor"),
      seats: null,
      city: null,

      thumbnailUrl: thumbnail(html),
    };
  },
};
