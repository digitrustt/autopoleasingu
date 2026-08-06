import type { ListingRef, NormalizedListing } from "@auta/core";
import { db, events, listings, listingSnapshots, sources } from "@auta/db";
import type { SourceAdapter } from "@auta/scrapers";
import { and, eq, inArray, sql } from "drizzle-orm";

export interface RunOptions {
  /**
   * Ile stron detali pobrac w jednym przebiegu. Pelny przelot Automarketu to
   * ~9,4 tys. ofert × 1,2 s ≈ 3 h, wiec kazdy run bierze tylko wycinek:
   * najpierw nowe oferty, potem najdawniej odswiezane.
   */
  detailLimit: number;
  /** Nie odswiezaj oferty czesciej niz co tyle godzin. */
  refreshAfterHours: number;
  dryRun?: boolean;
}

export interface RunResult {
  discovered: number;
  fetched: number;
  created: number;
  priceChanged: number;
  gone: number;
  /** Prawdziwe awarie: blad sieci albo niespodziewany ksztalt strony. */
  failed: number;
  /**
   * Swiadomie pominiete przez adapter (np. ciezarowka na liscie "samochody").
   * Trzymane osobno od failed — inaczej normalne filtrowanie zamaskowaloby
   * moment, w ktorym parser naprawde sie psuje.
   */
  skipped: number;
}

export async function runSource(
  adapter: SourceAdapter,
  opts: RunOptions,
): Promise<RunResult> {
  const result: RunResult = {
    discovered: 0, fetched: 0, created: 0, priceChanged: 0, gone: 0, failed: 0, skipped: 0,
  };

  await db
    .insert(sources)
    .values({
      id: adapter.id,
      name: adapter.name,
      baseUrl: adapter.baseUrl,
      strategy: adapter.strategy,
    })
    .onConflictDoNothing();

  const [srcRow] = await db
    .select({ lastDiscoverAt: sources.lastDiscoverAt })
    .from(sources)
    .where(eq(sources.id, adapter.id));

  const dueAt = adapter.discoverEveryMinutes
    ? (srcRow?.lastDiscoverAt?.getTime() ?? 0) + adapter.discoverEveryMinutes * 60_000
    : 0;

  const knownCount = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(listings)
    .where(eq(listings.sourceId, adapter.id))
    .then((r) => r[0]?.n ?? 0);

  /*
   * Dlawienie discovery ma sens tylko wtedy, gdy jest co odswiezac. Przy pustym
   * zrodle pominiecie discover dawalo przebieg "0 znaleziono, 0 bledow" —
   * czyli cisze wygladajaca na sukces. Pierwszy zaciag zawsze musi odkrywac.
   */
  const didDiscover = Date.now() >= dueAt || knownCount === 0;

  /*
   * Adapter, ktory niesie dane w ListingRef.payload, NIE MOZE pracowac na
   * refach odtworzonych z bazy — te payloadu nie maja, wiec parse dostalby
   * undefined. Zamiast produkowac smieci albo po cichu pomijac wszystko,
   * konczymy przebieg tego zrodla bez zmian i mowimy o tym wprost.
   *
   * Zlapane na Škodzie: po dolozeniu discoverEveryMinutes zrodlo zaraportowalo
   * 974 bledy z 974 ofert. Toyota miala ten sam konflikt od dawna, tyle ze
   * ciszej — jej parse oddawal null, wiec przebieg pokazywal "pominieto",
   * co wyglada na normalne filtrowanie.
   */
  if (!didDiscover && adapter.needsDiscoveryPayload) {
    console.log(
      `  ${adapter.id}: discover zdlawiony, a zrodlo wymaga payloadu — pomijam przebieg`,
    );
    return result;
  }

  const known = await db
    .select({
      id: listings.id,
      externalId: listings.externalId,
      url: listings.url,
      priceGross: listings.priceGross,
      mileageKm: listings.mileageKm,
      lastSeenAt: listings.lastSeenAt,
    })
    .from(listings)
    .where(eq(listings.sourceId, adapter.id));

  const knownByExt = new Map(known.map((k) => [k.externalId, k]));

  /*
   * Gdy pomijamy discover, pracujemy na ofertach juz zapisanych w bazie —
   * odswiezamy im ceny, ale NIE oznaczamy niczego jako "gone", bo nie mamy
   * aktualnej listy i skasowalibysmy zywe oferty.
   */
  let refs: ListingRef[];
  if (didDiscover) {
    refs = await adapter.discover();
    if (refs.length === 0) throw new Error(`${adapter.id}: discover nie zwrocil nic`);
  } else {
    refs = known.map((k) => ({
      sourceId: adapter.id,
      externalId: k.externalId,
      url: k.url,
    }));
  }
  result.discovered = refs.length;

  const seenExternalIds = new Set(refs.map((r) => r.externalId));

  // Priorytet: nowe oferty przed odswiezaniem starych. Sniper zyje z nowych.
  const staleBefore = Date.now() - opts.refreshAfterHours * 3600_000;
  const fresh = refs.filter((r) => !knownByExt.has(r.externalId));
  const stale = refs
    .filter((r) => {
      const k = knownByExt.get(r.externalId);
      return k != null && k.lastSeenAt.getTime() < staleBefore;
    })
    .sort((a, b) => {
      const ka = knownByExt.get(a.externalId)!.lastSeenAt.getTime();
      const kb = knownByExt.get(b.externalId)!.lastSeenAt.getTime();
      return ka - kb;
    });

  const queue = [...fresh, ...stale].slice(0, opts.detailLimit);

  for (const ref of queue) {
    let parsed: NormalizedListing | null = null;
    try {
      const raw = await adapter.fetchDetail(ref);
      parsed = adapter.parse(raw);
      result.fetched++;
    } catch (err) {
      result.failed++;
      console.warn(`  ! ${ref.url}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    // parse() === null to decyzja adaptera, ze oferta nas nie dotyczy — nie awaria.
    if (!parsed) {
      result.skipped++;
      continue;
    }
    if (opts.dryRun) continue;

    const prev = knownByExt.get(ref.externalId);
    const [row] = await db
      .insert(listings)
      .values({
        ...parsed,
        seller: parsed.seller ?? null,
        offerKind: parsed.offerKind ?? "fixed",
        auctionEndsAt: parsed.auctionEndsAt ?? null,
        status: "active",
        lastSeenAt: new Date(),
      })
      /*
       * Nadpisujemy WSZYSTKIE pola z parsera, nie tylko cene i przebieg.
       * Wczesniej make/model/rocznik byly pomijane, wiec poprawka parsera
       * (np. "BMW T-Roc" -> "Volkswagen T-Roc") nigdy nie docierala do juz
       * zapisanych ofert — dane zostawaly bledne az do skasowania wiersza.
       * Nie ruszamy tylko firstSeenAt: to znacznik historyczny.
       */
      .onConflictDoUpdate({
        target: [listings.sourceId, listings.externalId],
        set: {
          url: parsed.url,
          vin: parsed.vin,
          registration: parsed.registration ?? null,
          firstRegistrationAt: parsed.firstRegistrationAt ?? null,
          make: parsed.make,
          model: parsed.model,
          trim: parsed.trim,
          year: parsed.year,
          mileageKm: parsed.mileageKm,
          priceGross: parsed.priceGross,
          priceNet: parsed.priceNet,
          fuel: parsed.fuel,
          gearbox: parsed.gearbox,
          drive: parsed.drive,
          powerHp: parsed.powerHp,
          engineCcm: parsed.engineCcm,
          body: parsed.body,
          color: parsed.color,
          seats: parsed.seats,
          city: parsed.city,
          thumbnailUrl: parsed.thumbnailUrl,
          seller: parsed.seller ?? null,
          offerKind: parsed.offerKind ?? "fixed",
          auctionEndsAt: parsed.auctionEndsAt ?? null,
          status: "active",
          goneAt: null,
          lastSeenAt: new Date(),
        },
      })
      .returning({ id: listings.id });

    const priceMoved = prev != null && prev.priceGross !== parsed.priceGross;
    const mileageMoved = prev != null && prev.mileageKm !== parsed.mileageKm;

    // Snapshot tylko przy realnej zmianie — inaczej tabela puchnie bez informacji.
    if (prev == null || priceMoved || mileageMoved) {
      await db.insert(listingSnapshots).values({
        listingId: row.id,
        priceGross: parsed.priceGross,
        mileageKm: parsed.mileageKm,
      });
    }

    if (prev == null) {
      result.created++;
      await db.insert(events).values({
        listingId: row.id,
        kind: "new",
        newPrice: parsed.priceGross,
      });
    } else if (priceMoved && prev.priceGross != null && parsed.priceGross != null) {
      result.priceChanged++;
      await db.insert(events).values({
        listingId: row.id,
        kind: parsed.priceGross < prev.priceGross ? "price_drop" : "price_up",
        oldPrice: prev.priceGross,
        newPrice: parsed.priceGross,
      });
    }
  }

  /*
   * Oferta, ktorej nie ma juz w sitemapie, jest ~sprzedana. To najcenniejszy
   * sygnal w calym systemie: cena znikajacej oferty ≈ cena transakcyjna,
   * i wlasnie na tym (a nie na cenach wiszacych) uczymy pozniej wyceny.
   * Warunek: discover musial sie udac w calosci, inaczej skasujemy zywe oferty.
   */
  if (!opts.dryRun && didDiscover) {
    const missing = known
      .filter((k) => !seenExternalIds.has(k.externalId))
      .map((k) => k.id);

    for (let i = 0; i < missing.length; i += 500) {
      const chunk = missing.slice(i, i + 500);
      await db
        .update(listings)
        .set({ status: "gone", goneAt: new Date() })
        .where(and(inArray(listings.id, chunk), eq(listings.status, "active")));
      result.gone += chunk.length;
    }
  }

  /*
   * Dry-run nie moze ruszac bazy — takze tabeli `sources`. Wczesniej zapisywal
   * lastDiscoverAt, wiec proba "na sucho" dlawila discovery prawdziwego
   * przebiegu i ten konczyl sie pustym wynikiem.
   */
  if (!opts.dryRun) {
    await db
      .update(sources)
      .set({
        lastRunAt: new Date(),
        lastRunOk: true,
        lastError: null,
        ...(didDiscover ? { lastDiscoverAt: new Date() } : {}),
      })
      .where(eq(sources.id, adapter.id));
  }

  return result;
}

export async function markSourceFailed(sourceId: string, err: unknown): Promise<void> {
  await db
    .update(sources)
    .set({
      lastRunAt: new Date(),
      lastRunOk: false,
      lastError: err instanceof Error ? err.message : String(err),
    })
    .where(eq(sources.id, sourceId));
}
