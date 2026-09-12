import { Crumbs } from "@/components/Crumbs";
import { KategoriaKafelek } from "@/components/KategoriaKafelek";
import { StatStrip } from "@/components/StatStrip";
import { GRUPY } from "@/lib/filtry";
import { ikonaKategorii } from "@/lib/ikony";
import { getCitiesWithCounts, getKategoriePodglad, getStats } from "@/lib/queries";
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
  const [miasta, stats, podglad] = await Promise.all([
    getCitiesWithCounts(),
    getStats(),
    getKategoriePodglad(),
  ]);

  const wgKlucza = new Map(podglad.nadwozia.map((n) => [n.klucz, n]));
  const wgPaliwa = new Map(podglad.paliwa.map((n) => [n.klucz, n]));
  const wgProgu = new Map(podglad.progi.map((n) => [n.prog, n.total]));

  /** Liczba ofert dla kategorii — po slugu z lib/filtry.ts. */
  function ileOfert(slug: string): number | null {
    const nadwozie = wgKlucza.get(slug);
    if (nadwozie) return nadwozie.total;
    const paliwo = wgPaliwa.get(
      { hybrydy: "hybrid", elektryki: "electric", phev: "phev", diesel: "diesel", benzyna: "petrol" }[
        slug
      ] ?? "",
    );
    if (paliwo) return paliwo.total;
    const prog = slug.match(/^do-(\d+)-tys$/);
    if (prog) return wgProgu.get(Number(prog[1])) ?? null;
    return null;
  }

  const NADWOZIA = [
    { slug: "suv", nazwa: "SUV" },
    { slug: "kombi", nazwa: "Kombi" },
    { slug: "sedan", nazwa: "Sedan" },
    { slug: "hatchback", nazwa: "Hatchback" },
    { slug: "van", nazwa: "Van" },
    { slug: "dostawcze", nazwa: "Dostawcze" },
  ];

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

        Nadwozia dostaja zdjecia, reszta ikony. Zdjecie ma sens tam, gdzie
        NAZWA NIE WYSTARCZA — "kombi" i "hatchback" to dla wielu osob to samo,
        dopoki nie zobacza auta. Przy progu cenowym zdjecie nie niesie niczego,
        bo "do 50 tys." wyglada tak samo jak "do 80 tys.".
      */}
      <section className="mb-6">
        <h2 className="mb-3 text-[13px] uppercase tracking-wide text-neutral-600">
          Według nadwozia
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {NADWOZIA.map((n, i) => {
            const d = wgKlucza.get(n.slug);
            return (
              <KategoriaKafelek
                key={n.slug}
                href={`/poleasingowe/${n.slug}`}
                nazwa={n.nazwa}
                total={d?.total ?? 0}
                minPrice={d?.minPrice}
                thumb={d?.thumb}
                priority={i < 6}
              />
            );
          })}
        </div>
      </section>

      {GRUPY.filter((g) => g.tytul !== "Według nadwozia").map((g) => (
        <section key={g.tytul} className="mb-5">
          <h2 className="mb-2 text-[13px] uppercase tracking-wide text-neutral-600">{g.tytul}</h2>
          <ul className="flex flex-wrap gap-2">
            {g.pozycje.map((k) => {
              const Ikona = ikonaKategorii(k.slug);
              const ile = ileOfert(k.slug);
              return (
                <li key={k.slug}>
                  <Link
                    href={`/poleasingowe/${k.slug}`}
                    className="flex items-center gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2 text-[13px] text-neutral-200 transition-colors hover:border-neutral-600 hover:bg-[var(--color-ink)]"
                  >
                    <Ikona size={15} className="shrink-0 text-neutral-500" />
                    {k.nazwa}
                    {ile != null && (
                      <span className="tabular-nums text-[11px] text-neutral-600">{num.format(ile)}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <h2 className="mb-3 mt-8 text-lg font-semibold text-neutral-100">
        Według miasta ({grupy.length})
      </h2>
      {/*
        Nazwa miasta w OSOBNYM wierszu, liczby pod nia.
        Wczesniej stały obok siebie: nazwa z `truncate`, a licznik `shrink-0`.
        Przy takim ukladzie nazwa zawsze przegrywa walke o miejsce i w siatce
        stalo "Wa… 3020", "Wr… 1129", "Pozn… 786" — czyli spis miast, z ktorego
        nie dalo sie odczytac ani jednego miasta. Liczby sa krotsze i stale,
        wiec to one moga dzielic wiersz, a nie nazwa.
      */}
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-2">
        {grupy.map((m) => (
          <li key={m.city}>
            <Link
              href={`/poleasingowe/${slugify(m.city)}`}
              className="group flex h-full flex-col justify-between gap-1 rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2.5 transition-colors hover:border-neutral-600 hover:bg-[var(--color-ink)]"
            >
              <span className="text-sm font-medium leading-tight text-neutral-100">{m.city}</span>
              <span className="flex items-baseline gap-1.5 text-[11px] tabular-nums text-neutral-500">
                <span className="text-neutral-300">{num.format(m.total)}</span>
                {m.minPrice != null && <span>od {pln.format(m.minPrice)}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
