import type { ListingRef, NormalizedListing, RawListing } from "@auta/core";
import { normalizeMake, parseFuel, parseInteger, parseYear } from "@auta/core";
import { fetchText } from "../http";
import type { SourceAdapter } from "../types";

const BASE = "https://certified.mercedes-benz.pl";
const CARD = '<div class="vehicle-card-header"';
const MAX_PAGES = 60;

/**
 * Mercedes-Benz Certified. Strona detalu renderuje dane dopiero w JS, ale kafelki
 * listingu sa w pelni serwerowe — dlatego caly parsing dzieje sie w discover(),
 * a fetchDetail() nie rusza sieci. 440 pojazdow po 12 na strone ≈ 37 zadan.
 *
 * robots.txt jawnie zezwala na /vehiclesearch i /vehicles.
 */

function stripTags(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function lines(html: string): string[] {
  return stripTags(html)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export interface MercedesCard {
  externalId: string;
  make: string;
  url: string;
  model: string;
  priceGross: number | null;
  body: string | null;
  firstReg: string | null;
  powerHp: number | null;
  mileageKm: number | null;
  fuel: string | null;
  city: string | null;
  thumbnailUrl: string | null;
}

function parseCard(card: string): MercedesCard | null {
  const link = card.match(/href="(vehicle\?[^"]+)"/);
  const idMatch = link?.[1].match(/vehicle=(\d+)/);
  if (!link || !idMatch) return null;

  /*
   * "vehicle?1540+Mercedes-Benz+B+250+e" -> marka "Mercedes-Benz", model "B 250 e".
   * Przed nazwa marki bywa jeden LUB dwa numery ("05559+01898+Mercedes-Benz+C+300+e"),
   * wiec tniemy po samej marce zamiast zgadywac liczbe tokenow prefiksu.
   *
   * Marki NIE kodujemy na sztywno: obok Mercedes-Benz w ofercie sa tez
   * Mercedes-AMG i smart. Zakodowana marka dawalaby "Mercedes-Benz Mercedes-AMG GT".
   */
  const titlePart = decodeURIComponent(link[1].split("&")[0].replace(/^vehicle\?/, ""));
  const brandMatch = titlePart.match(/(Mercedes-AMG|Mercedes-Maybach|Mercedes-Benz|smart)/i);
  const brand = brandMatch?.[1] ?? "Mercedes-Benz";
  const brandAt = brandMatch ? titlePart.indexOf(brandMatch[1]) : -1;
  const model = (brandAt >= 0 ? titlePart.slice(brandAt + brand.length) : titlePart)
    .replace(/^\+/, "")
    .replace(/\+/g, " ")
    .trim();

  const ls = lines(card);
  const text = ls.join(" ");

  const price = text.match(/([\d.\s]+)\s*zł/);
  const power = text.match(/(\d+)\s*kW\s*\((\d+)\s*KM\)/);
  const mileage = text.match(/([\d.\s]+)\s*km(?!\/)/);
  const firstReg = text.match(/\b(\d{2}\.\d{2}\.\d{4})\b/);

  // Nadwozie i paliwo stoja na stalych pozycjach wzgledem znacznika certyfikatu.
  const anchor = ls.findIndex((l) => l.includes("Mercedes-Benz Certified"));
  const body = anchor >= 0 ? (ls[anchor + 1] ?? null) : null;
  const fuel = anchor >= 0 ? (ls[anchor + 5] ?? null) : null;
  const city = anchor >= 0 ? (ls[anchor + 7] ?? null) : null;

  const img = card.match(/<img[^>]+src="(https:\/\/img\.autodo\.eu\/[^"]+)"/);

  return {
    externalId: idMatch[1],
    make: brand,
    url: `${BASE}/${link[1].replace(/&amp;/g, "&")}`,
    model: model || "—",
    // "74.900 zł" — kropka jest separatorem tysiecy, nie dziesietnym.
    priceGross: price ? parseInteger(price[1].replace(/[.\s]/g, "")) : null,
    body,
    firstReg: firstReg?.[1] ?? null,
    powerHp: power ? Number(power[2]) : null,
    mileageKm: mileage ? parseInteger(mileage[1].replace(/[.\s]/g, "")) : null,
    fuel,
    city,
    thumbnailUrl: img?.[1] ?? null,
  };
}

export const mercedes: SourceAdapter = {
  id: "mercedes",
  name: "Mercedes-Benz Certified",
  baseUrl: BASE,
  strategy: "http",
  delayMs: 1200,
  /** parse() czyta z ref.payload — bez discover nie ma czego odswiezac. */
  needsDiscoveryPayload: true,
  /** Discover kosztuje dziesiatki zadan — miedzy przelotami odswiezamy znane oferty. */
  discoverEveryMinutes: 30,

  async discover(): Promise<ListingRef[]> {
    const seen = new Map<string, ListingRef>();

    let emptyStreak = 0;

    for (let page = 1; page <= MAX_PAGES; page++) {
      const html = await fetchText(`${BASE}/vehicles?page=${page}`, {
        delayMs: mercedes.delayMs,
        timeoutMs: 45_000,
      });

      const chunks = html.split(CARD).slice(1);
      if (chunks.length === 0) break;

      let fresh = 0;
      for (const chunk of chunks) {
        const card = parseCard(chunk);
        if (!card || seen.has(card.externalId)) continue;
        seen.set(card.externalId, {
          sourceId: "mercedes",
          externalId: card.externalId,
          url: card.url,
          payload: card,
        });
        fresh++;
      }
      // Patrz cararena: przerwanie na pierwszej stronie bez nowosci gubi reszte listy.
      emptyStreak = fresh === 0 ? emptyStreak + 1 : 0;
      if (emptyStreak >= 3) break;
    }

    return [...seen.values()];
  },

  // Detal nie niesie nic ponad kafelek — oszczedzamy 440 zadan.
  async fetchDetail(ref: ListingRef): Promise<RawListing> {
    return { ref, body: JSON.stringify(ref.payload), fetchedAt: new Date() };
  },

  parse(raw: RawListing): NormalizedListing | null {
    const c = JSON.parse(raw.body) as MercedesCard | null;
    if (!c?.model) return null;

    return {
      sourceId: raw.ref.sourceId,
      externalId: raw.ref.externalId,
      url: raw.ref.url,

      // Mercedes nie podaje VIN-u publicznie — dedup pojdzie po pHash zdjecia.
      vin: null,
      make: normalizeMake(c.make || "Mercedes-Benz"),
      model: c.model,
      trim: null,

      // "18.10.2020" -> 2020
      year: parseYear(c.firstReg?.slice(-4)),
      mileageKm: c.mileageKm,
      priceGross: c.priceGross,
      priceNet: null,

      fuel: parseFuel(c.fuel),
      gearbox: null,
      drive: null,
      powerHp: c.powerHp,
      engineCcm: null,
      body: c.body,
      color: null,
      seats: null,
      // "63-460 Ociąż" -> "Ociąż"
      city: c.city?.replace(/^\d{2}-\d{3}\s*/, "").trim() || null,

      thumbnailUrl: c.thumbnailUrl,
    };
  },
};
