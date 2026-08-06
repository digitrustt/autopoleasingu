import type { ListingRef, NormalizedListing, RawListing } from "@auta/core";
import {
  normalizeMake,
  parseDrive,
  parseFuel,
  parseGearbox,
  parseInteger,
  parseVin,
  parseYear,
  titleCase,
} from "@auta/core";
import { fetchJson } from "../http";
import type { SourceAdapter } from "../types";

const SITE = "https://autoselect.arval.pl";
/** Portal 17 = Arval Polska. Adres wyciagniety z konfiguracji wstrzykniętej w HTML. */
const API = "https://arval-prod-euw-appservice-portalapi.azurewebsites.net/api/Announcements/17";

/**
 * Arval AutoSelect. Strona to shell SPA (kazda trasa zwraca ten sam HTML),
 * wiec jedziemy po ich publicznym API. Rekord listingu niesie juz komplet poza
 * VIN-em i moca — te dobiera fetchDetail.
 *
 * robots.txt samego autoselect.arval.pl blokuje URL-e z filtrami (?makes= itd.);
 * nie tykamy ich — API jest na osobnym hoscie i tych regul nie obejmuje.
 */

interface Details {
  mileage: number | null;
  registrationYear: number | null;
  fuelTypeLabel: string | null;
  gearbox: string | null;
}

interface Announcement {
  id: number;
  make: string;
  model: string;
  trim: string | null;
  bodyType: string | null;
  location: string | null;
  offerUrl: string | null;
  mainImage: string | null;
  purchaseOption: string | null;
  salePriceGross: number | null;
  salePriceNet: number | null;
  details: Details | null;
}

interface ListResponse {
  announcements: {
    currentPageNumber: number;
    allAnnouncementsCount: number;
    allPageQuantity: number;
    announcements: Announcement[];
  };
}

interface DetailResponse {
  vin: string | null;
  colour: string | null;
  driveTrain: string | null;
  horsePower: number | null;
  engineSize: number | null;
  numberOfSeats: number | null;
}

export const arval: SourceAdapter = {
  id: "arval",
  name: "Arval AutoSelect",
  baseUrl: SITE,
  strategy: "http",
  delayMs: 1200,
  /** parse() czyta z ref.payload — bez discover nie ma czego odswiezac. */
  needsDiscoveryPayload: true,

  async discover(): Promise<ListingRef[]> {
    const res = await fetchJson<ListResponse>(`${API}?PageSize=2000&PageIndex=1`, {
      delayMs: 0,
      timeoutMs: 90_000,
    });

    return res.announcements.announcements
      /*
       * "release" to re-leasing — ma zerowe salePrice i rate w reLeasePrice*.
       * Bierzemy wylacznie "sale", inaczej do bazy trafilyby zera zamiast cen.
       */
      .filter((a) => a.purchaseOption === "sale" && (a.salePriceGross ?? 0) > 0)
      .map((a) => ({
        sourceId: "arval",
        externalId: String(a.id),
        // offerUrl podaje samo API — nie musimy zgadywac slugow.
        url: a.offerUrl ?? `${SITE}/uzywane-samochody/oferta/${a.id}`,
        payload: a,
      }));
  },

  async fetchDetail(ref: ListingRef): Promise<RawListing> {
    let detail: DetailResponse | null = null;
    try {
      detail = await fetchJson<DetailResponse>(`${API}/${ref.externalId}`, {
        delayMs: arval.delayMs,
      });
    } catch {
      detail = null;
    }
    return {
      ref,
      body: JSON.stringify({ list: ref.payload, detail }),
      fetchedAt: new Date(),
    };
  },

  parse(raw: RawListing): NormalizedListing | null {
    const { list, detail } = JSON.parse(raw.body) as {
      list: Announcement | null;
      detail: DetailResponse | null;
    };
    if (!list?.make || !list.model) return null;

    return {
      sourceId: raw.ref.sourceId,
      externalId: raw.ref.externalId,
      url: raw.ref.url,

      vin: parseVin(detail?.vin),
      make: normalizeMake(list.make),
      /*
       * Arval to firma hiszpanska i jej API zwraca "CLASE E" zamiast "Klasa E"
       * — w polskim interfejsie to po prostu bledna nazwa, a przy tym rozjezdza
       * modele Mercedesa z pozostalymi zrodlami. Adres oferty ma juz poprawnie
       * "klasa-e", wiec to wylacznie sprawa pola w API.
       */
      model: titleCase(list.model).replace(/^Clase\b/i, "Klasa"),
      trim: list.trim?.trim() || null,

      year: parseYear(list.details?.registrationYear),
      mileageKm: parseInteger(list.details?.mileage),
      priceGross: parseInteger(list.salePriceGross),
      priceNet: parseInteger(list.salePriceNet),

      fuel: parseFuel(list.details?.fuelTypeLabel),
      gearbox: parseGearbox(list.details?.gearbox),
      drive: parseDrive(detail?.driveTrain),
      powerHp: parseInteger(detail?.horsePower),
      engineCcm: parseInteger(detail?.engineSize),
      body: list.bodyType?.trim() || null,
      color: detail?.colour?.trim() || null,
      seats: parseInteger(detail?.numberOfSeats),
      city: list.location?.trim() || null,

      thumbnailUrl: list.mainImage?.trim() || null,
    };
  },
};
