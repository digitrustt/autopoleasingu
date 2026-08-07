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
import { type AlertOffer, newOffers } from "@auta/core";
import { alertsSent, client, db, listings, sources, subscriptions } from "@auta/db";
import { and, desc, eq, gte, ilike, isNotNull, isNull, lte, notInArray, sql } from "drizzle-orm";

/** Ile ofert maksymalnie w jednym mailu. Powyzej tego nikt nie czyta. */
const MAX_PER_MAIL = 12;

/** Jak swieza musi byc oferta, zeby w ogole trafic do alertu. */
const FRESH_HOURS = 30;

type Filters = Record<string, string>;

/** Te same reguly co w wyszukiwarce — patrz apps/web/lib/queries.ts. */
function whereFor(f: Filters) {
  const parts = [
    eq(listings.status, "active"),
    isNotNull(listings.priceGross),
    gte(listings.firstSeenAt, sql`now() - interval '${sql.raw(String(FRESH_HOURS))} hours'`),
  ];

  if (f.make) parts.push(eq(listings.make, f.make));
  if (f.model) parts.push(eq(listings.model, f.model));
  if (f.source) parts.push(eq(listings.sourceId, f.source));
  if (f.fuel) parts.push(eq(listings.fuel, f.fuel));
  if (f.gearbox) parts.push(eq(listings.gearbox, f.gearbox));
  if (f.body) parts.push(ilike(listings.body, `%${f.body}%`));
  if (f.kind === "fixed" || f.kind === "auction") parts.push(eq(listings.offerKind, f.kind));

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

    // Oferty juz wyslane temu adresatowi — nie powtarzamy.
    const seen = await db
      .select({ id: alertsSent.listingId })
      .from(alertsSent)
      .where(eq(alertsSent.subscriptionId, sub.id));
    const seenIds = seen.map((s) => s.id);

    const where = whereFor(filters);
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
      .where(seenIds.length > 0 ? and(where, notInArray(listings.id, seenIds)) : where)
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
