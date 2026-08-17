import { AlertSignup } from "@/components/AlertSignup";
import { OfferCard } from "@/components/OfferCard";
import { Pagination } from "@/components/Pagination";
import { type Filters as F, PAGE_SIZE, countListings, getListings } from "@/lib/queries";
import { unstable_cache } from "next/cache";
import { DatabaseZap, SearchX } from "lucide-react";
import Link from "next/link";

/**
 * Siatka wynikow jako osobny komponent async.
 *
 * Sens podzialu jest w Suspense: to TUTAJ czeka sie na baze, wiec radar podmienia
 * wylacznie liste, a naglowek i filtry zostaja na ekranie. Gdyby zapytanie siedzialo
 * w page.tsx, kazda zmiana filtra wygaszalaby cala strone razem z formularzem —
 * i przez chwile nie byloby widac, co sie wlasciwie filtruje.
 */
/*
 * Wyniki trzymane w cache na piec minut, kluczowane filtrami.
 *
 * Strona glowna nie ma cache'u calej strony, bo zalezy od parametrow
 * wyszukiwania — a to znaczylo, ze KAZDE wejscie renderowalo sie od zera
 * z bazy. Zmierzone na produkcji: 46% wszystkich zadan to strona glowna,
 * w ogromnej wiekszosci bez zadnego filtra, czyli to samo zapytanie liczone
 * w kolko. Cache na poziomie danych, a nie strony, zalatwia to bez psucia
 * filtrowania: kazdy zestaw filtrow ma wlasny wpis.
 *
 * Piec minut, a nie doba, bo tu liczy sie swiezosc — oferty poleasingowe
 * schodza szybko. Znacznik pozwala workerowi skasowac to zaraz po zaciagu.
 */
const pobierz = unstable_cache(
  async (filters: F, page: number) =>
    Promise.all([getListings(filters, page), countListings(filters)]),
  ["oferty"],
  { revalidate: 300, tags: ["oferty"] },
);

export async function Results({
  filters,
  page,
  params,
}: {
  filters: F;
  page: number;
  params: Record<string, string | undefined>;
}) {
  /*
   * Awaria bazy ma dac komunikat, a nie wieczny radar.
   *
   * Ten komponent siedzi pod granica Suspense, wiec gdy rzuci bledem, ktorego
   * nikt nie lapie, uzytkownik zostaje z animacja ladowania na zawsze —
   * dokladnie to widac bylo, gdy Neon odcial transfer.
   */
  let offers: Awaited<ReturnType<typeof getListings>>;
  let total: number;
  try {
    [offers, total] = await pobierz(filters, page);
  } catch (err) {
    console.error("lista ofert: baza niedostepna —", err);
    return (
      <p className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
        <DatabaseZap size={16} className="shrink-0" />
        Nie możemy teraz odczytać bazy ofert. To awaria po naszej stronie — spróbuj za kilka
        minut.
      </p>
    );
  }

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
