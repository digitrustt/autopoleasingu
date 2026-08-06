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
  splitMakeModel,
  titleCase,
} from "@auta/core";
import { fetchText } from "../http";
import type { SourceAdapter } from "../types";

const BASE = "https://aukcje.pkoleasing.pl";

/*
 * Te same parametry co poleasingowe.ts: procsubcat zawęża do osobowek po
 * stronie serwera, list_pagesize=20 to maksimum, jakie serwis honoruje.
 */
const LIST =
  `${BASE}/pl/auctions/list/pub/all/vehicles` +
  "?procsubcat=ecr_cartypess&mainprodcat=vehicles&vendor=all&list_sort=dzr&list_pagesize=20";
const MAX_PAGES = 20;

/**
 * Aukcje poleasingowe PKO Leasing — platforma AUKCYJNA, osobna od automarket.pl
 * (tam PKO Leasing sprzedaje "kup teraz"; tu licytuje sztuki z krotszym
 * przebiegiem sprzedaznym). Ten sam silnik co poleasingowe.pl (identyczna
 * struktura URL /auctions/list, /auctions/details, te same kody ecr_*), ale
 * inny host i inny inwentarz — nie duplikat.
 *
 * robots.txt blokuje tylko /auctions/calc-commission, /bidder-panel/.../all_offers
 * i /files — listing i detale sa dozwolone.
 *
 * WAZNE: "Aktualna cena" w DOM to Alpine.js binding (x-text), pusty w surowym
 * HTML-u. Prawdziwa wartosc siedzi w inline <script> jako obiekt JS
 * `auction: { current_price, current_price_brutto, endDateTimer }` —
 * bierzemy ja regexem wprost z tego bloku, bez proby JSON.parse (cudzyslowy
 * pojedyncze, klucze bez cudzyslowu — to nie jest poprawny JSON).
 */

function decode(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&oacute;/g, "ó")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** Pary "<span>Etykieta<br></span><span class="bold">Wartosc</span>" w karcie danych pojazdu. */
function dataFields(html: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /<span>([^<]+?)<br\s*\/?>\s*<\/span>\s*<span class="bold">([^<]*)<\/span>/g;
  for (const m of html.matchAll(re)) {
    out.set(decode(m[1]).toLowerCase(), decode(m[2]));
  }
  return out;
}

/**
 * Marka/model nie sa w tabeli danych — trzeba je wziac z okruszkow nawigacji.
 * Kotwiczymy na aria-label, nie na "breadcrumb-item": ten drugi to podlancuch
 * samej klasy pierwszego <li>, wiec ciecie od niego obcina otwierajacy tag
 * i regex gubi pierwszy okruszek ("Strona glowna").
 */
function breadcrumb(html: string): string[] {
  const at = html.indexOf('aria-label="Breadcrumb"');
  if (at < 0) return [];
  const section = html.slice(at, at + 1600);
  return [...section.matchAll(/<li class="breadcrumb-item">(?:<a[^>]*>)?([^<]*)/g)].map((m) =>
    decode(m[1]),
  );
}

export const pkoaukcje: SourceAdapter = {
  id: "pkoaukcje",
  name: "Aukcje PKO Leasing",
  baseUrl: BASE,
  strategy: "http",
  delayMs: 1200,

  async discover(): Promise<ListingRef[]> {
    const seen = new Map<string, ListingRef>();
    let emptyStreak = 0;

    for (let page = 1; page <= MAX_PAGES; page++) {
      const html = await fetchText(`${LIST}&page=${page}`, {
        delayMs: pkoaukcje.delayMs,
        timeoutMs: 45_000,
      });

      const found = [
        ...html.matchAll(/\/pl\/auctions\/details\/([a-z0-9-]+)\/([a-z0-9]+)(?![a-z0-9])/g),
      ];
      if (found.length === 0) break;

      let fresh = 0;
      for (const [, slug, code] of found) {
        if (seen.has(code)) continue;
        seen.set(code, {
          sourceId: "pkoaukcje",
          externalId: code,
          url: `${BASE}/pl/auctions/details/${slug}/${code}`,
        });
        fresh++;
      }
      emptyStreak = fresh === 0 ? emptyStreak + 1 : 0;
      if (emptyStreak >= 3) break;
    }

    return [...seen.values()];
  },

  async fetchDetail(ref: ListingRef): Promise<RawListing> {
    const body = await fetchText(ref.url, { delayMs: pkoaukcje.delayMs, timeoutMs: 45_000 });
    return { ref, body, fetchedAt: new Date() };
  },

  parse(raw: RawListing): NormalizedListing | null {
    const html = raw.body;

    /*
     * Kategoria /vehicles miesza osobowki z dostawczymi (Sprinter, Ducato) —
     * okruszki mowia prawde, procsubcat w zapytaniu jej nie gwarantuje.
     *
     * NIE kotwiczymy na stalym indeksie: dlugosc sciezki zalezy od tego, czy
     * serwis widzi sesje. Bez ciasteczek jest ["Strona glowna", "Pojazdy",
     * "Samochody osobowe", marka, model], a z sesja dochodzi "Wszystkie aukcje
     * publiczne" i wszystko przesuwa sie o jedno. Szukamy wiec kategorii po
     * nazwie i czytamy marke oraz model wzgledem niej.
     */
    const crumbs = breadcrumb(html);
    const catAt = crumbs.indexOf("Samochody osobowe");
    if (catAt < 0) return null;

    /*
     * Rzadkie modele (Mercedes-Maybach, Mazda MX-30 w probce) nie maja wlasnego
     * poziomu w okruszkach — konczy sie na marce. Wtedy rozbijamy naglowek H1
     * tym samym helperem co CarArena.
     */
    const makeCrumb = crumbs[catAt + 1];
    const modelCrumb = crumbs[catAt + 2];
    let make = makeCrumb ? normalizeMake(makeCrumb) : null;
    let model = modelCrumb ? (normalizeModel(modelCrumb) ?? titleCase(modelCrumb)) : null;
    if (make && !model) {
      const h1 = decode(html.match(/<h1[^>]*>([\s\S]{0,200}?)<\/h1>/)?.[1] ?? "");
      const split = h1 ? splitMakeModel(h1) : null;
      if (split) {
        make = split.make;
        model = split.model;
      }
    }
    if (!make || !model) return null;

    const d = dataFields(html);

    const priceNet = parseInteger(html.match(/current_price:\s*'([^']*)'/)?.[1]);
    const priceGross = parseInteger(html.match(/current_price_brutto:\s*'([^']*)'/)?.[1]);
    const endsAt = html.match(/endDateTimer:\s*moment\('([\d-]+ [\d:]+)'\)/)?.[1];

    const firstImage = html.match(/<img[^>]+src="(https:\/\/[^"]+\/images\/[^"]+\.(?:jpe?g|png|webp))"/i);

    return {
      sourceId: raw.ref.sourceId,
      externalId: raw.ref.externalId,
      url: raw.ref.url,

      vin: parseVin(d.get("vin")),
      registration: parseRegistration(d.get("nr rejestracyjny")),
      firstRegistrationAt: parseRegistrationDate(d.get("data pierwszej rejestracji")),
      make,
      model,
      trim: null,

      year: parseYear(d.get("data pierwszej rejestracji")?.slice(0, 4)),
      mileageKm: parseInteger(d.get("przebieg")),
      priceGross: priceGross ?? (priceNet != null ? Math.round(priceNet * 1.23) : null),
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
      auctionEndsAt: endsAt ? new Date(endsAt.replace(" ", "T")) : null,
    };
  },
};
