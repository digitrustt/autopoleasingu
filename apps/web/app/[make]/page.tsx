import { Crumbs } from "@/components/Crumbs";
import { OfferCard } from "@/components/OfferCard";
import { StatStrip } from "@/components/StatStrip";
import {
  getListings,
  getMakesWithCounts,
  getModelsWithCounts,
  getSegmentStats,
} from "@/lib/queries";
import { modelHref, resolveSlug, slugify } from "@/lib/slug";
import { ArrowRight, SlidersHorizontal } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

/*
 * Dane zmieniaja sie raz na dobe (zaciag chodzi o 3:00), a te strony ma
 * odwiedzac robot indeksujacy — kilkanascie tysiecy adresow. Renderowanie
 * kazdego z nich od nowa przy kazdym wejsciu obcialoby baze bez powodu,
 * wiec trzymamy wynik przez godzine.
 */
export const revalidate = 3600;

const pln = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("pl-PL");

/** Zamienia slug z adresu na nazwe marki z bazy albo null. */
async function resolve(slug: string) {
  const makes = await getMakesWithCounts();
  const make = resolveSlug(makes.map((m) => m.make), slug);
  return make ? { make, makes } : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ make: string }>;
}): Promise<Metadata> {
  const { make: slug } = await params;
  const found = await resolve(slug);
  if (!found) return { title: "Nie znaleziono marki" };

  const stats = await getSegmentStats(found.make);
  const title = `${found.make} po leasingu — ${num.format(stats.total)} ofert`;
  const description =
    `Aktualne oferty ${found.make} poleasingowych z ${stats.sources} źródeł: ` +
    (stats.medianPrice ? `mediana ${pln.format(stats.medianPrice)}, ` : "") +
    `${num.format(stats.deals)} ofert poniżej ceny rynkowej. Aktualizowane codziennie.`;

  return {
    title,
    description,
    alternates: { canonical: `/${slugify(found.make)}` },
    openGraph: { title, description, type: "website" },
  };
}

export default async function MakePage({ params }: { params: Promise<{ make: string }> }) {
  const { make: slug } = await params;
  const found = await resolve(slug);
  if (!found) notFound();
  const { make } = found;

  const [stats, models, best] = await Promise.all([
    getSegmentStats(make),
    getModelsWithCounts(make),
    // Najlepsze okazje marki — to one maja sprzedac te strone czytelnikowi.
    getListings({ make, sort: "deal_desc", withPrice: "1" }, 1, 12),
  ]);

  if (stats.total === 0) notFound();

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6">
      <Crumbs items={[{ label: make }]} />

      <h1 className="text-2xl font-bold tracking-tight text-neutral-100">
        {make} po leasingu
      </h1>
      <p className="mb-5 mt-1 max-w-[70ch] text-sm leading-relaxed text-neutral-400">
        {num.format(stats.total)} aktywnych ofert {make} z {stats.sources} źródeł poleasingowych —
        firm leasingowych, CFM i programów dealerskich. Ceny porównujemy z medianą rynkową dla
        tego samego rocznika, przebiegu i napędu, więc {num.format(stats.deals)} z nich stoi
        wyraźnie poniżej rynku.
      </p>

      <StatStrip
        items={[
          { label: "Ofert", value: num.format(stats.total), hint: `${stats.sources} źródeł` },
          {
            label: "Mediana",
            value: stats.medianPrice ? pln.format(stats.medianPrice) : "—",
            hint: "tylko „kup teraz”",
          },
          {
            label: "Najtaniej",
            value: stats.minPrice ? pln.format(stats.minPrice) : "—",
          },
          { label: "Poniżej rynku", value: num.format(stats.deals), hint: "co najmniej 10%" },
          { label: "Nowych dziś", value: num.format(stats.newToday) },
        ]}
      />

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-neutral-100">Modele {make}</h2>
        {/*
          Lista modeli to glowny szkielet linkowania wewnetrznego serwisu —
          bez niej strony modeli nie mialyby zadnej drogi dojscia.
        */}
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {models.map((m) => (
            <li key={m.model}>
              <Link
                href={modelHref(make, m.model)}
                className="group flex items-center justify-between gap-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2.5 transition-colors hover:border-accent/40"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-neutral-200 transition-colors group-hover:text-accent">
                    {make} {m.model}
                  </span>
                  <span className="text-[11px] text-neutral-600">
                    {num.format(m.total)} {m.total === 1 ? "oferta" : "ofert"}
                    {m.minPrice != null && ` · od ${pln.format(m.minPrice)}`}
                  </span>
                </span>
                <ArrowRight
                  size={15}
                  className="shrink-0 text-neutral-700 transition-colors group-hover:text-accent"
                />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {best.length > 0 && (
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-neutral-100">
              Najlepsze okazje — {make}
            </h2>
            <Link
              href={`/?make=${encodeURIComponent(make)}`}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-[13px] text-neutral-400 transition-colors hover:border-accent/70 hover:text-accent"
            >
              <SlidersHorizontal size={14} />
              Wszystkie oferty z filtrami
            </Link>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
            {best.map((o, i) => (
              <OfferCard key={o.id} o={o} index={i} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
