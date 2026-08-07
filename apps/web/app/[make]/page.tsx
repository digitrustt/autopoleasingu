import { Crumbs } from "@/components/Crumbs";
import { ModelGrid } from "@/components/ModelGrid";
import { OfferCard } from "@/components/OfferCard";
import { StatStrip } from "@/components/StatStrip";
import {
  getBodyBreakdown,
  getListings,
  getMakesWithCounts,
  getModelCards,
  getSegmentStats,
} from "@/lib/queries";
import { modelHref, resolveSlug, slugify } from "@/lib/slug";
import { bodySpec } from "@/lib/spec";
import { Layers, SlidersHorizontal, TrendingDown } from "lucide-react";
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

/**
 * Ile modeli dostaje kafelek ze zdjeciem.
 *
 * BMW ma w bazie 335 nazw modeli — wiekszosc to pojedyncze warianty zapisu
 * ("X3 20d", "X3 xDrive20d"). Kafelki dla wszystkich zrobilyby z tej strony
 * scianę trzystu zdjec, po ktorej nie da sie przewijac, wiec ogon idzie na
 * liste tekstowa nizej; dla robota indeksujacego jeden i drugi link waza tyle
 * samo. Prog jest ustawiony tak, zeby zdjecie dostalo wszystko, co ma wiecej
 * niz kilkanascie sztuk w bazie.
 */
const CARDS = 48;

const pln = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("pl-PL");

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

  const [stats, models, bodies, best] = await Promise.all([
    getSegmentStats(make),
    getModelCards(make),
    getBodyBreakdown(make),
    // Najlepsze okazje marki — to one maja sprzedac te strone czytelnikowi.
    getListings({ make, sort: "deal_desc", withPrice: "1" }, 1, 12),
  ]);

  if (stats.total === 0) notFound();

  const featured = models.slice(0, CARDS);
  const rest = models.slice(CARDS);

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6">
      <Crumbs items={[{ label: make }]} />

      <h1 className="text-2xl font-bold tracking-tight text-neutral-100">{make} po leasingu</h1>
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
          { label: "Najtaniej", value: stats.minPrice ? pln.format(stats.minPrice) : "—" },
          { label: "Poniżej rynku", value: num.format(stats.deals), hint: "co najmniej 10%" },
          { label: "Nowych dziś", value: num.format(stats.newToday) },
        ]}
      />

      {bodies.length > 1 && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-neutral-100">
            <Layers size={17} className="text-neutral-600" />
            Nadwozia
          </h2>
          <ul className="flex flex-wrap gap-2">
            {bodies.map((b) => {
              const spec = bodySpec(b.body);
              return (
                <li
                  key={b.body}
                  className="flex items-center gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2"
                >
                  {spec && <spec.Icon size={15} className="shrink-0 text-neutral-600" />}
                  <span className="text-[13px] text-neutral-200">{b.body}</span>
                  <span className="text-[11px] tabular-nums text-neutral-600">
                    {num.format(b.total)}
                    {b.medianPrice != null && ` · ${pln.format(b.medianPrice)}`}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-neutral-100">Modele {make}</h2>
        {/*
          Kafelki modeli to glowny szkielet linkowania wewnetrznego serwisu —
          bez nich strony modeli nie mialyby zadnej drogi dojscia.
        */}
        <ModelGrid make={make} models={featured} />

        {rest.length > 0 && (
          <>
            <h3 className="mb-2 mt-5 text-[13px] uppercase tracking-wide text-neutral-600">
              Pozostałe wersje ({num.format(rest.length)})
            </h3>
            <ul className="flex flex-wrap gap-2">
              {rest.map((m) => (
                <li key={m.model}>
                  <Link
                    href={modelHref(make, m.model)}
                    className="flex items-baseline gap-1.5 rounded-lg border border-[var(--color-line)] px-2.5 py-1.5 text-[13px] text-neutral-300 transition-colors hover:border-accent/70 hover:text-accent"
                  >
                    {m.model}
                    <span className="text-[11px] tabular-nums text-neutral-600">{m.total}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {best.length > 0 && (
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-100">
              <TrendingDown size={17} className="text-emerald-400" />
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
