import { Crumbs } from "@/components/Crumbs";
import { OfferCard } from "@/components/OfferCard";
import { StatStrip } from "@/components/StatStrip";
import { shortSource } from "@/lib/format";
import {
  getListings,
  getSourceCities,
  getSourceMakes,
  getSourceStats,
  getSources,
} from "@/lib/queries";
import { makeHref, slugify } from "@/lib/slug";
import { ArrowUpRight, Building2, Gavel, MapPin, SlidersHorizontal, TrendingDown } from "lucide-react";
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
 * Adresem jest identyfikator zrodla ("pkoaukcje"), nie slug nazwy.
 *
 * Identyfikatory sa stabilne i krotkie, a nazwy zmieniaja sie razem z marka
 * ("MHC Mobility (d. Athlon)"). Adres, ktory zmienia sie przy rebrandingu
 * leasingodawcy, kosztowalby cala pozycje w wyszukiwarce.
 */
async function resolve(id: string) {
  const stats = await getSourceStats(id);
  return stats && stats.total > 0 ? stats : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const s = await resolve((await params).id);
  if (!s) return { title: "Nie znaleziono źródła" };

  const krotka = shortSource(s.name);
  const title = `${krotka} — samochody poleasingowe (${num.format(s.total)} ofert)`;
  const description =
    `Aktualne auta poleasingowe z ${s.name}: ${num.format(s.total)} ofert, ` +
    `${num.format(s.makes)} marek` +
    (s.minPrice ? `, ceny od ${pln.format(s.minPrice)}` : "") +
    `. Porównane z medianą rynkową i z ofertami pozostałych 25 źródeł.`;

  return {
    title,
    description,
    alternates: { canonical: `/leasingodawca/${s.id}` },
    openGraph: { title, description, type: "website" },
  };
}

export default async function SourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await resolve(id);
  if (!s) notFound();

  const [marki, miasta, oferty, wszystkie] = await Promise.all([
    getSourceMakes(id),
    getSourceCities(id),
    getListings({ source: id, sort: "deal_desc", withPrice: "1" }, 1, 24),
    getSources(),
  ]);

  const krotka = shortSource(s.name);
  const inne = wszystkie.filter((x) => x.id !== id && x.active > 0).slice(0, 24);

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6">
      <Crumbs items={[{ label: "Źródła", href: "/zrodla" }, { label: krotka }]} />

      <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight text-neutral-100">
        <Building2 size={22} className="text-neutral-600" />
        {krotka} — samochody poleasingowe
      </h1>
      <p className="mb-5 mt-1 max-w-[70ch] text-sm leading-relaxed text-neutral-400">
        {num.format(s.total)} aut z {s.name} — {num.format(s.makes)} marek w{" "}
        {num.format(s.cities)} miastach.{" "}
        {/*
          To zdanie jest powodem, dla ktorego ta strona ma sens obok strony
          samego leasingodawcy: u niego zobaczysz tylko jego cene, tutaj
          widac ja na tle 25 pozostalych zrodel.
        */}
        Ceny porównujemy z medianą rynkową liczoną z wszystkich 26 źródeł, więc od razu widać,
        które z tych ofert odstają w dół — dziś {num.format(s.deals)}.
      </p>

      <StatStrip
        items={[
          { label: "Ofert", value: num.format(s.total), hint: `${s.makes} marek` },
          {
            label: "Mediana",
            value: s.medianPrice ? pln.format(s.medianPrice) : "—",
            hint: "tylko „kup teraz”",
          },
          { label: "Najtaniej", value: s.minPrice ? pln.format(s.minPrice) : "—" },
          { label: "Poniżej rynku", value: num.format(s.deals), hint: "co najmniej 10%" },
          {
            label: s.auctions > 0 ? "W tym licytacje" : "Nowych dziś",
            value: num.format(s.auctions > 0 ? s.auctions : s.newToday),
          },
        ]}
      />

      {s.baseUrl && (
        <a
          href={s.baseUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-8 inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-line)] px-3 py-2 text-[13px] text-neutral-400 transition-colors hover:border-accent/70 hover:text-accent"
        >
          Strona {krotka}
          <ArrowUpRight size={14} />
        </a>
      )}

      {marki.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-neutral-100">Marki w {krotka}</h2>
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
            Gdzie stoją auta z {krotka}
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
              {s.auctions > 0 ? (
                <Gavel size={17} className="text-violet-400" />
              ) : (
                <TrendingDown size={17} className="text-emerald-400" />
              )}
              Najlepsze okazje — {krotka}
            </h2>
            <Link
              href={`/?source=${encodeURIComponent(id)}`}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-[13px] text-neutral-400 transition-colors hover:border-accent/70 hover:text-accent"
            >
              <SlidersHorizontal size={14} />
              Wszystkie {num.format(s.total)} z filtrami
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
          <h2 className="mb-3 text-lg font-semibold text-neutral-100">Pozostali leasingodawcy</h2>
          <ul className="flex flex-wrap gap-2">
            {inne.map((x) => (
              <li key={x.id}>
                <Link
                  href={`/leasingodawca/${x.id}`}
                  className="flex items-baseline gap-1.5 rounded-lg border border-[var(--color-line)] px-2.5 py-1.5 text-[13px] text-neutral-300 transition-colors hover:border-accent/70 hover:text-accent"
                >
                  {shortSource(x.name)}
                  <span className="text-[11px] tabular-nums text-neutral-600">
                    {num.format(x.active)}
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
