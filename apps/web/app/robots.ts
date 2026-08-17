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
      /*
       * `/oferta/` jest zablokowana CELOWO, mimo ze to 22 tysiace stron.
       *
       * Nie ma ich w mapie strony, bo oferta zyje krotko i nie ma wartosci
       * wyszukiwarkowej — sluzy czlowiekowi, ktory juz jest na stronie.
       * Robot i tak po nich chodzil, bo sa podlinkowane wewnetrznie:
       * zmierzone na produkcji, 22% wszystkich zadan szlo na `/oferta/*`,
       * kazde z pelnym renderowaniem z bazy. To wlasnie ten ruch dobijal
       * limity i powodowal, ze co osme wejscie na strone glowna wisialo
       * kilkadziesiat sekund.
       */
      disallow: ["/api/", "/alerty/", "/oferta/"],
    },
    sitemap: "https://autopoleasingu.pl/sitemap.xml",
  };
}
