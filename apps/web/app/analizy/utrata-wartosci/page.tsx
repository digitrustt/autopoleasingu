import { Crumbs } from "@/components/Crumbs";
import { StatStrip } from "@/components/StatStrip";
import { YearBars } from "@/components/charts/YearBars";
import { getMarketByFuel, getMarketByYear, getStats } from "@/lib/queries";
import { fuelSpec } from "@/lib/spec";
import { TrendingDown } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

/*
 * Renderowane na zadanie, nie przy buildzie: te strony licza agregacje po calej
 * tabeli, a przy prerenderowaniu kilkunastu naraz przekraczaly limit czasu
 * zapytania w poolerze i wywracaly caly deploy. Pierwszy odwiedzajacy placi za
 * jedno przeliczenie, kolejni dostaja odpowiedz z cache'u brzegowego.
 */
export const dynamic = "force-dynamic";

const pln = new Intl.NumberFormat("pl-PL", {
  style: "currency", currency: "PLN", maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("pl-PL");

export const metadata: Metadata = {
  title: "Ile auto traci na wartości — dane z 23 tysięcy ofert",
  description:
    "Ile samochód traci po roku, po dwóch i po trzech latach — policzone z median cen " +
    "realnych ofert poleasingowych, nie z cenników. Rozbicie po roczniku i po paliwie.",
  alternates: { canonical: "/analizy/utrata-wartosci" },
};

/**
 * Utrata wartosci — strona pod pytanie "ile auto traci po roku".
 *
 * Google podpowiada tu bogaty ogon: "po roku", "po 2 latach", "po 3 latach",
 * "po wyjechaniu z salonu", "auto elektryczne". To pytanie zadawane masowo,
 * a odpowiadaja na nie zwykle teksty oparte na ogolnikach ("auto traci 20%
 * w pierwszym roku").
 *
 * My liczymy je z MEDIAN REALNYCH OFERT: rocznik po roczniku, z 23 tysiecy
 * samochodow z 26 zrodel. To jedyne miejsce w serwisie, gdzie mamy przewage
 * nad kazdym portalem motoryzacyjnym — oni maja opinie, my mamy ceny.
 *
 * WAZNE ZASTRZEZENIE, ktore jest na stronie i musi tam zostac: to jest przekroj
 * rynku w jednym momencie, a nie sledzenie tych samych aut w czasie. Rocznik
 * 2020 i 2024 to inne egzemplarze o innym przebiegu i innym wyposazeniu, wiec
 * roznica miedzy nimi opisuje rynek, a nie los konkretnego auta. Podawanie
 * tego jako "Twoj samochod straci X%" byloby naciaganiem.
 */
export default async function UtrataWartosci() {
  const [stats, lata, paliwa] = await Promise.all([
    getStats(),
    getMarketByYear(),
    getMarketByFuel(),
  ]);

  const teraz = new Date().getFullYear();
  const dzis = new Date().toISOString().slice(0, 10);

  // Rocznik odniesienia: najnowszy, ktory ma sensowna probke.
  const bazowy = lata[0];
  const spadki = bazowy
    ? lata.slice(1, 6).map((y) => ({
        rok: y.year,
        wiek: bazowy.year != null && y.year != null ? bazowy.year - y.year : null,
        mediana: y.medianPrice,
        procent: Math.round((1 - y.medianPrice / bazowy.medianPrice) * 100),
        total: y.total,
      }))
    : [];

  const skala = Math.max(...lata.map((y) => y.medianPrice), 1);

  return (
    <main className="mx-auto max-w-[860px] px-4 py-6">
      <Crumbs items={[{ label: "Analizy" }, { label: "Utrata wartości" }]} />

      <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight text-neutral-100">
        <TrendingDown size={22} className="text-neutral-600" />
        Ile auto traci na wartości
      </h1>
      <p className="mb-5 mt-1 text-sm text-neutral-500">
        Policzone z median cen {num.format(stats.active)} realnych ofert poleasingowych z 26
        źródeł. Stan na {dzis}, przeliczane codziennie.
      </p>

      {bazowy && spadki.length > 0 && (
        <>
          <p className="mb-4 max-w-[72ch] text-[15px] leading-relaxed text-neutral-300">
            Rocznik {bazowy.year} ma dziś medianę{" "}
            <span className="text-neutral-100">{pln.format(bazowy.medianPrice)}</span>. Wobec
            niego kolejne roczniki wyglądają tak:
          </p>
          <StatStrip
            items={spadki.slice(0, 5).map((s) => ({
              label: s.wiek === 1 ? "Rok starsze" : `${s.wiek} lata starsze`,
              value: `−${s.procent}%`,
              hint: pln.format(s.mediana),
            }))}
          />
        </>
      )}

      <section className="mb-8">
        <h2 className="mb-1 text-lg font-semibold text-neutral-100">Mediana ceny po roczniku</h2>
        <p className="mb-3 text-[13px] text-neutral-500">
          Roczniki z mniej niż dwudziestoma ofertami pominięte — mediana z kilku sztuk nie
          opisuje niczego.
        </p>
        <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
          <YearBars rows={lata} skala={skala} />
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-neutral-100">
          Czy elektryki tracą szybciej
        </h2>
        <p className="mb-3 max-w-[72ch] text-[13px] leading-relaxed text-neutral-500">
          To najczęstsze pytanie w tym temacie. Poniżej mediana ceny i mediana rocznika dla
          każdego rodzaju napędu — im niższa cena przy podobnym roczniku, tym szybsza utrata.
        </p>
        <div className="overflow-x-auto rounded-xl border border-[var(--color-line)]">
          <table className="w-full min-w-[440px] text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line)] text-left text-[11px] uppercase tracking-wide text-neutral-600">
                <th className="px-4 py-2.5 font-medium">Napęd</th>
                <th className="px-4 py-2.5 text-right font-medium">Ofert</th>
                <th className="px-4 py-2.5 text-right font-medium">Mediana ceny</th>
                <th className="px-4 py-2.5 text-right font-medium">Mediana rocznika</th>
              </tr>
            </thead>
            <tbody>
              {paliwa.map((f) => (
                <tr key={f.fuel} className="border-b border-[var(--color-line)] last:border-0">
                  <td className="px-4 py-2 font-medium text-neutral-200">
                    {fuelSpec(f.fuel)?.label ?? f.fuel}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-neutral-400">
                    {num.format(f.total)}
                  </td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums text-neutral-100">
                    {pln.format(f.medianPrice)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-neutral-500">
                    {f.medianYear ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <h2 className="mb-2 text-lg font-semibold text-neutral-100">
          Jak to czytać — i czego te liczby NIE mówią
        </h2>
        <ul className="flex flex-col gap-2 text-[13px] leading-relaxed text-neutral-300">
          <li>
            To jest <span className="font-medium">przekrój rynku w jednym momencie</span>, a nie
            śledzenie tych samych aut w czasie. Rocznik {teraz - 4} i {teraz - 1} to inne
            egzemplarze, o innym przebiegu i wyposażeniu.
          </li>
          <li>
            Różnica między rocznikami opisuje więc <span className="font-medium">rynek</span>,
            a nie los konkretnego samochodu. Twoje auto może stracić więcej albo mniej.
          </li>
          <li>
            Dane dotyczą wyłącznie aut poleasingowych — flotowych, zwykle serwisowanych
            w ASO i z wyższym przebiegiem niż egzemplarze prywatne. Na rynku prywatnym krzywa
            wygląda inaczej.
          </li>
          <li>
            Liczone tylko z ofert „kup teraz". Ceny aukcyjne pominięte, bo bieżąca stawka
            jeszcze urośnie.
          </li>
        </ul>
      </section>

      <p className="mt-6 text-[13px] text-neutral-500">
        Pełne dane rynkowe i metodologia:{" "}
        <Link href="/dane" className="underline decoration-dotted underline-offset-2 hover:text-accent">
          /dane
        </Link>
        . Ceny konkretnego modelu po roczniku znajdziesz na stronie każdego modelu, na przykład{" "}
        <Link href="/bmw/x3" className="underline decoration-dotted underline-offset-2 hover:text-accent">
          BMW X3
        </Link>
        .
      </p>
    </main>
  );
}
