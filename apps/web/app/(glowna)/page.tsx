import { BazaNiedostepna } from "@/components/BazaNiedostepna";
import { Filters } from "@/components/Filters";
import { Radar } from "@/components/Radar";
import { Results } from "@/components/Results";
import {
  filtryMarek,
  filtryModeli,
  filtryZrodel,
  statystykiNaglowka,
} from "@/lib/cache-filtrow";
import type { getModelsForFilter, getSources, getStats } from "@/lib/queries";
import { linieModelowe, rodzinyModeli, wariantyRodziny } from "@/lib/rodziny";
import { Activity } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

/**
 * Adres kanoniczny strony glownej.
 *
 * Musi tu byc z dwoch powodow. Po pierwsze, do niedawna www i domena bez www
 * oddawaly ta sama tresc pod dwoma adresami i Search Console pokazywal je jako
 * DWA osobne wiersze, dzielace miedzy siebie klikniecia (7 i 5) i wyswietlenia
 * (111 i 103). Przekierowanie zalatwia to u zrodla (patrz next.config), a ten
 * znacznik jest drugim zabezpieczeniem.
 *
 * Po drugie, i wazniejsze na dluzsza mete: ta strona przyjmuje filtry
 * w parametrach (?make=BMW&priceMax=50000), a kombinacji sa tysiace. Bez
 * kanonicznego adresu kazda z nich jest dla wyszukiwarki osobna strona
 * o niemal identycznej tresci. Frazy filtrowane obsluguja strony kategorii
 * (/poleasingowe/...), ktore maja wlasna, unikalna tresc.
 */
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

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

/**
 * Kilka wartosci tego samego parametru — "?make=BMW&make=Audi" albo
 * "?make=BMW,Audi".
 *
 * Oba zapisy, bo oba powstaja naturalnie: przegladarka przy wielu polach
 * formularza wysyla parametr kilka razy, a link skopiowany recznie czy
 * sklejony w kodzie latwiej zapisac po przecinku. Zwracamy tekst przy jednej
 * wartosci i tablice przy kilku — zapytania przyjmuja jedno i drugie.
 */
function many(v: string | string[] | undefined): string | string[] | undefined {
  const lista = (Array.isArray(v) ? v : [v])
    .flatMap((x) => (x ?? "").split(","))
    .map((x) => x.trim())
    .filter(Boolean);
  if (lista.length === 0) return undefined;
  return lista.length === 1 ? lista[0] : lista;
}

/** Pierwsza wartosc z wielokrotnego parametru — do podpisow i list zaleznych. */
function pierwsza(v: string | string[] | undefined): string | undefined {
  const w = many(v);
  return Array.isArray(w) ? w[0] : w;
}

const numOrUndef = (v?: string) => (v ? Number(v) : undefined);

export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const current = {
    q: one(sp.q),
    /* Marka i model przyjmuja kilka wartosci naraz — patrz `many`. */
    make: many(sp.make),
    model: many(sp.model),
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
  let makes: string[];
  let modeleZLicznikami: Awaited<ReturnType<typeof getModelsForFilter>>;
  let sourceList: Awaited<ReturnType<typeof getSources>>;
  let stats: Awaited<ReturnType<typeof getStats>>;
  try {
    /*
     * Wszystkie cztery z BUFORA — patrz lib/cache-filtrow.ts. Bez niego kazde
     * wejscie na strone glowna (takze kazde wejscie robota) odpalalo cztery
     * agregacje po calej tabeli i to one wyczerpaly limit CPU Vercela.
     */
    [makes, modeleZLicznikami, sourceList, stats] = await Promise.all([
      filtryMarek(),
      // Lista modeli zalezy od wybranej marki — bez niej byloby tysiac pozycji.
      /*
       * Lista modeli dla PIERWSZEJ wybranej marki. Przy kilku markach naraz
       * mieszanie ich modeli dawaloby liste bez sensu ("X3" obok "A4"),
       * a filtr modelu i tak dotyczy jednej marki.
       */
      filtryModeli(pierwsza(sp.make)),
      filtryZrodel(),
      statystykiNaglowka(),
    ]);
  } catch (err) {
    console.error("strona glowna: baza niedostepna —", err);
    return <BazaNiedostepna />;
  }

  /*
   * Rodziny modeli zamiast surowych wartosci z kolumny `model`.
   *
   * Zrodla zapisuja ten sam model na kilka sposobow — "X3", "X3 20d xDrive",
   * "X3 xDrive20d" — a filtr porownywal je przez rownosc. Wybranie "X3"
   * pokazywalo 132 oferty zamiast 353. Patrz lib/rodziny.ts.
   */
  const rodziny = rodzinyModeli(modeleZLicznikami);
  /*
   * Linie modelowe ponad rodzinami — "Seria 4" obejmuje 430i, 420d i reszte.
   * Rodziny scalaja pisownie tego samego modelu, linie scalaja rodzenstwo;
   * patrz packages/core/src/rodziny.ts.
   */
  const marka = pierwsza(sp.make);
  const linie = marka ? linieModelowe(marka, modeleZLicznikami) : [];

  if (current.model) {
    /*
     * Do zapytania idzie KOMPLET zapisow, nie nazwa wybrana na ekranie.
     * Kazdy wybor moze byc linia ("Seria 4") albo rodzina ("X3"), a przy
     * wielokrotnym wyborze — jednym i drugim naraz.
     */
    const wybrane = Array.isArray(current.model) ? current.model : [current.model];
    const zapisy = wybrane.flatMap((w) => {
      const linia = linie.find((l) => l.nazwa === w);
      return linia ? linia.warianty : wariantyRodziny(rodziny, w);
    });
    (filters as { model?: string | string[] }).model = [...new Set(zapisy)];
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
          {/*
            H1 OPISOWY, nie logotyp.
            Logotyp przeniosl sie do stalego naglowka, wiec powtarzanie go tutaj
            dawaloby te sama nazwe dwa razy jedna pod druga. Przy okazji to lepszy
            naglowek dla wyszukiwarki: "Auta poleasingowe z 26 zrodel" zawiera
            fraze, ktorej ludzie szukaja, a "autopoleasingu.pl" — nazwe, ktorej
            nie zna nikt poza nami.
          */}
          <h1 className="text-2xl font-bold tracking-tight text-neutral-100">
            Auta poleasingowe z {sourceList.length} źródeł
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
        <Filters makes={makes} rodziny={rodziny} linie={linie} sources={sourceList} current={current} />
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
