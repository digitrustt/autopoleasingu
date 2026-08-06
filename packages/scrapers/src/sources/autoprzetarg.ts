import type { ListingRef, NormalizedListing, RawListing } from "@auta/core";
import {
  normalizeMake,
  normalizeModel,
  parseFuel,
  parseInteger,
  parseVin,
  parseYear,
} from "@auta/core";
import { fetchText } from "../http";
import type { SourceAdapter } from "../types";

const BASE = "https://autoprzetarg.pl";
const LIST = `${BASE}/kategoria/Pojazdy1`;
const MAX_PAGES = 60;

/** Aukcje licytuje sie w kwotach netto — strona ustawia `var taxcost = 'Netto'`. */
const VAT = 1.23;

/**
 * autoprzetarg.pl — platforma aukcyjna WIELOFIRMOWA. Jednym adapterem lapiemy
 * auta Alior Leasingu, VeloLeasingu, Santandera i BNP Paribas Leasing Solutions
 * (pole "Sprzedajacy" na karcie -> kolumna listings.seller).
 *
 * Karta na liscie niesie komplet z VIN-em wlacznie, a strona szczegolow nie
 * dodaje ANI JEDNEGO pola wiecej (sprawdzone) — dlatego fetchDetail tylko
 * oddaje payload i cale zrodlo kosztuje ~24 zapytania zamiast ~300.
 *
 * robots.txt: "User-agent: *" ma "Allow: /" (blokady dotycza imiennie crawlerow
 * trenujacych modele; Content-Signal zezwala na "search" i "reference").
 * Osobno zablokowany jest CloudflareBrowserRenderingCrawler, wiec renderowania
 * przegladarka tu nie uzywamy — i tak nie trzeba, HTML jest serwerowy.
 */

function stripTags(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&oacute;/g, "ó")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/\s+/g, " ")
    .trim();
}

/** Pary "<b>Etykieta:</b> wartosc" — tak zbudowany jest caly opis na karcie. */
function labelled(html: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of html.matchAll(/<b>\s*([^<:]{2,40}):\s*<\/b>\s*([^<]*)/g)) {
    out.set(stripTags(m[1]).toLowerCase(), stripTags(m[2]));
  }
  return out;
}

/**
 * Lista marek z filtra na stronie. Marki bywaja dwuczlonowe ("ALFA ROMEO",
 * "LAND ROVER"), wiec ciecie tytulu po pierwszej spacji dawaloby model "ROMEO".
 * Bierzemy najdluzszy prefiks tytulu, ktory jest znana marka.
 */
let brandCache: string[] | null = null;

function readBrands(html: string): string[] {
  const select = html.match(/<select[^>]*id="CarBrandList"[\s\S]*?<\/select>/)?.[0];
  if (!select) return [];
  const brands = [...select.matchAll(/<option value="\d+">([^<]+)<\/option>/g)].map((m) =>
    stripTags(m[1]).toUpperCase(),
  );
  // Dluzsze najpierw: "MERCEDES-BENZ" musi wygrac z ewentualnym "MERCEDES".
  return brands.sort((a, b) => b.length - a.length);
}

function splitMakeModel(title: string, brands: string[]): { make: string; model: string } | null {
  const t = title.trim().replace(/\s+/g, " ");
  const upper = t.toUpperCase();
  const hit = brands.find((b) => upper === b || upper.startsWith(`${b} `));
  if (!hit) return null;

  // Tytul to "MARKA MODEL 1968,00 cm3 / 177 KM" — ucinamy ogon z silnikiem.
  const rest = t
    .slice(hit.length)
    .replace(/\s*\d+[.,]\d+\s*(ccm|cm3)[\s\S]*$/i, "")
    .replace(/\s*\/\s*\d+\s*KM.*$/i, "")
    .trim();
  return { make: normalizeMake(hit), model: normalizeModel(rest) ?? hit };
}

/** Karty to <a href="/aukcja/..."> ... </a>; dzielimy po znaczniku otwierajacym. */
function splitCards(html: string): string[] {
  return html.split(/(?=<a href="\/aukcja\/)/).filter((c) => c.startsWith('<a href="/aukcja/'));
}

export const autoprzetarg: SourceAdapter = {
  id: "autoprzetarg",
  name: "AutoPrzetarg (Alior, Velo, Santander, BNP)",
  baseUrl: BASE,
  strategy: "http",
  delayMs: 1200,
  /** parse() czyta z ref.payload — bez discover nie ma czego odswiezac. */
  needsDiscoveryPayload: true,

  async discover(): Promise<ListingRef[]> {
    const seen = new Map<string, ListingRef>();

    for (let page = 1; page <= MAX_PAGES; page++) {
      const html = await fetchText(page === 1 ? LIST : `${LIST}?page=${page}`, {
        delayMs: autoprzetarg.delayMs,
      });
      if (page === 1) brandCache = readBrands(html);

      const cards = splitCards(html);
      if (cards.length === 0) break;

      let added = 0;
      for (const card of cards) {
        const href = card.match(/^<a href="(\/aukcja\/[^"]+)"/)?.[1];
        if (!href) continue;

        /*
         * Kategoria siedzi w ostatnim segmencie URL-a po przecinku. Bierzemy
         * tylko osobowki — /kategoria/Pojazdy1 miesza je z ciezarowkami,
         * naczepami i dostawczakami.
         */
        const parts = decodeURIComponent(href).split(",");
        if (parts[parts.length - 1] !== "Samochody-osobowe") continue;

        const id = parts[1];
        if (!id || seen.has(id)) continue;
        seen.set(id, {
          sourceId: "autoprzetarg",
          externalId: id,
          url: `${BASE}${href}`,
          payload: card,
        });
        added++;
      }
      // Strona poza zakresem oddaje pusta liste kart, ale na wszelki wypadek
      // przerywamy tez, gdy przestaja dochodzic nowe id (petla paginacji).
      if (added === 0 && page > 1 && cards.length < 12) break;
    }

    return [...seen.values()];
  },

  async fetchDetail(ref: ListingRef): Promise<RawListing> {
    return { ref, body: String(ref.payload), fetchedAt: new Date() };
  },

  parse(raw: RawListing): NormalizedListing | null {
    const card = raw.body;
    const title = stripTags(card.match(/<h3[^>]*>([\s\S]*?)<\/h3>/)?.[1] ?? "");
    if (!title) return null;

    const mm = splitMakeModel(title, brandCache ?? []);
    if (!mm) return null;

    const f = labelled(card);

    // "1968,00 cm3 / 177 KM" — pojemnosc i moc w jednym polu.
    const engine = f.get("pojemność silnika") ?? "";
    const ccm = engine.match(/([\d\s]+)[.,]\d+\s*(?:ccm|cm3)/i)?.[1];
    const hp = engine.match(/(\d+)\s*KM/i)?.[1];

    const netto = parseInteger(f.get("aktualna cena aukcji") ?? priceFromCard(card));
    const endsAt = card.match(/name="auctionEndDate"[^>]*value="([^"]+)"/)?.[1];

    const photo = card.match(/<source[^>]*srcset="([^"]+)"/)?.[1];

    return {
      sourceId: raw.ref.sourceId,
      externalId: raw.ref.externalId,
      url: raw.ref.url,

      vin: parseVin(f.get("vin")),
      make: mm.make,
      model: mm.model,
      trim: null,

      year: parseYear(f.get("rok produkcji")),
      mileageKm: parseInteger(f.get("przebieg")),
      priceGross: netto == null ? null : Math.round(netto * VAT),
      priceNet: netto,

      fuel: parseFuel(f.get("rodzaj paliwa")),
      gearbox: null, // Karta ani strona szczegolow nie podaja skrzyni.
      drive: null,
      powerHp: parseInteger(hp),
      engineCcm: parseInteger(ccm?.replace(/\s/g, "")),
      body: null,
      color: null,
      seats: null,
      city: f.get("lokalizacja")?.split(",")[0]?.trim() || null,

      thumbnailUrl: photo && !photo.includes("brakzdjecia") ? `${BASE}${photo}` : null,
      seller: f.get("sprzedający") || null,

      offerKind: "auction",
      auctionEndsAt: endsAt ? new Date(endsAt.replace(" ", "T")) : null,
    };
  },
};

/** Cena nie jest etykietowana <b>, tylko siedzi we wlasnym divie. */
function priceFromCard(card: string): string | null {
  const m = card.match(/section-list-auctions-price">([^<]*)</);
  return m ? stripTags(m[1]) || null : null;
}
