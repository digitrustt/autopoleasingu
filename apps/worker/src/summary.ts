/**
 * Podsumowanie stanu zrodel po przebiegu — do podsumowania zadania w Actions.
 *
 *   pnpm --filter @auta/worker summary
 *
 * Istnieje, bo scraper, ktory przestaje cokolwiek znajdowac, konczy sie
 * SUKCESEM: "0 znalezionych, 0 bledow" wyglada w logu identycznie jak zdrowy
 * przebieg zrodla, ktore akurat nie mialo nowosci. Bez jawnego wskazania
 * zrodel z zerem aktywnych ofert cichy zgon adaptera przechodzi niezauwazony.
 *
 * Osobny plik, a nie `tsx -e` w YAML-u: kod z backtickami i ${...} wewnatrz
 * cudzyslowow w kroku `run` przechodzi przez dwa poziomy cytowania (YAML
 * i bash) i przy pierwszej probie sie o to wylozyl.
 */
import { client, db, listings, sources } from "@auta/db";
import { eq, sql } from "drizzle-orm";

async function main() {
  const rows = await db
    .select({
      id: sources.id,
      active: sql<number>`count(${listings.id}) filter (
        where ${listings.status} = 'active'
      )::int`,
      fresh: sql<number>`count(${listings.id}) filter (
        where ${listings.status} = 'active'
          and ${listings.firstSeenAt} > now() - interval '25 hours'
      )::int`,
      priced: sql<number>`count(${listings.id}) filter (
        where ${listings.status} = 'active' and ${listings.priceGross} is not null
      )::int`,
    })
    .from(sources)
    .leftJoin(listings, eq(listings.sourceId, sources.id))
    .groupBy(sources.id)
    .orderBy(sql`count(${listings.id}) filter (where ${listings.status} = 'active') desc`);

  const [totals] = await db
    .select({
      active: sql<number>`count(*) filter (where ${listings.status} = 'active')::int`,
      scored: sql<number>`count(*) filter (where ${listings.dealScore} is not null)::int`,
      deals: sql<number>`count(*) filter (where ${listings.dealScore} >= 0.15)::int`,
    })
    .from(listings);

  const out: string[] = [];
  out.push("## Zaciąg zakończony", "");
  out.push(
    `**${totals.active}** aktywnych ofert · **${totals.scored}** z wyceną · ` +
      `**${totals.deals}** okazji ≥15% pod rynkiem`,
    "",
  );

  const dead = rows.filter((r) => Number(r.active) === 0);
  if (dead.length > 0) {
    out.push(`> [!WARNING]`, `> Źródła bez ani jednej oferty: ${dead.map((d) => d.id).join(", ")}`, "");
  }

  out.push("| Źródło | Aktywne | Nowe (24 h) | Z ceną |", "|---|---:|---:|---:|");
  for (const r of rows) {
    out.push(`| ${r.id} | ${r.active} | ${r.fresh} | ${r.priced} |`);
  }

  console.log(out.join("\n"));
  await client.end();
}

main().catch(async (err) => {
  console.error("✗ podsumowanie:", err instanceof Error ? err.message : String(err));
  await client.end();
  process.exit(1);
});
