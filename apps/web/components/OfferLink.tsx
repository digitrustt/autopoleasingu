"use client";

import { track } from "@/components/Analytics";
import Link from "next/link";

/**
 * Link do oferty z pomiarem.
 *
 * Ma dwa tryby, bo klikniecie w oferte znaczy co innego w dwoch miejscach:
 *
 *  - kafelek na liscie prowadzi do WEWNETRZNEJ strony oferty (`/oferta/123`).
 *    Wczesniej wyrzucal prosto na zrodlo, przez co po pierwszym kliknięciu
 *    uzytkownik znikal, a serwis nie mial ani jednej podstrony, ktora dalo by
 *    sie zaindeksowac albo komus podeslac;
 *  - przycisk na stronie oferty prowadzi juz NA ZEWNATRZ, do sprzedawcy —
 *    tam odbywa sie transakcja i to jest moment, w ktorym narzedzie
 *    faktycznie zadzialalo.
 *
 * Oba zdarzenia zbieramy pod ta sama nazwa, z polem `z` odrozniajacym miejsce.
 * `track` nic nie robi bez zgody, wiec wolamy je bezwarunkowo.
 */
export function OfferLink({
  href,
  offer,
  external = false,
  className,
  style,
  children,
}: {
  href: string;
  offer: Record<string, unknown>;
  /** true = wyjscie do sprzedawcy w nowej karcie. */
  external?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const onClick = () => track("oferta_klik", offer);

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        style={style}
        onClick={onClick}
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className} style={style} onClick={onClick}>
      {children}
    </Link>
  );
}
