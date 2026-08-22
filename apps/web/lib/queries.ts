import { db, events, listingSnapshots, listings, sources } from "@auta/db";
import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, lte, or, sql } from "drizzle-orm";
import { groupBySlug } from "@/lib/slug";

export interface Filters {
  q?: string;
  make?: string;
  /** Nazwa modelu albo komplet pisowni tego samego sluga. */
  model?: string | string[];
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
  /** Miasto albo komplet wariantow zapisu tej samej nazwy. */
  city?: string | string[];
  /**
   * Grupa nadwozia ("suv", "kombi"), nie surowa wartosc z bazy.
   *
   * Zrodla pisza nadwozie wolnym tekstem — 90 wariantow, w tym "Kombi",
   * "Combi", "Touring" i "Variant" oznaczajace to samo. Filtr `body` szuka
   * przez ilike jednego ciagu i przez to gubi polowe; `bodyGroup` dopasowuje
   * cala rodzine wyrazeniem regularnym. Patrz BODY_GROUPS.
   */
  bodyGroup?: string;
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
/*
 * Przy sortowaniu PO CENIE aukcje ida za oferta "kup teraz".
 *
 * Powod nie jest kosmetyczny: cena aukcyjna to biezaca oferta w licytacji,
 * ktora pojdzie w gore — nie jest wiec porownywalna z cena zakupu. Zmierzone
 * na tej bazie: wsrod 200 najtanszych ofert 157 to licytacje, wiec "cena
 * rosnaco" pokazywala 108 aukcji na 120 kafelkow, z czolowka po 1 zl i 100 zl.
 * Wygladalo to na okazje stulecia, a bylo licytacja w polowie drogi.
 *
 * Kto chce ogladac same aukcje, ma do tego filtr `kind`.
 */
const AUCTIONS_LAST = sql`${listings.offerKind} = 'auction'`;

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

/**
 * Rodziny nadwozi — jedno wyrazenie na kazda.
 *
 * Te same wzorce co w lib/spec.tsx po stronie ikon, ale tutaj musza byc
 * w SQL-u, bo filtrowanie dzieje sie w bazie. Zmiana w jednym miejscu
 * wymaga zmiany w drugim — dlatego oba komentarze na siebie wskazuja.
 */
export const BODY_GROUPS: Record<string, string> = {
  suv: "suv|sav|terenow|crossover",
  kombi: "kombi|combi|estate|touring|variant",
  sedan: "sedan|limuzyn",
  hatchback: "hatch|kompakt",
  van: "van|bus|minivan",
  coupe: "coupe|cabrio|roadster",
  dostawcze: "dostawcz|furgon|pick",
};

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
  if (f.model) parts.push(modelMatches(f.model));
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
  if (f.bodyGroup && BODY_GROUPS[f.bodyGroup]) {
    parts.push(sql`${listings.body} ~* ${BODY_GROUPS[f.bodyGroup]}`);
  }
  if (f.city) parts.push(cityMatches(f.city));
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

/**
 * Dopasowanie modelu: jedna nazwa albo KOMPLET pisowni tego samego sluga.
 *
 * Zrodla zapisuja model roznie ("XC60", "XC 60", "Xc-60"), a wszystkie te
 * warianty mieszkaja pod jednym adresem `/volvo/xc-60`. Filtrowanie po
 * rownosci pokazywaloby oferty tylko z jednej pisowni — patrz lib/slug.ts.
 */
function modelMatches(model: string | string[]) {
  return Array.isArray(model) ? inArray(listings.model, model) : eq(listings.model, model);
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
      // Tylko przy sortowaniu po cenie — przy "najnowsze" swieza aukcja
      // jest tak samo nowa jak kazda inna oferta i nie ma powodu jej spychac.
      ...(sort === "price_asc" || sort === "price_desc" ? [AUCTIONS_LAST] : []),
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
      /*
       * Mediana LICZONA BEZ AUKCJI. Cena aukcyjna rosnie w czasie, wiec
       * wrzucona do jednego worka z cenami "kup teraz" zanizala naglowek
       * (117 630 zamiast 119 900 zl) — ta sama zasada, ktora rzadzi wycena.
       */
      medianPrice: sql<number>`coalesce(
        percentile_cont(0.5) within group (order by ${listings.priceGross})
        filter (where ${listings.status} = 'active' and ${listings.offerKind} = 'fixed'), 0
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

/* ────────────────────────────────────────────────────────────────────────────
 * Strony docelowe marka / model
 *
 * Zapytania ponizej obsluguja /[marka] i /[marka]/[model]. Powstaly, bo cala
 * baza — 22 tys. ofert i 1290 par marka+model — wisiala pod jednym adresem
 * z filtrami w query stringu. Wyszukiwarka widziala z tego jedna strone.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Tylko oferty, ktore realnie da sie porownac — bez nich statystyki klamia. */
const LIVE = and(eq(listings.status, "active"), isNotNull(listings.priceGross));

/**
 * Marki z liczba ofert, malejaco.
 *
 * Kolejnosc ma znaczenie przy rozwiazywaniu sluga: gdy dwa zapisy nazwy daja
 * ten sam slug, wygrywa ten z wieksza liczba ofert. Patrz lib/slug.ts.
 */
export async function getMakesWithCounts() {
  return db
    .select({
      make: listings.make,
      total: sql<number>`count(*)::int`,
      medianPrice: sql<number | null>`percentile_cont(0.5) within group (
        order by ${listings.priceGross}
      ) filter (where ${listings.offerKind} = 'fixed')::int`,
    })
    .from(listings)
    .where(eq(listings.status, "active"))
    .groupBy(listings.make)
    .orderBy(desc(sql`count(*)`));
}

/** Modele jednej marki z liczba ofert i mediana — do listy na stronie marki. */
export async function getModelsWithCounts(make: string) {
  return db
    .select({
      model: listings.model,
      total: sql<number>`count(*)::int`,
      minPrice: sql<number | null>`min(${listings.priceGross}) filter (
        where ${listings.offerKind} = 'fixed'
      )::int`,
      medianPrice: sql<number | null>`percentile_cont(0.5) within group (
        order by ${listings.priceGross}
      ) filter (where ${listings.offerKind} = 'fixed')::int`,
    })
    .from(listings)
    .where(and(eq(listings.status, "active"), eq(listings.make, make)))
    .groupBy(listings.model)
    .orderBy(desc(sql`count(*)`));
}

/**
 * Liczby na naglowek strony docelowej.
 *
 * Mediana i rozpietosc liczone WYLACZNIE z ofert "kup teraz" — cena aukcyjna
 * to biezaca oferta w licytacji i jeszcze urosnie, wiec w statystyce cen
 * rynkowych nie ma czego szukac. Ta sama zasada rzadzi wycena i naglowkiem
 * strony glownej.
 */
export async function getSegmentStats(make: string, model?: string | string[]) {
  const scope = model
    ? and(eq(listings.make, make), modelMatches(model))
    : eq(listings.make, make);

  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      withPrice: sql<number>`count(*) filter (where ${listings.priceGross} is not null)::int`,
      newToday: sql<number>`count(*) filter (
        where ${listings.firstSeenAt} > now() - interval '24 hours'
      )::int`,
      deals: sql<number>`count(*) filter (where ${listings.dealScore} >= 0.1)::int`,
      sources: sql<number>`count(distinct ${listings.sourceId})::int`,
      minPrice: sql<number | null>`min(${listings.priceGross}) filter (
        where ${listings.offerKind} = 'fixed'
      )::int`,
      maxPrice: sql<number | null>`max(${listings.priceGross}) filter (
        where ${listings.offerKind} = 'fixed'
      )::int`,
      medianPrice: sql<number | null>`percentile_cont(0.5) within group (
        order by ${listings.priceGross}
      ) filter (where ${listings.offerKind} = 'fixed')::int`,
      medianMileage: sql<number | null>`percentile_cont(0.5) within group (
        order by ${listings.mileageKm}
      )::int`,
      minYear: sql<number | null>`min(${listings.year})::int`,
      maxYear: sql<number | null>`max(${listings.year})::int`,
    })
    .from(listings)
    .where(and(eq(listings.status, "active"), scope));

  return row;
}

/**
 * Rozbicie po roczniku: ile sztuk i za ile.
 *
 * To jest ta jedna tabelka, dla ktorej warto wejsc na strone modelu — mowi,
 * ile kosztuje ROCZNIK, a nie "model od 40 tys.". Zadne pojedyncze zrodlo
 * tego nie pokaze, bo zadne nie ma 26 kanalow naraz.
 */
export async function getYearBreakdown(make: string, model: string | string[]) {
  return db
    .select({
      year: listings.year,
      total: sql<number>`count(*)::int`,
      minPrice: sql<number>`min(${listings.priceGross})::int`,
      medianPrice: sql<number>`percentile_cont(0.5) within group (
        order by ${listings.priceGross}
      )::int`,
      medianMileage: sql<number | null>`percentile_cont(0.5) within group (
        order by ${listings.mileageKm}
      )::int`,
    })
    .from(listings)
    .where(
      and(
        LIVE,
        eq(listings.make, make),
        modelMatches(model),
        eq(listings.offerKind, "fixed"),
        isNotNull(listings.year),
      ),
    )
    .groupBy(listings.year)
    .orderBy(desc(listings.year));
}

/** Rozbicie po paliwie — druga najczestsza os wyboru po roczniku. */
export async function getFuelBreakdown(make: string, model: string | string[]) {
  return db
    .select({
      fuel: listings.fuel,
      total: sql<number>`count(*)::int`,
      medianPrice: sql<number>`percentile_cont(0.5) within group (
        order by ${listings.priceGross}
      )::int`,
    })
    .from(listings)
    .where(
      and(
        LIVE,
        eq(listings.make, make),
        modelMatches(model),
        eq(listings.offerKind, "fixed"),
        isNotNull(listings.fuel),
      ),
    )
    .groupBy(listings.fuel)
    .orderBy(desc(sql`count(*)`));
}

/* ────────────────────────────────────────────────────────────────────────────
 * Pojedyncza oferta — /oferta/[id]
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Jedna oferta z pelna specyfikacja.
 *
 * Bierzemy rowniez oferty ze statusem `gone`. Zniknieta oferta NIE jest bledem
 * 404: adres mogl juz trafic do indeksu albo na czyjas liste, a strona
 * z informacja "sprzedane, oto podobne" jest warta wiecej niz pusty blad —
 * i dla czytelnika, i dla wyszukiwarki.
 */
export async function getListing(id: number) {
  const [row] = await db
    .select({
      id: listings.id,
      url: listings.url,
      vin: listings.vin,
      status: listings.status,
      make: listings.make,
      model: listings.model,
      trim: listings.trim,
      year: listings.year,
      registration: listings.registration,
      firstRegistrationAt: listings.firstRegistrationAt,
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
      auctionEndsAt: listings.auctionEndsAt,
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
    .where(eq(listings.id, id));

  if (!row) return null;

  const history = await db
    .select({
      priceGross: listingSnapshots.priceGross,
      mileageKm: listingSnapshots.mileageKm,
      capturedAt: listingSnapshots.capturedAt,
    })
    .from(listingSnapshots)
    .where(eq(listingSnapshots.listingId, id))
    .orderBy(asc(listingSnapshots.capturedAt));

  // Ta sama sztuka u innego zrodla — rozjazd cen miedzy kanalami siega
  // kilkudziesieciu tysiecy i jest najmocniejszym sygnalem w calej bazie.
  const twins = row.vin
    ? await db
        .select({
          id: listings.id,
          priceGross: listings.priceGross,
          offerKind: listings.offerKind,
          status: listings.status,
          url: listings.url,
          // Zdjecie kazdego blizniaka: te same auto sfotografowane u dwoch
          // sprzedawcow wyglada inaczej i to samo w sobie jest informacja
          // (jeden ma zdjecie studyjne, drugi fotke z parkingu).
          thumbnailUrl: listings.thumbnailUrl,
          mileageKm: listings.mileageKm,
          city: listings.city,
          sourceName: sources.name,
        })
        .from(listings)
        .innerJoin(sources, eq(sources.id, listings.sourceId))
        .where(
          and(eq(listings.vin, row.vin), eq(listings.status, "active"), sql`${listings.id} <> ${id}`),
        )
        .orderBy(asc(listings.priceGross))
    : [];

  return { ...row, history, twins };
}

export type ListingDetail = NonNullable<Awaited<ReturnType<typeof getListing>>>;

/**
 * Podobne oferty — ten sam model, zblizony rocznik.
 *
 * Sluzy dwóm rzeczom naraz: czytelnikowi, ktory trafil na sprzedane auto,
 * i linkowaniu wewnetrznemu, bez ktorego strony ofert bylyby slepymi zaulkami
 * dla robota indeksujacego.
 */
export async function getSimilar(row: {
  id: number;
  make: string;
  model: string | string[];
  year: number | null;
}, limit = 8) {
  return db
    .select({
      id: listings.id,
      make: listings.make,
      model: listings.model,
      trim: listings.trim,
      year: listings.year,
      mileageKm: listings.mileageKm,
      priceGross: listings.priceGross,
      fuel: listings.fuel,
      thumbnailUrl: listings.thumbnailUrl,
      dealScore: listings.dealScore,
      offerKind: listings.offerKind,
      sourceName: sources.name,
    })
    .from(listings)
    .innerJoin(sources, eq(sources.id, listings.sourceId))
    .where(
      and(
        LIVE,
        eq(listings.make, row.make),
        modelMatches(row.model),
        sql`${listings.id} <> ${row.id}`,
        ...(row.year ? [sql`abs(coalesce(${listings.year}, 0) - ${row.year}) <= 2`] : []),
      ),
    )
    .orderBy(sql`${listings.dealScore} desc nulls last`, desc(listings.firstSeenAt))
    .limit(limit);
}

export type SimilarRow = Awaited<ReturnType<typeof getSimilar>>[number];

/* ────────────────────────────────────────────────────────────────────────────
 * Mapa strony
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Adresy do sitemapy.
 *
 * Progi sa celowe. Model z jedna oferta znika z bazy przy najblizszym
 * przebiegu scrapera i zostawia po sobie 404 w indeksie — zglaszamy wiec
 * dopiero te, ktore maja z czego zyc. VIN-y ograniczamy do egzemplarzy
 * wystawionych u WIECEJ niz jednego zrodla, bo tylko tam strona historii
 * mowi cokolwiek, czego nie ma w samej ofercie.
 */
export async function getSitemapEntries() {
  const [makes, models, vins, cities, srcs] = await Promise.all([
    db
      .select({ make: listings.make, updated: sql<string>`max(${listings.lastSeenAt})` })
      .from(listings)
      .where(eq(listings.status, "active"))
      .groupBy(listings.make)
      .having(sql`count(*) >= 3`),

    db
      .select({
        make: listings.make,
        model: listings.model,
        updated: sql<string>`max(${listings.lastSeenAt})`,
        // Do wyboru wariantu kanonicznego przy scalaniu pisowni w sitemap.ts.
        total: sql<number>`count(*)::int`,
      })
      .from(listings)
      .where(eq(listings.status, "active"))
      .groupBy(listings.make, listings.model)
      .having(sql`count(*) >= 3`)
      .orderBy(desc(sql`count(*)`)),

    db
      .select({ vin: listings.vin, updated: sql<string>`max(${listings.lastSeenAt})` })
      .from(listings)
      .where(and(eq(listings.status, "active"), isNotNull(listings.vin)))
      .groupBy(listings.vin)
      .having(sql`count(*) > 1`),

    db
      .select({ city: listings.city, updated: sql<string>`max(${listings.lastSeenAt})` })
      .from(listings)
      .where(and(eq(listings.status, "active"), isNotNull(listings.city)))
      .groupBy(listings.city)
      .having(sql`count(*) >= 30`)
      .orderBy(desc(sql`count(*)`)),

    db
      .select({ id: listings.sourceId, updated: sql<string>`max(${listings.lastSeenAt})` })
      .from(listings)
      .where(eq(listings.status, "active"))
      .groupBy(listings.sourceId)
      .having(sql`count(*) >= 10`),
  ]);

  return { makes, models, vins, cities, srcs };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Zdjecia i wykresy na stronach docelowych
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Kafelki modeli na stronie marki — z jednym reprezentatywnym zdjeciem.
 *
 * Zdjecie wybiera `distinct on` po najnowszej ofercie z miniatura: nowsza
 * oferta to zwykle nowszy lift i lepsze zdjecie studyjne, a nie fotka
 * z telefonu na parkingu.
 *
 * Reszta pol (paliwo, nadwozie) to wartosc NAJCZESTSZA, nie pierwsza z brzegu
 * — przy Octavii kombi i sedan stoja obok siebie, wiec losowy wybor bylby
 * mylacy przez polowe czasu.
 */
export async function getModelCards(make: string) {
  const rows = await db.execute(sql`
    with baza as (
      select model, thumbnail_url, price_gross, offer_kind, fuel, body, year, first_seen_at
      from listings
      where status = 'active' and make = ${make}
    ),
    foto as (
      select distinct on (model) model, thumbnail_url
      from baza
      where thumbnail_url is not null
      order by model, first_seen_at desc
    ),
    paliwo as (
      select distinct on (model) model, fuel, count(*) as n
      from baza where fuel is not null
      group by model, fuel order by model, n desc
    ),
    nadwozie as (
      select distinct on (model) model, body, count(*) as n
      from baza where body is not null
      group by model, body order by model, n desc
    )
    select
      b.model,
      count(*)::int                                            as total,
      min(b.price_gross) filter (where b.offer_kind = 'fixed')::int  as min_price,
      (percentile_cont(0.5) within group (order by b.price_gross)
        filter (where b.offer_kind = 'fixed'))::int            as median_price,
      min(b.year)::int                                         as min_year,
      max(b.year)::int                                         as max_year,
      f.thumbnail_url                                          as thumbnail,
      p.fuel                                                   as top_fuel,
      n.body                                                   as top_body
    from baza b
    left join foto f     on f.model = b.model
    left join paliwo p   on p.model = b.model
    left join nadwozie n on n.model = b.model
    group by b.model, f.thumbnail_url, p.fuel, n.body
    order by count(*) desc
  `);

  const surowe = (rows as unknown as Record<string, unknown>[]).map((r) => ({
    model: String(r.model),
    total: Number(r.total),
    minPrice: r.min_price == null ? null : Number(r.min_price),
    medianPrice: r.median_price == null ? null : Number(r.median_price),
    minYear: r.min_year == null ? null : Number(r.min_year),
    maxYear: r.max_year == null ? null : Number(r.max_year),
    thumbnail: (r.thumbnail as string | null) ?? null,
    topFuel: (r.top_fuel as string | null) ?? null,
    topBody: (r.top_body as string | null) ?? null,
  }));

  /*
   * Scalanie pisowni tego samego modelu.
   *
   * SQL grupuje po surowej nazwie, wiec "XC60", "XC 60" i "Xc-60" wracaja jako
   * trzy wiersze — a wszystkie trzy prowadza pod jeden adres `/volvo/xc-60`.
   * Bez scalenia strona marki pokazywalaby ten sam kafelek kilka razy, a kazdy
   * z ulamkiem ofert.
   *
   * Scalamy w JS, a nie w SQL, bo slug liczy `slugify` — powtorzenie tej samej
   * normalizacji w Postgresie (diakrytyki, znaki specjalne) rozjechaloby sie
   * z wersja w TypeScripcie przy pierwszej zmianie jednej z nich.
   *
   * MEDIANY NIE DA SIE SCALIC: mediana z median to nie mediana calosci.
   * W grupach zlozonych podajemy wiec `null` zamiast liczby, ktora bylaby
   * zmyslona. Suma sztuk i cena minimalna scalaja sie poprawnie.
   */
  return [...groupBySlug(surowe, (r) => r.model).values()].map((grupa) => {
    const glowny = grupa[0];
    if (grupa.length === 1) return glowny;

    const ceny = grupa.map((g) => g.minPrice).filter((v): v is number => v != null);
    const odRoku = grupa.map((g) => g.minYear).filter((v): v is number => v != null);
    const doRoku = grupa.map((g) => g.maxYear).filter((v): v is number => v != null);

    return {
      ...glowny,
      total: grupa.reduce((n, g) => n + g.total, 0),
      minPrice: ceny.length > 0 ? Math.min(...ceny) : null,
      medianPrice: null,
      minYear: odRoku.length > 0 ? Math.min(...odRoku) : null,
      maxYear: doRoku.length > 0 ? Math.max(...doRoku) : null,
      thumbnail: grupa.find((g) => g.thumbnail)?.thumbnail ?? null,
    };
  });
}

export type ModelCard = Awaited<ReturnType<typeof getModelCards>>[number];

/**
 * Dane do wykresu cena/przebieg.
 *
 * Regresja, zakresy i licznik licza sie W BAZIE — `regr_slope` i
 * `regr_intercept` sa wbudowanymi agregatami Postgresa, wiec nie ma powodu
 * przesylac tysiaca wierszy, zeby policzyc dwie liczby w JavaScripcie.
 *
 * Same punkty do narysowania chmury przycinamy do `limit`. Przy Toyocie
 * Corolli bylo ich 1250 na kazde wejscie na strone; na wykresie o szerokosci
 * 600 pikseli i tak nakladaja sie na siebie, a linia trendu liczona jest
 * z CALOSCI, nie z probki — wiec obraz pozostaje uczciwy.
 *
 * Same aukcje pomijamy: cena aukcyjna to biezaca oferta w licytacji, wiec na
 * wykresie ceny rynkowej lezalaby duzo za nisko i psula caly obraz.
 */
export async function getScatter(make: string, model: string | string[], limit = 400) {
  const where = and(
    LIVE,
    eq(listings.make, make),
    modelMatches(model),
    eq(listings.offerKind, "fixed"),
    isNotNull(listings.mileageKm),
  );

  const [agg] = await db
    .select({
      n: sql<number>`count(*)::int`,
      slope: sql<number | null>`regr_slope(${listings.priceGross}, ${listings.mileageKm})`,
      intercept: sql<number | null>`regr_intercept(${listings.priceGross}, ${listings.mileageKm})`,
      xMin: sql<number | null>`min(${listings.mileageKm})::int`,
      xMax: sql<number | null>`max(${listings.mileageKm})::int`,
      yMin: sql<number | null>`min(${listings.priceGross})::int`,
      yMax: sql<number | null>`max(${listings.priceGross})::int`,
    })
    .from(listings)
    .where(where);

  const points = await db
    .select({
      id: listings.id,
      mileageKm: listings.mileageKm,
      priceGross: listings.priceGross,
    })
    .from(listings)
    .where(where)
    .limit(limit);

  return {
    points,
    n: agg?.n ?? 0,
    slope: agg?.slope ?? null,
    intercept: agg?.intercept ?? null,
    xMin: agg?.xMin ?? null,
    xMax: agg?.xMax ?? null,
    yMin: agg?.yMin ?? null,
    yMax: agg?.yMax ?? null,
  };
}

export type ScatterData = Awaited<ReturnType<typeof getScatter>>;


/**
 * Histogram cen — kubelki liczone W BAZIE, nie po stronie aplikacji.
 *
 * Wczesniej ta funkcja zwracala WSZYSTKIE ceny modelu i histogram powstawal
 * w JavaScripcie. Przy Toyocie Corolli to 1250 wierszy przez siec na kazde
 * wejscie na strone — a wynikiem jest szesnascie liczb. Przy 1913 stronach
 * odswiezanych przez robota indeksujacego wystarczylo to, zeby przekroczyc
 * limit transferu Neona i zdjac caly serwis.
 *
 * `width_bucket` robi to samo w Postgresie i odsyla tyle, ile trzeba.
 */
export async function getPriceHistogram(make: string, model: string | string[], bins = 16) {
  const where = and(
    LIVE,
    eq(listings.make, make),
    modelMatches(model),
    eq(listings.offerKind, "fixed"),
  );

  const [zakres] = await db
    .select({
      min: sql<number | null>`min(${listings.priceGross})::int`,
      max: sql<number | null>`max(${listings.priceGross})::int`,
      total: sql<number>`count(*)::int`,
    })
    .from(listings)
    .where(where);

  // Ponizej szesciu ofert histogram i tak sie nie rysuje — patrz komponent.
  if (!zakres?.min || !zakres.max || zakres.max === zakres.min || zakres.total < 6) {
    return { min: zakres?.min ?? 0, max: zakres?.max ?? 0, total: zakres?.total ?? 0, counts: [] };
  }

  const rows = await db
    .select({
      kubelek: sql<number>`width_bucket(
        ${listings.priceGross}, ${zakres.min}, ${zakres.max}, ${bins}
      )`,
      n: sql<number>`count(*)::int`,
    })
    .from(listings)
    .where(where)
    .groupBy(sql`1`);

  /*
   * width_bucket zwraca 1..bins dla wartosci w zakresie i bins+1 dokladnie dla
   * maksimum (bo gorna granica jest wylaczna). Domykamy je do ostatniego
   * kubelka, inaczej najdrozsza oferta wypadalaby z wykresu.
   */
  const counts = new Array<number>(bins).fill(0);
  for (const r of rows) {
    const i = Math.min(bins, Math.max(1, Number(r.kubelek))) - 1;
    counts[i] += r.n;
  }

  return { min: zakres.min, max: zakres.max, total: zakres.total, counts };
}

export type PriceHistogramData = Awaited<ReturnType<typeof getPriceHistogram>>;

/**
 * Ile ofert jest tansze od podanej ceny — do znacznika na histogramie.
 *
 * Osobne, tanie zapytanie zamiast sciagania wszystkich cen tylko po to, zeby
 * je policzyc w JavaScripcie.
 */
export async function countCheaperThan(
  make: string,
  model: string | string[],
  price: number,
): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(listings)
    .where(
      and(
        LIVE,
        eq(listings.make, make),
        modelMatches(model),
        eq(listings.offerKind, "fixed"),
        lte(listings.priceGross, price),
      ),
    );
  return row?.n ?? 0;
}

/** Nadwozia w segmencie — druga po paliwie os, wedlug ktorej ludzie wybieraja. */
export async function getBodyBreakdown(make: string, model?: string | string[]) {
  const rows = await db
    .select({
      /*
       * Grupujemy po malych literach, bo zrodla pisza nadwozie roznie
       * ("SUV", "suv", "Suv") i bez tego jeden typ rozpadal sie na trzy
       * wiersze. Do wyswietlenia bierzemy min() — w ASCII wielkie litery sa
       * przed malymi, wiec wygrywa "SUV", a nie "suv".
       */
      body: sql<string>`min(${listings.body})`,
      total: sql<number>`count(*)::int`,
      medianPrice: sql<number | null>`percentile_cont(0.5) within group (
        order by ${listings.priceGross}
      )::int`,
    })
    .from(listings)
    .where(
      and(
        LIVE,
        eq(listings.make, make),
        ...(model ? [modelMatches(model)] : []),
        eq(listings.offerKind, "fixed"),
        isNotNull(listings.body),
      ),
    )
    .groupBy(sql`lower(${listings.body})`)
    .orderBy(desc(sql`count(*)`))
    .limit(8);
  return rows;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Strony miast — /poleasingowe/[miasto]
 *
 * Powstaly, bo zapytania lokalne maja w tej kategorii NAJWIEKSZY wolumen
 * z wszystkiego, co zmierzylismy: "samochody poleasingowe warszawa" i "auta
 * poleasingowe warszawa" siedza w przedziale 1–10 tys. wyszukiwan miesiecznie,
 * podczas gdy porownania modeli ("bmw x3 czy audi q5") miesci sie w 10–100.
 * Miasto ma juz kazda oferta — 83% bazy — wiec dane byly, brakowalo stron.
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Miasta z liczba ofert.
 *
 * Zwracamy surowe nazwy z bazy; scalanie wariantow zapisu ("Warszawa" obok
 * "warszawa") robi `groupBySlug` po stronie wywolujacej — ta sama zasada
 * co przy modelach, z tego samego powodu: normalizacja musi byc jedna
 * i liczona tym samym kodem.
 */
export async function getCitiesWithCounts(minOffers = 30) {
  return db
    .select({
      city: listings.city,
      total: sql<number>`count(*)::int`,
      medianPrice: sql<number | null>`percentile_cont(0.5) within group (
        order by ${listings.priceGross}
      ) filter (where ${listings.offerKind} = 'fixed')::int`,
      minPrice: sql<number | null>`min(${listings.priceGross}) filter (
        where ${listings.offerKind} = 'fixed'
      )::int`,
    })
    .from(listings)
    .where(and(eq(listings.status, "active"), isNotNull(listings.city)))
    .groupBy(listings.city)
    .having(sql`count(*) >= ${minOffers}`)
    .orderBy(desc(sql`count(*)`));
}

export type CityRow = Awaited<ReturnType<typeof getCitiesWithCounts>>[number];

/** Miasto moze byc zapisane na kilka sposobow — stad lista, nie jedna nazwa. */
function cityMatches(city: string | string[]) {
  return Array.isArray(city) ? inArray(listings.city, city) : eq(listings.city, city);
}

/** Liczby na naglowek strony miasta. */
export async function getCityStats(city: string | string[]) {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      withPrice: sql<number>`count(*) filter (where ${listings.priceGross} is not null)::int`,
      newToday: sql<number>`count(*) filter (
        where ${listings.firstSeenAt} > now() - interval '24 hours'
      )::int`,
      deals: sql<number>`count(*) filter (where ${listings.dealScore} >= 0.1)::int`,
      sources: sql<number>`count(distinct ${listings.sourceId})::int`,
      makes: sql<number>`count(distinct ${listings.make})::int`,
      minPrice: sql<number | null>`min(${listings.priceGross}) filter (
        where ${listings.offerKind} = 'fixed'
      )::int`,
      medianPrice: sql<number | null>`percentile_cont(0.5) within group (
        order by ${listings.priceGross}
      ) filter (where ${listings.offerKind} = 'fixed')::int`,
    })
    .from(listings)
    .where(and(eq(listings.status, "active"), cityMatches(city)));
  return row;
}

/** Marki dostepne w miescie — glowna nawigacja i linkowanie do stron marek. */
export async function getCityMakes(city: string | string[], limit = 24) {
  return db
    .select({
      make: listings.make,
      total: sql<number>`count(*)::int`,
      minPrice: sql<number | null>`min(${listings.priceGross}) filter (
        where ${listings.offerKind} = 'fixed'
      )::int`,
    })
    .from(listings)
    .where(and(eq(listings.status, "active"), cityMatches(city)))
    .groupBy(listings.make)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
}

/** Kto realnie wystawia auta w tym miescie — konkret, ktorego nie ma nigdzie indziej. */
export async function getCitySellers(city: string | string[], limit = 10) {
  return db
    .select({
      sourceName: sources.name,
      total: sql<number>`count(*)::int`,
    })
    .from(listings)
    .innerJoin(sources, eq(sources.id, listings.sourceId))
    .where(and(eq(listings.status, "active"), cityMatches(city)))
    .groupBy(sources.name)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
}

/* ────────────────────────────────────────────────────────────────────────────
 * Strony leasingodawcow — /leasingodawca/[id]
 *
 * "poleasingowe pko" to 1–10 tys. wyszukiwan miesiecznie przy NISKIEJ
 * konkurencji reklamowej — najlepszy stosunek wolumenu do trudnosci, jaki
 * znalezlismy. Strona /zrodla istniala od dawna, ale jako jedna tabela
 * zdrowia adapterow: nie dawalo sie z niej wejsc w konkretnego leasingodawce.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Wszystko o jednym zrodle — naglowek strony leasingodawcy. */
export async function getSourceStats(sourceId: string) {
  const [row] = await db
    .select({
      id: sources.id,
      name: sources.name,
      baseUrl: sources.baseUrl,
      total: sql<number>`count(*) filter (where ${listings.status} = 'active')::int`,
      withPrice: sql<number>`count(*) filter (
        where ${listings.status} = 'active' and ${listings.priceGross} is not null
      )::int`,
      newToday: sql<number>`count(*) filter (
        where ${listings.status} = 'active'
          and ${listings.firstSeenAt} > now() - interval '24 hours'
      )::int`,
      deals: sql<number>`count(*) filter (
        where ${listings.status} = 'active' and ${listings.dealScore} >= 0.1
      )::int`,
      makes: sql<number>`count(distinct ${listings.make}) filter (
        where ${listings.status} = 'active'
      )::int`,
      cities: sql<number>`count(distinct ${listings.city}) filter (
        where ${listings.status} = 'active'
      )::int`,
      minPrice: sql<number | null>`min(${listings.priceGross}) filter (
        where ${listings.status} = 'active' and ${listings.offerKind} = 'fixed'
      )::int`,
      medianPrice: sql<number | null>`percentile_cont(0.5) within group (
        order by ${listings.priceGross}
      ) filter (where ${listings.status} = 'active' and ${listings.offerKind} = 'fixed')::int`,
      auctions: sql<number>`count(*) filter (
        where ${listings.status} = 'active' and ${listings.offerKind} = 'auction'
      )::int`,
    })
    .from(sources)
    .leftJoin(listings, eq(listings.sourceId, sources.id))
    .where(eq(sources.id, sourceId))
    .groupBy(sources.id, sources.name, sources.baseUrl);
  return row ?? null;
}

/** Marki u jednego leasingodawcy — linkowanie do stron marek. */
export async function getSourceMakes(sourceId: string, limit = 24) {
  return db
    .select({
      make: listings.make,
      total: sql<number>`count(*)::int`,
      minPrice: sql<number | null>`min(${listings.priceGross}) filter (
        where ${listings.offerKind} = 'fixed'
      )::int`,
    })
    .from(listings)
    .where(and(eq(listings.status, "active"), eq(listings.sourceId, sourceId)))
    .groupBy(listings.make)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
}

/** Miasta, w ktorych ten leasingodawca ma auta — linkowanie do stron miast. */
export async function getSourceCities(sourceId: string, limit = 16) {
  return db
    .select({
      city: listings.city,
      total: sql<number>`count(*)::int`,
    })
    .from(listings)
    .where(
      and(eq(listings.status, "active"), eq(listings.sourceId, sourceId), isNotNull(listings.city)),
    )
    .groupBy(listings.city)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
}

/* ────────────────────────────────────────────────────────────────────────────
 * Strony filtrow — /poleasingowe/suv, /poleasingowe/do-50-tys
 *
 * Google podpowiada "auto poleasingowe do 50 tys", "poleasingowe suv",
 * "poleasingowe hybrydy" — czyli ludzie szukaja wprost tymi kategoriami.
 * Do tej pory odpowiadalismy na to wylacznie parametrami w adresie, ktorych
 * wyszukiwarka nie indeksuje.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Naglowek dowolnej strony filtra — liczby liczone tym samym WHERE co lista. */
export async function getFilterStats(f: Filters) {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      newToday: sql<number>`count(*) filter (
        where ${listings.firstSeenAt} > now() - interval '24 hours'
      )::int`,
      deals: sql<number>`count(*) filter (where ${listings.dealScore} >= 0.1)::int`,
      sources: sql<number>`count(distinct ${listings.sourceId})::int`,
      makes: sql<number>`count(distinct ${listings.make})::int`,
      minPrice: sql<number | null>`min(${listings.priceGross}) filter (
        where ${listings.offerKind} = 'fixed'
      )::int`,
      medianPrice: sql<number | null>`percentile_cont(0.5) within group (
        order by ${listings.priceGross}
      ) filter (where ${listings.offerKind} = 'fixed')::int`,
      medianMileage: sql<number | null>`percentile_cont(0.5) within group (
        order by ${listings.mileageKm}
      )::int`,
    })
    .from(listings)
    .where(buildWhere(f));
  return row;
}

/** Marki w obrebie filtra — linkowanie do stron marek. */
export async function getFilterMakes(f: Filters, limit = 24) {
  return db
    .select({
      make: listings.make,
      total: sql<number>`count(*)::int`,
      minPrice: sql<number | null>`min(${listings.priceGross}) filter (
        where ${listings.offerKind} = 'fixed'
      )::int`,
    })
    .from(listings)
    .where(buildWhere(f))
    .groupBy(listings.make)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
}

/** Miasta w obrebie filtra — linkowanie do stron miast. */
export async function getFilterCities(f: Filters, limit = 16) {
  return db
    .select({ city: listings.city, total: sql<number>`count(*)::int` })
    .from(listings)
    .where(and(buildWhere(f), isNotNull(listings.city)))
    .groupBy(listings.city)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
}

/**
 * Producent wg WMI — trzech pierwszych znakow VIN-u.
 *
 * Uczymy sie tego z WLASNYCH danych, nie z licencjonowanej bazy WMI: mamy
 * 19 856 VIN-ow, przy ktorych marka jest znana z ogloszenia. Sprawdzone na
 * calosci: ze 189 wystepujacych WMI az 173 wskazuja jedna marke w ponad 95%
 * przypadkow, wiec odpowiedz jest pewna tam, gdzie w ogole jej udzielamy.
 *
 * Zwracamy null przy WMI niejednoznacznym albo nieznanym — lepiej nie
 * odpowiedziec niz zgadnac.
 */
export async function getWmiMake(vin: string): Promise<string | null> {
  const wmi = vin.slice(0, 3).toUpperCase();
  if (wmi.length < 3) return null;

  const rows = await db
    .select({ make: listings.make, n: sql<number>`count(*)::int` })
    .from(listings)
    .where(sql`upper(left(${listings.vin}, 3)) = ${wmi}`)
    .groupBy(listings.make)
    .orderBy(desc(sql`count(*)`))
    .limit(5);

  if (rows.length === 0) return null;
  const suma = rows.reduce((n, r) => n + r.n, 0);
  return rows[0].n / suma > 0.95 ? rows[0].make : null;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Dane rynkowe — /dane
 *
 * Liczby o CALYM rynku poleasingowym, nie o pojedynczej marce. Powstalo, bo
 * to jest jedyna rzecz w tym serwisie, ktora ma wartosc jako CYTAT: mediana
 * ceny, utrata wartosci po roczniku, rozjazdy cen tego samego egzemplarza.
 * Dziennikarz albo model jezykowy potrzebuje jednej liczby ze zrodlem, a nie
 * wyszukiwarki z filtrami.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Mediana ceny i przebiegu dla calego rynku, po roczniku. */
export async function getMarketByYear() {
  return db
    .select({
      year: listings.year,
      total: sql<number>`count(*)::int`,
      // Wykres YearBars oczekuje rowniez ceny minimalnej — patrz komponent.
      minPrice: sql<number>`min(${listings.priceGross})::int`,
      medianPrice: sql<number>`percentile_cont(0.5) within group (
        order by ${listings.priceGross}
      )::int`,
      medianMileage: sql<number | null>`percentile_cont(0.5) within group (
        order by ${listings.mileageKm}
      )::int`,
    })
    .from(listings)
    .where(and(LIVE, eq(listings.offerKind, "fixed"), isNotNull(listings.year)))
    .groupBy(listings.year)
    .having(sql`count(*) >= 20`)
    .orderBy(desc(listings.year));
}

/** Mediana ceny wedlug paliwa — dla calego rynku. */
export async function getMarketByFuel() {
  return db
    .select({
      fuel: listings.fuel,
      total: sql<number>`count(*)::int`,
      medianPrice: sql<number>`percentile_cont(0.5) within group (
        order by ${listings.priceGross}
      )::int`,
      medianYear: sql<number | null>`percentile_cont(0.5) within group (
        order by ${listings.year}
      )::int`,
    })
    .from(listings)
    .where(and(LIVE, eq(listings.offerKind, "fixed"), isNotNull(listings.fuel)))
    .groupBy(listings.fuel)
    .having(sql`count(*) >= 50`)
    .orderBy(desc(sql`count(*)`));
}

/**
 * Rozjazdy cen tego samego egzemplarza — najmocniejsza liczba w tej bazie.
 *
 * Liczone WYLACZNIE miedzy ofertami "kup teraz" i tylko wtedy, gdy ten sam VIN
 * wystepuje u ROZNYCH zrodel. Cena aukcyjna jeszcze urosnie, wiec zestawianie
 * jej z cena zakupu dawaloby roznice, ktora zniknie do konca licytacji.
 */
export async function getVinSpread() {
  const [row] = await db
    .select({
      par: sql<number>`count(*)::int`,
      ponad10k: sql<number>`count(*) filter (where roz >= 10000)::int`,
      max: sql<number | null>`max(roz)::int`,
      mediana: sql<number | null>`percentile_cont(0.5) within group (order by roz)::int`,
      suma: sql<number | null>`sum(roz)::bigint`,
    })
    .from(
      sql`(
        select max(${listings.priceGross}) - min(${listings.priceGross}) as roz
        from ${listings}
        where ${listings.status} = 'active' and ${listings.vin} is not null
          and ${listings.priceGross} is not null and ${listings.offerKind} = 'fixed'
        group by ${listings.vin}
        having count(distinct ${listings.sourceId}) > 1
           and max(${listings.priceGross}) > min(${listings.priceGross})
      ) as pary`,
    );
  return row;
}

/**
 * Najwieksze rozjazdy cen tego samego egzemplarza — z konkretami.
 *
 * `getVinSpread` daje same liczby zbiorcze; ta funkcja daje auta, ktore da sie
 * kliknac i sprawdzic. To jest roznica miedzy "twierdzimy, ze rozjazdy istnieja"
 * a "oto osiem sztuk, otworz obie oferty i zobacz sam".
 */
export async function getTopSpreads(limit = 10) {
  const rows = await db.execute(sql`
    select
      min(vin)                                       as vin,
      min(make || ' ' || model)                      as auto,
      min(year)                                      as rok,
      min(price_gross)::int                          as taniej,
      max(price_gross)::int                          as drozej,
      (max(price_gross) - min(price_gross))::int     as roznica,
      count(distinct source_id)::int                 as zrodel
    from listings
    where status = 'active' and vin is not null
      and price_gross is not null and offer_kind = 'fixed'
    group by vin
    having count(distinct source_id) > 1
       and max(price_gross) > min(price_gross)
    order by max(price_gross) - min(price_gross) desc
    limit ${limit}
  `);

  return (rows as unknown as Record<string, unknown>[]).map((r) => ({
    vin: String(r.vin),
    auto: String(r.auto),
    rok: r.rok == null ? null : Number(r.rok),
    taniej: Number(r.taniej),
    drozej: Number(r.drozej),
    roznica: Number(r.roznica),
    zrodel: Number(r.zrodel),
  }));
}
