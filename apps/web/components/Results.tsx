import { AlertSignup } from "@/components/AlertSignup";
import { OfferCard } from "@/components/OfferCard";
import { Pagination } from "@/components/Pagination";
import { type Filters as F, PAGE_SIZE, countListings, getListings } from "@/lib/queries";
import { SearchX } from "lucide-react";
import Link from "next/link";

/**
 * Siatka wynikow jako osobny komponent async.
 *
 * Sens podzialu jest w Suspense: to TUTAJ czeka sie na baze, wiec radar podmienia
 * wylacznie liste, a naglowek i filtry zostaja na ekranie. Gdyby zapytanie siedzialo
 * w page.tsx, kazda zmiana filtra wygaszalaby cala strone razem z formularzem —
 * i przez chwile nie byloby widac, co sie wlasciwie filtruje.
 */
export async function Results({
  filters,
  page,
  params,
}: {
  filters: F;
  page: number;
  params: Record<string, string | undefined>;
}) {
  const [offers, total] = await Promise.all([
    getListings(filters, page),
    countListings(filters),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const num = new Intl.NumberFormat("pl-PL");

  if (offers.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-10 text-center">
        <SearchX size={28} className="text-neutral-600" />
        <p className="text-sm text-neutral-400">Brak ofert dla tych filtrów.</p>
        <Link
          href="/"
          className="rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-sm text-neutral-300 transition-colors hover:border-accent/70 hover:text-accent"
        >
          Wyczyść filtry
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Formularz nad lista: uzytkownik wlasnie ustawil filtry i widzi wynik. */}
      <AlertSignup filters={params} total={total} />

      <p className="mb-3 text-sm text-neutral-400">
        Znaleziono{" "}
        <span className="font-semibold text-neutral-200 tabular-nums">{num.format(total)}</span>{" "}
        ofert
        {pageCount > 1 && ` · strona ${page} z ${pageCount}`}
      </p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
        {offers.map((o, i) => (
          <OfferCard key={o.id} o={o} index={i} />
        ))}
      </div>
      <Pagination page={page} pageCount={pageCount} params={params} />
    </>
  );
}
