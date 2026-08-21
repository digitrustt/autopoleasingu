import { Crumbs } from "@/components/Crumbs";
import { StatStrip } from "@/components/StatStrip";
import {
  getMarketByFuel,
  getMarketByYear,
  getSources,
  getStats,
  getVinSpread,
} from "@/lib/queries";
import { fuelSpec } from "@/lib/spec";
import { ChartColumn } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const revalidate = 86_400;

const pln = new Intl.NumberFormat("pl-PL", {
  style: "currency", currency: "PLN", maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("pl-PL");

export const metadata: Metadata = {
  title: "Dane o rynku aut poleasingowych w Polsce",
  description:
    "Mediana cen, utrata wartości po roczniku i rozbieżności cenowe tego samego egzemplarza — " +
    "policzone z ponad 23 tysięcy ofert z 26 źródeł poleasingowych. Aktualizowane codziennie.",
  alternates: { canonical: "/dane" },
};

/**
 * Strona danych rynkowych.
 *
 * To jedyna strona w serwisie pisana pod CYTOWANIE, a nie pod przegladanie
 * ofert. Dziennikarz, ktory pyta "ile kosztuje auto poleasingowe", i model
 * jezykowy, ktory ma odpowiedziec na to samo pytanie, potrzebuja jednej liczby
 * ze zrodlem i data — nie wyszukiwarki z filtrami.
 *
 * Stad forma: goly tekst, tabele, jawna metodologia i jawna data. Bez zdjec,
 * bez kafelkow, bez niczego, co trzeba klikac, zeby zobaczyc liczbe.
 */
export default async function DanePage() {
  const [stats, lata, paliwa, rozjazd, zrodla] = await Promise.all([
    getStats(),
    getMarketByYear(),
    getMarketByFuel(),
    getVinSpread(),
    getSources(),
  ]);

  const dzis = new Date().toISOString().slice(0, 10);
  const czynne = zrodla.filter((z) => z.active > 0).length;

  return (
    <main className="mx-auto max-w-[900px] px-4 py-6">
      <Crumbs items={[{ label: "Dane rynkowe" }]} />

      <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight text-neutral-100">
        <ChartColumn size={22} className="text-neutral-600" />
        Rynek aut poleasingowych w Polsce — dane
      </h1>
      <p className="mb-1 mt-1 max-w-[75ch] text-sm leading-relaxed text-neutral-400">
        Liczby policzone z {num.format(stats.active)} aktywnych ofert zebranych z {czynne} źródeł:
        firm leasingowych, firm CFM, programów dealerskich i platform aukcyjnych. Wszystkie
        mediany dotyczą wyłącznie ofert „kup teraz" — ceny aukcyjne są bieżącą stawką
        w licytacji i jeszcze urosną, więc nie są cenami zakupu.
      </p>
      <p className="mb-5 text-[13px] text-neutral-600">
        Stan na {dzis}. Dane odświeżane codziennie. Wolno je cytować, podając źródło.
      </p>

      <StatStrip
        items={[
          { label: "Ofert w bazie", value: num.format(stats.active), hint: `${czynne} źródeł` },
          { label: "Mediana ceny", value: pln.format(stats.medianPrice), hint: "tylko „kup teraz”" },
          { label: "Nowych dziś", value: num.format(stats.newToday) },
          { label: "Zniknęło z rynku", value: num.format(stats.gone), hint: "od początku pomiaru" },
        ]}
      />

      <section className="mb-8">
        <h2 className="mb-1 text-lg font-semibold text-neutral-100">
          Ile kosztuje auto poleasingowe według rocznika
        </h2>
        <p className="mb-3 text-[13px] text-neutral-500">
          Mediana ceny i przebiegu dla całego rynku. Roczniki z mniej niż dwudziestoma ofertami
          pominięte, bo mediana z kilku sztuk nie opisuje niczego.
        </p>
        <div className="overflow-x-auto rounded-xl border border-[var(--color-line)]">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line)] text-left text-[11px] uppercase tracking-wide text-neutral-600">
                <th className="px-4 py-2.5 font-medium">Rocznik</th>
                <th className="px-4 py-2.5 text-right font-medium">Ofert</th>
                <th className="px-4 py-2.5 text-right font-medium">Mediana ceny</th>
                <th className="px-4 py-2.5 text-right font-medium">Mediana przebiegu</th>
              </tr>
            </thead>
            <tbody>
              {lata.map((y) => (
                <tr key={y.year} className="border-b border-[var(--color-line)] last:border-0">
                  <td className="px-4 py-2 font-medium text-neutral-200">{y.year}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-neutral-400">
                    {num.format(y.total)}
                  </td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums text-neutral-100">
                    {pln.format(y.medianPrice)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-neutral-500">
                    {y.medianMileage != null ? `${num.format(y.medianMileage)} km` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-neutral-100">Ceny według paliwa</h2>
        <div className="overflow-x-auto rounded-xl border border-[var(--color-line)]">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line)] text-left text-[11px] uppercase tracking-wide text-neutral-600">
                <th className="px-4 py-2.5 font-medium">Paliwo</th>
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

      {rozjazd?.par != null && rozjazd.par > 0 && (
        <section className="mb-8">
          <h2 className="mb-1 text-lg font-semibold text-neutral-100">
            Ten sam samochód, dwie ceny
          </h2>
          <p className="mb-3 max-w-[75ch] text-[13px] leading-relaxed text-neutral-500">
            Ten sam egzemplarz bywa wystawiony równocześnie przez leasingodawcę i przez dealera,
            po różnych cenach. Łączymy oferty po numerze VIN — jedynym identyfikatorze, który
            znaczy to samo we wszystkich źródłach — i liczymy różnicę.
          </p>
          <StatStrip
            items={[
              { label: "Aut z rozbieżnością", value: num.format(rozjazd.par) },
              { label: "Różnica ≥ 10 tys.", value: num.format(rozjazd.ponad10k) },
              {
                label: "Największa różnica",
                value: rozjazd.max ? pln.format(rozjazd.max) : "—",
              },
              {
                label: "Mediana różnicy",
                value: rozjazd.mediana ? pln.format(rozjazd.mediana) : "—",
              },
              {
                label: "Suma różnic",
                value: rozjazd.suma ? pln.format(Number(rozjazd.suma)) : "—",
              },
            ]}
          />
        </section>
      )}

      <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
        <h2 className="mb-2 text-lg font-semibold text-neutral-100">Metodologia</h2>
        <ul className="flex flex-col gap-1.5 text-[13px] leading-relaxed text-neutral-400">
          <li>
            Dane zbierane raz na dobę z {czynne} źródeł. Pełna lista ze stanem każdego:{" "}
            <Link href="/zrodla" className="underline decoration-dotted underline-offset-2 hover:text-accent">
              /zrodla
            </Link>
            .
          </li>
          <li>
            Mediany liczone wyłącznie z ofert „kup teraz". Licytacje pomijamy, bo bieżąca stawka
            nie jest ceną zakupu.
          </li>
          <li>
            Oferty bez podanej ceny (sprzedawane wyłącznie w leasingu lub najmie) nie wchodzą do
            median.
          </li>
          <li>
            Rozbieżności cenowe liczone wyłącznie między RÓŻNYMI źródłami dla tego samego,
            pełnego 17-znakowego numeru VIN.
          </li>
          <li>
            Serwis nie sprzedaje samochodów i nie pośredniczy w transakcjach. Nie ma dostępu do
            historii wypadkowej ani do przebiegu z CEPiK.
          </li>
        </ul>
      </section>
    </main>
  );
}
