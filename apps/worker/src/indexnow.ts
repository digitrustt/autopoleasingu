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
 * ktore trzeba pamietac, zeby trzymac zgodne. Pojedynczych ofert tam nie ma,
 * i tak ma zostac — zyja po kilka dni i sa zabronione w robots.txt.
 */
const HOST = "autopoleasingu.pl";
const BASE = `https://${HOST}`;
const KLUCZ = process.env.INDEXNOW_KEY;

async function main() {
  if (!KLUCZ) {
    console.log("✓ indexnow: INDEXNOW_KEY nie ustawiony — pomijam");
    return;
  }

  const xml = await (await fetch(`${BASE}/sitemap.xml`)).text();
  const adresy = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);

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
