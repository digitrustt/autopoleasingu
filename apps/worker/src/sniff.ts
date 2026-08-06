/**
 * Rozpoznanie zrodla, ktore renderuje liste dopiero w przegladarce.
 *
 * Zamiast zgadywac endpoint, otwieramy strone i notujemy odpowiedzi JSON,
 * o ktore prosi ona sama. Tak znalezlismy API Škody — okazalo sie zwyklym
 * GET-em, wiec adapter dziala na czystym HTTP, bez kosztu Chromium.
 *
 *   pnpm --filter @auta/worker sniff https://mauto.pl/lista-pojazdow
 *   pnpm --filter @auta/worker sniff <url> --match api --settle 12000
 */
import { captureJson, closeBrowser, fetchRendered } from "@auta/scrapers";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const url = process.argv[2];
if (!url?.startsWith("http")) {
  console.error("Uzycie: sniff <url> [--match <fragment>] [--settle <ms>]");
  process.exit(1);
}

const pattern = new RegExp(arg("match") ?? ".");
const settleMs = Number(arg("settle") ?? 9000);

/*
 * --links zamiast API pokazuje odnosniki po renderze. Potrzebne, gdy API oddaje
 * same dane bez adresu oferty (mauto.pl) — a bez adresu miniatura nie ma dokad
 * prowadzic.
 */
if (process.argv.includes("--links")) {
  const html = await fetchRendered(url, { settleMs, timeoutMs: 60_000 });
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  const filter = arg("match");
  for (const h of [...new Set(hrefs)].filter((h) => !filter || h.includes(filter))) {
    console.log(h);
  }
  await closeBrowser();
  process.exit(0);
}

const calls = await captureJson(url, pattern, { settleMs, timeoutMs: 60_000 });

// Najciekawsze sa najwieksze odpowiedzi — to zwykle one niosa liste ofert.
const sorted = calls
  .map((c) => ({ ...c, size: JSON.stringify(c.body).length }))
  .sort((a, b) => b.size - a.size);

for (const c of sorted) {
  console.log(`\n${c.method} ${c.url}  [${c.size} B]`);
  if (c.postData) console.log("  POST:", c.postData.slice(0, 400));
  console.log("  ->", JSON.stringify(c.body).slice(0, 500));
}
console.log(`\nlacznie ${calls.length} odpowiedzi JSON`);

await closeBrowser();
