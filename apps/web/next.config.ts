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
};

export default config;
