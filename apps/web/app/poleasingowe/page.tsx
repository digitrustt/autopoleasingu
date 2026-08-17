import { Crumbs } from "@/components/Crumbs";
import { StatStrip } from "@/components/StatStrip";
import { GRUPY } from "@/lib/filtry";
import { getCitiesWithCounts, getStats } from "@/lib/queries";
import { groupBySlug, slugify } from "@/lib/slug";
import { MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

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

export const metadata: Metadata = {
  title: "Samochody poleasingowe według miast",
  description:
    "Auta poleasingowe w polskich miastach — Warszawa, Wrocław, Poznań, Gdańsk i ponad sto " +
    "innych. Oferty z 26 źródeł: firm leasingowych, CFM i programów dealerskich.",
  alternates: { canonical: "/poleasingowe" },
};

/**
 * Spis miast.
 *
 * Istnieje z dwoch powodow naraz. Dla czytelnika: wiekszosc ludzi chce
 * obejrzec auto przed zakupem, wiec miasto jest pierwszym filtrem, jaki
 * ustawiaja. Dla wyszukiwarki: bez tej strony 128 podstron miast nie mialoby
 * ZADNEGO linku prowadzacego, a strona odlinkowana praktycznie nie istnieje.
 */
export default async function CitiesPage() {
  const [miasta, stats] = await Promise.all([getCitiesWithCounts(), getStats()]);

  // Warianty zapisu tej samej nazwy scalamy — patrz strona miasta.
  const grupy = [...groupBySlug(miasta, (m) => m.city ?? "").values()].map((g) => ({
    city: g[0].city ?? "",
    total: g.reduce((n, x) => n + x.total, 0),
    minPrice: g.map((x) => x.minPrice).filter((v): v is number => v != null).sort((a, b) => a - b)[0] ?? null,
  }));

  const wOfertach = grupy.reduce((n, g) => n + g.total, 0);

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6">
      <Crumbs items={[{ label: "Miasta" }]} />

      <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight text-neutral-100">
        <MapPin size={22} className="text-neutral-600" />
        Samochody poleasingowe — kategorie i miasta
      </h1>
      <p className="mb-5 mt-1 max-w-[70ch] text-sm leading-relaxed text-neutral-400">
        Auta poleasingowe w {grupy.length} miastach, w których stoi co najmniej trzydzieści
        ofert. Zbieramy je z 26 źródeł — firm leasingowych, CFM i programów dealerskich — i
        porównujemy ceny z medianą rynkową dla tego samego rocznika, przebiegu i napędu.
      </p>

      <StatStrip
        items={[
          { label: "Miast", value: num.format(grupy.length), hint: "min. 30 ofert" },
          { label: "Ofert w nich", value: num.format(wOfertach) },
          { label: "Cała baza", value: num.format(stats.active) },
          { label: "Nowych dziś", value: num.format(stats.newToday) },
          { label: "Mediana", value: pln.format(stats.medianPrice), hint: "tylko „kup teraz”" },
        ]}
      />

      {/*
        Kategorie NAD miastami, bo frazy typu "auto poleasingowe do 50 tys"
        i "poleasingowe suv" sa grubsze niz pojedyncze miasto poza Warszawa.
      */}
      {GRUPY.map((g) => (
        <section key={g.tytul} className="mb-5">
          <h2 className="mb-2 text-[13px] uppercase tracking-wide text-neutral-600">{g.tytul}</h2>
          <ul className="flex flex-wrap gap-2">
            {g.pozycje.map((k) => (
              <li key={k.slug}>
                <Link
                  href={`/poleasingowe/${k.slug}`}
                  className="rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2 text-[13px] text-neutral-200 transition-colors hover:border-accent/70 hover:text-accent"
                >
                  {k.nazwa}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <h2 className="mb-3 mt-8 text-lg font-semibold text-neutral-100">
        Według miasta ({grupy.length})
      </h2>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2">
        {grupy.map((m) => (
          <li key={m.city}>
            <Link
              href={`/poleasingowe/${slugify(m.city)}`}
              className="group flex items-baseline justify-between gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2.5 transition-colors hover:border-accent/40"
            >
              <span className="min-w-0 truncate text-sm font-medium text-neutral-200 transition-colors group-hover:text-accent">
                {m.city}
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-neutral-600">
                {num.format(m.total)}
                {m.minPrice != null && ` · od ${pln.format(m.minPrice)}`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
