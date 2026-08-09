import { Crumbs } from "@/components/Crumbs";
import { OfferCard } from "@/components/OfferCard";
import { StatStrip } from "@/components/StatStrip";
import { GRUPY, type Kategoria } from "@/lib/filtry";
import { getFilterCities, getFilterMakes, getFilterStats, getListings } from "@/lib/queries";
import { makeHref, slugify } from "@/lib/slug";
import { Layers, MapPin, SlidersHorizontal, TrendingDown } from "lucide-react";
import Link from "next/link";

const pln = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("pl-PL");

/**
 * Strona kategorii — "do 50 tys.", "SUV", "hybrydy".
 *
 * Osobny widok, a nie kolejne rozgalezienie w stronie miasta: obie mieszkaja
 * pod /poleasingowe/… i dziela trase, ale odpowiadaja na inne pytanie
 * i pokazuja inne rzeczy. Wspolna funkcja byla by drabinka ifow.
 */
export async function KategoriaWidok({ k }: { k: Kategoria }) {
  const [stats, marki, miasta, oferty] = await Promise.all([
    getFilterStats(k.filtry),
    getFilterMakes(k.filtry),
    getFilterCities(k.filtry),
    getListings({ ...k.filtry, sort: "deal_desc" }, 1, 24),
  ]);

  /*
   * Adres listy z tymi samymi filtrami. Kategoria opisana jest przez `Filters`,
   * wiec parametry powstaja z niej automatycznie — bez recznego przepisywania,
   * ktore rozjechaloby sie przy pierwszej zmianie definicji.
   */
  const params = new URLSearchParams(
    Object.entries(k.filtry)
      .filter(([, v]) => v != null && v !== "")
      .map(([key, v]) => [key, String(v)]),
  );

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6">
      <Crumbs items={[{ label: "Kategorie", href: "/poleasingowe" }, { label: k.nazwa }]} />

      <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight text-neutral-100">
        <Layers size={22} className="text-neutral-600" />
        {k.h1}
      </h1>
      <p className="mb-5 mt-1 max-w-[70ch] text-sm leading-relaxed text-neutral-400">
        {num.format(stats.total)} ofert z {stats.sources} źródeł, {num.format(stats.makes)} marek.{" "}
        {k.opis}
      </p>

      <StatStrip
        items={[
          { label: "Ofert", value: num.format(stats.total), hint: `${stats.makes} marek` },
          {
            label: "Mediana",
            value: stats.medianPrice ? pln.format(stats.medianPrice) : "—",
            hint: "tylko „kup teraz”",
          },
          { label: "Najtaniej", value: stats.minPrice ? pln.format(stats.minPrice) : "—" },
          {
            label: "Przebieg",
            value: stats.medianMileage != null ? `${num.format(stats.medianMileage)} km` : "—",
            hint: "mediana",
          },
          { label: "Poniżej rynku", value: num.format(stats.deals), hint: "co najmniej 10%" },
        ]}
      />

      {marki.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-neutral-100">Marki w tej kategorii</h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {marki.map((m) => (
              <li key={m.make}>
                <Link
                  href={makeHref(m.make)}
                  className="group flex items-baseline justify-between gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2.5 transition-colors hover:border-accent/40"
                >
                  <span className="truncate text-sm text-neutral-200 transition-colors group-hover:text-accent">
                    {m.make}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-neutral-600">
                    {num.format(m.total)}
                    {m.minPrice != null && ` · od ${pln.format(m.minPrice)}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {miasta.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-neutral-100">
            <MapPin size={17} className="text-neutral-600" />
            Gdzie ich najwięcej
          </h2>
          <ul className="flex flex-wrap gap-2">
            {miasta.map((m) => (
              <li key={m.city}>
                <Link
                  href={`/poleasingowe/${slugify(m.city ?? "")}`}
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
        </section>
      )}

      {oferty.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-100">
              <TrendingDown size={17} className="text-emerald-400" />
              Najlepsze okazje
            </h2>
            <Link
              href={`/?${params.toString()}`}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-[13px] text-neutral-400 transition-colors hover:border-accent/70 hover:text-accent"
            >
              <SlidersHorizontal size={14} />
              Wszystkie {num.format(stats.total)} z filtrami
            </Link>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
            {oferty.map((o, i) => (
              <OfferCard key={o.id} o={o} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* Pelna nawigacja po kategoriach — kazda strona linkuje do wszystkich. */}
      {GRUPY.map((g) => (
        <section key={g.tytul} className="mb-5">
          <h2 className="mb-2 text-[13px] uppercase tracking-wide text-neutral-600">{g.tytul}</h2>
          <ul className="flex flex-wrap gap-2">
            {g.pozycje
              .filter((x) => x.slug !== k.slug)
              .map((x) => (
                <li key={x.slug}>
                  <Link
                    href={`/poleasingowe/${x.slug}`}
                    className="rounded-lg border border-[var(--color-line)] px-2.5 py-1.5 text-[13px] text-neutral-300 transition-colors hover:border-accent/70 hover:text-accent"
                  >
                    {x.nazwa}
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
