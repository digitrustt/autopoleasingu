import NextLink from "next/link";
import type { ComponentProps } from "react";

/**
 * next/link BEZ wstepnego ladowania (prefetch) — domyslny link w calym serwisie.
 *
 * Zmierzone 4.11.2026 w przegladarce na produkcji: jedno wejscie na strone
 * modelu albo miasta odpalalo w tle 63-68 zadan `?_rsc=` o strony ze wszystkich
 * widocznych linkow (oferty, menu, kafelki), z czego przy pierwszej wizycie
 * prawie polowa nie byla w cache — kazda taka to render funkcji na Vercelu,
 * czyli limit CPU darmowego planu (25.10: 70%), zjadany przez strony, w ktore
 * nikt nie kliknal. Strony i tak ida z CDN, wiec przejscie po kliknieciu
 * pozostaje szybkie.
 *
 * Tam, gdzie prefetch faktycznie sie oplaca, mozna go wlaczyc jawnie:
 * `<Link prefetch>`.
 */
export default function Link({ prefetch = false, ...props }: ComponentProps<typeof NextLink>) {
  return <NextLink prefetch={prefetch} {...props} />;
}
