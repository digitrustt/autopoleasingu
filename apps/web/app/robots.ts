import type { MetadataRoute } from "next";

/**
 * robots.txt.
 *
 * Blokujemy trzy rzeczy:
 *  - `/api/` — nie ma tam nic do czytania, a zapis na powiadomienia to POST;
 *  - `/alerty/` — linki z maila zawieraja token subskrypcji. Wejscie robota
 *    w `/alerty/wypisz?token=…` WYPISALOBY czlowieka z powiadomien, bo ta
 *    strona dziala jednym klikniecięm i bez potwierdzenia;
 *  - `/oferta/` — 22 tysiace stron pojedynczych ofert. NIE MA ich w mapie
 *    strony, bo oferta zyje kilka dni i nie ma wartosci wyszukiwarkowej.
 *    Robot i tak po nich chodzil, bo sa podlinkowane wewnetrznie: zmierzone
 *    na produkcji, 22% wszystkich zadan szlo wlasnie tam, kazde z pelnym
 *    renderowaniem z bazy. To ten ruch dobijal limity i powodowal, ze co osme
 *    wejscie na strone glowna wisialo kilkadziesiat sekund.
 *
 * Crawlery modeli jezykowych sa wypisane Z NAZWY, mimo ze regula `*` i tak je
 * obejmuje. Chodzi o czytelnosc: kto zajrzy do tego pliku, ma od razu widziec,
 * ze to decyzja, a nie przeoczenie. W analityce pojawilo sie juz wejscie
 * z `utm_source=chatgpt.com`, wiec modele realnie tu odsylaja.
 *
 * `/oferta/` zostaje zabronione takze dla nich, i to jest celowe: cytowanie
 * oferty, ktora znika po kilku dniach, prowadzi czytelnika do martwego adresu.
 * To, co warto cytowac, stoi na /dane i na stronach modeli.
 */
const ZABRONIONE = ["/api/", "/alerty/", "/oferta/"];

/** Crawlery modeli jezykowych i wyszukiwarek opartych na modelach. */
const MODELE = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "PerplexityBot",
  "Google-Extended",
  "Applebot-Extended",
];

export default function robots(): MetadataRoute.Robots {
  const regula = (userAgent: string) => ({ userAgent, allow: "/", disallow: ZABRONIONE });

  return {
    rules: [regula("*"), ...MODELE.map(regula)],
    sitemap: "https://autopoleasingu.pl/sitemap.xml",
    host: "https://autopoleasingu.pl",
  };
}
