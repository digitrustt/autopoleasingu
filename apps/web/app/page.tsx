import { BazaNiedostepna } from "@/components/BazaNiedostepna";
import { Filters } from "@/components/Filters";
import { Logo } from "@/components/Logo";
import { Radar } from "@/components/Radar";
import { Results } from "@/components/Results";
import { getMakes, getModels, getSources, getStats } from "@/lib/queries";
import { Activity } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

// Dane zmieniaja sie co przebieg scrapera — nie cache'ujemy strony.
export const dynamic = "force-dynamic";

/*
 * Twardy limit czasu funkcji.
 *
 * Zmierzone na produkcji: zawieszone renderowanie trzymalo slot ponad 45
 * sekund, przez co kolejne zadania czekaly w kolejce i wieszaly sie tak samo.
 * Krotki limit zabija takie wywolanie szybko i zwalnia miejsce, zamiast
 * pozwalac jednemu zatkanemu zapytaniu zablokowac cala strone.
 */
export const maxDuration = 15;

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
  /*
   * Awaria bazy nie moze wygladac jak awaria calego serwisu.
   *
   * Ta strona zalezy od parametrow wyszukiwania, wiec nie ma cache'a — gdy
   * Neon odcial transfer za przekroczenie limitu, zwracala goly blad 500,
   * podczas gdy strony z `revalidate` spokojnie serwowaly ostatnia dobra
   * wersje. Lapiemy wiec blad i pokazujemy komunikat zamiast zrzutu wyjatku.
   */
  /*
   * Wlasny limit czasu na zapytania — 8 sekund.
   *
   * `connect_timeout` w kliencie nie pomagal, bo polaczenie bylo nawiazywane,
   * a zapytanie i tak nie wracalo. Bez tego wyscigu uzytkownik zostawal
   * z animacja ladowania az do limitu funkcji. Lepiej pokazac komunikat po
   * osmiu sekundach niz nie pokazac nic po czterdziestu pieciu.
   */
  const limit = <T,>(p: Promise<T>): Promise<T> =>
    Promise.race([
      p,
      new Promise<never>((_, odrzuc) =>
        setTimeout(() => odrzuc(new Error("baza nie odpowiedziala w 8 s")), 8000),
      ),
    ]);

  let makes: string[];
  let models: string[];
  let sourceList: Awaited<ReturnType<typeof getSources>>;
  let stats: Awaited<ReturnType<typeof getStats>>;
  try {
    [makes, models, sourceList, stats] = await limit(Promise.all([
      getMakes(),
      // Lista modeli zalezy od wybranej marki — bez niej byloby tysiac pozycji.
      getModels(current.make),
      getSources(),
      getStats(),
    ]));
  } catch (err) {
    console.error("strona glowna: baza niedostepna —", err);
    return <BazaNiedostepna />;
  }

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
          <h1 className="text-2xl">
            <Logo />
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
