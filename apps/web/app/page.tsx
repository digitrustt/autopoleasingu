import { Filters } from "@/components/Filters";
import { Radar } from "@/components/Radar";
import { Results } from "@/components/Results";
import { getMakes, getModels, getSources, getStats } from "@/lib/queries";
import { Activity } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

// Dane zmieniaja sie co przebieg scrapera — nie cache'ujemy strony.
export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() !== "" ? s.trim() : undefined;
}

const numOrUndef = (v?: string) => (v ? Number(v) : undefined);

export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const current = {
    q: one(sp.q),
    make: one(sp.make),
    model: one(sp.model),
    source: one(sp.source),
    priceMin: one(sp.priceMin),
    priceMax: one(sp.priceMax),
    yearMin: one(sp.yearMin),
    yearMax: one(sp.yearMax),
    mileageMax: one(sp.mileageMax),
    powerMin: one(sp.powerMin),
    fuel: one(sp.fuel),
    gearbox: one(sp.gearbox),
    body: one(sp.body),
    sort: one(sp.sort),
    kind: one(sp.kind),
    twinsOnly: one(sp.twinsOnly),
    withPrice: one(sp.withPrice),
    dealMin: one(sp.dealMin),
  };

  const page = Math.max(1, Number(one(sp.page) ?? 1) || 1);
  const filters = {
    ...current,
    priceMin: numOrUndef(current.priceMin),
    priceMax: numOrUndef(current.priceMax),
    yearMin: numOrUndef(current.yearMin),
    yearMax: numOrUndef(current.yearMax),
    mileageMax: numOrUndef(current.mileageMax),
    powerMin: numOrUndef(current.powerMin),
  };

  /*
   * Tu czekamy tylko na dane naglowka i list rozwijanych — sa tanie i praktycznie
   * niezmienne miedzy filtrami. Ciezkie zapytanie o oferty siedzi w <Results>,
   * ponizej granicy Suspense.
   */
  const [makes, models, sourceList, stats] = await Promise.all([
    getMakes(),
    // Lista modeli zalezy od wybranej marki — bez niej byloby tysiac pozycji.
    getModels(current.make),
    getSources(),
    getStats(),
  ]);

  const pln = new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0,
  });
  const num = new Intl.NumberFormat("pl-PL");

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            auto<span className="text-accent">poleasingu</span>
            <span className="text-neutral-600">.pl</span>
          </h1>
          <p className="text-sm text-neutral-400">
            {num.format(stats.active)} aktywnych z {sourceList.length} źródeł ·{" "}
            {num.format(stats.newToday)} nowych dziś · mediana {pln.format(stats.medianPrice)} ·{" "}
            {num.format(stats.gone)} zniknęło
          </p>
        </div>

        <Link
          href="/zrodla"
          className="flex items-center gap-1.5 rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm text-neutral-400 transition-colors hover:border-accent/70 hover:text-accent"
        >
          <Activity size={15} />
          Źródła
        </Link>
      </header>

      <div className="mb-5">
        <Filters makes={makes} models={models} sources={sourceList} current={current} />
      </div>

      {/*
        `key` musi zmieniac sie z kazdym zestawem filtrow. React pokazuje fallback
        tylko przy MONTOWANIU granicy — bez klucza kolejne wyszukiwanie
        aktualizowaloby liste w miejscu i radar nie pojawilby sie ani razu.
      */}
      <Suspense key={`${JSON.stringify(current)}#${page}`} fallback={<Radar />}>
        <Results filters={filters} page={page} params={current} />
      </Suspense>
    </main>
  );
}
