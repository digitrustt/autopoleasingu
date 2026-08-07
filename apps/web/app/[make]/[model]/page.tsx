import { Crumbs } from "@/components/Crumbs";
import { OfferCard } from "@/components/OfferCard";
import { StatStrip } from "@/components/StatStrip";
import {
  getFuelBreakdown,
  getListings,
  getMakesWithCounts,
  getModelsWithCounts,
  getSegmentStats,
  getYearBreakdown,
} from "@/lib/queries";
import { makeHref, modelHref, resolveSlug, slugify } from "@/lib/slug";
import { SlidersHorizontal } from "lucide-react";
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

const FUEL_PL: Record<string, string> = {
  petrol: "Benzyna", diesel: "Diesel", hybrid: "Hybryda", phev: "PHEV",
  electric: "Elektryk", lpg: "LPG", cng: "CNG", other: "Inne",
};

/** Slug -> nazwy z bazy. Model rozwiazujemy dopiero w obrebie znalezionej marki. */
async function resolve(makeSlug: string, modelSlug: string) {
  const makes = await getMakesWithCounts();
  const make = resolveSlug(makes.map((m) => m.make), makeSlug);
  if (!make) return null;

  const models = await getModelsWithCounts(make);
  const model = resolveSlug(models.map((m) => m.model), modelSlug);
  return model ? { make, model, models } : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ make: string; model: string }>;
}): Promise<Metadata> {
  const { make: ms, model: mos } = await params;
  const found = await resolve(ms, mos);
  if (!found) return { title: "Nie znaleziono modelu" };

  const stats = await getSegmentStats(found.make, found.model);
  const name = `${found.make} ${found.model}`;
  const title = `${name} po leasingu — ${num.format(stats.total)} ofert${
    stats.minPrice ? ` od ${pln.format(stats.minPrice)}` : ""
  }`;
  const description =
    `Ceny ${name} poleasingowych z ${stats.sources} źródeł: ` +
    (stats.medianPrice ? `mediana ${pln.format(stats.medianPrice)}` : "aktualne oferty") +
    (stats.minYear && stats.maxYear ? `, roczniki ${stats.minYear}–${stats.maxYear}` : "") +
    ". Rozbicie cen po roczniku i paliwie, aktualizowane codziennie.";

  return {
    title,
    description,
    alternates: { canonical: modelHref(found.make, found.model) },
    openGraph: { title, description, type: "website" },
  };
}

export default async function ModelPage({
  params,
}: {
  params: Promise<{ make: string; model: string }>;
}) {
  const { make: ms, model: mos } = await params;
  const found = await resolve(ms, mos);
  if (!found) notFound();
  const { make, model, models } = found;
  const name = `${make} ${model}`;

  const [stats, years, fuels, offers] = await Promise.all([
    getSegmentStats(make, model),
    getYearBreakdown(make, model),
    getFuelBreakdown(make, model),
    getListings({ make, model, sort: "deal_desc" }, 1, 24),
  ]);

  if (stats.total === 0) notFound();

  /*
   * Dane strukturalne o produkcie. Bez nich Google pokazuje sam tytul;
   * z nimi ma prawo dorysowac widelki cenowe i liczbe ofert przy wyniku,
   * co przy zapytaniu o konkretny model decyduje o kliknięciu.
   */
  const ld =
    stats.minPrice && stats.maxPrice
      ? {
          "@context": "https://schema.org",
          "@type": "Product",
          name: `${name} po leasingu`,
          brand: { "@type": "Brand", name: make },
          offers: {
            "@type": "AggregateOffer",
            priceCurrency: "PLN",
            lowPrice: stats.minPrice,
            highPrice: stats.maxPrice,
            offerCount: stats.withPrice,
            availability: "https://schema.org/InStock",
          },
        }
      : null;

  const siblings = models.filter((m) => m.model !== model).slice(0, 12);

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6">
      {ld && (
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD nie ma innej drogi
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
        />
      )}

      <Crumbs items={[{ label: make, href: makeHref(make) }, { label: model }]} />

      <h1 className="text-2xl font-bold tracking-tight text-neutral-100">{name} po leasingu</h1>
      <p className="mb-5 mt-1 max-w-[70ch] text-sm leading-relaxed text-neutral-400">
        {num.format(stats.total)} ofert {name} z {stats.sources}{" "}
        {stats.sources === 1 ? "źródła" : "źródeł"} poleasingowych
        {stats.minYear && stats.maxYear && `, roczniki ${stats.minYear}–${stats.maxYear}`}
        {stats.medianMileage != null &&
          `, mediana przebiegu ${num.format(stats.medianMileage)} km`}
        . Ten sam egzemplarz bywa wystawiony w kilku kanałach po różnych cenach — pokazujemy je
        obok siebie zamiast scalać.
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
          { label: "Najdrożej", value: stats.maxPrice ? pln.format(stats.maxPrice) : "—" },
          { label: "Poniżej rynku", value: num.format(stats.deals), hint: "co najmniej 10%" },
        ]}
      />

      {years.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-1 text-lg font-semibold text-neutral-100">
            Ile kosztuje {name} według rocznika
          </h2>
          <p className="mb-3 text-[13px] text-neutral-500">
            Mediana i cena minimalna liczone wyłącznie z ofert „kup teraz”. Ceny aukcyjne są
            bieżącą ofertą w licytacji i jeszcze urosną, więc nie wchodzą do tej tabeli.
          </p>
          {/* overflow-x-auto: przy waskim ekranie tabela ma sie przewijac sama,
              zamiast rozpychac cala strone w poziomie. */}
          <div className="overflow-x-auto rounded-xl border border-[var(--color-line)]">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-line)] text-left text-[11px] uppercase tracking-wide text-neutral-600">
                  <th className="px-4 py-2.5 font-medium">Rocznik</th>
                  <th className="px-4 py-2.5 text-right font-medium">Ofert</th>
                  <th className="px-4 py-2.5 text-right font-medium">Od</th>
                  <th className="px-4 py-2.5 text-right font-medium">Mediana</th>
                  <th className="px-4 py-2.5 text-right font-medium">Przebieg</th>
                </tr>
              </thead>
              <tbody>
                {years.map((y) => (
                  <tr
                    key={y.year}
                    className="border-b border-[var(--color-line)] last:border-0 hover:bg-[var(--color-panel)]"
                  >
                    <td className="px-4 py-2.5 font-medium text-neutral-200">{y.year}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-neutral-400">
                      {num.format(y.total)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-neutral-300">
                      {pln.format(y.minPrice)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-neutral-100">
                      {pln.format(y.medianPrice)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-neutral-500">
                      {y.medianMileage != null ? `${num.format(y.medianMileage)} km` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {fuels.length > 1 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-neutral-100">Ceny według paliwa</h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {fuels.map((f) => (
              <li
                key={f.fuel}
                className="rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2.5"
              >
                <p className="text-sm font-medium text-neutral-200">
                  {FUEL_PL[f.fuel ?? ""] ?? f.fuel}
                </p>
                <p className="text-[11px] text-neutral-600">
                  {num.format(f.total)} {f.total === 1 ? "oferta" : "ofert"} · mediana{" "}
                  {pln.format(f.medianPrice)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-neutral-100">Oferty {name}</h2>
          <Link
            href={`/?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-[13px] text-neutral-400 transition-colors hover:border-accent/70 hover:text-accent"
          >
            <SlidersHorizontal size={14} />
            Wszystkie {num.format(stats.total)} z filtrami
          </Link>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
          {offers.map((o, i) => (
            <OfferCard key={o.id} o={o} index={i} />
          ))}
        </div>
      </section>

      {siblings.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-neutral-100">Inne modele {make}</h2>
          <ul className="flex flex-wrap gap-2">
            {siblings.map((m) => (
              <li key={m.model}>
                <Link
                  href={modelHref(make, m.model)}
                  className="flex items-baseline gap-1.5 rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-[13px] text-neutral-300 transition-colors hover:border-accent/70 hover:text-accent"
                >
                  {m.model}
                  <span className="text-[11px] text-neutral-600">{num.format(m.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
