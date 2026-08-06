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
  titleCase,
} from "@auta/core";
import { fetchText } from "../http";
import type { SourceAdapter } from "../types";

/**
 * Otomoto — WYLACZNIE sklepy firmowe leasingodawcow i CFM, nie caly serwis.
 *
 * Otomoto ma 234 tys. ofert osobowych; filtr "sprzedawca: firma" zawęża to
 * do 188 tys., czyli nadal calego handlu uzywkami. To nie jest to, czego szukamy,
 * a przy ~1,4 kB na oferte rozsadziloby darmowy tier Neona (0,5 GB) samym
 * pierwszym zaciagiem. Zamiast tego bierzemy imiennie poddomeny firm, ktore
 * sprzedaja tu wlasny stock poleasingowy.
 *
 * DZIEKI TEMU WCHODZA TRZY ZRODLA NIEDOSTEPNE INACZEJ:
 *   - Athlon — na wlasnej stronie kieruje klientow indywidualnych wprost tutaj,
 *   - Sixt (Eurorent) — sixt.pl oddaje challenge Cloudflare,
 *   - Vehis — vehis.pl blokuje w robots.txt jedyna sciezke do danych.
 * Reszta poddomen to firmy, ktore mamy juz z ich wlasnych serwisow — trzymamy je,
 * bo roznica cen tego samego auta miedzy kanalami jest sama w sobie sygnalem.
 *
 * SCIEZKA MA ZNACZENIE: listingiem sklepu jest `/inventory`, nie `/osobowe`.
 * Obie oddaja te same 30 pierwszych ofert, ale tylko `/inventory` honoruje
 * `?page=N` — offset rosnie o 30 i przychodza kolejne auta. Na `/osobowe`
 * paginacja, filtry marki i przewijanie sa po cichu IGNOROWANE: strona w kolko
 * zwraca te sama trzydziestke, co wyglada na komplet, dopoki nie porowna sie
 * jej z polem `total`. Adres `/inventory` podaje samo Otomoto w `sellerUrl`
 * na stronie oferty.
 *
 * robots.txt otomoto.pl: "Allow: /" dla wszystkich, zabronione sa /api/ i /ajax/
 * — my czytamy zwykly HTML strony sklepu i tamtych sciezek nie dotykamy.
 */

/** Ile ofert oddaje jedna strona `/inventory`. Stala serwisu. */
const PAGE_SIZE = 30;
/** Bezpiecznik na wypadek, gdyby `total` klamal — najwiekszy sklep ma ~110 ofert. */
const MAX_PAGES = 40;

/** Poddomena -> nazwa sprzedajacego do kolumny `seller`. */
const STORES: [string, string][] = [
  ["athlon", "Athlon Car Lease"],
  ["sixt", "Sixt (Eurorent)"],
  ["vehis", "VEHIS"],
  ["arval", "Arval"],
  ["alphabet", "Alphabet"],
  ["carefleet", "Carefleet"],
  ["pkoleasing", "PKO Leasing"],
  ["efl", "EFL"],
  ["mleasing", "mLeasing"],
  ["impuls", "Impuls Leasing"],
  ["vbleasing", "VB Leasing"],
];

interface AdAttribute {
  key: string;
  value?: string | null;
}

interface OtomotoAd {
  id: string;
  title?: string | null;
  url?: string | null;
  photos?: string[] | null;
  price?: {
    grossMinorAmount?: number | null;
    netMinorAmount?: number | null;
  } | null;
  attributes?: AdAttribute[] | null;
}

/**
 * Wyluskuje liste ofert ze stanu urql wstrzyknietego w __NEXT_DATA__.
 * `data` jest tam stringiem z JSON-em, nie obiektem — stad podwojny parse.
 */
function readAds(html: string): { ads: OtomotoAd[]; seller: string | null; total: number } {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return { ads: [], seller: null, total: 0 };

  let props: Record<string, unknown>;
  try {
    const parsed = JSON.parse(m[1]) as { props?: { pageProps?: Record<string, unknown> } };
    props = parsed.props?.pageProps ?? {};
  } catch {
    return { ads: [], seller: null, total: 0 };
  }

  /*
   * Nieistniejaca poddomena NIE daje 404 — Otomoto oddaje wtedy strone glowna
   * z licznikiem rzedu 2,3 mln ofert. Brak `businessName` jest jedynym pewnym
   * odroznikiem; bez tej kontroli adapter zaciagnalby losowe oferty z calego
   * serwisu jako "oferty leasingodawcy".
   */
  const seller = typeof props.businessName === "string" ? props.businessName : null;
  if (!seller) return { ads: [], seller: null, total: 0 };

  const urql = (props.urqlState ?? {}) as Record<string, { data?: string }>;
  for (const entry of Object.values(urql)) {
    if (typeof entry?.data !== "string") continue;
    try {
      const inner = JSON.parse(entry.data) as {
        publishedAds?: { total?: number; ads?: OtomotoAd[] };
      };
      if (inner.publishedAds?.ads) {
        return {
          ads: inner.publishedAds.ads,
          seller,
          total: inner.publishedAds.total ?? inner.publishedAds.ads.length,
        };
      }
    } catch {
      // Inny wpis cache'u — szukamy dalej.
    }
  }
  return { ads: [], seller, total: 0 };
}

function attr(ad: OtomotoAd, key: string): string | null {
  const v = ad.attributes?.find((a) => a.key === key)?.value;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Ceny przychodza w groszach ("minor amount"). */
function fromMinor(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? Math.round(v / 100) : null;
}

export const otomoto: SourceAdapter = {
  id: "otomoto",
  name: "Otomoto — sklepy leasingodawcow",
  baseUrl: "https://www.otomoto.pl",
  strategy: "http",
  delayMs: 1500,
  /** parse() czyta z ref.payload — bez discover nie ma czego odswiezac. */
  needsDiscoveryPayload: true,
  /** Discover kosztuje dziesiatki zadan — miedzy przelotami odswiezamy znane oferty. */
  discoverEveryMinutes: 30,

  async discover(): Promise<ListingRef[]> {
    const seen = new Map<string, ListingRef>();

    for (const [subdomain, sellerName] of STORES) {
      let total = Number.POSITIVE_INFINITY;

      for (let page = 1; page <= MAX_PAGES; page++) {
        let html: string;
        try {
          html = await fetchText(`https://${subdomain}.otomoto.pl/inventory?page=${page}`, {
            delayMs: otomoto.delayMs,
            timeoutMs: 45_000,
            retries: 1,
          });
        } catch {
          // Sklep moze zniknac — reszta poddomen ma sie zaciagnac mimo to.
          break;
        }

        const found = readAds(html);
        // Brak `businessName` = poddomena nie istnieje i dostalismy strone glowna.
        if (!found.seller || found.ads.length === 0) break;
        total = found.total;

        for (const ad of found.ads) {
          if (!ad?.id || seen.has(ad.id)) continue;
          seen.set(ad.id, {
            sourceId: "otomoto",
            externalId: ad.id,
            // Adres oferty podaje samo API — nie skladamy sluga.
            url: ad.url ?? `https://www.otomoto.pl/osobowe/oferta/ID${ad.id}.html`,
            payload: { ad, seller: found.seller ?? sellerName },
          });
        }

        // Ostatnia strona: mniej niz pelna paczka albo osiagnieta deklarowana suma.
        if (found.ads.length < PAGE_SIZE || page * PAGE_SIZE >= total) break;
      }
    }

    return [...seen.values()];
  },

  // Kafelek niesie komplet — strona oferty nie dodaje ani jednego pola wiecej.
  async fetchDetail(ref: ListingRef): Promise<RawListing> {
    return { ref, body: JSON.stringify(ref.payload), fetchedAt: new Date() };
  },

  parse(raw: RawListing): NormalizedListing | null {
    const { ad, seller } = JSON.parse(raw.body) as { ad: OtomotoAd; seller: string };

    const make = attr(ad, "make");
    const model = attr(ad, "model");
    if (!make || !model) return null;

    // Sklepy wystawiaja tez auta nowe — te zaburzylyby wycene rynkowa uzywanych.
    if (attr(ad, "new_used") === "new") return null;

    /*
     * VIN jest w polu `vin`, ale ZASZYFROWANY (token typu "AUUKypi6/iZ...=.1.7UX"),
     * nie 17-znakowy numer. parseVin i tak go odrzuci — zostawiamy jawnie null,
     * zeby nie wygladalo, ze zrodlo VIN-y podaje. Dedup oprze sie tu na
     * fingerprincie i pHashu zdjec.
     */

    const gross = fromMinor(ad.price?.grossMinorAmount);
    const net = fromMinor(ad.price?.netMinorAmount);

    return {
      sourceId: raw.ref.sourceId,
      externalId: raw.ref.externalId,
      url: raw.ref.url,

      vin: parseVin(null),
      make: normalizeMake(make),
      model: normalizeModel(titleCase(model)) ?? titleCase(model),
      // "ver-1-3-tce-mhev-techno-edc" jest sluga; version_label jest czytelny.
      trim: attr(ad, "version_label") ?? ad.title?.trim() ?? null,

      year: parseYear(attr(ad, "year")),
      mileageKm: parseInteger(attr(ad, "mileage")),
      priceGross: gross,
      priceNet: net,

      fuel: parseFuel(attr(ad, "fuel_type")),
      gearbox: parseGearbox(attr(ad, "gearbox")),
      drive: parseDrive(attr(ad, "transmission")),
      powerHp: parseInteger(attr(ad, "engine_power")),
      engineCcm: parseInteger(attr(ad, "engine_capacity")),
      body: attr(ad, "body_type"),
      color: attr(ad, "color"),
      seats: parseInteger(attr(ad, "nr_seats")),
      city: null,

      thumbnailUrl: ad.photos?.[0] ?? null,
      seller,
    };
  },
};
