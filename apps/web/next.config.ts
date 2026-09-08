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
