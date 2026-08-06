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
import { fetchText } from "../http";
import type { SourceAdapter } from "../types";
import { field, largestPhoto, offerLinks, vehicleData } from "./famat";

const BASE = "https://famataukcje.pl";
/** subcat=2 to "Osobowe" — kategoria /transport miesza je z ciezarowkami i autobusami. */
const LIST = `${BASE}/oferty/transport/strona-`;
const MAX_PAGES = 30;

const VAT = 1.23;

/**
 * FAMAT Aukcje — platforma aukcyjna WIELOFIRMOWA. Trafilismy tu z VeloLeasingu,
 * ktory nie prowadzi aukcji u siebie, tylko deleguje je na zewnatrz.
 *
 * Wsrod sprzedajacych jest VEHIS — zrodlo odrzucone wczesniej, bo jedyna droga
 * do jego danych (vehis.pl/api/announcement/) jest zabroniona w robots.txt.
 * Tutaj te same auta sa dostepne legalnie: famataukcje.pl ma "Allow: /".
 *
 * Silnik strony jest wspolny z Carefleet — patrz famat.ts.
 */
export const famataukcje: SourceAdapter = {
  id: "famataukcje",
  name: "FAMAT Aukcje (VEHIS, PEAC, Velo)",
  baseUrl: BASE,
  strategy: "http",
  delayMs: 1200,

  async discover(): Promise<ListingRef[]> {
    const seen = new Map<string, ListingRef>();
    let emptyStreak = 0;

    for (let page = 1; page <= MAX_PAGES; page++) {
      const html = await fetchText(`${LIST}${page}/?subcat=2`, {
        delayMs: famataukcje.delayMs,
        timeoutMs: 45_000,
      });

      let fresh = 0;
      // Na tym listingu adresy sa pelne, nie wzgledne — stad host w dopasowaniu.
      for (const { id, url } of offerLinks(html, "famataukcje\\.pl")) {
        if (seen.has(id)) continue;
        seen.set(id, { sourceId: "famataukcje", externalId: id, url: `${BASE}${url}` });
        fresh++;
      }

      emptyStreak = fresh === 0 ? emptyStreak + 1 : 0;
      if (emptyStreak >= 3) break;
    }

    return [...seen.values()];
  },

  async fetchDetail(ref: ListingRef): Promise<RawListing> {
    const body = await fetchText(ref.url, { delayMs: famataukcje.delayMs });
    return { ref, body, fetchedAt: new Date() };
  },

  parse(raw: RawListing): NormalizedListing | null {
    const html = raw.body;

    const d = vehicleData(html);
    const make = field(d, "marka");
    const model = field(d, "model");
    if (!make || !model) return null;

    /*
     * Cena biezacej licytacji. Serwis sam podpisuje ja "netto" albo "brutto"
     * w <span class="price_kind">, wiec nie zakladamy niczego z gory —
     * przeliczamy tylko wtedy, gdy faktycznie jest netto.
     */
    const amount = html.match(/class="[^"]*current_price[^"]*">([^<]+)</)?.[1];
    const kind = html.match(/class="[^"]*price_kind[^"]*">([^<]+)</)?.[1] ?? "";
    const value = amount ? parseInteger(amount.replace(/[\s ]/g, "")) : null;
    const isNet = /netto/i.test(kind);

    /*
     * Sprzedajacy siedzi w <span class="extra_span_info"> wewnatrz bloku
     * seller_box, w formie "VEHIS Sp. z o.o., Metalowa 10, 05-600 Slomczyn" —
     * bierzemy sama nazwe firmy, adres nas nie interesuje.
     */
    const at = html.indexOf("seller_box");
    const sellerBlock = at < 0 ? "" : html.slice(at, at + 800);
    const seller =
      sellerBlock.match(/class="extra_span_info[^"]*">([^<]+)</)?.[1]?.split(",")[0]?.trim() ||
      null;

    const capacity = field(d, "pojemnosc");

    return {
      sourceId: raw.ref.sourceId,
      externalId: raw.ref.externalId,
      url: raw.ref.url,

      vin: parseVin(field(d, "vin")),
      make: normalizeMake(make),
      model: normalizeModel(model) ?? titleCase(model),
      trim: null,

      year: parseYear(field(d, "rokprodukcji")),
      mileageKm: parseInteger(field(d, "przebieg")?.replace(/[\s ]/g, "")),
      priceGross: value == null ? null : isNet ? Math.round(value * VAT) : value,
      priceNet: isNet ? value : null,

      fuel: parseFuel(field(d, "paliwo")),
      gearbox: parseGearbox(field(d, "skrzyniabiegow")),
      drive: null,
      powerHp: null, // Tabela nie podaje mocy.
      engineCcm: parseInteger(capacity?.replace(/[\s ]/g, "")),
      body: null,
      color: field(d, "kolor"),
      seats: null,
      city: null,

      thumbnailUrl: largestPhoto(html, BASE),
      seller,

      offerKind: "auction",
      auctionEndsAt: null, // Licznik dociagany jest JS-em, w HTML-u nie ma daty.
    };
  },
};
