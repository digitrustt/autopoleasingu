import type { MetadataRoute } from "next";

/**
 * robots.txt.
 *
 * Blokujemy trzy rzeczy:
 *  - `/api/` — nie ma tam nic do czytania, a zapis na powiadomienia to POST;
 *  - `/alerty/` — linki z maila zawieraja token subskrypcji. Wejscie robota
 *    w `/alerty/wypisz?token=…` WYPISALOBY czlowieka z powiadomien, bo ta
 *    strona dziala jednym klikniecięm i bez potwierdzenia;
 *
 * `/oferta/` BYLO tu przez tydzien i to byl blad — zmierzony, wiec zapisany.
 *
 * Powodem blokady bylo 22% zadan idacych na oferty, obwinione o zawieszanie
 * serwisu. Prawdziwa przyczyna byly `Promise.race` porzucajace polaczenia,
 * zly region i godzinny odswiez; naprawilismy je osobno, a blokada zostala
 * i kosztowala ruch. Zmierzone w analityce: DZIESIEC z pietnastu stron,
 * na ktore Google wysyla ludzi, to wlasnie strony ofert — okolo POLOWY
 * calego ruchu z wyszukiwarki. Wchodzily nadal po 17.08, bo `Disallow`
 * zatrzymuje robota, ale nie usuwa z indeksu tego, co juz w nim jest; za to
 * skazuje te adresy na powolne wypadniecie.
 *
 * To najbardziej wartosciowy ruch, jaki serwis ma: ktos wpisal w Google
 * konkretne auto i trafil na konkretne auto. Oferty zostaja poza mapa strony
 * (patrz sitemap.ts) — nie zglaszamy ich jako priorytetu, ale nie wyrzucamy
 * z indeksu tego, co Google sam znalazl.
 *
 * Crawlery modeli jezykowych sa wypisane Z NAZWY, mimo ze regula `*` i tak je
 * obejmuje. Chodzi o czytelnosc: kto zajrzy do tego pliku, ma od razu widziec,
 * ze to decyzja, a nie przeoczenie. W analityce pojawilo sie juz wejscie
 * z `utm_source=chatgpt.com`, wiec modele realnie tu odsylaja.
 *
 * Zniknieta oferta nie jest martwym adresem: strona zostaje, mowi wprost, ze
 * auto zostalo sprzedane, pokazuje historie ceny i podobne egzemplarze.
 * ZOSTAJE TEZ W INDEKSIE — `noindex` zdjety 17.09.2026, bo 42% odslon stron
 * ofert dotyczy wlasnie aut sprzedanych (patrz app/oferta/[id]/page.tsx).
 */
/*
 * `/opengraph-image` to obrazki podgladu dla Facebooka i Twittera, generowane
 * osobno dla KAZDEJ oferty. Robot traktowal je jak zwykle adresy i mielil
 * tysiacami — w raporcie Google zajmowaly wiekszosc pozycji "wykluczona tagiem
 * noindex". Kazde takie zadanie to osobne generowanie obrazka, czyli czysty
 * koszt CPU bez zadnej wartosci: te adresy nigdy nie mialy byc w indeksie,
 * a serwisy spolecznosciowe pobieraja je BEZPOSREDNIO, ignorujac robots.txt.
 *
 * Wspolwinne odcieciu serwisu przez Vercela 21.09.2026 (10 h 14 min CPU).
 */
/*
 * `/?` — strona glowna z parametrami, czyli filtry listy (`/?make=BMW&priceMax=…`).
 * Celowo NIE `/*?`: pliki z /_next/ tez miewaja parametry w adresie, a robot
 * odciety od stylow i skryptow nie wyrenderuje strony.
 *
 * Kombinacji sa tysiace, kazda prowadzi do strony glownej, ktora jest liczona
 * przy kazdym wejsciu i jest najciezsza w serwisie. Adres kanoniczny wskazuje
 * na "/", wiec w indeksie i tak nie ma z nich pozytku — a robot chodzacy po
 * linkach filtrow i stronicowania mielil je bez konca. Frazy filtrowane
 * obsluguja strony kategorii (/poleasingowe/…), ktore parametrow nie maja.
 */
const ZABRONIONE = ["/api/", "/alerty/", "/*/opengraph-image", "/?"];

/*
 * Roboty narzedzi SEO i hurtowe zbieracze. Nie przysylaja ani jednego
 * czlowieka, a chodza po dziesiatkach tysiecy adresow. Wyszukiwarki i roboty
 * modeli jezykowych zostaja — te realnie odsylaja ruch (patrz MODELE).
 */
const NIEPOTRZEBNE = [
  "AhrefsBot",
  "SemrushBot",
  "MJ12bot",
  "DotBot",
  "DataForSeoBot",
  "BLEXBot",
  "Bytespider",
  "PetalBot",
  "serpstatbot",
  "Barkrowler",
];

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
    rules: [
      regula("*"),
      ...MODELE.map(regula),
      ...NIEPOTRZEBNE.map((userAgent) => ({ userAgent, disallow: "/" })),
    ],
    sitemap: "https://autopoleasingu.pl/sitemap.xml",
    host: "https://autopoleasingu.pl",
  };
}
