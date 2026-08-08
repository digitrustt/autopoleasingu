import { Crumbs } from "@/components/Crumbs";
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
  getMakesWithCounts,
  getModelCards,
  getModelsWithCounts,
  getPrices,
  getScatter,
  getSegmentStats,
  getYearBreakdown,
} from "@/lib/queries";
import { makeHref, modelHref, modelKey, resolveAliases, resolveSlug, slugify } from "@/lib/slug";
import { bodySpec, fuelSpec } from "@/lib/spec";
import { CalendarRange, Gauge, Layers, SlidersHorizontal, TrendingDown } from "lucide-react";
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

/** Slug -> nazwy z bazy. Model rozwiazujemy dopiero w obrebie znalezionej marki. */
async function resolve(makeSlug: string, modelSlug: string) {
  const makes = await getMakesWithCounts();
  const make = resolveSlug(makes.map((m) => m.make), makeSlug);
  if (!make) return null;

  const models = await getModelCards(make);
  /*
   * Szukamy po kluczu bez separatorow, nie po dokladnym slugu. Inaczej
   * `/volvo/xc-60` znajdowalby wariant "XC 60" i uznawal WLASNY adres za
   * kanoniczny — czyli dwie strony jednego auta zostawalyby na zawsze.
   * `getModelCards` zwraca warianty posortowane malejaco po liczbie ofert,
   * wiec pierwszy pasujacy jest tym dominujacym.
   */
  const klucz = modelKey(modelSlug);
  const model = models.find((m) => modelKey(m.model) === klucz)?.model;
  if (!model) return null;

  /*
   * Do FILTROWANIA bierzemy komplet pisowni, nie samą nazwę z kafelka.
   * `getModelCards` scala warianty, ale zwraca tylko nazwe dominujaca —
   * a w bazie oferty siedza pod wszystkimi ("XC60", "XC 60", "Xc-60").
   * Bez tego strona `/volvo/xc-60` pokazywala ulamek ofert.
   */
  const surowe = await getModelsWithCounts(make);
  const aliasy = resolveAliases(surowe.map((m) => m.model), modelSlug);

  /*
   * Adres kanoniczny to pisownia o NAJWIEKSZEJ liczbie ofert — `getModelCards`
   * zwraca warianty posortowane malejaco, wiec `model` juz nia jest.
   *
   * Wejscie pod innym slugiem tej samej grupy (`/volvo/xc-60` zamiast
   * `/volvo/xc60`) renderuje te sama, scalona strone i wskazuje kanoniczny
   * przez <link rel="canonical"> w generateMetadata. Przekierowania 308 tu
   * NIE MA swiadomie: `permanentRedirect` w tej wersji Next nie ustawia
   * statusu odpowiedzi — dokladnie tak samo jak `notFound()`, ktory zwraca
   * 200 zamiast 404. Sprawdzone: strona wychodzila z kodem 200 i pustym
   * naglowkiem Location. Canonical jest mechanizmem, ktorym Google i tak
   * scala duplikaty, wiec zostaje jako jedyny — zamiast martwego wywolania,
   * ktore wyglada, jakby dzialalo.
   */
  return { make, model, models, aliasy: aliasy.length > 0 ? aliasy : [model] };
}

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
  const { make, model, models, aliasy } = found;

  const name = `${make} ${model}`;

  const [stats, years, fuels, bodies, prices, scatter, offers] = await Promise.all([
    getSegmentStats(make, aliasy),
    getYearBreakdown(make, aliasy),
    getFuelBreakdown(make, aliasy),
    getBodyBreakdown(make, aliasy),
    getPrices(make, aliasy),
    getScatter(make, aliasy),
    getListings({ make, model: aliasy, sort: "deal_desc" }, 1, 24),
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
          <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-neutral-100">
            <CalendarRange size={17} className="text-neutral-600" />
            Ile kosztuje {name} według rocznika
          </h2>
          <p className="mb-3 text-[13px] text-neutral-500">
            Mediana i cena minimalna liczone wyłącznie z ofert „kup teraz”. Ceny aukcyjne są
            bieżącą ofertą w licytacji i jeszcze urosną, więc nie wchodzą do tych zestawień.
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
          </div>
        </section>
      )}

      {(prices.length >= 6 || scatter.length >= 6) && (
        <section className="mb-8 grid gap-4 lg:grid-cols-2">
          {prices.length >= 6 && (
            <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
              <h2 className="text-lg font-semibold text-neutral-100">Rozkład cen</h2>
              <p className="mb-4 text-[13px] leading-relaxed text-neutral-500">
                Sama mediana nie mówi, czy rynek jest jednolity. Tu widać, czy oferty skupiają
                się wokół jednej ceny, czy rozpadają na dwie grupy.
              </p>
              <PriceHistogram prices={prices} />
            </div>
          )}

          {scatter.length >= 6 && (
            <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-100">
                <Gauge size={17} className="text-neutral-600" />
                Cena a przebieg
              </h2>
              <p className="mb-4 text-[13px] leading-relaxed text-neutral-500">
                Ile realnie kosztuje każde dziesięć tysięcy kilometrów na tym modelu — czyli czy
                opłaca się dopłacić za mniejszy przebieg.
              </p>
              <MileagePrice points={scatter} />
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

    </main>
  );
}
