import type { ListingRef, NormalizedListing, RawListing } from "@auta/core";
import { normalizeModel, parseInteger, parseYear, splitMakeModel } from "@auta/core";
import { fetchText } from "../http";
import type { SourceAdapter } from "../types";

const BASE = "https://www.dawro.pl";
const LIST = `${BASE}/aukcje/lista`;

/**
 * Dawro (Dom Aukcyjny Mariola Nosko) — aukcje m.in. dla Santandera, VeloBanku
 * i Stellantisa. Maly wolumen, ale tanie zrodlo: cala lista to jedno zapytanie.
 *
 * Czytamy WYLACZNIE liste. Adresy /aukcja/{id},{slug} nie sa stronami pojedynczej
 * oferty — pod kazdym z nich serwis pokazuje ten sam pelny wykaz aukcji, a nazwa
 * oferty siedzi jedynie w <title>. Wczesniejsza wersja probowala wylowic wlasciwy
 * blok, dopasowujac slug z URL-a do tytulu, i przy niezgodnosci brala PIERWSZY
 * blok z brzegu — przez co pieciu roznym autom (Movano, Jumper, Ducato, 500)
 * przypisala dane tego samego Peugeota 308. Blok z listy niesie wlasny href z id,
 * wiec powiazanie jest jednoznaczne i takiej pomylki nie da sie juz popelnic.
 *
 * Serwis miesza pojazdy z nieruchomosciami — te ostatnie nie maja rocznika ani
 * przebiegu i po tym je odsiewamy.
 */

interface Card {
  id: string;
  slug: string;
  title: string;
  price: string | null;
  year: string | null;
  mileage: string | null;
  photo: string | null;
}

function decode(v: string): string {
  return v
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCards(html: string): Card[] {
  const out: Card[] = [];
  // Kazda oferta to <a class="ramka" href="/aukcja/{id},{slug}"> ... </a>
  for (const chunk of html.split('<a class="ramka"').slice(1)) {
    const link = chunk.match(/^\s*href="\/aukcja\/(\d+),([a-z0-9-]+)"/);
    if (!link) continue;

    const title = chunk.match(/<div class="nazwa">([\s\S]*?)<\/div>/)?.[1];
    if (!title) continue;

    out.push({
      id: link[1],
      slug: link[2],
      title: decode(title),
      price: chunk.match(/class="cena">([^<]*)</)?.[1] ?? null,
      year: chunk.match(/Rok produkcji:\s*(\d{4})/)?.[1] ?? null,
      mileage: chunk.match(/Przebieg:\s*([\d\s ]+)\s*km/)?.[1] ?? null,
      photo: chunk.match(/data-original="([^"]+)"/)?.[1] ?? null,
    });
  }
  return out;
}

export const dawro: SourceAdapter = {
  id: "dawro",
  name: "Dawro (aukcje)",
  baseUrl: BASE,
  strategy: "http",
  delayMs: 1200,
  /** parse() czyta z ref.payload — bez discover nie ma czego odswiezac. */
  needsDiscoveryPayload: true,

  async discover(): Promise<ListingRef[]> {
    const html = await fetchText(LIST, { delayMs: dawro.delayMs, timeoutMs: 45_000 });
    const seen = new Map<string, ListingRef>();

    for (const card of parseCards(html)) {
      // Nieruchomosci i dzierzawy nie maja rocznika ani przebiegu.
      if (!card.year && !card.mileage) continue;
      if (seen.has(card.id)) continue;
      seen.set(card.id, {
        sourceId: "dawro",
        externalId: card.id,
        url: `${BASE}/aukcja/${card.id},${card.slug}`,
        payload: card,
      });
    }
    return [...seen.values()];
  },

  // Komplet jest juz na liscie — pobieranie detalu tylko dokladaloby ruchu.
  async fetchDetail(ref: ListingRef): Promise<RawListing> {
    return { ref, body: JSON.stringify(ref.payload), fetchedAt: new Date() };
  },

  parse(raw: RawListing): NormalizedListing | null {
    const c = JSON.parse(raw.body) as Card | null;
    if (!c?.title) return null;

    // "MINI [BMW] Countryman Cooper S ALL4" -> nawias z grupa kapitalowa odpada.
    const clean = c.title.replace(/\s*\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();
    const mm = splitMakeModel(clean);
    if (!mm) return null;

    return {
      sourceId: raw.ref.sourceId,
      externalId: raw.ref.externalId,
      url: raw.ref.url,

      vin: null,
      make: mm.make,
      model: normalizeModel(mm.model) ?? mm.model,
      trim: null,

      year: parseYear(c.year),
      mileageKm: parseInteger(c.mileage?.replace(/[\s ]/g, "")),
      // "58 230,00 zł" — spacja to separator tysiecy, czesc po przecinku odpada.
      priceGross: parseInteger(c.price?.replace(/[\s ]/g, "").split(",")[0]),
      priceNet: null,

      fuel: null,
      gearbox: null,
      drive: null,
      powerHp: null,
      engineCcm: null,
      body: null,
      color: null,
      seats: null,
      city: null,

      thumbnailUrl: c.photo ? `${BASE}${c.photo}` : null,

      offerKind: "auction",
      auctionEndsAt: null,
    };
  },
};
