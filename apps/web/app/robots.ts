import type { MetadataRoute } from "next";

/**
 * robots.txt.
 *
 * Do tej pory go nie bylo, co samo w sobie nie blokuje indeksowania — ale
 * przez to nie bylo tez gdzie wskazac mapy strony, a serwis ma 22 tys.
 * podstron, do ktorych nie prowadzi zaden link z zewnatrz.
 *
 * Blokujemy trzy rzeczy:
 *  - `/api/` — nie ma tam nic do czytania, a zapis na powiadomienia to POST;
 *  - `/alerty/` — linki z maila zawieraja token subskrypcji. Wejscie robota
 *    w `/alerty/wypisz?token=…` WYPISALOBY czlowieka z powiadomien, bo ta
 *    strona dziala jednym klikniecięm i bez potwierdzenia;
 *  - `/?` z parametrami — lista z filtrami daje nieskonczenie wiele kombinacji
 *    tej samej tresci. Od tego sa strony marka/model.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/alerty/"],
    },
    sitemap: "https://autopoleasingu.pl/sitemap.xml",
  };
}
