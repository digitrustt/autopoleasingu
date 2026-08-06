/**
 * Jednorazowy przebieg scrapera — do developmentu i do crona.
 *
 *   pnpm scrape                      # wszystkie wlaczone zrodla
 *   pnpm scrape -- --source automarket --limit 20
 *   pnpm scrape -- --dry-run --limit 3
 */
import { client } from "@auta/db";
import { adapters, closeBrowser } from "@auta/scrapers";
import { markSourceFailed, runSource } from "./pipeline";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const has = (name: string) => process.argv.includes(`--${name}`);

const only = arg("source");
const detailLimit = Number(arg("limit") ?? 300);
const refreshAfterHours = Number(arg("refresh-after") ?? 24);
const dryRun = has("dry-run");

const selected = only ? adapters.filter((a) => a.id === only) : adapters;
if (selected.length === 0) {
  console.error(`Nie znam zrodla "${only}". Dostepne: ${adapters.map((a) => a.id).join(", ")}`);
  process.exit(1);
}

let exitCode = 0;
for (const adapter of selected) {
  const t0 = Date.now();
  console.log(`\n▶ ${adapter.name}${dryRun ? " [dry-run]" : ""}`);
  try {
    const r = await runSource(adapter, { detailLimit, refreshAfterHours, dryRun });
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(
      `✓ ${adapter.id}: znaleziono ${r.discovered}, pobrano ${r.fetched}, ` +
        `nowych ${r.created}, zmian ceny ${r.priceChanged}, zniknelo ${r.gone}, ` +
        `pominieto ${r.skipped}, bledow ${r.failed} (${secs}s)`,
    );
  } catch (err) {
    exitCode = 1;
    console.error(`✗ ${adapter.id}: ${err instanceof Error ? err.message : String(err)}`);
    await markSourceFailed(adapter.id, err).catch(() => {});
  }
}

await closeBrowser();
await client.end();
process.exit(exitCode);
