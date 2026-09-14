"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const num = new Intl.NumberFormat("pl-PL");

export interface MiastoPozycja {
  city: string;
  href: string;
  total: number;
}

/**
 * Ile pigulek widac przed rozwinieciem.
 *
 * Pigulki sa male i lamia sie w wiersze, wiec miesci sie ich duzo wiecej niz
 * kafelkow ze zdjeciem — stad 24, a nie 12 jak przy markach.
 */
const WIDOCZNE = 24;

/**
 * Lista miast jako pigulki, z rozwijaniem w miejscu.
 *
 * Zapytania byly przyciete do 16 miast i reszta znikala bez sladu. Zmierzone:
 * Automarket ma auta w 115 miastach, kategoria SUV w 182, BMW w 65. Pokazywac
 * szesnascie i nie dac ZADNEGO sposobu na dojscie do pozostalych stu to bylo
 * chowanie wlasnych stron przed wlasnymi uzytkownikami — i przed robotem
 * indeksujacym, dla ktorego kazdy taki link to droga do kolejnej strony miasta.
 */
export function MiastaLista({ miasta }: { miasta: MiastoPozycja[] }) {
  const [rozwiniete, setRozwiniete] = useState(false);
  if (miasta.length === 0) return null;

  const widoczne = rozwiniete ? miasta : miasta.slice(0, WIDOCZNE);
  const ukryte = miasta.length - widoczne.length;

  return (
    <div>
      <ul className="flex flex-wrap gap-2">
        {widoczne.map((m) => (
          <li key={m.href}>
            <Link
              href={m.href}
              className="flex items-baseline gap-1.5 rounded-lg border border-[var(--color-line)] px-2.5 py-1.5 text-[13px] text-neutral-300 transition-colors hover:border-accent/70 hover:text-accent"
            >
              {m.city}
              <span className="text-[11px] tabular-nums text-neutral-600">
                {num.format(m.total)}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {ukryte > 0 && (
        <button
          type="button"
          onClick={() => setRozwiniete(true)}
          className="mt-3 flex items-center gap-1.5 rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2 text-[13px] text-neutral-300 transition-colors hover:border-neutral-600 hover:text-neutral-100"
        >
          Zobacz wszystkie {num.format(miasta.length)} miast
          <span className="text-neutral-600">(+{num.format(ukryte)})</span>
          <ChevronDown size={14} className="text-neutral-500" />
        </button>
      )}
    </div>
  );
}
