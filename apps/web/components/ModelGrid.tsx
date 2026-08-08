import { CarImage } from "@/components/CarImage";
import type { ModelCard } from "@/lib/queries";
import { modelHref } from "@/lib/slug";
import { bodySpec, fuelSpec } from "@/lib/spec";
import Link from "next/link";

const pln = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("pl-PL");

/**
 * Modele marki jako kafelki ze zdjeciem.
 *
 * Wczesniej byla to lista tekstowa i wygladala jak spis tresci — przy 335
 * modelach BMW nie sposob bylo niczego na niej znalezc wzrokiem. Zdjecie
 * rozpoznaje sie szybciej niz nazwe: "X3" nie mowi nic komus, kto szuka SUV-a.
 *
 * Zdjecie i tak juz mamy w bazie, wiec kosztuje to jedno zapytanie wiecej
 * (patrz getModelCards), a nie osobne zrodlo danych.
 */
export function ModelGrid({ make, models }: { make: string; models: ModelCard[] }) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
      {models.map((m, i) => {
        const fuel = fuelSpec(m.topFuel);
        const body = bodySpec(m.topBody);
        return (
          <li key={m.model}>
            <Link
              href={modelHref(make, m.model)}
              className="group flex h-full flex-col overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] transition duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-lg hover:shadow-white/5"
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-black/40">
                <CarImage
                  src={m.thumbnail}
                  alt={`${make} ${m.model}`}
                  /* Pierwszy rzad ladujemy od razu — to on jest nad linia zalamania. */
                  priority={i < 6}
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
                />
                <span className="absolute right-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-neutral-200">
                  {num.format(m.total)}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-1.5 p-3">
                <p className="truncate font-semibold leading-tight text-neutral-100 transition-colors group-hover:text-accent">
                  {m.model}
                </p>

                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-neutral-500">
                  {body && (
                    <span className="flex min-w-0 items-center gap-1">
                      <body.Icon size={12} className="shrink-0 text-neutral-600" />
                      <span className="truncate">{body.label}</span>
                    </span>
                  )}
                  {fuel && (
                    <span className="flex items-center gap-1">
                      <fuel.Icon size={12} className="shrink-0 text-neutral-600" />
                      {fuel.label}
                    </span>
                  )}
                  {m.minYear && m.maxYear && (
                    <span className="tabular-nums">
                      {m.minYear === m.maxYear ? m.minYear : `${m.minYear}–${m.maxYear}`}
                    </span>
                  )}
                </div>

                <p className="mt-auto pt-1 text-[13px] tabular-nums">
                  {m.minPrice != null ? (
                    <>
                      <span className="text-neutral-600">od </span>
                      <span className="font-bold text-neutral-100">{pln.format(m.minPrice)}</span>
                      {m.medianPrice != null && (
                        <span className="text-neutral-600">
                          {" "}
                          · mediana {pln.format(m.medianPrice)}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-neutral-600">tylko leasing lub najem</span>
                  )}
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
