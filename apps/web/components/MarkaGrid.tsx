"use client";

import { CarImage } from "@/components/CarImage";
import { makeHref } from "@/lib/slug";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const pln = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("pl-PL");

export interface MarkaKafelek {
  make: string;
  total: number;
  minPrice: number | null;
  thumb: string | null;
}

/**
 * Ile kafelkow widac przed rozwinieciem.
 *
 * Dwa pelne rzedy przy szesciu kolumnach. Wyzej siatka zaczyna dominowac
 * strone, a to jest sekcja pomocnicza, nie glowna tresc.
 */
const WIDOCZNE = 12;

/**
 * Siatka marek ze zdjeciem przykladowego auta.
 *
 * ROZWIJANIE W MIEJSCU, NIE LINK GDZIE INDZIEJ — i to jest sedno tego
 * komponentu. Zapytania byly wczesniej przyciete do 24 marek, a zmierzone:
 * Warszawa ma 42 marki, Automarket 59, kategoria "kombi" 53. Polowa marek
 * nie miala wiec ZADNEGO sposobu, zeby sie do niej dostac z tej strony —
 * ani przycisku, ani linku, po prostu znikaly.
 *
 * Rozwazalem link do wyszukiwarki z ustawionym filtrem miasta zamiast
 * rozwijania. Odpadlo, bo strona glowna NIE CZYTA parametru `city` z adresu
 * (patrz app/page.tsx) — link "wszystkie marki w Warszawie" pokazalby wszystkie
 * marki w Polsce. Rozwijanie na miejscu nie zalezy od niczego poza ta lista.
 */
export function MarkaGrid({ marki }: { marki: MarkaKafelek[] }) {
  const [rozwiniete, setRozwiniete] = useState(false);
  if (marki.length === 0) return null;

  const widoczne = rozwiniete ? marki : marki.slice(0, WIDOCZNE);
  const ukryte = marki.length - widoczne.length;

  return (
    <div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {widoczne.map((m, i) => (
          <li key={m.make}>
            <Link
              href={makeHref(m.make)}
              className="group flex h-full flex-col overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] transition-colors hover:border-neutral-600"
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-[var(--color-ink)]">
                <CarImage
                  src={m.thumb}
                  alt={m.make}
                  /* Pierwszy rzad laduje sie od razu — reszta dopiero przy przewijaniu. */
                  priority={i < 6}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                />
              </div>
              {/*
                Podpis POD zdjeciem, nie na nim. Nazwy marek bywaja dlugie
                ("Mercedes-Benz", "Land Rover") i razem z dwiema liczbami nie
                mieszcza sie czytelnie na przyciemnieniu.
              */}
              <div className="flex flex-1 flex-col justify-between gap-0.5 px-3 py-2">
                <span className="text-[13px] font-medium leading-tight text-neutral-100">
                  {m.make}
                </span>
                <span className="flex items-baseline gap-1.5 text-[11px] tabular-nums text-neutral-500">
                  <span className="text-neutral-300">{num.format(m.total)}</span>
                  {m.minPrice != null && <span>od {pln.format(m.minPrice)}</span>}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {ukryte > 0 && (
        <button
          type="button"
          onClick={() => setRozwiniete(true)}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-2.5 text-[13px] text-neutral-300 transition-colors hover:border-neutral-600 hover:text-neutral-100"
        >
          Zobacz wszystkie {num.format(marki.length)} marek
          <span className="text-neutral-600">(+{num.format(ukryte)})</span>
          <ChevronDown size={14} className="text-neutral-500" />
        </button>
      )}
    </div>
  );
}
