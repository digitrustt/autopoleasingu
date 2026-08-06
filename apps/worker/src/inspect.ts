/**
 * Podglad tego, co adapter wyciaga z pojedynczej oferty — bez dotykania bazy.
 *   pnpm --filter @auta/worker inspect -- --source automarket --n 5
 */
import { adapterById, closeBrowser } from "@auta/scrapers";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const adapter = adapterById.get(arg("source") ?? "automarket");
if (!adapter) throw new Error("Nieznane zrodlo");

const n = Number(arg("n") ?? 3);
const refs = await adapter.discover();
console.log(`discover: ${refs.length} ofert\n`);

for (const ref of refs.slice(0, n)) {
  const raw = await adapter.fetchDetail(ref);
  const parsed = adapter.parse(raw);
  if (!parsed) {
    console.log(`✗ ${ref.url} — parse zwrocil null\n`);
    continue;
  }
  const { thumbnailUrl, url, ...rest } = parsed;
  console.log(JSON.stringify(rest, null, 2));
  console.log("  thumb:", thumbnailUrl ?? "(brak)");
  console.log("  url:  ", url, "\n");
}

await closeBrowser();
