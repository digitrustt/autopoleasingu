import { DealBadge } from "@/components/DealBadge";
import { shortSource } from "@/lib/format";
import type { SimilarRow } from "@/lib/queries";
import { ImageOff } from "lucide-react";
import Link from "next/link";

const pln = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("pl-PL");

/**
 * Podobne oferty pod strona pojedynczego auta.
 *
 * Osobny, lzejszy kafelek niz OfferCard: tam kazdy element walczy o uwage na
 * liscie wynikow, tutaj ma tylko dac trzecia opcje po tym, jak ktos obejrzal
 * juz konkretne auto. Linkuje do WEWNETRZNEJ strony oferty — te linki sa
 * jedyna droga, ktora robot indeksujacy dochodzi z jednego auta do drugiego.
 */
export function SimilarStrip({ rows }: { rows: SimilarRow[] }) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
      {rows.map((r) => (
        <li key={r.id}>
          <Link
            href={`/oferta/${r.id}`}
            className="group flex h-full flex-col overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] transition-colors hover:border-accent/40"
          >
            <div className="relative aspect-[4/3] overflow-hidden bg-black/40">
              {r.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={r.thumbnailUrl}
                  alt={`${r.make} ${r.model}`}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-neutral-700">
                  <ImageOff size={18} />
                </div>
              )}
              {r.dealScore != null && (
                <span className="absolute left-2 top-2">
                  <DealBadge score={r.dealScore} compact />
                </span>
              )}
            </div>

            <div className="flex flex-1 flex-col gap-1 p-2.5">
              <p className="truncate text-[13px] font-semibold leading-tight text-neutral-200 transition-colors group-hover:text-accent">
                {r.make} {r.model}
              </p>
              <p className="text-[11px] text-neutral-600">
                {[r.year, r.mileageKm != null ? `${num.format(r.mileageKm)} km` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p className="mt-auto flex items-baseline justify-between gap-2 pt-1">
                <span className="text-sm font-bold tabular-nums text-neutral-100">
                  {r.priceGross != null ? pln.format(r.priceGross) : "—"}
                </span>
                <span className="min-w-0 truncate text-[11px] text-neutral-600">
                  {shortSource(r.sourceName)}
                </span>
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
