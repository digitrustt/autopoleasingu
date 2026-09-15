/**
 * Wysylka powiadomien o nowych ofertach.
 *
 *   pnpm --filter @auta/worker alerts
 *
 * Chodzi PO zaciagu i wycenie, w tym samym przebiegu — inaczej alert lecialby
 * bez deal score, czyli bez tej jednej informacji, dla ktorej warto go otwierac.
 *
 * Wysylamy WYLACZNIE oferty, ktorych ten adresat jeszcze nie dostal (tabela
 * alerts_sent) i wylacznie do subskrypcji POTWIERDZONYCH. Powtorki sa
 * najszybsza droga do wypisania sie i do zgloszen spamu, ktore psuja reputacje
 * domeny nadawcy.
 */
import { BODY_GROUPS, type AlertOffer, newOffers, rodzinyModeli, wariantyRodziny } from "@auta/core";
import { alertsSent, client, db, listings, sources, subscriptions } from "@auta/db";
import { and, desc, eq, gte, ilike, inArray, isNotNull, isNull, lte, notInArray, or, sql } from "drizzle-orm";

/** Ile ofert maksymalnie w jednym mailu. Powyzej tego nikt nie czyta. */
const MAX_PER_MAIL = 12;

/** Jak swieza musi byc oferta, zeby w ogole trafic do alertu. */
const FRESH_HOURS = 30;

type Filters = Record<string, string>;

/** Te same reguly co w wyszukiwarce — patrz apps/web/lib/queries.ts. */
/**
 * Warianty zapisu modelu dla tej marki — te same, ktore lapie filtr na stronie.
 *
 * Zrodla zapisuja model po swojemu: "X3", "X3 20d xDrive", "X3 xDrive20d". Na
 * stronie lista rozwijana pokazuje RODZINY (patrz @auta/core/rodziny), wiec
 * zapis na powiadomienia przychodzi z nazwa rodziny — a worker porownywal ja
 * przez rownosc i lapal 132 oferty zamiast 353.
 *
 * Bez tego obietnica ze strony ("powiadomimy o kolejnych X3") byla spelniana
 * w jednej trzeciej i nikt by sie nie domyslil, dlaczego.
 */
async function wariantyModelu(make: string, model: string): Promise<string[]> {
  const modele = await db
    .select({ model: listings.model, total: sql<number>`count(*)::int` })
    .from(listings)
    .where(and(eq(listings.status, "active"), eq(listings.make, make)))
    .groupBy(listings.model);
  return wariantyRodziny(rodzinyModeli(modele), model);
}

function whereFor(f: Filters, modelWarianty?: string[]) {
  const parts = [
    eq(listings.status, "active"),
    isNotNull(listings.priceGross),
    gte(listings.firstSeenAt, sql`now() - interval '${sql.raw(String(FRESH_HOURS))} hours'`),
  ];

  if (f.make) parts.push(eq(listings.make, f.make));
  // Komplet wariantow zapisu, nie sama nazwa rodziny — patrz wariantyModelu.
  if (modelWarianty && modelWarianty.length > 0) {
    parts.push(inArray(listings.model, modelWarianty));
  } else if (f.model) {
    parts.push(eq(listings.model, f.model));
  }
  if (f.source) parts.push(eq(listings.sourceId, f.source));
  if (f.fuel) parts.push(eq(listings.fuel, f.fuel));
  if (f.gearbox) parts.push(eq(listings.gearbox, f.gearbox));
  if (f.body) parts.push(ilike(listings.body, `%${f.body}%`));
  if (f.kind === "fixed" || f.kind === "auction") parts.push(eq(listings.offerKind, f.kind));

  /*
   * `city` i `bodyGroup` doszly razem z paskami zapisu na stronach miast
   * i kategorii. Bez nich subskrypcja "poleasingowe Krakow" przechodzila
   * walidacje, ale TU nie zawezala niczego — czlowiek dostawalby oferty
   * z calej Polski mimo obietnicy zlozonej na stronie zapisu.
   */
  if (f.city) parts.push(eq(listings.city, f.city));
  if (f.bodyGroup && BODY_GROUPS[f.bodyGroup]) {
    parts.push(sql`${listings.body} ~* ${BODY_GROUPS[f.bodyGroup]}`);
  }

  const n = (v?: string) => (v && Number.isFinite(Number(v)) ? Number(v) : null);
  const priceMin = n(f.priceMin);
  const priceMax = n(f.priceMax);
  const yearMin = n(f.yearMin);
  const yearMax = n(f.yearMax);
  const mileageMax = n(f.mileageMax);
  const powerMin = n(f.powerMin);
  const dealMin = n(f.dealMin);

  if (priceMin != null) parts.push(gte(listings.priceGross, priceMin));
  if (priceMax != null) parts.push(lte(listings.priceGross, priceMax));
  if (yearMin != null) parts.push(gte(listings.year, yearMin));
  if (yearMax != null) parts.push(lte(listings.year, yearMax));
  if (mileageMax != null) parts.push(lte(listings.mileageKm, mileageMax));
  if (powerMin != null) parts.push(gte(listings.powerHp, powerMin));
  if (dealMin != null) parts.push(gte(listings.dealScore, dealMin / 100));

  return and(...parts);
}

async function main() {
  const subs = await db
    .select()
    .from(subscriptions)
    .where(and(isNotNull(subscriptions.confirmedAt), isNull(subscriptions.unsubscribedAt)));

  if (subs.length === 0) {
    console.log("✓ alerty: brak potwierdzonych subskrypcji");
    await client.end();
    return;
  }

  let mails = 0;
  let offersSent = 0;
  let failed = 0;

  for (const sub of subs) {
    const filters = (sub.filters ?? {}) as Filters;

    /*
     * Oferty juz wyslane temu adresatowi — nie powtarzamy.
     *
     * ODSIEWAMY TEZ PO VIN, nie tylko po ID oferty, i to jest konieczne:
     * zrodla wystawiaja ten sam egzemplarz ponownie pod NOWYM identyfikatorem.
     * Zdarzone naprawde — pierwszy subskrybent spoza rodziny dostal tego samego
     * Formentora dwa razy w piec dni:
     *
     *   11.09  oferta 202667  VIN VSSZZZKM7SR031180  166 138 zl  23 653 km
     *   15.09  oferta 218583  VIN VSSZZZKM7SR031180  166 138 zl  23 653 km
     *
     * Dla bazy to dwa rozne wiersze, dla czlowieka to samo auto drugi raz
     * w skrzynce. Przy jednym mailu dziennie i kilku ofertach w srodku takie
     * powtorki sa najszybsza droga do wypisania sie.
     */
    const seen = await db
      .select({ id: alertsSent.listingId, vin: listings.vin })
      .from(alertsSent)
      .innerJoin(listings, eq(listings.id, alertsSent.listingId))
      .where(eq(alertsSent.subscriptionId, sub.id));
    const seenIds = seen.map((s) => s.id);
    const seenVins = [...new Set(seen.map((s) => s.vin).filter((v): v is string => v != null))];

    /*
     * Model rozwijamy do wariantow zapisu tylko wtedy, gdy znamy marke —
     * bez niej "Leon" moglby zlapac modele innych producentow.
     */
    const modelWarianty =
      filters.make && typeof filters.model === "string"
        ? await wariantyModelu(filters.make, filters.model)
        : undefined;

    const where = whereFor(filters, modelWarianty);
    const rows = await db
      .select({
        id: listings.id,
        make: listings.make,
        model: listings.model,
        trim: listings.trim,
        year: listings.year,
        mileageKm: listings.mileageKm,
        priceGross: listings.priceGross,
        marketPrice: listings.marketPrice,
        dealScore: listings.dealScore,
        url: listings.url,
        sourceName: sources.name,
      })
      .from(listings)
      .innerJoin(sources, eq(sources.id, listings.sourceId))
      .where(
        and(
          where,
          seenIds.length > 0 ? notInArray(listings.id, seenIds) : undefined,
          /*
           * `notInArray`, nie `<> all(...)` w surowym SQL: Drizzle nie serializuje
           * tablicy JS do tablicy Postgresa i zapytanie wywala sie na
           * `make_scalar_array_op`. Sprawdzone.
           *
           * `vin is null` przepuszczamy — brak numeru nie moze blokowac oferty.
           */
          seenVins.length > 0
            ? or(isNull(listings.vin), notInArray(listings.vin, seenVins))
            : undefined,
        ),
      )
      // Najlepsze okazje na gorze — mail ma sie zaczynac od tego, co najciekawsze.
      .orderBy(sql`${listings.dealScore} desc nulls last`, desc(listings.firstSeenAt))
      .limit(MAX_PER_MAIL);

    if (rows.length === 0) continue;

    const res = await newOffers(sub.email, sub.token, sub.label, rows as AlertOffer[]);
    if (res.skipped) {
      console.log("  RESEND_API_KEY nie ustawiony — nic nie wysylam");
      break;
    }
    if (!res.ok) {
      console.error(`  ✗ ${sub.email}: ${res.error}`);
      failed++;
      continue;
    }

    /*
     * Zapisujemy DOPIERO po udanej wysylce. Odwrotna kolejnosc oznaczalaby,
     * ze przy bledzie SMTP oferta zostaje oznaczona jako wyslana i adresat
     * nigdy jej nie zobaczy.
     */
    await db
      .insert(alertsSent)
      .values(rows.map((r) => ({ subscriptionId: sub.id, listingId: r.id })))
      .onConflictDoNothing();
    await db
      .update(subscriptions)
      .set({ lastSentAt: new Date() })
      .where(eq(subscriptions.id, sub.id));

    mails++;
    offersSent += rows.length;
  }

  console.log(
    `✓ alerty: ${subs.length} subskrypcji, wyslano ${mails} maili (${offersSent} ofert)` +
      (failed > 0 ? `, bledow ${failed}` : ""),
  );
  await client.end();
}

main().catch(async (err) => {
  console.error("✗ alerty:", err instanceof Error ? err.message : String(err));
  await client.end();
  process.exit(1);
});
