import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";


/** Rejestr zrodel. Wiersze sa seedowane z packages/scrapers. */
export const sources = pgTable("sources", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  baseUrl: text("base_url").notNull(),
  strategy: text("strategy").notNull().default("http"),
  enabled: boolean("enabled").notNull().default(true),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  lastRunOk: boolean("last_run_ok"),
  lastError: text("last_error"),
  /**
   * Kiedy ostatnio przeleciano PELNA liste ofert. Dla duzych zrodel (Toyota:
   * 300 stron listingu) discover jest drogi, wiec robimy go rzadziej niz
   * pobieranie detali — patrz SourceAdapter.discoverEveryMinutes.
   */
  lastDiscoverAt: timestamp("last_discover_at", { withTimezone: true }),
});

/**
 * Jedna oferta u jednego zrodla. Cena trzymana tu jest zawsze ta najswiezsza —
 * historia siedzi w listing_snapshots.
 */
export const listings = pgTable(
  "listings",
  {
    id: serial("id").primaryKey(),
    sourceId: text("source_id").notNull().references(() => sources.id),
    externalId: text("external_id").notNull(),
    url: text("url").notNull(),

    vin: text("vin"),
    /*
     * Numer rejestracyjny i PELNA data pierwszej rejestracji.
     *
     * Nie sa ozdoba: historiapojazdu.gov.pl (CEPiK) wymaga do sprawdzenia
     * historii pojazdu TRZECH danych naraz — VIN, numeru rejestracyjnego i daty
     * pierwszej rejestracji. Bez tych dwoch kolumn sam VIN jest bezuzyteczny
     * i nie da sie odpytac o szkody ani przebiegi z przegladow.
     *
     * Czesc zrodel podaje oba (pkoaukcje, poleasingowe, mhc), czesc sama date
     * (volvo, skoda, seat, cupra). Wczesniej wyciagalismy z niej tylko rok.
     */
    registration: text("registration"),
    firstRegistrationAt: timestamp("first_registration_at", { withTimezone: true }),
    make: text("make").notNull(),
    model: text("model").notNull(),
    trim: text("trim"),

    year: smallint("year"),
    mileageKm: integer("mileage_km"),
    priceGross: integer("price_gross"),
    priceNet: integer("price_net"),

    fuel: text("fuel"),
    gearbox: text("gearbox"),
    drive: text("drive"),
    powerHp: smallint("power_hp"),
    engineCcm: integer("engine_ccm"),
    body: text("body"),
    color: text("color"),
    seats: smallint("seats"),
    city: text("city"),

    thumbnailUrl: text("thumbnail_url"),

    /** Sprzedajacy na platformach wielofirmowych (autoprzetarg = 4 leasingodawcow). */
    seller: text("seller"),

    /**
     * fixed = cena "kup teraz", auction = aktualna oferta w licytacji.
     * Faza 3 MUSI je rozroznic: cena aukcyjna rosnie w czasie i nie jest
     * ceną transakcyjną, wiec nie moze uczyc modelu wyceny na rowni z fixed.
     */
    offerKind: text("offer_kind").notNull().default("fixed"),
    auctionEndsAt: timestamp("auction_ends_at", { withTimezone: true }),

    /*
     * Wynik wyceny, przeliczany osobnym przebiegiem (apps/worker/src/revalue.ts).
     * Trzymamy go na ofercie, a nie liczymy w locie, bo po tym sortujemy
     * i filtrujemy — liczenie median per zapytanie zabiloby liste.
     *
     * marketPrice: mediana koszyka porownywalnych sztuk.
     * dealScore: (mediana - cena) / mediana, czyli ile procent PONIZEJ rynku.
     *   Dodatni = taniej niz rynek. NULL = za malo porownywalnych, zeby cokolwiek
     *   uczciwie powiedziec — i wtedy UI nie pokazuje nic zamiast zgadywac.
     */
    marketPrice: integer("market_price"),
    dealScore: real("deal_score"),
    /** Ile sztuk bylo w koszyku — bez tego nie widac, czy ocena jest warta zaufania. */
    dealSamples: smallint("deal_samples"),
    /** Czy mediana pochodzi z ofert SPRZEDANYCH (dokladniejsza) czy z wiszacych. */
    dealFromSold: boolean("deal_from_sold").notNull().default(false),

    /** active = widziana w ostatnim przebiegu, gone = zniknela (≈ sprzedana). */
    status: text("status").notNull().default("active"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    goneAt: timestamp("gone_at", { withTimezone: true }),
  },
  (t) => [
    // Klucz idempotencji calego pipeline'u — upsert leci po tym indeksie.
    uniqueIndex("listings_source_external_idx").on(t.sourceId, t.externalId),
    index("listings_vin_idx").on(t.vin),
    index("listings_search_idx").on(t.make, t.model, t.year, t.priceGross),
    index("listings_status_seen_idx").on(t.status, t.firstSeenAt),
    // Sortowanie i filtr "tylko okazje" ida po tym indeksie.
    index("listings_deal_idx").on(t.status, t.dealScore),
  ],
);

/**
 * Koszyki porownawcze — jeden wiersz na (marka, model, rocznik, przedzial
 * przebiegu, paliwo, skrzynia).
 *
 * DLACZEGO TAK WASKI KLUCZ: mediana liczona po samych marka+model+rocznik jest
 * wykrywaczem wysokiego przebiegu, nie okazji. Sprawdzone na tej bazie —
 * przy koszyku bez kontroli przebiegu "najwieksze okazje" mialy 99, 149 i 222
 * tys. km. Po dolozeniu przebiegu, paliwa i skrzyni z 838 rzekomych okazji
 * zostalo 188 prawdziwych.
 */
export const valuations = pgTable(
  "valuations",
  {
    id: serial("id").primaryKey(),
    make: text("make").notNull(),
    model: text("model").notNull(),
    year: smallint("year").notNull(),
    /** Numer przedzialu 25 tys. km: 0 = 0-25k, 1 = 25-50k, ... */
    mileageBucket: smallint("mileage_bucket").notNull(),
    fuel: text("fuel"),
    gearbox: text("gearbox"),

    medianPrice: integer("median_price").notNull(),
    sampleCount: smallint("sample_count").notNull(),
    /** Mediana z ofert, ktore zniknely (≈ sprzedane) — blizsza cenie transakcyjnej. */
    soldMedianPrice: integer("sold_median_price"),
    soldSampleCount: smallint("sold_sample_count"),

    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("valuations_key_idx").on(
      t.make, t.model, t.year, t.mileageBucket, t.fuel, t.gearbox,
    ),
  ],
);

/** Historia cen. Nowy wiersz tylko gdy cena albo przebieg faktycznie sie zmienil. */
export const listingSnapshots = pgTable(
  "listing_snapshots",
  {
    id: serial("id").primaryKey(),
    listingId: integer("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    priceGross: integer("price_gross"),
    mileageKm: integer("mileage_km"),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("snapshots_listing_idx").on(t.listingId, t.capturedAt)],
);

/** Zdarzenia wykryte przez pipeline — zrodlo prawdy dla alertow i dashboardu. */
export const events = pgTable(
  "events",
  {
    id: serial("id").primaryKey(),
    listingId: integer("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    /** new | price_drop | price_up | gone */
    kind: text("kind").notNull(),
    oldPrice: integer("old_price"),
    newPrice: integer("new_price"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
  },
  (t) => [index("events_created_idx").on(t.createdAt), index("events_kind_idx").on(t.kind)],
);

/**
 * Subskrypcje alertow mailowych.
 *
 * DOUBLE OPT-IN nie jest tu ozdoba: bez potwierdzenia linkiem kazdy moglby
 * zapisac cudzy adres na powiadomienia, a my wysylalibysmy je komus, kto o nic
 * nie prosil. Dlatego `confirmedAt` jest puste do momentu klikniecia w mail,
 * a wysylka bierze WYLACZNIE potwierdzone rekordy.
 *
 * Filtry trzymamy jako jsonb, bo to dokladnie ten sam ksztalt co filtry
 * wyszukiwarki (marka, model, cena do, rocznik od, prog okazji...). Osobne
 * kolumny na kazdy z nich znaczylyby migracje przy kazdym nowym filtrze.
 */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),

    /** Nazwa nadana przez uzytkownika, np. "BMW seria 3 do 120 tys.". */
    label: text("label"),
    /** Filtry w formacie query stringa wyszukiwarki — patrz apps/web/lib/queries.ts. */
    filters: jsonb("filters").notNull().default({}),

    /*
     * Token sluzy i do potwierdzenia, i do wypisania. Jeden sekret zamiast
     * dwoch, bo oba dzialaja tak samo: znasz token = jestes wlascicielem zapisu.
     * Link wypisujacy MUSI byc w kazdym mailu — bez tego wysylka jest spamem.
     */
    token: text("token").notNull(),

    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),

    /** Znacznik ostatniej wysylki — zeby nie slac dwa razy tych samych ofert. */
    lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("subscriptions_token_idx").on(t.token),
    index("subscriptions_email_idx").on(t.email),
  ],
);

/**
 * Co juz komu wyslalismy — zabezpieczenie przed dublami.
 *
 * Bez tego kazda zmiana ceny albo ponowne uruchomienie przebiegu wysylalyby
 * te sama oferte drugi raz, a nic tak szybko nie uczy ludzi wypisywania sie
 * jak powtorki.
 */
export const alertsSent = pgTable(
  "alerts_sent",
  {
    id: serial("id").primaryKey(),
    subscriptionId: integer("subscription_id")
      .notNull()
      .references(() => subscriptions.id, { onDelete: "cascade" }),
    listingId: integer("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("alerts_sent_idx").on(t.subscriptionId, t.listingId)],
);
