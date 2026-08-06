import type { ListingRef, NormalizedListing, RawListing } from "@auta/core";
import {
  normalizeMake,
  normalizeModel,
  parseFuel,
  parseGearbox,
  parseInteger,
  parseVin,
  parseYear,
  titleCase,
} from "@auta/core";
import { extractSitemapLocs, fetchText } from "../http";
import type { SourceAdapter } from "../types";

/*
 * Host kanoniczny. aukcje.vbleasing.pl i aukcje.leasycar.pl przekierowuja tutaj
 * 301 — ale sitemapa nadal wypisuje adresy z domeny vbleasing, wiec adresy ofert
 * bierzemy z niej bez podmiany i to one trafiaja do bazy.
 */
const BASE = "https://aukcje.leasygroup.pl";
const SITEMAP = `${BASE}/sitemap.xml`;

/**
 * leasyGROUP — plac poleasingowy VB Leasingu (dawniej Idea Getin Leasing).
 *
 * Ta sama platforma stoi pod trzema adresami: aukcje.leasygroup.pl,
 * aukcje.vbleasing.pl i aukcje.leasycar.pl. To NIE sa trzy zrodla —
 * identyfikatory aukcji pokrywaja sie co do sztuki (sprawdzone: 27538 i 27766
 * sa na obu), wiec chodzimy po jednym hoscie, tak jak przy poddomenach
 * poleasingowe.pl.
 *
 * DROGA DOZWOLONA ZAMIAST WYGODNEJ, jak przy BMW: robots.txt zabrania
 * listingow kategorii (`/aukcje/pojazdy-samochodowe-i-motocykle/widok-lista/*`
 * oraz `widok-siatka/*`, przepuszczajac wylacznie `strona-1`), wiec paginacji
 * po kategorii nie tykamy. Sitemapa i strony `/aukcja/` sa dozwolone i to z
 * nich korzystamy — sitemapa niesie komplet aukcji wszystkich kategorii.
 *
 * Serwis sprzedaje glownie maszyny: kombajny, naczepy, wywrotki. Osobowki
 * odsiewamy po okruszku "Osobowe" w tresci strony.
 */

function decode(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&oacute;/g, "ó")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tabela danych: <p ...>Etykieta:</p><p ...>Wartosc</p> w div.description_box. */
function dataFields(html: string): Map<string, string> {
  const out = new Map<string, string>();
  const re =
    /<div class="description_box">\s*<p[^>]*>([^<]*?):\s*<\/p>\s*<p[^>]*>([\s\S]*?)<\/p>/g;
  for (const m of html.matchAll(re)) {
    out.set(decode(m[1]).toLowerCase(), decode(m[2]));
  }
  return out;
}

export const leasygroup: SourceAdapter = {
  id: "leasygroup",
  name: "leasyGROUP (VB Leasing)",
  baseUrl: BASE,
  strategy: "http",
  delayMs: 1200,

  async discover(): Promise<ListingRef[]> {
    const xml = await fetchText(SITEMAP, { delayMs: 0, timeoutMs: 45_000 });

    const seen = new Map<string, ListingRef>();
    for (const loc of extractSitemapLocs(xml)) {
      const m = loc.match(/\/aukcja\/(\d+)\//);
      if (!m || seen.has(m[1])) continue;
      seen.set(m[1], { sourceId: "leasygroup", externalId: m[1], url: loc });
    }
    return [...seen.values()];
  },

  async fetchDetail(ref: ListingRef): Promise<RawListing> {
    const body = await fetchText(ref.url, { delayMs: leasygroup.delayMs, timeoutMs: 45_000 });
    return { ref, body, fetchedAt: new Date() };
  },

  parse(raw: RawListing): NormalizedListing | null {
    const html = raw.body;

    // Sitemapa miesza kategorie — bierzemy tylko osobowki.
    if (!html.includes("Osobowe")) return null;

    const d = dataFields(html);
    const make = d.get("marka");
    const model = d.get("model");
    if (!make || !model) return null;

    // "Cena: 105 000 <sup>zl brutto</sup>" — kwota i jej rodzaj w osobnych wezlach.
    const priceBlock = html.match(
      /class="product_price[^"]*">\s*([\d\s ]+)\s*<sup>\s*zł\s*(brutto|netto)/i,
    );
    const price = parseInteger(priceBlock?.[1].replace(/[\s ]/g, ""));
    const isGross = priceBlock?.[2].toLowerCase() !== "netto";

    // Zdjecia sa adresowane wzglednie — sklejamy z hostem oferty, nie kanonicznym.
    const photo = html.match(/<img[^>]+src="(\/i\/zd\/[^"]+)"/);
    const host = new URL(raw.ref.url).origin;

    return {
      sourceId: raw.ref.sourceId,
      externalId: raw.ref.externalId,
      url: raw.ref.url,

      vin: parseVin(d.get("vin")),
      make: normalizeMake(make),
      model: normalizeModel(model) ?? titleCase(model),
      trim: null,

      year: parseYear(d.get("rok produkcji")),
      mileageKm: parseInteger(d.get("przebieg")?.replace(/[\s ]/g, "")),
      priceGross: isGross ? price : null,
      priceNet: isGross ? null : price,

      fuel: parseFuel(d.get("paliwo")),
      gearbox: parseGearbox(d.get("skrzynia biegów")),
      drive: null,
      powerHp: null,
      engineCcm: parseInteger(d.get("pojemność")?.replace(/[\s ]/g, "")),
      body: d.get("karoseria") ? titleCase(d.get("karoseria")!) : null,
      color: d.get("kolor") ? titleCase(d.get("kolor")!) : null,
      seats: null,
      city: null,

      thumbnailUrl: photo ? `${host}${photo[1]}` : null,
      seller: "VB Leasing",

      offerKind: "auction",
      auctionEndsAt: null,
    };
  },
};
