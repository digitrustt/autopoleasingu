import { Crumbs } from "@/components/Crumbs";
import { FaqBlok, type PytanieFaq } from "@/components/FaqBlok";
import { LeasingLista } from "@/components/LeasingLista";
import { RataLista } from "@/components/RataLista";
import { ZapisPasek } from "@/components/ZapisPasek";
import { OfferCard } from "@/components/OfferCard";
import { ModelGrid } from "@/components/ModelGrid";
import { StatStrip } from "@/components/StatStrip";
import { MileagePrice } from "@/components/charts/MileagePrice";
import { PriceHistogram } from "@/components/charts/PriceHistogram";
import { YearBars } from "@/components/charts/YearBars";
import {
  getBodyBreakdown,
  getFuelBreakdown,
  getListings,
  getPriceHistogram,
  getScatter,
  getSegmentStats,
  getYearBreakdown,
  getYearSold,
} from "@/lib/queries";
import { makeHref, modelHref, slugify } from "@/lib/slug";
import { bodySpec, fuelSpec } from "@/lib/spec";
import { CalendarRange, Gauge, Layers, SlidersHorizontal, TrendingDown } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { paryModelu } from "@/lib/pary";
import { paryMarkaMiastoLiczniki } from "@/lib/cache-filtrow";
import { makaMiastoHref } from "@/lib/marka-miasto";
import { miejsceOk } from "@/lib/smiec";
import { notFound } from "next/navigation";
import { rozwiazModel as resolve } from "@/lib/model";
import { rocznikHref, rocznikOk } from "@/lib/roczniki";
import { oferty, zrodel } from "@/lib/format";

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

/*
 * BEZ TEGO `revalidate` NIE DZIALA — i przez dwa miesiace nie dzialal.
 *
 * Trasa z parametrem w adresie, ktora nie eksportuje generateStaticParams,
 * jest w Next 15 renderowana przy KAZDYM zadaniu; `revalidate` jest wtedy
 * martwym zapisem. Zmierzone 5.10.2026 na produkcji: wszystkie takie strony
 * oddawaly `cache-control: private, no-store` i `x-vercel-cache: MISS`, a
 * jedyna trasa z ta funkcja ([make]/poleasingowe/[miasto]) szla z cache'u.
 * Skutek: kazde wejscie robota = funkcja + zapytania do bazy, 586 tys.
 * wywolan w miesiacu i przekroczony limit CPU na Vercelu (7 h 48 min z 4 h).
 *
 * Pusta lista znaczy: nic nie budujemy z gory (build nie dotyka bazy), a
 * kazdy adres jest liczony przy pierwszym wejsciu i trzymany przez `revalidate`.
 */
export async function generateStaticParams() {
  return [];
}

const pln = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("pl-PL");

export async function generateMetadata({
  params,
}: {
  params: Promise<{ make: string; model: string }>;
}): Promise<Metadata> {
  const { make: ms, model: mos } = await params;
  const found = await resolve(ms, mos);
  if (!found) return { title: "Nie znaleziono modelu" };

  const stats = await getSegmentStats(found.make, found.aliasy);
  const name = `${found.make} ${found.model}`;
  /*
   * "POLEASINGOWE", NIE TYLKO "PO LEASINGU" (22.10.2026). Search Console:
   * "bmw poleasingowe" poz. 23, "toyota poleasingowe" 20, "bmw x3 poleasingowe"
   * 25, "skoda superb poleasingowa" 46 — sedno niszy, a tytuly mialy tylko
   * "po leasingu". W polskim Google forma slowa ma znaczenie; tytul niesie
   * teraz obie.
   */
  const title = `${name} poleasingowe — ${num.format(stats.total)} ${oferty(stats.total)} po leasingu${
    stats.minPrice ? ` od ${pln.format(stats.minPrice)}` : ""
  }`;
  /*
   * Opis zaczyna sie od CENY, nie od liczby zrodel.
   *
   * Poprzednia wersja otwierala sie slowami "Ceny X poleasingowych z 9 zrodel",
   * czyli informacja o NAS, a nie o aucie. Czlowiek w wynikach wyszukiwania
   * szuka widelek cenowych — je stawiamy na poczatku, zanim Google utnie opis.
   * Liczba zrodel zostaje na koncu jako dowod kompletnosci.
   */
  /*
   * Jedna cena to nie widelki (28.10.2026): T-Cross z jedna oferta z cena dawal opis
   * "53 900 zl – 53 900 zl, mediana 53 900 zl", a Geely EX5 "roczniki 2025–2025".
   * Takie opisy wygladaja na blad i obnizaja klikalnosc w wynikach.
   */
  const jednaCena = stats.minPrice != null && stats.minPrice === stats.maxPrice;
  const widelki =
    stats.minPrice && stats.maxPrice
      ? jednaCena
        ? `cena ${pln.format(stats.minPrice)}`
        : `${pln.format(stats.minPrice)} – ${pln.format(stats.maxPrice)}`
      : null;

  const description =
    (widelki ? `${name} poleasingowe: ${widelki}` : `${name} poleasingowe`) +
    (stats.medianPrice && !jednaCena ? `, mediana ${pln.format(stats.medianPrice)}` : "") +
    (stats.minYear && stats.maxYear
      ? stats.minYear === stats.maxYear
        ? `. Rocznik ${stats.minYear}`
        : `. Roczniki ${stats.minYear}–${stats.maxYear}`
      : "") +
    `. ${num.format(stats.total)} ${oferty(stats.total)} z ${stats.sources} ${zrodel(stats.sources)}, aktualizowane codziennie.` +
    // Zapytania "<model> leasing" (30.10.2026) — Google pogrubia trafione slowa w opisie.
    " Leasing dla firm i kredyt.";

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
  const { make, model, models, aliasy } = found;

  const name = `${make} ${model}`;

  const [stats, years, fuels, bodies, histogram, scatter, offers, liczniki, sprzedane] = await Promise.all([
    getSegmentStats(make, aliasy),
    getYearBreakdown(make, aliasy),
    getFuelBreakdown(make, aliasy),
    getBodyBreakdown(make, aliasy),
    getPriceHistogram(make, aliasy),
    getScatter(make, aliasy),
    getListings({ make, model: aliasy, sort: "deal_desc" }, 1, 24),
    paryMarkaMiastoLiczniki(),
    getYearSold(make, aliasy),
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

  /*
   * Miasta marki (28.10.2026): strony marka x miasto maja po stronie modelu
   * naturalne miejsce linku, a do tej pory linkowaly do nich tylko oferty.
   */
  const miasta = liczniki.filter((m) => m.make === make && miejsceOk(m.city)).slice(0, 8);

  /*
   * Pytania liczone z danych tej strony. Kazde pojawia sie tylko wtedy, gdy ma
   * z czego sie policzyc: model z jedna oferta bez ceny nie dostaje pytania o mediane.
   */
  const jednaCena = stats.minPrice != null && stats.minPrice === stats.maxPrice;
  /*
   * Mediana z mniej niz trzech znikniec to anegdota, nie cena — takie roczniki
   * dostaja kreske zamiast liczby.
   */
  const sprzedaneWgRoku = new Map(
    sprzedane.filter((r) => r.year != null && r.sold >= 3).map((r) => [r.year as number, r]),
  );
  /*
   * Pytania o konkretny rocznik (30.10.2026): Search Console pokazywal zapytania
   * typu "toyota corolla hybrid 2023 cena" na poz. ~8, a strona odpowiadala na
   * nie tylko tabela. Trzy roczniki z najwieksza liczba ofert, minimum trzy oferty.
   */
  /*
   * Roczniki z wlasna strona (31.10.2026) — ten sam prog co na stronie rocznika,
   * liczony z tych samych dwoch zapytan, wiec link nigdy nie prowadzi do 404.
   */
  const zeStrona = new Set(
    years
      .filter((y) => y.year != null)
      .map((y) => y.year as number)
      .filter((rok) =>
        rocznikOk(
          years.find((y) => y.year === rok)?.total ?? 0,
          sprzedane.find((r) => r.year === rok)?.sold ?? 0,
        ),
      ),
  );
  const rocznikiFaq = years
    .filter((y) => y.year != null && y.total >= 3)
    .sort((a, b) => b.total - a.total)
    .slice(0, 3)
    .sort((a, b) => (b.year as number) - (a.year as number));
  const rocznikiAsc = years
    .filter((y) => y.year != null)
    .sort((a, b) => (a.year as number) - (b.year as number));
  const pytania: PytanieFaq[] = [
    ...(stats.minPrice
      ? [
          {
            q: `Ile kosztuje ${name} po leasingu?`,
            a: jednaCena
              ? `Jedyna oferta ${name} z podaną ceną kosztuje ${pln.format(stats.minPrice)}.`
              : `Ceny ${name} poleasingowego zaczynają się od ${pln.format(stats.minPrice)}` +
                (stats.maxPrice ? ` i sięgają ${pln.format(stats.maxPrice)}` : "") +
                (stats.medianPrice ? `, a mediana to ${pln.format(stats.medianPrice)}` : "") +
                (rocznikiAsc.length >= 2
                  ? `. Najstarszy rocznik (${rocznikiAsc[0].year}) kosztuje typowo ` +
                    `${pln.format(rocznikiAsc[0].medianPrice)}, najnowszy ` +
                    `(${rocznikiAsc[rocznikiAsc.length - 1].year}) ` +
                    `${pln.format(rocznikiAsc[rocznikiAsc.length - 1].medianPrice)}`
                  : "") +
                ".",
          },
        ]
      : []),
    ...(stats.medianMileage != null
      ? [
          {
            q: `Jaki przebieg mają ${name} po leasingu?`,
            a:
              `Mediana przebiegu ${name} w naszej bazie to ${num.format(stats.medianMileage)} km, ` +
              "liczona z ofert, w których sprzedawca podał przebieg.",
          },
        ]
      : []),
    ...(fuels.length > 0
      ? [
          {
            q: `Jakie silniki mają ${name} po leasingu?`,
            a:
              "W ofercie są: " +
              fuels.map((f) => `${fuelSpec(f.fuel)?.label ?? f.fuel} (${num.format(f.total)} szt.)`).join(", ") +
              ".",
          },
        ]
      : []),
    ...rocznikiFaq.map((y) => {
      const s = sprzedaneWgRoku.get(y.year as number);
      return {
        q: `Ile kosztuje ${name} z ${y.year} roku?`,
        a:
          `Mediana ceny ${name} z ${y.year} roku to ${pln.format(y.medianPrice)} ` +
          `(${num.format(y.total)} ${oferty(y.total)} „kup teraz”), najtańszy od ${pln.format(y.minPrice)}` +
          (y.medianMileage != null ? `, przy typowym przebiegu ${num.format(y.medianMileage)} km` : "") +
          "." +
          (s
            ? ` Oferty z tego rocznika, które zniknęły w ostatnich 180 dniach (czyli najpewniej ` +
              `zostały sprzedane), kosztowały typowo ${pln.format(s.soldMedian)}.`
            : ""),
        ...(zeStrona.has(y.year as number)
          ? { link: { href: rocznikHref(make, model, y.year as number), tekst: `Więcej o ${name} ${y.year}.` } }
          : {}),
      };
    }),
    {
      q: `Gdzie kupić ${name} poleasingowy?`,
      a:
        `Mamy ${num.format(stats.total)} ${oferty(stats.total)} ${name} z ${stats.sources} ` +
        `${zrodel(stats.sources)}. Każda prowadzi do sprzedawcy, u którego dokonujesz zakupu, ` +
        "a my pokazujemy ceny, historię zmian ceny i ten sam VIN u kilku sprzedawców.",
    },
    {
      q: `Czy ${name} poleasingowy można kupić na raty?`,
      a:
        "Zwykle tak, kredytem samochodowym. Warunki zależą od banku i od sprzedawcy, więc ratę " +
        "sprawdzisz u kredytodawcy.",
      link: { href: "/poleasingowe/na-raty", tekst: "Więcej o zakupie na raty." },
    },
    {
      q: `Czy ${name} poleasingowy można wziąć w leasing?`,
      a:
        "Zwykle tak. Auta poleasingowe wystawiają głównie leasingodawcy, firmy flotowe i dealerzy, " +
        "więc kupując na firmę, można je sfinansować leasingiem tak jak nowe auto. Warunki, " +
        "w tym dopuszczalny wiek samochodu na koniec umowy, ustala leasingodawca.",
      link: { href: "/poleasingowe/w-leasingu", tekst: "Jak wziąć auto poleasingowe w leasing." },
    },
    {
      q: `Leasing czy kredyt na ${name}?`,
      a:
        "Przy zakupie na firmę zwykle rozważa się leasing, przy zakupie prywatnym kredyt " +
        "samochodowy. To dwie różne umowy z innymi skutkami podatkowymi, więc kupując na " +
        "działalność, warto porównać obie opcje z księgowym.",
    },
  ];

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

      <h1 className="text-2xl font-bold tracking-tight text-neutral-100">{name} poleasingowe</h1>
      <p className="mb-5 mt-1 max-w-[70ch] text-sm leading-relaxed text-neutral-400">
        {num.format(stats.total)} ofert {name} z {stats.sources}{" "}
        {stats.sources === 1 ? "źródła" : "źródeł"} poleasingowych
        {stats.minYear && stats.maxYear && `, roczniki ${stats.minYear}–${stats.maxYear}`}
        {stats.medianMileage != null &&
          `, mediana przebiegu ${num.format(stats.medianMileage)} km`}
        . Ten sam egzemplarz bywa wystawiony w kilku kanałach po różnych cenach — pokazujemy je
        obok siebie zamiast scalać.
      </p>

      <RataLista etykieta={`model-${make}-${model}`.toLowerCase().replace(/[^a-z0-9]+/g, "-")} />

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
          <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-neutral-100">
            <CalendarRange size={17} className="text-neutral-600" />
            Ile kosztuje {name} według rocznika
          </h2>
          <p className="mb-3 text-[13px] text-neutral-500">
            Mediana i cena minimalna liczone wyłącznie z ofert „kup teraz”. Ceny aukcyjne są
            bieżącą ofertą w licytacji i jeszcze urosną, więc nie wchodzą do tych zestawień.
            {sprzedaneWgRoku.size > 0 &&
              " Kolumna „Sprzedane” to mediana ostatniej ceny ofert, które zniknęły w ciągu 180 dni — najbliżej ceny transakcyjnej, jaką da się zobaczyć."}
          </p>

          {/*
            Wykres i tabela pokazuja te same liczby, ale odpowiadaja na inne
            pytania: z tabeli odczytuje sie konkretna wartosc, z wykresu widac
            ksztalt utraty wartosci i ktory rocznik odstaje od reszty.
          */}
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
              <YearBars rows={years} />
            </div>

            {/* overflow-x-auto: przy waskim ekranie tabela ma sie przewijac sama,
                zamiast rozpychac cala strone w poziomie. */}
            <div className="overflow-x-auto rounded-xl border border-[var(--color-line)]">
            <table className={`w-full text-sm ${sprzedaneWgRoku.size > 0 ? "min-w-[620px]" : "min-w-[520px]"}`}>
              <thead>
                <tr className="border-b border-[var(--color-line)] text-left text-[11px] uppercase tracking-wide text-neutral-600">
                  <th className="px-4 py-2.5 font-medium">Rocznik</th>
                  <th className="px-4 py-2.5 text-right font-medium">Ofert</th>
                  <th className="px-4 py-2.5 text-right font-medium">Od</th>
                  <th className="px-4 py-2.5 text-right font-medium">Mediana</th>
                  {sprzedaneWgRoku.size > 0 && (
                    <th className="px-4 py-2.5 text-right font-medium">Sprzedane</th>
                  )}
                  <th className="px-4 py-2.5 text-right font-medium">Przebieg</th>
                </tr>
              </thead>
              <tbody>
                {years.map((y) => (
                  <tr
                    key={y.year}
                    className="border-b border-[var(--color-line)] last:border-0 hover:bg-[var(--color-panel)]"
                  >
                    <td className="px-4 py-2.5 font-medium text-neutral-200">
                      {y.year != null && zeStrona.has(y.year) ? (
                        <Link href={rocznikHref(make, model, y.year)} className="text-accent hover:underline">
                          {y.year}
                        </Link>
                      ) : (
                        y.year
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-neutral-400">
                      {num.format(y.total)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-neutral-300">
                      {pln.format(y.minPrice)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-neutral-100">
                      {pln.format(y.medianPrice)}
                    </td>
                    {sprzedaneWgRoku.size > 0 && (
                      <td className="px-4 py-2.5 text-right tabular-nums text-neutral-300">
                        {(() => {
                          const s = sprzedaneWgRoku.get(y.year as number);
                          return s ? (
                            <span title={`${num.format(s.sold)} ofert zniknęło w 180 dni`}>
                              {pln.format(s.soldMedian)}
                            </span>
                          ) : (
                            <span className="text-neutral-600">—</span>
                          );
                        })()}
                      </td>
                    )}
                    <td className="px-4 py-2.5 text-right tabular-nums text-neutral-500">
                      {y.medianMileage != null ? `${num.format(y.medianMileage)} km` : "—"}
                    </td>
                  </tr>
                ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {(histogram.counts.length > 0 || scatter.n >= 6) && (
        <section className="mb-8 grid gap-4 lg:grid-cols-2">
          {histogram.counts.length > 0 && (
            <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
              <h2 className="text-lg font-semibold text-neutral-100">Rozkład cen</h2>
              <p className="mb-4 text-[13px] leading-relaxed text-neutral-500">
                Sama mediana nie mówi, czy rynek jest jednolity. Tu widać, czy oferty skupiają
                się wokół jednej ceny, czy rozpadają na dwie grupy.
              </p>
              <PriceHistogram dane={histogram} />
            </div>
          )}

          {scatter.n >= 6 && (
            <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-100">
                <Gauge size={17} className="text-neutral-600" />
                Cena a przebieg
              </h2>
              <p className="mb-4 text-[13px] leading-relaxed text-neutral-500">
                Ile realnie kosztuje każde dziesięć tysięcy kilometrów na tym modelu — czyli czy
                opłaca się dopłacić za mniejszy przebieg.
              </p>
              <MileagePrice dane={scatter} />
            </div>
          )}
        </section>
      )}

      {(fuels.length > 1 || bodies.length > 1) && (
        <section className="mb-8 grid gap-6 sm:grid-cols-2">
          {fuels.length > 1 && (
            <div>
              <h2 className="mb-3 text-lg font-semibold text-neutral-100">Ceny według paliwa</h2>
              <ul className="flex flex-col gap-2">
                {fuels.map((f) => {
                  const spec = fuelSpec(f.fuel);
                  return (
                    <li
                      key={f.fuel}
                      className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2.5"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        {spec && <spec.Icon size={15} className="shrink-0 text-neutral-600" />}
                        <span className="truncate text-sm text-neutral-200">
                          {spec?.label ?? f.fuel}
                        </span>
                      </span>
                      <span className="shrink-0 text-[13px] tabular-nums text-neutral-500">
                        {num.format(f.total)} szt. ·{" "}
                        <span className="font-semibold text-neutral-200">
                          {pln.format(f.medianPrice)}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {bodies.length > 1 && (
            <div>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-neutral-100">
                <Layers size={17} className="text-neutral-600" />
                Ceny według nadwozia
              </h2>
              <ul className="flex flex-col gap-2">
                {bodies.map((b) => {
                  const spec = bodySpec(b.body);
                  return (
                    <li
                      key={b.body}
                      className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2.5"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        {spec && <spec.Icon size={15} className="shrink-0 text-neutral-600" />}
                        <span className="truncate text-sm text-neutral-200">{b.body}</span>
                      </span>
                      <span className="shrink-0 text-[13px] tabular-nums text-neutral-500">
                        {num.format(b.total)} szt.
                        {b.medianPrice != null && (
                          <>
                            {" · "}
                            <span className="font-semibold text-neutral-200">
                              {pln.format(b.medianPrice)}
                            </span>
                          </>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Wycena z wypelniona marka i modelem — patrz WycenaAuta. */}
      <p className="-mt-4 mb-8 text-[13px] text-neutral-400">
        Masz {name}?{" "}
        <Link
          href={`/wycena-samochodu?marka=${encodeURIComponent(make)}&model=${slugify(model)}`}
          className="underline decoration-dotted underline-offset-2 hover:text-accent"
        >
          Wyceń swoje auto
        </Link>{" "}
        — po roczniku i przebiegu, na tych samych ofertach.
      </p>

      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-100">
            <TrendingDown size={17} className="text-emerald-400" />
            Oferty {name} — najlepsze okazje
          </h2>
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

      {/*
        Leasing (30.10.2026): 417 zapytan "<model> leasing" w Search Console trafialo
        na strony modeli z ~35. pozycji, choc slowo "leasing" nie padalo tu ani razu.
        Tresc bez zadnych liczb o warunkach — patrz LeasingLista.
      */}
      <section className="mb-8 max-w-[80ch]">
        <h2 className="mb-2 text-lg font-semibold text-neutral-100">{name} w leasingu</h2>
        <p className="mb-3 text-[14px] leading-relaxed text-neutral-400">
          Auta poleasingowe sprzedają głównie leasingodawcy, firmy flotowe i dealerzy, czyli
          sprzedawcy wystawiający fakturę. Dlatego {name} z tej listy można zwykle sfinansować
          leasingiem dla firm — tak samo jak nowy samochód, tylko przedmiotem leasingu jest
          konkretny egzemplarz używany.
        </p>
        <ul className="mb-4 list-disc space-y-1.5 pl-5 text-[14px] leading-relaxed text-neutral-400">
          <li>
            <strong className="font-medium text-neutral-300">Wiek auta.</strong> Leasingodawcy
            ograniczają wiek samochodu na koniec umowy, więc przy starszych rocznikach sprawdź ten
            limit, zanim wybierzesz długość umowy.
          </li>
          <li>
            <strong className="font-medium text-neutral-300">Faktura.</strong> Oferta z ceną netto
            oznacza fakturę VAT. Przy samej cenie brutto zapytaj sprzedawcę o formę sprzedaży.
          </li>
          <li>
            <strong className="font-medium text-neutral-300">Leasing czy kredyt.</strong> Leasing
            jest dla firm. Kupując prywatnie, zwykle bierze się{" "}
            <Link href="/poleasingowe/na-raty" className="text-accent hover:underline">
              kredyt samochodowy
            </Link>
            .
          </li>
        </ul>
        <LeasingLista
          etykieta={`model-${make}-${model}`.toLowerCase().replace(/[^a-z0-9]+/g, "-")}
          gdzie="model"
          tekst={`Kupujesz na firmę? Sprawdź leasing ${name}`}
        />
        <p className="text-[13px] text-neutral-500">
          Więcej:{" "}
          <Link href="/poleasingowe/w-leasingu" className="text-accent hover:underline">
            samochody poleasingowe w leasingu
          </Link>
          .
        </p>
      </section>

      {miasta.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-neutral-100">
            {make} poleasingowe w miastach
          </h2>
          <ul className="flex flex-wrap gap-2 text-[13px]">
            {miasta.map((m) => (
              <li key={m.citySlug}>
                <Link
                  href={makaMiastoHref(make, m.city)}
                  className="inline-block rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-1.5 text-neutral-300 transition-colors hover:border-neutral-600 hover:text-neutral-100"
                >
                  {make} poleasingowe {m.city}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <FaqBlok tytul={`${name} poleasingowe: najczęstsze pytania`} pytania={pytania} />

      {siblings.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-neutral-100">Inne modele {make}</h2>
          {/*
            Kafelki ze zdjeciem, nie same nazwy. "Seria 5" albo "X4 xDrive20d"
            nic nie mowi komus, kto wlasnie oglada X3 i zastanawia sie, co
            jeszcze wchodzi w gre — a zdjecie odpowiada na to od razu.
          */}
          <ModelGrid make={make} models={siblings} />
        </section>
      )}

      {(() => {
        const pary = paryModelu(make, model);
        if (pary.length === 0) return null;
        return (
          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-neutral-100">
              Porównaj {make} {model} z innymi
            </h2>
            <ul className="flex flex-wrap gap-2">
              {pary.map(({ para, drugi }) => (
                <li key={para.slug}>
                  <Link
                    href={`/porownaj/${para.slug}`}
                    className="rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2 text-[13px] text-neutral-200 transition-colors hover:border-accent/70 hover:text-accent"
                  >
                    {make} {model} czy {drugi}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })()}

      <ZapisPasek
        typ="model"
        tytul={`Powiadomić o nowych ${make} ${model}?`}
        opis={
          `Sprawdzamy 26 źródeł codziennie. Gdy pojawi się nowy ${make} ${model} — ` +
          "albo któryś z obecnych stanieje — dostaniesz maila."
        }
        label={`${make} ${model}`}
        filters={{ make, model }}
      />
    </main>
  );
}
