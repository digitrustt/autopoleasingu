/** Wspolny model danych dla wszystkich zrodel. Kazdy adapter mapuje na to. */

export type Fuel = "petrol" | "diesel" | "hybrid" | "phev" | "electric" | "lpg" | "cng" | "other";
export type Gearbox = "manual" | "automatic" | "other";
export type Drive = "fwd" | "rwd" | "awd" | "other";

/** Wskaznik na oferte znaleziony w fazie discover — jeszcze bez danych pojazdu. */
export interface ListingRef {
  sourceId: string;
  externalId: string;
  url: string;
  /**
   * Dane juz zdobyte w fazie discover. Zrodla z API listingowym (Alphabet)
   * zwracaja komplet pol jednym zadaniem — byloby marnotrawstwem pobierac je
   * ponownie per oferta. Zrodla sitemapowe (Automarket) zostawiaja to puste.
   */
  payload?: unknown;
}

/** Surowa odpowiedz ze zrodla, przed interpretacja. Trzymamy do snapshot-testow. */
export interface RawListing {
  ref: ListingRef;
  body: string;
  fetchedAt: Date;
}

/** Znormalizowana oferta — to trafia do bazy. */
export interface NormalizedListing {
  sourceId: string;
  externalId: string;
  url: string;

  vin: string | null;
  /*
   * Numer rejestracyjny i pelna data pierwszej rejestracji. Razem z VIN-em sa
   * kompletem, ktorego wymaga historiapojazdu.gov.pl — sam VIN nie wystarczy,
   * zeby sprawdzic historie pojazdu w CEPiK.
   */
  registration?: string | null;
  firstRegistrationAt?: Date | null;
  make: string;
  model: string;
  trim: string | null;

  year: number | null;
  mileageKm: number | null;

  /** Cena gotowkowa brutto w PLN. Null gdy zrodlo podaje wylacznie rate. */
  priceGross: number | null;
  priceNet: number | null;

  fuel: Fuel | null;
  gearbox: Gearbox | null;
  drive: Drive | null;
  powerHp: number | null;
  engineCcm: number | null;
  body: string | null;
  color: string | null;
  seats: number | null;
  city: string | null;

  /** Hot-linkujemy miniature ze zrodla. Nigdy nie hostujemy zdjec — storage kosztuje. */
  thumbnailUrl: string | null;

  /**
   * Faktyczny sprzedajacy, gdy zrodlo jest platforma wielofirmowa: autoprzetarg.pl
   * wystawia auta Alior Leasing, VeloLeasing, Santandera i BNP naraz. Bez tego
   * "sourceId" mowi tylko, gdzie oferta wisi, a nie czyja jest.
   */
  seller?: string | null;

  /**
   * fixed = cena "kup teraz", auction = aktualna oferta w licytacji.
   * Domyslnie "fixed"; platformy aukcyjne ustawiaja "auction".
   */
  offerKind?: "fixed" | "auction";
  auctionEndsAt?: Date | null;
}
