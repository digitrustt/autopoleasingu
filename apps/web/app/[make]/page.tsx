import { Crumbs } from "@/components/Crumbs";
import { ModelGrid } from "@/components/ModelGrid";
import { FaqBlok, type PytanieFaq } from "@/components/FaqBlok";
import { OfferCard } from "@/components/OfferCard";
import { RataLista } from "@/components/RataLista";
import { ZapisPasek } from "@/components/ZapisPasek";
import { StatStrip } from "@/components/StatStrip";
import {
  getBodyBreakdown,
  getListings,
  getMakesWithCounts,
  getModelCards,
  getSegmentStats,
} from "@/lib/queries";
import { modelHref, resolveSlug, slugify } from "@/lib/slug";
import { bodySpec } from "@/lib/spec";
import { Layers, SlidersHorizontal, TrendingDown } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { oferty, zrodel } from "@/lib/format";
import { paryMarkaMiastoLiczniki, wmiStaty } from "@/lib/cache-filtrow";
import { makaMiastoHref } from "@/lib/marka-miasto";
import { paryMarki } from "@/lib/pary";
import { miejsceOk } from "@/lib/smiec";
import { vinMarkiHref, wgMarek } from "@/lib/vin";

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

/**
 * Ile modeli dostaje kafelek ze zdjeciem.
 *
 * BMW ma w bazie 335 nazw modeli — wiekszosc to pojedyncze warianty zapisu
 * ("X3 20d", "X3 xDrive20d"). Kafelki dla wszystkich zrobilyby z tej strony
 * scianę trzystu zdjec, po ktorej nie da sie przewijac, wiec ogon idzie na
 * liste tekstowa nizej; dla robota indeksujacego jeden i drugi link waza tyle
 * samo. Prog jest ustawiony tak, zeby zdjecie dostalo wszystko, co ma wiecej
 * niz kilkanascie sztuk w bazie.
 */
const CARDS = 48;

const pln = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("pl-PL");

async function resolve(slug: string) {
  const makes = await getMakesWithCounts();
  const make = resolveSlug(makes.map((m) => m.make), slug);
  return make ? { make, makes } : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ make: string }>;
}): Promise<Metadata> {
  const { make: slug } = await params;
  const found = await resolve(slug);
  if (!found) return { title: "Nie znaleziono marki" };

  const stats = await getSegmentStats(found.make);
  /* Cena w tytule: to ona decyduje o kliknieciu, nie liczba ofert. */
  /*
   * "POLEASINGOWE", NIE TYLKO "PO LEASINGU" (22.10.2026). Search Console:
   * "bmw poleasingowe" poz. 23, "toyota poleasingowe" 20, "bmw x3 poleasingowe"
   * 25, "skoda superb poleasingowa" 46 — sedno niszy, a tytuly mialy tylko
   * "po leasingu". W polskim Google forma slowa ma znaczenie; tytul niesie
   * teraz obie.
   */
  const title =
    `${found.make} poleasingowe — ${num.format(stats.total)} ${oferty(stats.total)} po leasingu` +
    (stats.minPrice ? ` od ${pln.format(stats.minPrice)}` : "");
  const description =
    `Aktualne oferty ${found.make} poleasingowych z ${stats.sources} ${zrodel(stats.sources)}: ` +
    (stats.medianPrice ? `mediana ${pln.format(stats.medianPrice)}, ` : "") +
    `${num.format(stats.deals)} ${oferty(stats.deals)} poniżej ceny rynkowej. Aktualizowane codziennie.`;

  return {
    title,
    description,
    alternates: { canonical: `/${slugify(found.make)}` },
    openGraph: { title, description, type: "website" },
  };
}

export default async function MakePage({ params }: { params: Promise<{ make: string }> }) {
  const { make: slug } = await params;
  const found = await resolve(slug);
  if (!found) notFound();
  const { make } = found;

  const [stats, models, bodies, best, staty, liczniki] = await Promise.all([
    getSegmentStats(make),
    getModelCards(make),
    getBodyBreakdown(make),
    // Najlepsze okazje marki — to one maja sprzedac te strone czytelnikowi.
    getListings({ make, sort: "deal_desc", withPrice: "1" }, 1, 12),
    wmiStaty(),
    paryMarkaMiastoLiczniki(),
  ]);

  if (stats.total === 0) notFound();
  // Strona VIN tej marki istnieje tylko, gdy mamy dosc numerow — patrz wgMarek.
  const maVin = wgMarek(staty).some((m) => m.make === make);

  const featured = models.slice(0, CARDS);
  const rest = models.slice(CARDS);

  /*
   * Linki do stron marka x miasto i do porownan (28.10.2026). Strona marki nie
   * linkowala do zadnej z nich, a Search Console (29.10) pokazal 521 stron
   * "wykrytych, ale niezindeksowanych", m.in. wlasnie te. Strona marki to
   * naturalne miejsce: to ona wie, w jakich miastach marka ma co najmniej
   * prog ofert (PROG_OFERT) i jakie porownania istnieja.
   */
  const miasta = liczniki.filter((m) => m.make === make && miejsceOk(m.city)).slice(0, 12);
  const porownania = paryMarki(make, 8);

  const top = models.slice(0, 3);
  const pytania: PytanieFaq[] = [
    ...(stats.medianPrice
      ? [
          {
            q: `Ile kosztuje ${make} po leasingu?`,
            a:
              `Mediana cen ${make} poleasingowych w naszej bazie to ${pln.format(stats.medianPrice)}` +
              (stats.minPrice ? `, a najtańszy egzemplarz kosztuje ${pln.format(stats.minPrice)}` : "") +
              ". Cena zależy od modelu, rocznika i przebiegu, więc najlepiej porównać ją z medianą " +
              "dla konkretnego modelu na jego stronie.",
          },
        ]
      : []),
    ...(top.length > 0
      ? [
          {
            q: `Których modeli ${make} jest najwięcej po leasingu?`,
            a:
              `Najwięcej ofert mamy dla: ${top.map((m) => `${m.model} (${num.format(m.total)})`).join(", ")}. ` +
              `W sumie to ${num.format(models.length)} ${models.length === 1 ? "wersja modelu" : "wersji modeli"}.`,
          },
        ]
      : []),
    {
      q: `Gdzie kupić ${make} poleasingowy?`,
      a:
        `W naszej bazie jest ${num.format(stats.total)} ${oferty(stats.total)} ${make} z ` +
        `${stats.sources} ${zrodel(stats.sources)}: od firm leasingowych, CFM i w programach ` +
        "dealerskich. Każda oferta prowadzi do sprzedawcy, u którego dokonujesz zakupu. My " +
        "pokazujemy ceny, historię zmian ceny i to, czy ten sam VIN jest u kilku sprzedawców.",
      link: { href: "/zrodla", tekst: "Lista źródeł." },
    },
    {
      q: `Czy ${make} poleasingowy można kupić na raty?`,
      a:
        "Zwykle tak, kredytem samochodowym. Warunki zależą od banku, od sprzedawcy i od twojej " +
        "zdolności kredytowej, więc ratę sprawdzisz u kredytodawcy.",
      link: { href: "/poleasingowe/na-raty", tekst: "Więcej o zakupie na raty." },
    },
  ];

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6">
      <Crumbs items={[{ label: make }]} />

      <h1 className="text-2xl font-bold tracking-tight text-neutral-100">{make} poleasingowe</h1>
      <p className="mb-5 mt-1 max-w-[70ch] text-sm leading-relaxed text-neutral-400">
        {num.format(stats.total)} aktywnych ofert {make} z {stats.sources} źródeł poleasingowych —
        firm leasingowych, CFM i programów dealerskich. Ceny porównujemy z medianą rynkową dla
        tego samego rocznika, przebiegu i napędu, więc {num.format(stats.deals)} z nich stoi
        wyraźnie poniżej rynku.
      </p>

      <RataLista etykieta={`marka-${slugify(make)}`} />

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

      {bodies.length > 1 && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-neutral-100">
            <Layers size={17} className="text-neutral-600" />
            Nadwozia
          </h2>
          <ul className="flex flex-wrap gap-2">
            {bodies.map((b) => {
              const spec = bodySpec(b.body);
              return (
                <li
                  key={b.body}
                  className="flex items-center gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2"
                >
                  {spec && <spec.Icon size={15} className="shrink-0 text-neutral-600" />}
                  <span className="text-[13px] text-neutral-200">{b.body}</span>
                  <span className="text-[11px] tabular-nums text-neutral-600">
                    {num.format(b.total)}
                    {b.medianPrice != null && ` · ${pln.format(b.medianPrice)}`}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-neutral-100">Modele {make}</h2>
        {/*
          Kafelki modeli to glowny szkielet linkowania wewnetrznego serwisu —
          bez nich strony modeli nie mialyby zadnej drogi dojscia.
        */}
        <ModelGrid make={make} models={featured} />

        {rest.length > 0 && (
          <>
            <h3 className="mb-2 mt-5 text-[13px] uppercase tracking-wide text-neutral-600">
              Pozostałe wersje ({num.format(rest.length)})
            </h3>
            <ul className="flex flex-wrap gap-2">
              {rest.map((m) => (
                <li key={m.model}>
                  <Link
                    href={modelHref(make, m.model)}
                    className="flex items-baseline gap-1.5 rounded-lg border border-[var(--color-line)] px-2.5 py-1.5 text-[13px] text-neutral-300 transition-colors hover:border-accent/70 hover:text-accent"
                  >
                    {m.model}
                    <span className="text-[11px] tabular-nums text-neutral-600">{m.total}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {best.length > 0 && (
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-100">
              <TrendingDown size={17} className="text-emerald-400" />
              Najlepsze okazje — {make}
            </h2>
            <Link
              href={`/?make=${encodeURIComponent(make)}`}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-[13px] text-neutral-400 transition-colors hover:border-accent/70 hover:text-accent"
            >
              <SlidersHorizontal size={14} />
              Wszystkie oferty z filtrami
            </Link>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
            {best.map((o, i) => (
              <OfferCard key={o.id} o={o} index={i} />
            ))}
          </div>
        </section>
      )}

      {miasta.length > 0 && (
        <section className="mt-10">
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
                  {make} poleasingowe {m.city}{" "}
                  <span className="text-[11px] tabular-nums text-neutral-600">{num.format(m.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {porownania.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-semibold text-neutral-100">Porównaj modele {make}</h2>
          <ul className="flex flex-wrap gap-2 text-[13px]">
            {porownania.map((pa) => (
              <li key={pa.slug}>
                <Link
                  href={`/porownaj/${pa.slug}`}
                  className="inline-block rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-1.5 text-neutral-300 transition-colors hover:border-neutral-600 hover:text-neutral-100"
                >
                  {pa.a.make} {pa.a.model} czy {pa.b.make} {pa.b.model}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-10">
        <FaqBlok tytul={`${make} poleasingowe: najczęstsze pytania`} pytania={pytania} />
      </div>

      <ZapisPasek
        typ="marka"
        tytul={`Powiadomić o nowych ${make}?`}
        opis={
          `Sprawdzamy ${stats.sources} ${zrodel(stats.sources)} codziennie. Gdy pojawi się nowy ${make} ` +
          "albo któryś z obecnych stanieje, dostaniesz maila."
        }
        label={make}
        filters={{ make }}
      />

      {maVin && (
        <p className="mt-8 text-[13px] text-neutral-400">
          Masz numer nadwozia?{" "}
          <Link
            href={vinMarkiHref(make)}
            className="underline decoration-dotted underline-offset-2 hover:text-accent"
          >
            Sprawdź VIN {make}
          </Link>{" "}
          — kody producenta, rok z numeru i te same auta u kilku sprzedawców.
        </p>
      )}
    </main>
  );
}
