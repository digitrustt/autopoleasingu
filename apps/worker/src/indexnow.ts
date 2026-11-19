/**
 * Zgloszenie adresow do IndexNow.
 *
 *   pnpm --filter @auta/worker indexnow
 *
 * Google nie obsluguje tego protokolu i kaze czekac, az robot sam wroci — ale
 * Bing i Yandex indeksuja zgloszony adres w ciagu godzin. Ma to znaczenie poza
 * samym Bingiem: wyszukiwarka ChatGPT korzysta z jego indeksu, a w analityce
 * pojawilo sie juz wejscie z `utm_source=chatgpt.com`. To najkrotsza droga do
 * tego, zeby modele w ogole zobaczyly nowe strony.
 *
 * ZRODLEM LISTY JEST MAPA STRONY, nie wlasne zapytania do bazy. Poczatkowo
 * skladalem te liste tutaj, importujac funkcje z aplikacji Next — i to nie
 * dziala, bo tamten kod uzywa aliasu `@/`, ktory zyje tylko w jej buildzie.
 * Pobranie sitemapy jest zreszta lepsze samo w sobie: nie ma dwoch miejsc,
 * ktore trzeba pamietac, zeby trzymac zgodne.
 *
 * OFERTY (20.11.2026). Wczesniej ich tu nie bylo, bo "sa zabronione
 * w robots.txt" — ale ta blokada zostala zdjeta we wrzesniu, a ChatGPT przysyla
 * dzis ~30 osob dziennie, z czego wiekszosc na strony ofert. Zglaszamy wiec
 * oferty z sitemap-oferty.xml dodane w ostatnich 36 godzinach (kilkaset
 * dziennie), na poczatku listy. Tylko nowe: kazde zgloszenie to wizyta robota
 * Bing, czyli render strony i CPU na Vercelu, a stare oferty Bing juz zna.
 */
const HOST = "autopoleasingu.pl";
const BASE = `https://${HOST}`;
const KLUCZ = process.env.INDEXNOW_KEY;

async function main() {
  if (!KLUCZ && !process.env.INDEXNOW_DRY) {
    console.log("✓ indexnow: INDEXNOW_KEY nie ustawiony — pomijam");
    return;
  }

  const xml = await (await fetch(`${BASE}/sitemap.xml`)).text();
  const strony = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);

  // Swieze oferty — patrz komentarz na gorze. Blad tej mapy nie blokuje reszty.
  let oferty: string[] = [];
  try {
    const xmlOfert = await (await fetch(`${BASE}/sitemap-oferty.xml`)).text();
    const od = Date.now() - 36 * 3600 * 1000;
    oferty = [...xmlOfert.matchAll(/<loc>(.*?)<\/loc><lastmod>(.*?)<\/lastmod>/g)]
      .filter((m) => Date.parse(m[2]) >= od)
      .map((m) => m[1]);
  } catch (err) {
    console.error("✗ indexnow: sitemap-oferty.xml:", err instanceof Error ? err.message : String(err));
  }
  const adresy = [...new Set([...oferty, ...strony])];
  console.log(`  indexnow: ${oferty.length} swiezych ofert + ${strony.length} stron z mapy`);

  if (process.env.INDEXNOW_DRY) {
    console.log("  indexnow: INDEXNOW_DRY — nic nie wysylam; przyklad:", adresy.slice(0, 3));
    return;
  }

  if (adresy.length === 0) {
    console.error("✗ indexnow: mapa strony nie zwrocila zadnego adresu");
    process.exit(1);
  }

  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: HOST,
      key: KLUCZ,
      keyLocation: `${BASE}/${KLUCZ}.txt`,
      // Limit protokolu to 10 000 adresow na zgloszenie.
      urlList: adresy.slice(0, 10_000),
    }),
  });

  /*
   * 200 i 202 znacza przyjete. 422 to najczesciej niezgodnosc klucza z plikiem
   * pod keyLocation — warto wiedziec od razu, a nie odkryc po miesiacu.
   */
  console.log(
    res.ok
      ? `✓ indexnow: zgloszono ${Math.min(adresy.length, 10_000)} adresow (HTTP ${res.status})`
      : `✗ indexnow: HTTP ${res.status} — ${(await res.text()).slice(0, 140)}`,
  );
}

main().catch((err) => {
  console.error("✗ indexnow:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
