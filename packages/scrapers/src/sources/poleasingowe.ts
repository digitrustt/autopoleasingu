import type { ListingRef, NormalizedListing, RawListing } from "@auta/core";
import {
  normalizeMake,
  normalizeModel,
  parseFuel,
  parseGearbox,
  parseInteger,
  parseRegistration,
  parseRegistrationDate,
  parseVin,
  parseYear,
  titleCase,
} from "@auta/core";
import { fetchText } from "../http";
import type { SourceAdapter } from "../types";

const BASE = "https://poleasingowe.pl";

/*
 * procsubcat=ecr_cartypess zawęża liste do osobowek PO STRONIE SERWERA, a
 * list_pagesize=20 podwaja strone (wyzsze wartosci serwis i tak przycina do 20).
 * Bez tego bralismy 786 pozycji z 80 stron i odrzucali ~300 ciezarowek dopiero
 * po pobraniu ich stron szczegolow — teraz jest 480 pozycji z 25 stron.
 */
const LIST =
  `${BASE}/pl/auctions/list/pub/all/vehicles` +
  "?procsubcat=ecr_cartypess&mainprodcat=vehicles&vendor=all&list_sort=dzr&list_pagesize=20";
const MAX_PAGES = 60;

/** VAT 23% — na aukcjach cena podawana jest netto, "Forma sprzedazy: faktura VAT". */
const VAT = 1.23;

/**
 * Poleasingowe.pl (EFL / European Remarketing Center) — platforma AUKCYJNA.
 * Cena to aktualna oferta w licytacji, nie "kup teraz", dlatego offerKind=auction.
 *
 * Uwaga: kategoria /vehicles miesza osobowki z ciezarowkami i naczepami.
 * Odsiewamy je juz w zapytaniu (procsubcat), a kontrola okruszkow "Samochody
 * osobowe" w parse() zostaje jako zabezpieczenie, gdyby filtr przestal dzialac.
 *
 * Ta sama platforma obsluguje kilku leasingodawcow pod wlasnymi poddomenami
 * (pekaoleasing., millenniumleasing., efl.). Sprawdzone empirycznie: wszystkie
 * ich aukcje sa rowniez na domenie glownej (52/52 Pekao, 6/6 Millennium),
 * wiec jeden crawl glownej wystarcza — osobne adaptery byłyby duplikatem.
 */

function stripTags(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&oacute;/g, "ó")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tabela "Dane podstawowe": pary <div class="auction-data-label|value">. */
function dataItems(html: string): Map<string, string> {
  const out = new Map<string, string>();
  const re =
    /<div class="auction-data-label">([\s\S]*?)<\/div>\s*<div class="auction-data-value">([\s\S]*?)<\/div>/g;
  for (const m of html.matchAll(re)) {
    out.set(stripTags(m[1]).toLowerCase(), stripTags(m[2]));
  }
  return out;
}

export const poleasingowe: SourceAdapter = {
  id: "poleasingowe",
  name: "Poleasingowe.pl (EFL)",
  baseUrl: BASE,
  strategy: "http",
  delayMs: 1000,
  /** Discover kosztuje dziesiatki zadan — miedzy przelotami odswiezamy znane oferty. */
  discoverEveryMinutes: 30,

  async discover(): Promise<ListingRef[]> {
    const seen = new Map<string, ListingRef>();

    let emptyStreak = 0;

    for (let page = 1; page <= MAX_PAGES; page++) {
      const html = await fetchText(`${LIST}&page=${page}`, {
        delayMs: poleasingowe.delayMs,
        timeoutMs: 45_000,
      });

      // /pl/auctions/details/{slug}/{kod}  — kod jest naszym externalId
      const found = [
        ...html.matchAll(/\/pl\/auctions\/details\/([a-z0-9-]+)\/([a-z0-9]+)(?![a-z0-9])/g),
      ];
      if (found.length === 0) break;

      let fresh = 0;
      for (const m of found) {
        const [, slug, code] = m;
        if (seen.has(code)) continue;
        seen.set(code, {
          sourceId: "poleasingowe",
          externalId: code,
          url: `${BASE}/pl/auctions/details/${slug}/${code}`,
        });
        fresh++;
      }
      /*
       * Dopiero kilka pustych stron z rzedu oznacza koniec listy. Pojedyncza
       * strona bez nowosci zdarza sie, gdy serwis przestawi kolejnosc w trakcie
       * zaciagu i powtorzy poprzednia — przerwanie na niej gubi reszte ofert.
       */
      emptyStreak = fresh === 0 ? emptyStreak + 1 : 0;
      if (emptyStreak >= 3) break;
    }

    return [...seen.values()];
  },

  async fetchDetail(ref: ListingRef): Promise<RawListing> {
    const body = await fetchText(ref.url, { delayMs: poleasingowe.delayMs });
    return { ref, body, fetchedAt: new Date() };
  },

  parse(raw: RawListing): NormalizedListing | null {
    const html = raw.body;
    const text = stripTags(html);

    // Odsiewamy ciezarowki, naczepy i maszyny — interesuja nas osobowki.
    if (!text.includes("Samochody osobowe")) return null;

    const d = dataItems(html);
    const make = d.get("marka");
    const model = d.get("model");
    if (!make || !model) return null;

    // "Aktualna cena 30100.00 PLN netto"
    const priceMatch = text.match(/Aktualna cena\s*([\d\s.,]+)\s*PLN/i);
    const priceNet = priceMatch ? parseInteger(priceMatch[1].replace(/\s/g, "")) : null;
    const priceGross = priceNet != null ? Math.round(priceNet * VAT) : null;

    const firstImage = html.match(
      /<img[^>]+src="(https:\/\/[^"]+\/(?:auctions|files|images)\/[^"]+\.(?:jpe?g|png|webp))"/i,
    );

    return {
      sourceId: raw.ref.sourceId,
      externalId: raw.ref.externalId,
      url: raw.ref.url,

      vin: parseVin(d.get("vin")),
      registration: parseRegistration(d.get("nr rejestracyjny")),
      firstRegistrationAt: parseRegistrationDate(d.get("data pierwszej rejestracji")),
      make: normalizeMake(make),
      // titleCase zrobilby z "XC60" -> "Xc60", a z "I30" -> zly zapis Hyundaia.
      model: normalizeModel(model) ?? titleCase(model),
      trim: d.get("typ") ? titleCase(d.get("typ")!) : null,

      year: parseYear(d.get("rok produkcji")),
      mileageKm: parseInteger(d.get("przebieg")),
      priceGross,
      priceNet,

      fuel: parseFuel(d.get("paliwo")),
      gearbox: parseGearbox(d.get("skrzynia biegów")),
      drive: null,
      powerHp: parseInteger(d.get("moc silnika")),
      engineCcm: parseInteger(d.get("pojemność silnika")),
      body: d.get("typ") ? titleCase(d.get("typ")!) : null,
      color: d.get("kolor") ? titleCase(d.get("kolor")!) : null,
      seats: parseInteger(d.get("ilość miejsc")),
      city: null,

      thumbnailUrl: firstImage?.[1] ?? null,

      offerKind: "auction",
      auctionEndsAt: null,
    };
  },
};
