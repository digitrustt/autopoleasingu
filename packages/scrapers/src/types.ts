import type { ListingRef, NormalizedListing, RawListing } from "@auta/core";

export interface SourceAdapter {
  id: string;
  name: string;
  baseUrl: string;
  strategy: "http" | "browser";

  /** Odstep miedzy zadaniami do tego zrodla (ms). */
  delayMs: number;

  /**
   * Jak czesto przechodzic pelna liste ofert. Domyslnie co przebieg.
   * Ustaw dla zrodel, gdzie discover kosztuje setki zadan (Toyota: 300 stron) —
   * miedzy przelotami pipeline korzysta z ofert juz zapisanych w bazie.
   */
  discoverEveryMinutes?: number;

  /**
   * Adapter przenosi dane oferty przez `ListingRef.payload` z discover() do
   * parse(), zamiast pobierac strone szczegolow.
   *
   * MA ZNACZENIE PRZY DLAWIENIU DISCOVERY: gdy pipeline pomija discover,
   * odtwarza ListingRef-y z bazy — a te nie maja payloadu. Dla takiego adaptera
   * parse dostawalby wtedy `undefined` i cale zrodlo sypaloby bledami albo,
   * gorzej, po cichu pomijalo wszystkie oferty.
   *
   * Ustawienie tej flagi mowi silnikowi: albo discover, albo nic — nigdy
   * odswiezanie na pustym payloadzie.
   */
  needsDiscoveryPayload?: boolean;

  /** Faza 1: lista ofert do sprawdzenia. */
  discover(): Promise<ListingRef[]>;

  /** Faza 2: pobranie strony oferty. */
  fetchDetail(ref: ListingRef): Promise<RawListing>;

  /** Faza 3+4: surowa tresc -> znormalizowana oferta. Null gdy oferta nieczytelna. */
  parse(raw: RawListing): NormalizedListing | null;
}
