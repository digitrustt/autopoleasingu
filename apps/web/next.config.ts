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
    const cdnDlugi = [
      {
        key: "Vercel-CDN-Cache-Control",
        value: "s-maxage=86400, stale-while-revalidate=604800",
      },
    ];
    return [
      /*
       * JEDNA REGULA DLA WSZYSTKICH STRON HTML (22.10.2026), zamiast listy tras.
       *
       * Lista zawodzila za kazdym razem, gdy ktos dodal trase i o niej
       * zapomnial. Test na produkcji pokazal, ze bez naglowka nie szly
       * z cache'u: strona glowna, strony modeli (/bmw/x3), kategorie
       * i wojewodztwa (/poleasingowe/suv), leasingodawcy i kazdy wariant
       * "/?make=...". Kazde wejscie Googlebota odpalalo wtedy funkcje
       * i zapytania do bazy — to dokladnie mechanizm, ktory przekroczyl limit
       * CPU 5.10.2026.
       *
       * Teraz nowa trasa dostaje cache automatycznie. Kazdy unikalny adres
       * kosztuje najwyzej jedno wywolanie funkcji na 6 godzin, niezaleznie od
       * tego, ile razy robot do niego wroci.
       *
       * WYJATKI: /api (odpowiedzi maja wlasne naglowki, patrz route.ts),
       * /alerty (adresy z tokenem, nie moga isc do cache'u wspoldzielonego)
       * i /_next (statyki Next maja wlasne, wieczne naglowki).
       *
       * Na stronach nie ma niczego zaleznego od uzytkownika — nakladki i zgody
       * dzialaja w przegladarce, wiec wspolny cache jest bezpieczny.
       */
      { source: "/((?!api/|alerty/|_next/|oferta/|vin/).*)", headers: cdn },
      /*
       * Oferty i VIN-y: ~107 tys. adresow, po ktorych chodzi Googlebot i scrapery.
       * Doba zamiast 6 h, bo kazdy powrot robota po wygasnieciu to nowe
       * wywolanie funkcji (25.10.2026: 70% limitu Hobby). Cena zmienia sie
       * najwyzej raz na dobe. Wylaczone z reguly ogolnej, zeby nie bylo dwoch naglowkow.
       */
      { source: "/oferta/:id+", headers: cdnDlugi },
      { source: "/vin/:vin+", headers: cdnDlugi },
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
      /*
       * Carefleet sprzedaje od 19.10.2026 przez carefleet.otomoto.pl (wlasna strona
       * 503), a te auta sa w zrodle otomoto. Tymczasowe, bo strona moze wrocic.
       */
      {
        source: "/leasingodawca/carefleet",
        destination: "/leasingodawca/otomoto",
        permanent: false,
      },
    ];
  },
};

export default config;
