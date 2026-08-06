import type { ListingRef, NormalizedListing, RawListing } from "@auta/core";
import {
  normalizeMake,
  parseFuel,
  parseGearbox,
  parseInteger,
  parseVin,
  parseYear,
} from "@auta/core";
import { extractSitemapLocs, fetchText, sliceJsonObject } from "../http";
import type { SourceAdapter } from "../types";

const BASE = "https://najlepszeoferty.bmw.pl";
const SITEMAP_INDEX = `${BASE}/uzywane/sitemap.xml`;

/**
 * BMW Premium Selection.
 *
 * WAZNE: robots.txt tego serwisu zabrania /uzywane/api — a wlasnie tam siedzi
 * wygodne JSON API wyszukiwarki. Nie uzywamy go. Dane bierzemy wylacznie ze
 * sciezek dozwolonych: sitemapy pojazdow i stron "opis-szczegolowy", ktore
 * BMW renderuje serwerowo (obiekt METADATA.vehicle + tabela techniczna).
 *
 * Wyjatek swiadomy: adres miniatury wskazuje na /uzywane/api. Scraper go NIE
 * pobiera — zapisujemy sam URL, ktory laduje przegladarka uzytkownika przy
 * renderowaniu kafelka, tak samo jak na stronie BMW.
 */

interface Labelled {
  id?: number;
  label?: string;
}

interface VehicleMeta {
  id: number;
  title?: string;
  brand?: Labelled;
  series?: Labelled;
  bodyType?: Labelled;
  color?: Labelled;
  fuel?: Labelled;
  transmission?: Labelled;
  productionYear?: number;
  registration?: string;
  registrationYear?: string;
  mileage?: number;
  transactionalPrice?: number;
}

function readMetadata<T>(html: string, prop: string): T | null {
  const at = html.indexOf(`METADATA.${prop} = `);
  if (at < 0) return null;
  const braceAt = html.indexOf("{", at);
  const raw = sliceJsonObject(html, braceAt);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export const bmw: SourceAdapter = {
  id: "bmw",
  name: "BMW Premium Selection",
  baseUrl: BASE,
  strategy: "http",
  delayMs: 1200,

  async discover(): Promise<ListingRef[]> {
    const index = await fetchText(SITEMAP_INDEX, { delayMs: 0, timeoutMs: 45_000 });

    // Indeks zawiera kilka sitemap; interesuja nas wylacznie te z pojazdami.
    const vehicleMaps = extractSitemapLocs(index)
      .map((u) => u.replace(/&amp;/g, "&"))
      .filter((u) => u.includes("sitemap=vehicle"));

    const seen = new Map<string, ListingRef>();
    for (const map of vehicleMaps) {
      const xml = await fetchText(map, { delayMs: bmw.delayMs, timeoutMs: 60_000 });
      for (const loc of extractSitemapLocs(xml)) {
        const m = loc.match(/opis-szczegolowy\/(\d+)/);
        if (!m) continue;
        seen.set(m[1], { sourceId: "bmw", externalId: m[1], url: loc });
      }
    }
    return [...seen.values()];
  },

  async fetchDetail(ref: ListingRef): Promise<RawListing> {
    const body = await fetchText(ref.url, { delayMs: bmw.delayMs, timeoutMs: 45_000 });
    return { ref, body, fetchedAt: new Date() };
  },

  parse(raw: RawListing): NormalizedListing | null {
    const html = raw.body;
    const v = readMetadata<VehicleMeta>(html, "vehicle");
    if (!v?.title) return null;

    const dealer = readMetadata<{ name?: string }>(html, "dealer");

    // Tabela techniczna: "Moc | 100KW / 136KM", "Pojemność silnika | 1499cm3"
    const power = html.match(/(\d+)\s*KM\s*<\/?/i) ?? html.match(/\/\s*(\d+)KM/i);
    const capacity = html.match(/(\d+)\s*cm3/i);
    const vin = html.match(/VIN\s+([A-HJ-NPR-Z0-9]{17})\b/);

    const srcset = html.match(/srcset="(https:\/\/[^"\s]+)/);

    // Adres dealera: "20-234 Lublin" — pierwszy kod pocztowy na stronie.
    const city = html.match(/\b\d{2}-\d{3}\s+([A-ZŁŚŻŹĆÓĄĘŃ][A-Za-ząćęłńóśźżĄĆĘŁŃÓŚŹŻ .-]{2,30})/);

    /*
     * UWAGA: to jest platforma dealerska BMW, ale sprzedaje tez auta innych marek
     * przyjete w rozliczeniu (VW T-Roc, Audi Q4) oraz MINI, ktore jest osobna
     * marka. Marki NIE wolno zakodowac na sztywno — zrodlo podaje ja w brand.label.
     */
    const make = normalizeMake(v.brand?.label?.trim() || "BMW");

    // Tytul bywa poprzedzony marka ("MINI Cabrio Cooper S") i zakonczony kodem
    // modelu ("T-Roc (D11)(12.2021->)") — oba do usuniecia.
    const title = v.title.trim();
    const model =
      title
        .replace(new RegExp(`^${make.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`, "i"), "")
        .replace(/^(BMW|VW|Volkswagen|MINI)\s+/i, "")
        .replace(/\s*\([^)]*\)\s*/g, " ")
        .replace(/\s+/g, " ")
        .trim() || title;

    return {
      sourceId: raw.ref.sourceId,
      externalId: raw.ref.externalId,
      url: raw.ref.url,

      vin: parseVin(vin?.[1]),
      make,
      model,
      trim: v.series?.label ?? null,

      year: parseYear(v.productionYear ?? v.registrationYear),
      mileageKm: parseInteger(v.mileage),
      priceGross: parseInteger(v.transactionalPrice),
      priceNet: null,

      fuel: parseFuel(v.fuel?.label),
      gearbox: parseGearbox(v.transmission?.label),
      drive: null,
      powerHp: power ? parseInteger(power[1]) : null,
      engineCcm: capacity ? parseInteger(capacity[1]) : null,
      body: v.bodyType?.label?.trim() || null,
      color: v.color?.label?.trim() || null,
      seats: null,
      city: city?.[1].trim() ?? dealer?.name ?? null,

      thumbnailUrl: srcset?.[1] ?? null,
    };
  },
};
