import type { NextConfig } from "next";

const config: NextConfig = {
  // Pakiety workspace'owe sa w TS — Next musi je przetranspilowac.
  transpilePackages: ["@auta/db", "@auta/core"],

  /*
   * Lokalny `next build` pisze do wlasnego katalogu, zeby nie nadpisac chunkow
   * dzialajacego `next dev` (objawia sie jako "__webpack_modules__[moduleId]
   * is not a function"). Na Vercelu zmiennej nie ma, wiec zostaje domyslny .next.
   */
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Miniatury hot-linkujemy zwyklym <img>. next/image optymalizowalby je na
  // Vercelu, ale to platny limit — a zdjecia i tak serwuje zrodlo.

  /**
   * www -> domena bez www, trwale.
   *
   * Do tej pory OBA adresy oddawaly 200 z pelna trescia, wiec caly serwis
   * istnial w wyszukiwarce podwojnie. W Search Console widac to wprost: strona
   * glowna figuruje jako dwa osobne wiersze, ktore dziela miedzy siebie
   * klikniecia (7 i 5) oraz wyswietlenia (111 i 103). Kazdy sygnal — linki,
   * zachowanie uzytkownikow, autorytet — rozkladal sie na dwie polowy zamiast
   * wzmacniac jeden adres.
   *
   * Przy domenie bez ani jednego linku z zewnatrz dzielenie i tak skromnego
   * autorytetu na pol jest kosztem, na ktory nas nie stac.
   */
  /**
   * Strony ofert i VIN-ow trzymane w pamieci podrecznej sieci Vercela.
   *
   * Tych adresow jest kilkadziesiat tysiecy (oferty aktywne i sprzedane,
   * VIN-y) i to po nich roboty chodza najwiecej. Zwykly mechanizm Next
   * (generateStaticParams + revalidate, jak na stronach marek) zapisywalby
   * kazda z nich w magazynie ISR, a ten ma na darmowym planie limit 200 tys.
   * zapisow miesiecznie — zamienilibysmy jeden przekroczony limit na drugi.
   *
   * Naglowek `Vercel-CDN-Cache-Control` mowi samej sieci, zeby trzymala
   * odpowiedz, niezaleznie od `private, no-store`, ktore Next dokleja stronom
   * liczonym na zadanie. Szesc godzin swiezosci i doba oddawania starej wersji
   * w trakcie odswiezania: cena zmienia sie najwyzej raz na dobe (zaciag
   * o 03:37), wiec czlowiek nie zobaczy danych starszych niz z poprzedniego
   * zaciagu. Na stronie nie ma niczego zaleznego od uzytkownika — nakladki
   * i zgody dzialaja w przegladarce.
   */
  async headers() {
    const cdn = [
      {
        key: "Vercel-CDN-Cache-Control",
        value: "s-maxage=21600, stale-while-revalidate=86400",
      },
    ];
    return [
      { source: "/oferta/:id(\\d+)", headers: cdn },
      { source: "/vin/:vin", headers: cdn },
      /*
       * Strony z agregacjami po calej tabeli. Sa liczone na zadanie (patrz
       * `connection()` w nich), wiec bez tego kazde wejscie odpalalo po kilka
       * ciezkich zapytan — i to wlasnie one najczesciej trafialy na zerwane
       * polaczenie i konczyly sie 504. Dane zmieniaja sie raz na dobe.
       */
      ...[
        "/poleasingowe",
        "/poleasingowe/dla-osoby-prywatnej",
        "/dane",
        "/zrodla",
        "/vin",
        "/analizy/:slug",
        "/poradnik/:slug",
      ].map((source) => ({ source, headers: cdn })),
    ];
  },

  async redirects() {
    return [
      {
        source: "/:sciezka*",
        has: [{ type: "host", value: "www.autopoleasingu.pl" }],
        destination: "https://autopoleasingu.pl/:sciezka*",
        permanent: true,
      },
    ];
  },
};

export default config;
