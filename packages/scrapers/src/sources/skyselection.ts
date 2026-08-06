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
  splitMakeModel,
} from "@auta/core";
import { fetchText } from "../http";
import type { SourceAdapter } from "../types";

const BASE = "https://skyselection.pl";
/** perpage=36 to maksimum, jakie serwis honoruje — wyzsze wartosci przycina. */
const LIST = `${BASE}/oferta-samochodow/page,`;
const QUERY = ".html?perpage=36&sortForm=";
const MAX_PAGES = 40;

/**
 * Mazda SkySelection — certyfikowane uzywane Mazdy z sieci dealerskiej.
 *
 * mazda.pl to sama strona programu, bez ani jednej oferty; caly inwentarz
 * siedzi na osobnej domenie skyselection.pl, linkowanej z tamtej stopki.
 * robots.txt ma puste "Disallow:", czyli zezwala na wszystko.
 *
 * Listing jest serwerowy, ale niesie wylacznie cene i zdjecie — rocznik,
 * przebieg i VIN sa dopiero na stronie oferty, wiec detal jest konieczny.
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

/** Dane oferty to plaska lista <li>Etykieta: wartosc</li> w kilku blokach. */
function labelled(html: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of html.matchAll(/<li[^>]*>\s*([^<:]{2,40}):\s*([^<]*)<\/li>/g)) {
    out.set(decode(m[1]).toLowerCase(), decode(m[2]));
  }
  return out;
}

/**
 * "Podstawowe parametry" maja inny ksztalt niz reszta: etykieta i wartosc sa
 * sklejone w dymku (<div class="param-tooltip">Moc 186 KM</div>), bez dwukropka.
 */
function param(html: string, label: string): string | null {
  const re = new RegExp(
    `<div class="param-tooltip">\\s*${label}\\s+([^<]*?)\\s*</div>`,
    "i",
  );
  return html.match(re)?.[1].trim() || null;
}

export const skyselection: SourceAdapter = {
  id: "skyselection",
  name: "Mazda SkySelection",
  baseUrl: BASE,
  strategy: "http",
  delayMs: 1200,
  /** Discover kosztuje dziesiatki zadan — miedzy przelotami odswiezamy znane oferty. */
  discoverEveryMinutes: 60,

  async discover(): Promise<ListingRef[]> {
    const seen = new Map<string, ListingRef>();
    let emptyStreak = 0;

    for (let page = 1; page <= MAX_PAGES; page++) {
      const html = await fetchText(`${LIST}${page}${QUERY}`, {
        delayMs: skyselection.delayMs,
        timeoutMs: 45_000,
      });

      let fresh = 0;
      // /oferta-samochodow/mazda-3,43522.html — liczba po przecinku to id oferty.
      for (const m of html.matchAll(/href="(\/oferta-samochodow\/([a-z0-9-]+),(\d+)\.html)"/g)) {
        const [, href, , id] = m;
        if (seen.has(id)) continue;
        seen.set(id, { sourceId: "skyselection", externalId: id, url: `${BASE}${href}` });
        fresh++;
      }

      // Patrz cararena: przerwanie na pierwszej stronie bez nowosci gubi reszte.
      emptyStreak = fresh === 0 ? emptyStreak + 1 : 0;
      if (emptyStreak >= 3) break;
    }

    return [...seen.values()];
  },

  async fetchDetail(ref: ListingRef): Promise<RawListing> {
    const body = await fetchText(ref.url, { delayMs: skyselection.delayMs, timeoutMs: 45_000 });
    return { ref, body, fetchedAt: new Date() };
  },

  parse(raw: RawListing): NormalizedListing | null {
    const html = raw.body;

    const title = decode(html.match(/<h1 class="car-offer-header-model">([\s\S]*?)<\/h1>/)?.[1] ?? "");
    if (!title) return null;

    /*
     * Serwis sprzedaje glownie Mazdy, ale bierze tez auta w rozliczeniu — marki
     * nie wolno zakodowac na sztywno (patrz bmw.ts i "BMW T-Roc").
     */
    const mm = splitMakeModel(title);
    if (!mm) return null;

    const d = labelled(html);

    /*
     * Kwota i jednostka sa rozdzielone znacznikiem:
     * `<span ...-value"> 199 900 <span class="price-label-span">zl brutto</span>`.
     * Bez przepuszczenia tego <span> regex nie trafia i cala oferta idzie do bazy
     * bez ceny — a wtedy wyglada na wycofana, zamiast na blad parsera.
     */
    const price = html.match(
      /car-details-price-element-value">\s*([\d\s ]+?)\s*(?:<[^>]+>\s*)?zł\s*(brutto|netto)?/i,
    );
    const amount = parseInteger(price?.[1].replace(/[\s ]/g, ""));
    const isNet = price?.[2]?.toLowerCase() === "netto";

    // "Pojemność 2.0" — litry, nie centymetry; baza trzyma ccm.
    const litres = Number(param(html, "Pojemność")?.replace(",", "."));

    const photo = html.match(/<img[^>]+src="(https:\/\/[^"]+\/cms_cars_offer\/[^"]+)"/i);

    return {
      sourceId: raw.ref.sourceId,
      externalId: raw.ref.externalId,
      url: raw.ref.url,

      vin: parseVin(d.get("numer vin")),
      make: mm.make,
      model: normalizeModel(mm.model) ?? mm.model,
      trim: null,

      year: parseYear(d.get("rok produkcji") ?? param(html, "Rok produkcji")),
      mileageKm: parseInteger(d.get("przebieg")?.replace(/[\s ]/g, "")),
      priceGross: isNet ? null : amount,
      priceNet: isNet ? amount : null,

      fuel: parseFuel(param(html, "Typ paliwa")),
      gearbox: parseGearbox(param(html, "Skrzynia biegów")),
      drive: parseDrive(d.get("napęd") ?? null),
      powerHp: parseInteger(param(html, "Moc")),
      engineCcm: Number.isFinite(litres) ? Math.round(litres * 1000) : null,
      body: param(html, "Typ nadwozia"),
      color: d.get("kolor") ?? null,
      seats: null,
      city: null,

      thumbnailUrl: photo?.[1] ?? null,
      seller: decode(html.match(/car-offer-header-dealer">([\s\S]*?)<\/p>/)?.[1] ?? "")
        .replace(/^Dealer:\s*/i, "")
        .trim() || null,
    };
  },
};
