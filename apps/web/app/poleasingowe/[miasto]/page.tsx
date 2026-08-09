import { Crumbs } from "@/components/Crumbs";
import { OfferCard } from "@/components/OfferCard";
import { StatStrip } from "@/components/StatStrip";
import {
  getCitiesWithCounts,
  getCityMakes,
  getCitySellers,
  getCityStats,
  getListings,
} from "@/lib/queries";
import { shortSource } from "@/lib/format";
import { groupBySlug, makeHref, resolveAliases, slugify } from "@/lib/slug";
import { Building2, MapPin, SlidersHorizontal, TrendingDown } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export const revalidate = 3600;

const pln = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("pl-PL");

/**
 * Slug -> miasto z bazy, razem z wariantami zapisu.
 *
 * Tak samo jak przy modelach: w bazie sasiaduja "Warszawa" i "warszawa"
 * (235 roznych zapisow, 210 po normalizacji), a wszystkie prowadza pod jeden
 * adres. Do filtrowania idzie komplet, do wyswietlenia wariant dominujacy.
 */
async function resolve(slug: string) {
  const miasta = await getCitiesWithCounts();
  const grupy = groupBySlug(miasta, (m) => m.city ?? "");
  const grupa = grupy.get(slugify(slug));
  if (!grupa || grupa.length === 0) return null;

  const nazwy = grupa.map((g) => g.city).filter((c): c is string => c != null);
  return {
    // Wariant o najwiekszej liczbie ofert — zapytanie sortuje malejaco.
    miasto: nazwy[0],
    warianty: nazwy,
    wszystkie: miasta,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ miasto: string }>;
}): Promise<Metadata> {
  const found = await resolve((await params).miasto);
  if (!found) return { title: "Nie znaleziono miasta" };

  const stats = await getCityStats(found.warianty);
  const title = `Samochody poleasingowe ${found.miasto} — ${num.format(stats.total)} ofert`;
  const description =
    `Auta poleasingowe w mieście ${found.miasto}: ${num.format(stats.total)} ofert z ` +
    `${stats.sources} źródeł` +
    (stats.minPrice ? `, ceny od ${pln.format(stats.minPrice)}` : "") +
    `. Firmy leasingowe, CFM i programy dealerskie w jednym miejscu, aktualizowane codziennie.`;

  return {
    title,
    description,
    alternates: { canonical: `/poleasingowe/${slugify(found.miasto)}` },
    openGraph: { title, description, type: "website" },
  };
}

export default async function CityPage({ params }: { params: Promise<{ miasto: string }> }) {
  const found = await resolve((await params).miasto);
  if (!found) notFound();
  const { miasto, warianty, wszystkie } = found;

  const [stats, marki, sprzedawcy, oferty] = await Promise.all([
    getCityStats(warianty),
    getCityMakes(warianty),
    getCitySellers(warianty),
    getListings({ city: warianty, sort: "deal_desc", withPrice: "1" }, 1, 24),
  ]);

  if (stats.total === 0) notFound();

  // Najblizsze miasta na liscie — proste linkowanie poziome miedzy stronami miast.
  const inne = wszystkie
    .filter((m) => m.city && slugify(m.city) !== slugify(miasto))
    .slice(0, 20);

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6">
      <Crumbs items={[{ label: "Miasta", href: "/poleasingowe" }, { label: miasto }]} />

      <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight text-neutral-100">
        <MapPin size={22} className="text-neutral-600" />
        Samochody poleasingowe — {miasto}
      </h1>
      <p className="mb-5 mt-1 max-w-[70ch] text-sm leading-relaxed text-neutral-400">
        {num.format(stats.total)} aut poleasingowych wystawionych w mieście {miasto}, zebranych
        z {stats.sources} źródeł: firm leasingowych, CFM i programów dealerskich.{" "}
        {num.format(stats.makes)} marek, {num.format(stats.deals)} ofert poniżej mediany rynkowej.
        Ceny porównujemy z medianą dla tego samego rocznika, przebiegu i napędu.
      </p>

      <StatStrip
        items={[
          { label: "Ofert", value: num.format(stats.total), hint: `${stats.sources} źródeł` },
          {
            label: "Mediana",
            value: stats.medianPrice ? pln.format(stats.medianPrice) : "—",
            hint: "tylko „kup teraz”",
          },
          { label: "Najtaniej", value: stats.minPrice ? pln.format(stats.minPrice) : "—" },
          { label: "Poniżej rynku", value: num.format(stats.deals), hint: "co najmniej 10%" },
          { label: "Nowych dziś", value: num.format(stats.newToday) },
        ]}
      />

      {sprzedawcy.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-neutral-100">
            <Building2 size={17} className="text-neutral-600" />
            Kto wystawia auta w mieście {miasto}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {sprzedawcy.map((s) => (
              <li
                key={s.sourceName}
                className="flex items-baseline gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2 text-[13px] text-neutral-200"
              >
                {shortSource(s.sourceName)}
                <span className="text-[11px] tabular-nums text-neutral-600">
                  {num.format(s.total)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {marki.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-neutral-100">
            Marki dostępne w mieście {miasto}
          </h2>
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

      {oferty.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-100">
              <TrendingDown size={17} className="text-emerald-400" />
              Najlepsze okazje — {miasto}
            </h2>
            <Link
              href={`/?q=${encodeURIComponent(miasto)}`}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-[13px] text-neutral-400 transition-colors hover:border-accent/70 hover:text-accent"
            >
              <SlidersHorizontal size={14} />
              Wszystkie oferty z filtrami
            </Link>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
            {oferty.map((o, i) => (
              <OfferCard key={o.id} o={o} index={i} />
            ))}
          </div>
        </section>
      )}

      {inne.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-neutral-100">Inne miasta</h2>
          <ul className="flex flex-wrap gap-2">
            {inne.map((m) => (
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
    </main>
  );
}
