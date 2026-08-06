import { db, events, listingSnapshots, listings, sources } from "@auta/db";
import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, lte, or, sql } from "drizzle-orm";

export interface Filters {
  q?: string;
  make?: string;
  model?: string;
  source?: string;
  priceMin?: number;
  priceMax?: number;
  yearMin?: number;
  yearMax?: number;
  mileageMax?: number;
  powerMin?: number;
  fuel?: string;
  gearbox?: string;
  body?: string;
  sort?: string;
  /** "fixed" = kup teraz, "auction" = licytacja. Pusty = jedno i drugie. */
  kind?: string;
  /** "1" = pokaz wylacznie sztuki wystawione tez gdzie indziej (ten sam VIN). */
  twinsOnly?: string;
  /** "1" = tylko oferty z cena gotowkowa. */
  withPrice?: string;
  /** Minimalny deal score w procentach, np. "15" = co najmniej 15% ponizej rynku. */
  dealMin?: string;
}

export type SortKey =
  | "new"
  | "price_asc"
  | "price_desc"
  | "mileage_asc"
  | "year_desc"
  | "power_desc"
  | "deal_desc";

/*
 * Oferty bez ceny (Automarket sprzedaje czesc aut wylacznie w finansowaniu)
 * musza wypasc na koniec przy KAZDYM sortowaniu po cenie. Bez jawnego NULLS LAST
 * Postgres stawia NULL-e na poczatku przy DESC — czyli "najdrozsze" zaczynałyby
 * sie od aut bez ceny.
 */
const ORDER = {
  new: desc(listings.firstSeenAt),
  price_asc: sql`${listings.priceGross} asc nulls last`,
  price_desc: sql`${listings.priceGross} desc nulls last`,
  mileage_asc: sql`${listings.mileageKm} asc nulls last`,
  year_desc: sql`${listings.year} desc nulls last`,
  power_desc: sql`${listings.powerHp} desc nulls last`,
  // Oferty bez wyceny na koniec — brak oceny to nie to samo co ocena zerowa.
  deal_desc: sql`${listings.dealScore} desc nulls last`,
} as const;

function buildWhere(f: Filters) {
  const parts = [eq(listings.status, "active")];

  if (f.q) {
    const needle = `%${f.q}%`;
    const m = or(
      ilike(listings.make, needle),
      ilike(listings.model, needle),
      ilike(listings.trim, needle),
    );
    if (m) parts.push(m);
  }
  if (f.make) parts.push(eq(listings.make, f.make));
  if (f.model) parts.push(eq(listings.model, f.model));
  if (f.source) parts.push(eq(listings.sourceId, f.source));
  /*
   * Przy filtrze ceny oferty bez ceny wypadaja same: `null <= x` daje w SQL
   * NULL, nie TRUE. Tak ma byc — skoro ktos szuka "do 80 tys.", auto bez podanej
   * ceny nie jest odpowiedzia na to pytanie.
   */
  if (f.priceMin) parts.push(gte(listings.priceGross, f.priceMin));
  if (f.priceMax) parts.push(lte(listings.priceGross, f.priceMax));
  if (f.yearMin) parts.push(gte(listings.year, f.yearMin));
  if (f.yearMax) parts.push(lte(listings.year, f.yearMax));
  if (f.mileageMax) parts.push(lte(listings.mileageKm, f.mileageMax));
  if (f.powerMin) parts.push(gte(listings.powerHp, f.powerMin));
  if (f.fuel) parts.push(eq(listings.fuel, f.fuel));
  if (f.gearbox) parts.push(eq(listings.gearbox, f.gearbox));
  if (f.body) parts.push(ilike(listings.body, `%${f.body}%`));
  if (f.withPrice === "1") parts.push(isNotNull(listings.priceGross));

  /*
   * Filtr okazji. Prog podajemy w procentach, w bazie deal_score jest ulamkiem.
   * Oferty bez wyceny wypadaja same (NULL >= x to NULL) — i tak ma byc: nie
   * wiemy, czy sa okazja, wiec nie udajemy, ze sa.
   */
  if (f.dealMin) {
    const pct = Number(f.dealMin);
    if (Number.isFinite(pct)) parts.push(gte(listings.dealScore, pct / 100));
  }

  /*
   * Bliźniaki: ten sam VIN u wiecej niz jednego zrodla. To najmocniejszy sygnal
   * w calej bazie — rozjazd cen tego samego egzemplarza miedzy kanalami siega
   * kilkudziesieciu tysiecy — wiec zasluguje na wlasny filtr.
   */
  if (f.twinsOnly === "1") {
    parts.push(isNotNull(listings.vin));
    parts.push(
      sql`exists (
        select 1 from ${listings} t
        where t.vin = ${listings.vin}
          and t.status = 'active'
          and t.source_id <> ${listings.sourceId}
      )`,
    );
  }
  /*
   * Rozroznienie jest istotne przy sortowaniu po cenie: przy aukcjach cena to
   * biezaca oferta w licytacji, wiec auto za 1 zl wyladowaloby na szczycie jako
   * rzekoma okazja. Filtr pozwala patrzec wylacznie na ceny "kup teraz".
   */
  if (f.kind === "fixed" || f.kind === "auction") parts.push(eq(listings.offerKind, f.kind));

  return and(...parts);
}

export const PAGE_SIZE = 60;

/** Liczba ofert pasujacych do filtrow — potrzebna do paginacji. */
export async function countListings(f: Filters): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(listings)
    .where(buildWhere(f));
  return row?.n ?? 0;
}

export async function getListings(f: Filters, page = 1, limit = PAGE_SIZE) {
  const sort = (f.sort ?? "new") as SortKey;
  const offset = Math.max(0, (page - 1) * limit);
  const rows = await db
    .select({
      id: listings.id,
      url: listings.url,
      vin: listings.vin,
      make: listings.make,
      model: listings.model,
      trim: listings.trim,
      year: listings.year,
      mileageKm: listings.mileageKm,
      priceGross: listings.priceGross,
      fuel: listings.fuel,
      gearbox: listings.gearbox,
      powerHp: listings.powerHp,
      body: listings.body,
      city: listings.city,
      thumbnailUrl: listings.thumbnailUrl,
      firstSeenAt: listings.firstSeenAt,
      sourceName: sources.name,
      seller: listings.seller,
      offerKind: listings.offerKind,
      auctionEndsAt: listings.auctionEndsAt,
      marketPrice: listings.marketPrice,
      dealScore: listings.dealScore,
      dealSamples: listings.dealSamples,
      dealFromSold: listings.dealFromSold,
    })
    .from(listings)
    .innerJoin(sources, eq(sources.id, listings.sourceId))
    .where(buildWhere(f))
    /*
     * Oferty BEZ CENY zawsze na koncu, niezaleznie od wybranego sortowania.
     *
     * Automarket sprzedaje ~7 tys. aut wylacznie w leasingu i one nie maja ceny
     * gotowkowej. Przy sortowaniu "najnowsze" wchodzily miedzy zwykle oferty
     * i zalewaly liste czyms, czego i tak nie da sie porownac ani wycenic.
     * `is null` daje false(0) przed true(1), wiec sama ta kolumna wypycha je na dol,
     * a wybrane sortowanie dziala normalnie w obrebie kazdej z dwoch grup.
     */
    .orderBy(
      sql`${listings.priceGross} is null`,
      ORDER[sort] ?? ORDER.new,
      // Stabilny tie-break po id — bez niego oferty o rownej cenie potrafia
      // przeskakiwac miedzy stronami przy kolejnych zapytaniach.
      desc(listings.id),
    )
    .limit(limit)
    .offset(offset);

  if (rows.length === 0) return [];

  /*
   * Spadki cen dociagamy osobno zamiast joinowac — przy jednym zapytaniu na
   * strone jest to tansze niz LATERAL, a kod czytelniejszy.
   */
  const drops = await db
    .select({
      listingId: events.listingId,
      oldPrice: events.oldPrice,
      newPrice: events.newPrice,
      createdAt: events.createdAt,
    })
    .from(events)
    .where(
      and(
        eq(events.kind, "price_drop"),
        inArray(events.listingId, rows.map((r) => r.id)),
        gte(events.createdAt, sql`now() - interval '14 days'`),
      ),
    )
    .orderBy(desc(events.createdAt));

  const dropByListing = new Map<number, { oldPrice: number | null; newPrice: number | null }>();
  for (const d of drops) if (!dropByListing.has(d.listingId)) dropByListing.set(d.listingId, d);

  const twins = await findTwins(rows);

  return rows.map((r) => ({
    ...r,
    drop: dropByListing.get(r.id) ?? null,
    twin: twins.get(r.id) ?? null,
  }));
}

export interface Twin {
  sourceName: string;
  priceGross: number | null;
  offerKind: string;
  url: string;
  /** Ujemna = gdzie indziej taniej. */
  diff: number | null;
}

/**
 * Ta sama sztuka bywa wystawiona w kilku miejscach naraz i CENY SIE ROZNIA —
 * zaobserwowane BMW X1 (VIN WBA11EG0005297078) stalo u dealera za 189 800 zl
 * "kup teraz", a rownoczesnie szlo na aukcji za 166 788 zl.
 *
 * Dlatego nie scalamy i nie kasujemy duplikatow: pokazujemy je obok siebie,
 * bo wlasnie ta roznica jest tym, czego szuka sniper. Laczymy po VIN — jedynym
 * identyfikatorze, ktory znaczy to samo we wszystkich zrodlach.
 */
async function findTwins(
  rows: { id: number; vin: string | null; priceGross: number | null }[],
): Promise<Map<number, Twin>> {
  const vins = rows.map((r) => r.vin).filter((v): v is string => !!v);
  if (vins.length === 0) return new Map();

  const siblings = await db
    .select({
      id: listings.id,
      vin: listings.vin,
      priceGross: listings.priceGross,
      offerKind: listings.offerKind,
      url: listings.url,
      sourceName: sources.name,
    })
    .from(listings)
    .innerJoin(sources, eq(sources.id, listings.sourceId))
    .where(and(eq(listings.status, "active"), inArray(listings.vin, vins)));

  const byVin = new Map<string, typeof siblings>();
  for (const s of siblings) {
    if (!s.vin) continue;
    const list = byVin.get(s.vin) ?? [];
    list.push(s);
    byVin.set(s.vin, list);
  }

  const out = new Map<number, Twin>();
  for (const r of rows) {
    if (!r.vin) continue;
    // Spośrod blizniakow bierzemy najtanszego — to on jest istotny przy zakupie.
    const other = (byVin.get(r.vin) ?? [])
      .filter((s) => s.id !== r.id && s.priceGross != null)
      .sort((a, b) => (a.priceGross ?? 0) - (b.priceGross ?? 0))[0];
    if (!other) continue;
    out.set(r.id, {
      sourceName: other.sourceName,
      priceGross: other.priceGross,
      offerKind: other.offerKind,
      url: other.url,
      diff:
        r.priceGross != null && other.priceGross != null ? other.priceGross - r.priceGross : null,
    });
  }
  return out;
}

/**
 * Wszystko, co wiemy o jednym egzemplarzu — po VIN, czyli po jedynym
 * identyfikatorze, ktory znaczy to samo we wszystkich zrodlach.
 *
 * To jest ta czesc bazy, ktorej NIE MA zadne pojedyncze zrodlo: Otomoto nie
 * powie, ze to samo auto stoi taniej u leasingodawcy, a leasingodawca nie powie,
 * ze cena spadla dwa razy w ciagu miesiaca. Dlatego bierzemy tez oferty
 * `gone` — zniknieta oferta to najpewniejszy sygnal ceny transakcyjnej.
 */
export async function getVinHistory(vin: string) {
  const rows = await db
    .select({
      id: listings.id,
      url: listings.url,
      status: listings.status,
      registration: listings.registration,
      firstRegistrationAt: listings.firstRegistrationAt,
      make: listings.make,
      model: listings.model,
      trim: listings.trim,
      year: listings.year,
      mileageKm: listings.mileageKm,
      priceGross: listings.priceGross,
      priceNet: listings.priceNet,
      fuel: listings.fuel,
      gearbox: listings.gearbox,
      drive: listings.drive,
      powerHp: listings.powerHp,
      engineCcm: listings.engineCcm,
      body: listings.body,
      color: listings.color,
      seats: listings.seats,
      city: listings.city,
      thumbnailUrl: listings.thumbnailUrl,
      seller: listings.seller,
      offerKind: listings.offerKind,
      marketPrice: listings.marketPrice,
      dealScore: listings.dealScore,
      dealSamples: listings.dealSamples,
      dealFromSold: listings.dealFromSold,
      firstSeenAt: listings.firstSeenAt,
      lastSeenAt: listings.lastSeenAt,
      goneAt: listings.goneAt,
      sourceId: listings.sourceId,
      sourceName: sources.name,
    })
    .from(listings)
    .innerJoin(sources, eq(sources.id, listings.sourceId))
    .where(eq(listings.vin, vin))
    .orderBy(asc(listings.priceGross));

  if (rows.length === 0) return null;

  // Historia cen kazdej z ofert — stad widac przeceny i to, jak dlugo auto stoi.
  const snaps = await db
    .select({
      listingId: listingSnapshots.listingId,
      priceGross: listingSnapshots.priceGross,
      mileageKm: listingSnapshots.mileageKm,
      capturedAt: listingSnapshots.capturedAt,
    })
    .from(listingSnapshots)
    .where(inArray(listingSnapshots.listingId, rows.map((r) => r.id)))
    .orderBy(asc(listingSnapshots.capturedAt));

  const history = new Map<number, typeof snaps>();
  for (const s of snaps) {
    const arr = history.get(s.listingId) ?? [];
    arr.push(s);
    history.set(s.listingId, arr);
  }

  const priced = rows.filter((r) => r.priceGross != null && r.offerKind !== "auction");
  const cheapest = priced[0] ?? null;
  const dearest = priced[priced.length - 1] ?? null;

  /*
   * "Najtaniej" ma sens tylko wtedy, gdy naprawde jest taniej. Przy dwoch
   * ofertach po tej samej cenie plakietka na jednej z nich sugerowalaby przewage,
   * ktorej nie ma — a wybor, ktora dostanie odznake, bylby przypadkowy.
   */
  const strictlyCheapest =
    cheapest != null &&
    priced.length > 1 &&
    cheapest.priceGross != null &&
    priced[1]?.priceGross != null &&
    cheapest.priceGross < priced[1].priceGross;

  return {
    vin,
    listings: rows.map((r) => ({ ...r, history: history.get(r.id) ?? [] })),
    /*
     * Rozpietosc liczymy WYLACZNIE miedzy cenami "kup teraz". Wrzucenie tu
     * aukcji obiecywaloby oszczednosc, ktora zniknie do konca licytacji.
     */
    spread:
      cheapest && dearest && cheapest.id !== dearest.id && cheapest.priceGross != null && dearest.priceGross != null
        ? dearest.priceGross - cheapest.priceGross
        : null,
    cheapestId: strictlyCheapest ? cheapest.id : null,
  };
}

export type VinHistory = NonNullable<Awaited<ReturnType<typeof getVinHistory>>>;

export type OfferRow = Awaited<ReturnType<typeof getListings>>[number];

export async function getMakes(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ make: listings.make })
    .from(listings)
    .where(eq(listings.status, "active"))
    .orderBy(asc(listings.make));
  return rows.map((r) => r.make);
}

/**
 * Modele wybranej marki. Bez marki zwracamy pusto — pelna lista to ponad tysiac
 * pozycji z calego rynku, a "Corolla" obok "Serii 3" nie jest wyborem, tylko szumem.
 */
export async function getModels(make?: string): Promise<string[]> {
  if (!make) return [];
  const rows = await db
    .selectDistinct({ model: listings.model })
    .from(listings)
    .where(and(eq(listings.status, "active"), eq(listings.make, make)))
    .orderBy(asc(listings.model));
  return rows.map((r) => r.model);
}

/** Zrodla z liczba aktywnych ofert — do filtra i do kontroli, czy adapter zyje. */
export async function getSources() {
  return db
    .select({
      id: sources.id,
      name: sources.name,
      active: sql<number>`count(${listings.id}) filter (where ${listings.status} = 'active')::int`,
    })
    .from(sources)
    .leftJoin(listings, eq(listings.sourceId, sources.id))
    .groupBy(sources.id, sources.name)
    .orderBy(asc(sources.name));
}

export async function getStats() {
  const [row] = await db
    .select({
      active: sql<number>`count(*) filter (where ${listings.status} = 'active')::int`,
      gone: sql<number>`count(*) filter (where ${listings.status} = 'gone')::int`,
      newToday: sql<number>`count(*) filter (
        where ${listings.status} = 'active' and ${listings.firstSeenAt} > now() - interval '24 hours'
      )::int`,
      medianPrice: sql<number>`coalesce(
        percentile_cont(0.5) within group (order by ${listings.priceGross})
        filter (where ${listings.status} = 'active'), 0
      )::int`,
    })
    .from(listings);
  return row;
}

/**
 * Zdrowie zrodel — do strony /zrodla.
 *
 * Powstalo, bo zeby sprawdzic, czy ktorys adapter nie umarl, trzeba bylo pisac
 * SQL recznie. To dokladnie ten scenariusz, przed ktorym ostrzega README:
 * parser pada po cichu, przebieg raportuje "0 bledow", a oferty przestaja
 * dochodzic. Bez tej strony nikt tego nie zauwazy przez tydzien.
 */
export async function getSourceHealth() {
  const rows = await db
    .select({
      id: sources.id,
      name: sources.name,
      baseUrl: sources.baseUrl,
      lastDiscoverAt: sources.lastDiscoverAt,
      active: sql<number>`count(${listings.id}) filter (where ${listings.status} = 'active')::int`,
      gone: sql<number>`count(${listings.id}) filter (where ${listings.status} = 'gone')::int`,
      withPrice: sql<number>`count(${listings.id}) filter (
        where ${listings.status} = 'active' and ${listings.priceGross} is not null
      )::int`,
      withVin: sql<number>`count(${listings.id}) filter (
        where ${listings.status} = 'active' and ${listings.vin} is not null
      )::int`,
      newToday: sql<number>`count(${listings.id}) filter (
        where ${listings.status} = 'active'
          and ${listings.firstSeenAt} > now() - interval '24 hours'
      )::int`,
      /*
       * Surowy `sql` NIE przechodzi przez mapowanie typow Drizzle — Postgres
       * oddaje tu string, nie Date. Deklarowanie `sql<Date>` bylo klamstwem
       * wobec kompilatora: typecheck przechodzil, a strona wywalala sie
       * w runtime na `.getTime is not a function`. Konwersje robimy jawnie nizej.
       */
      lastSeenAt: sql<string | null>`max(${listings.lastSeenAt})`,
    })
    .from(sources)
    .leftJoin(listings, eq(listings.sourceId, sources.id))
    .groupBy(sources.id, sources.name, sources.baseUrl, sources.lastDiscoverAt)
    .orderBy(desc(sql`count(${listings.id}) filter (where ${listings.status} = 'active')`));

  // Jawna konwersja zamiast udawania, ze baza zwrocila Date.
  return rows.map((r) => ({
    ...r,
    lastSeenAt: r.lastSeenAt ? new Date(r.lastSeenAt) : null,
  }));
}

export type SourceHealth = Awaited<ReturnType<typeof getSourceHealth>>[number];
