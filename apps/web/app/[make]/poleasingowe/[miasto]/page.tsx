import { Crumbs } from "@/components/Crumbs";
import { MarkaGrid } from "@/components/MarkaGrid";
import { OfferCard } from "@/components/OfferCard";
import { StatStrip } from "@/components/StatStrip";
import { ZapisPasek } from "@/components/ZapisPasek";
import { PROG_OFERT, zgrupujParyMarkaMiasto } from "@/lib/marka-miasto";
import {
  getCityMakes,
  getListings,
  getMakeCities,
  getMakeCityPairs,
  getMakeCityStats,
  getMakesWithCounts,
} from "@/lib/queries";
import { makeHref, resolveSlug, slugify } from "@/lib/slug";
import { Building2, MapPin, TrendingDown } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

/*
 * Odswiezanie RAZ NA DOBE, nie co godzine.
 *
 * Zaciag chodzi o 03:37, wiec czesciej nie ma czego przeliczac. Przy stronach
 * odswiezanych przez robota indeksujacego godzinny odswiez oznaczal
 * dwadziescia cztery razy wiecej zapytan, niz wynika ze zmian w danych — i to
 * on przekroczyl limit transferu Neona, zdejmujac caly serwis na trzy dni.
 */
export const revalidate = 86_400;

const pln = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("pl-PL");

/**
 * Strona krzyzowa marka x miasto: "BMW poleasingowe Warszawa".
 *
 * Do tej pory serwis na te fraze NIE ODPOWIADAL — strona marki nie filtruje po
 * miescie, strona miasta nie filtruje po marce. Prog pokrycia (patrz
 * lib/marka-miasto.ts) zostawia z pelnej krzyzowki 71 marek x ~200 miast tylko
 * pary z co najmniej 20 ofertami, zeby nie zrobic tysiecy stron przelotowych.
 */
async function resolve(makeSlug: string, miastoSlug: string) {
  const [makes, pary] = await Promise.all([getMakesWithCounts(), getMakeCityPairs()]);
  const make = resolveSlug(
    makes.map((m) => m.make),
    makeSlug,
  );
  if (!make) return null;

  const wszystkie = zgrupujParyMarkaMiasto(pary);
  const para = wszystkie.find((p) => p.make === make && p.citySlug === slugify(miastoSlug));
  if (!para) return null;

  return { make, para };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ make: string; miasto: string }>;
}): Promise<Metadata> {
  const { make: makeSlug, miasto: miastoSlug } = await params;
  const found = await resolve(makeSlug, miastoSlug);
  if (!found) return { title: "Nie znaleziono" };
  const { make, para } = found;

  const stats = await getMakeCityStats(make, para.cityWarianty);
  const title = `${make} poleasingowe ${para.city} — ${num.format(stats.total)} ofert`;
  const description =
    `${make} po leasingu w mieście ${para.city}: ${num.format(stats.total)} ofert z ` +
    `${stats.sources} źródeł` +
    (stats.minPrice ? `, ceny od ${pln.format(stats.minPrice)}` : "") +
    ". Aktualizowane codziennie, porównane z medianą rynkową.";

  return {
    title,
    description,
    alternates: { canonical: `${makeHref(make)}/poleasingowe/${para.citySlug}` },
    openGraph: { title, description, type: "website" },
  };
}

/**
 * Statyczne parametry dla par przekraczajacych prog — reszta idzie na 404.
 *
 * Bez tego "/bmw/poleasingowe/gdziekolwiek" renderowaloby sie za kazdym razem
 * od nowa i przy dowolnym slugu zwracaloby albo 404, albo (gorzej) puste
 * zestawienie bez notFound(), gdyby ktos pominal sprawdzenie progu gdzies
 * dalej w kodzie. Jawna lista jest tania — to jedno zapytanie raz na budowe.
 */
export async function generateStaticParams() {
  const pary = await getMakeCityPairs();
  return zgrupujParyMarkaMiasto(pary).map((p) => ({
    make: slugify(p.make),
    miasto: p.citySlug,
  }));
}

export default async function MarkaMiastoPage({
  params,
}: {
  params: Promise<{ make: string; miasto: string }>;
}) {
  const { make: makeSlug, miasto: miastoSlug } = await params;
  const found = await resolve(makeSlug, miastoSlug);
  if (!found) notFound();
  const { make, para } = found;

  const [stats, oferty, inneMiasta, inneMarki] = await Promise.all([
    getMakeCityStats(make, para.cityWarianty),
    getListings({ make, city: para.cityWarianty, sort: "deal_desc", withPrice: "1" }, 1, 24),
    getMakeCities(make),
    getCityMakes(para.cityWarianty),
  ]);

  if (stats.total === 0) notFound();

  const innychMiast = inneMiasta.filter((m) => slugify(m.city ?? "") !== para.citySlug);
  const innychMarek = inneMarki.filter((m) => m.make !== make);

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6">
      <Crumbs
        items={[
          { label: make, href: makeHref(make) },
          { label: `Poleasingowe ${para.city}` },
        ]}
      />

      <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight text-neutral-100">
        <MapPin size={22} className="text-neutral-600" />
        {make} poleasingowe — {para.city}
      </h1>
      <p className="mb-5 mt-1 max-w-[70ch] text-sm leading-relaxed text-neutral-400">
        {num.format(stats.total)} ofert {make} wystawionych w mieście {para.city}, zebranych z{" "}
        {stats.sources} źródeł: firm leasingowych, CFM i programów dealerskich.{" "}
        {num.format(stats.deals)} ofert co najmniej 10% poniżej mediany rynkowej dla tego samego
        rocznika, przebiegu i napędu.
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
          { label: "Poniżej rynku", value: num.format(stats.deals), hint: "co najmniej 10%" },
          { label: "Nowych dziś", value: num.format(stats.newToday) },
        ]}
      />

      {oferty.length > 0 && (
        <section className="mb-8">
          {/*
            BEZ linku "wszystkie z filtrami" do strony glownej.
            Wyszukiwarka na `/` NIE CZYTA parametru `city` z adresu — sprawdzone
            w app/page.tsx, ktorego `current` nie ma tego pola. Link do
            `/?make=X&city=Y` po cichu gubilby filtr miasta i pokazywal WSZYSTKIE
            BMW w Polsce pod przyciskiem obiecujacym BMW w Warszawie. Ta strona
            i tak jest juz widokiem "wszystkie X w Y" — link byleby zbedny.
          */}
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-neutral-100">
            <TrendingDown size={17} className="text-emerald-400" />
            Najlepsze okazje — {make} w {para.city}
          </h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
            {oferty.map((o, i) => (
              <OfferCard key={o.id} o={o} index={i} />
            ))}
          </div>
        </section>
      )}

      {innychMarek.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-neutral-100">
            <Building2 size={17} className="text-neutral-600" />
            Inne marki w mieście {para.city}
          </h2>
          <MarkaGrid marki={innychMarek} />
        </section>
      )}

      {innychMiast.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-neutral-100">
            {make} w innych miastach
          </h2>
          <ul className="flex flex-wrap gap-2">
            {innychMiast.map((m) => (
              <li key={m.city}>
                <Link
                  href={`${makeHref(make)}/poleasingowe/${slugify(m.city ?? "")}`}
                  className="flex items-baseline gap-1.5 rounded-lg border border-[var(--color-line)] px-2.5 py-1.5 text-[13px] text-neutral-300 transition-colors hover:border-accent/70 hover:text-accent"
                >
                  {m.city}
                  <span className="text-[11px] tabular-nums text-neutral-600">
                    {num.format(m.total)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ZapisPasek
        typ="marka-miasto"
        tytul={`Powiadomić o nowych ${make} w mieście ${para.city}?`}
        opis={`Gdy w którymkolwiek z ${stats.sources} źródeł pojawi się nowe ${make} w ${para.city}, dostaniesz maila. Jedna wiadomość dziennie, tylko gdy faktycznie coś doszło.`}
        label={`${make} — ${para.city}`}
        filters={{ make, city: para.city }}
      />
    </main>
  );
}
