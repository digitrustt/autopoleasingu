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
} from "@auta/core";
import { fetchText } from "../http";
import type { SourceAdapter } from "../types";

const BASE = "https://aukcje.mhcmobility.pl";
/** type=4 to giełda samochodow osobowych; inne typy to sprzet i pojazdy ciezkie. */
const LIST = `${BASE}/AuctionList.aspx?type=4`;
const MAX_PAGES = 15;

/**
 * MHC Mobility Polska (dawniej Athlon Car Lease) — gielda aut poleasingowych.
 *
 * Wyszlo przy szukaniu, gdzie sprzedaje Masterlease: serwis nie byl na pierwotnej
 * liscie szesnastu zrodel.
 *
 * To ASP.NET WebForms, wiec paginacja nie jest adresowalna GET-em — kolejne strony
 * chodza przez __doPostBack z __VIEWSTATE. Adapter odtwarza ten POST: bierze
 * viewstate z odebranej strony i odsyla go z __EVENTARGUMENT=Page$N. Bez tego
 * widac wylacznie pierwsza z czterech stron.
 *
 * Kafelek listy niesie juz cene brutto i netto, przebieg, rocznik, moc i paliwo;
 * strona ItemDetails dokłada VIN, kolor, pojemnosc i nadwozie.
 *
 * Ceny sa podawane w obu wariantach naraz ("Cena brutto: 89 448,06 zl / Cena
 * netto: 72 722,00 zl"), wiec nie trzeba niczego przeliczac — w odroznieniu od
 * poleasingowe.pl i autoprzetarg.pl, gdzie mnozymy netto przez 1,23.
 */

function decode(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&oacute;/g, "ó")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Wszystkie ukryte pola formularza. Trzeba odeslac KOMPLET, nie sam __VIEWSTATE:
 * strona wystawia jeszcze __CSRFTOKEN i po polu na kazdy wiersz siatki, a przy
 * niepelnym zestawie ASP.NET odpowiada bledem 500 zamiast kolejna strona.
 */
function hiddenFields(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of html.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
    const tag = m[0];
    const name = tag.match(/name="([^"]+)"/)?.[1];
    if (!name) continue;
    out[name] = (tag.match(/value="([^"]*)"/)?.[1] ?? "").replace(/&amp;/g, "&");
  }
  return out;
}

interface Card {
  id: string;
  title: string | null;
  trim: string | null;
  powerHp: string | null;
  fuel: string | null;
  mileageKm: string | null;
  gearbox: string | null;
  year: string | null;
  priceGross: string | null;
  priceNet: string | null;
  thumbnailUrl: string | null;
}

/**
 * Kazda oferta jest w HTML DWA RAZY — raz jako wiersz listy, raz jako kafelek
 * (strona przelacza widoki po stronie klienta). Bierzemy pierwsze wystapienie
 * danego data-id; patrz cararena, gdzie ta sama pulapka ucinala zaciag.
 */
function parseCards(html: string): Card[] {
  const body = html.replace(/<script[\s\S]*?<\/script>/g, " ");
  const out = new Map<string, Card>();

  const blocks = body.split(/(?=<div data-id="\d+")/).slice(1);
  for (const block of blocks) {
    const id = block.match(/^<div data-id="(\d+)"/)?.[1];
    if (!id || out.has(id)) continue;

    const text = decode(block.replace(/<[^>]+>/g, "|")).replace(/\s*\|\s*/g, "|");
    const cells = text.split("|").filter(Boolean);

    const grossAt = cells.findIndex((c) => /^Brutto:?$/i.test(c));
    const netAt = cells.findIndex((c) => /^Netto:?$/i.test(c));

    out.set(id, {
      id,
      title: cells[0] ?? null,
      trim: cells[1] ?? null,
      powerHp: cells.find((c) => /\d+\s*KM$/i.test(c)) ?? null,
      fuel: cells.find((c) => /benzyn|diesel|hybry|elektr|lpg/i.test(c)) ?? null,
      // Przebieg to jedyna czysta liczba z separatorem tysiecy, bez "zl" i "KM".
      mileageKm: cells.find((c) => /^\d[\d ]{2,}$/.test(c)) ?? null,
      gearbox: cells.find((c) => /^(automat|manual)/i.test(c)) ?? null,
      year: cells.find((c) => /^(19|20)\d{2}$/.test(c)) ?? null,
      priceGross: grossAt >= 0 ? (cells[grossAt + 1] ?? null) : null,
      priceNet: netAt >= 0 ? (cells[netAt + 1] ?? null) : null,
      // Adres miniatury jest zaescapowany w HTML — bez odkodowania "&amp;" nie laduje sie.
      thumbnailUrl:
        block.match(/src="(SiteHelpers\/ImgRender\.aspx\?[^"]+)"/)?.[1].replace(/&amp;/g, "&") ??
        null,
    });
  }
  return [...out.values()];
}

/** Etykietowane pola na ItemDetails: "VIN:|ZAR...", "Kolor:|bialy". */
function detailFields(html: string): Map<string, string> {
  const body = html.replace(/<script[\s\S]*?<\/script>/g, " ");
  const cells = decode(body.replace(/<[^>]+>/g, "|"))
    .replace(/\s*\|\s*/g, "|")
    .split("|")
    .filter(Boolean);

  const out = new Map<string, string>();
  for (let i = 0; i < cells.length - 1; i++) {
    const label = cells[i].replace(/:$/, "").trim().toLowerCase();
    if (label) out.set(label, cells[i + 1]);
  }
  return out;
}

export const mhc: SourceAdapter = {
  id: "mhc",
  name: "MHC Mobility (d. Athlon)",
  baseUrl: BASE,
  strategy: "http",
  delayMs: 1200,
  /** parse() czyta z ref.payload — bez discover nie ma czego odswiezac. */
  needsDiscoveryPayload: true,
  /** Discover kosztuje dziesiatki zadan — miedzy przelotami odswiezamy znane oferty. */
  discoverEveryMinutes: 30,

  async discover(): Promise<ListingRef[]> {
    const seen = new Map<string, ListingRef>();

    let html = await fetchText(LIST, { delayMs: mhc.delayMs, timeoutMs: 45_000, cookies: true });

    for (let page = 1; page <= MAX_PAGES; page++) {
      for (const card of parseCards(html)) {
        if (seen.has(card.id)) continue;
        seen.set(card.id, {
          sourceId: "mhc",
          externalId: card.id,
          url: `${BASE}/ItemDetails.aspx?id=${card.id}`,
          payload: card,
        });
      }

      // Paginator wypisuje tylko istniejace strony — brak linku = koniec listy.
      if (!html.includes(`Page$${page + 1}&#39;`) && !html.includes(`Page$${page + 1}'`)) break;

      html = await fetchText(LIST, {
        delayMs: mhc.delayMs,
        timeoutMs: 45_000,
        // Postback bez ciasteczka sesji ASP.NET konczy sie bledem 500.
        cookies: true,
        form: {
          ...hiddenFields(html),
          __EVENTTARGET: "ctl00$MainContent$gvAuctions",
          __EVENTARGUMENT: `Page$${page + 1}`,
        },
      });
    }

    return [...seen.values()];
  },

  async fetchDetail(ref: ListingRef): Promise<RawListing> {
    let detail = "";
    try {
      detail = await fetchText(ref.url, { delayMs: mhc.delayMs, timeoutMs: 45_000 });
    } catch {
      // Kafelek wystarcza — detal dokłada tylko VIN, kolor i pojemnosc.
    }
    return {
      ref,
      body: JSON.stringify({ card: ref.payload ?? null, detail }),
      fetchedAt: new Date(),
    };
  },

  parse(raw: RawListing): NormalizedListing | null {
    const { card, detail } = JSON.parse(raw.body) as { card: Card | null; detail: string };
    if (!card?.title) return null;

    /*
     * Tytul to "ALFA ROMEO Stelvio 17-22 Stelvio 2.0 Turbo TI Q4 aut" — marka,
     * model, zakres rocznikow i wersja sklejone razem. Nie tniemy po pierwszej
     * spacji: "ALFA ROMEO" i "MERCEDES-BENZ" daloby to model "ROMEO".
     */
    const mm = splitMakeModel(card.title);
    if (!mm) return null;

    // Z reszty tytulu zostawiamy sam model: ucinamy zakres rocznikow ("17-22") i ogon wersji.
    const model = mm.model.split(/\s+\d{2}-\d{2}\s+/)[0].split(/\s+/)[0];

    const d = detailFields(detail || "");

    return {
      sourceId: raw.ref.sourceId,
      externalId: raw.ref.externalId,
      url: raw.ref.url,

      vin: parseVin(d.get("vin")),
      registration: parseRegistration(d.get("nr rej")),
      firstRegistrationAt: parseRegistrationDate(d.get("data pierwszej rejestracji")),
      make: mm.make,
      model: normalizeModel(model) ?? model,
      trim: card.trim,

      year: parseYear(card.year) ?? parseYear(d.get("rok produkcji")),
      mileageKm: parseInteger(card.mileageKm?.replace(/[\s ]/g, "")),
      priceGross: parseInteger(card.priceGross?.replace(/[\s ]/g, "")),
      priceNet: parseInteger(card.priceNet?.replace(/[\s ]/g, "")),

      fuel: parseFuel(card.fuel ?? d.get("rodzaj paliwa")),
      gearbox: parseGearbox(card.gearbox ?? d.get("skrzynia biegów")),
      drive: null,
      powerHp: parseInteger(card.powerHp),
      engineCcm: parseInteger(d.get("pojemność silnika")?.replace(/[\s ]/g, "")),
      body: d.get("rodzaj nadwozia") ?? null,
      color: d.get("kolor") ?? null,
      seats: null,
      city: null,

      thumbnailUrl: card.thumbnailUrl ? `${BASE}/${card.thumbnailUrl}` : null,
      seller: "MHC Mobility",

      /*
       * To gielda z "Zloz oferte", ale cena brutto jest cena wywolawcza podana
       * wprost przez sprzedajacego, nie biezaca licytacja rosnaca w czasie —
       * dlatego fixed, a nie auction.
       */
      offerKind: "fixed",
    };
  },
};
