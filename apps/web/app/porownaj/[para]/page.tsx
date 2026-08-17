import { Crumbs } from "@/components/Crumbs";
import { OfferCard } from "@/components/OfferCard";
import { YearBars } from "@/components/charts/YearBars";
import { type Para, sasiedniePary, znajdzPare } from "@/lib/pary";
import {
  getListings,
  getModelsWithCounts,
  getSegmentStats,
  getYearBreakdown,
} from "@/lib/queries";
import { modelHref, resolveAliases } from "@/lib/slug";
import { Scale, TrendingDown } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

/*
 * Odswiezanie RAZ NA DOBE, nie co godzine.
 *
 * Zaciag chodzi o 03:37, wiec czesciej nie ma czego przeliczac. Przy 1913
 * stronach i robocie indeksujacym, ktory po nich chodzi, godzinny odswiez
 * oznaczal dwadziescia cztery razy wiecej zapytan, niz wynika ze zmian
 * w danych — i to on przekroczyl limit transferu Neona, zdejmujac caly
 * serwis na trzy dni.
 */
export const revalidate = 86_400;

const pln = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("pl-PL");

/** Komplet pisowni modelu — te same reguly co na stronie modelu. */
async function aliasy(m: { make: string; model: string }) {
  const wszystkie = await getModelsWithCounts(m.make);
  const lista = resolveAliases(
    wszystkie.map((x) => x.model),
    // Slug liczymy z samej nazwy modelu, bo aliasy szukamy juz w obrebie marki.
    m.model.toLowerCase().replace(/[^a-z0-9]+/gi, "-"),
  );
  return lista.length > 0 ? lista : [m.model];
}

async function dane(p: Para) {
  const [aliasA, aliasB] = await Promise.all([aliasy(p.a), aliasy(p.b)]);
  const [statsA, statsB, lataA, lataB, ofertyA, ofertyB] = await Promise.all([
    getSegmentStats(p.a.make, aliasA),
    getSegmentStats(p.b.make, aliasB),
    getYearBreakdown(p.a.make, aliasA),
    getYearBreakdown(p.b.make, aliasB),
    getListings({ make: p.a.make, model: aliasA, sort: "deal_desc", withPrice: "1" }, 1, 6),
    getListings({ make: p.b.make, model: aliasB, sort: "deal_desc", withPrice: "1" }, 1, 6),
  ]);
  return { statsA, statsB, lataA, lataB, ofertyA, ofertyB };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ para: string }>;
}): Promise<Metadata> {
  const p = znajdzPare((await params).para);
  if (!p) return { title: "Nie znaleziono porównania" };

  const { statsA, statsB } = await dane(p);
  const nazwaA = `${p.a.make} ${p.a.model}`;
  const nazwaB = `${p.b.make} ${p.b.model}`;
  const title = `${nazwaA} czy ${nazwaB} — ceny po leasingu`;
  const description =
    `Porównanie cen ${nazwaA} i ${nazwaB} po leasingu: ` +
    (statsA.medianPrice ? `mediana ${pln.format(statsA.medianPrice)} ` : "") +
    `(${num.format(statsA.total)} ofert) kontra ` +
    (statsB.medianPrice ? `${pln.format(statsB.medianPrice)} ` : "") +
    `(${num.format(statsB.total)} ofert). Dane z 26 źródeł, aktualizowane codziennie.`;

  return {
    title,
    description,
    alternates: { canonical: `/porownaj/${p.slug}` },
    openGraph: { title, description, type: "website" },
  };
}

/** Kolumna jednej strony porownania. */
function Strona({
  nazwa,
  href,
  stats,
  lata,
  tansza,
  skala,
}: {
  nazwa: string;
  href: string;
  stats: Awaited<ReturnType<typeof getSegmentStats>>;
  lata: Awaited<ReturnType<typeof getYearBreakdown>>;
  tansza: boolean;
  /** Wspolne maksimum obu kolumn — inaczej slupkow nie da sie porownac. */
  skala: number;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-neutral-100">
          <Link href={href} className="transition-colors hover:text-accent">
            {nazwa}
          </Link>
        </h2>
        {tansza && (
          <span className="rounded-md bg-emerald-500 px-1.5 py-0.5 text-[11px] font-semibold text-black">
            TANIEJ
          </span>
        )}
      </div>

      <dl className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--color-line)] bg-[var(--color-line)]">
        {[
          { l: "Ofert", v: num.format(stats.total) },
          { l: "Mediana", v: stats.medianPrice ? pln.format(stats.medianPrice) : "—" },
          { l: "Najtaniej", v: stats.minPrice ? pln.format(stats.minPrice) : "—" },
          {
            l: "Przebieg",
            v: stats.medianMileage != null ? `${num.format(stats.medianMileage)} km` : "—",
          },
        ].map((x) => (
          <div key={x.l} className="bg-[var(--color-panel)] px-3 py-2">
            <dt className="text-[11px] uppercase tracking-wide text-neutral-600">{x.l}</dt>
            <dd className="text-sm font-semibold tabular-nums text-neutral-100">{x.v}</dd>
          </div>
        ))}
      </dl>

      {lata.length > 0 && <YearBars rows={lata} skala={skala} />}
    </div>
  );
}

export default async function PorownaniePage({
  params,
}: {
  params: Promise<{ para: string }>;
}) {
  const p = znajdzPare((await params).para);
  if (!p) notFound();

  const { statsA, statsB, lataA, lataB, ofertyA, ofertyB } = await dane(p);
  if (statsA.total === 0 || statsB.total === 0) notFound();

  const nazwaA = `${p.a.make} ${p.a.model}`;
  const nazwaB = `${p.b.make} ${p.b.model}`;
  const roznica =
    statsA.medianPrice != null && statsB.medianPrice != null
      ? statsA.medianPrice - statsB.medianPrice
      : null;

  // Jedna skala dla obu wykresow — patrz komentarz w komponencie Strona.
  const skala = Math.max(
    ...[...lataA, ...lataB].map((r) => r.medianPrice),
    1,
  );

  const sasiedzi = sasiedniePary(p);

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6">
      <Crumbs items={[{ label: "Porównania", href: "/porownaj" }, { label: `${nazwaA} vs ${nazwaB}` }]} />

      <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight text-neutral-100">
        <Scale size={22} className="text-neutral-600" />
        {nazwaA} czy {nazwaB}?
      </h1>

      <p className="mb-5 mt-1 max-w-[75ch] text-sm leading-relaxed text-neutral-400">
        {/*
          Odpowiedz w pierwszym zdaniu, a nie na koncu. Ktos, kto wpisal
          "octavia czy corolla", przyszedl po jedna liczbe — roznice.
        */}
        {roznica != null && roznica !== 0 ? (
          <>
            Po leasingu <span className="text-neutral-200">{roznica < 0 ? nazwaA : nazwaB}</span>{" "}
            jest tańsze o <span className="text-neutral-200">{pln.format(Math.abs(roznica))}</span>{" "}
            w medianie.{" "}
          </>
        ) : (
          <>Mediany obu modeli są dziś praktycznie równe. </>
        )}
        Porównanie liczone z {num.format(statsA.total + statsB.total)} aktualnych ofert z 26 źródeł
        poleasingowych — firm leasingowych, CFM i programów dealerskich. Ceny wyłącznie „kup
        teraz": licytacje odpadają, bo ich stawka jeszcze urośnie.
      </p>

      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <Strona
          nazwa={nazwaA}
          href={modelHref(p.a.make, p.a.model)}
          stats={statsA}
          lata={lataA}
          tansza={roznica != null && roznica < 0}
          skala={skala}
        />
        <Strona
          nazwa={nazwaB}
          href={modelHref(p.b.make, p.b.model)}
          stats={statsB}
          lata={lataB}
          tansza={roznica != null && roznica > 0}
          skala={skala}
        />
      </div>

      {(ofertyA.length > 0 || ofertyB.length > 0) && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-neutral-100">
            <TrendingDown size={17} className="text-emerald-400" />
            Najlepsze okazje z obu stron
          </h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
            {[...ofertyA, ...ofertyB]
              .sort((x, y) => (y.dealScore ?? 0) - (x.dealScore ?? 0))
              .map((o, i) => (
                <OfferCard key={o.id} o={o} index={i} />
              ))}
          </div>
        </section>
      )}

      {sasiedzi.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-neutral-100">Inne porównania</h2>
          <ul className="flex flex-wrap gap-2">
            {sasiedzi.map((x) => (
              <li key={x.slug}>
                <Link
                  href={`/porownaj/${x.slug}`}
                  className="rounded-lg border border-[var(--color-line)] px-2.5 py-1.5 text-[13px] text-neutral-300 transition-colors hover:border-accent/70 hover:text-accent"
                >
                  {x.a.make} {x.a.model} czy {x.b.make} {x.b.model}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

/*
 * generateStaticParams TU NIE MA swiadomie.
 *
 * Sciezki znamy z gory, wiec kusi, zeby wygenerowac wszystkie 313 przy
 * buildzie. Probowalem: kazda strona to szesc zapytan do bazy, a Neon przy
 * takim rownoleglym natarciu przestawal wyrabiac sie w limicie 60 s na strone
 * i build sie wywracal. Renderujemy wiec na zadanie, z `revalidate` jak reszta
 * serwisu — pierwszy odwiedzajacy placi za jedno przeliczenie, kolejni dostaja
 * gotowe.
 */
