import { Crumbs } from "@/components/Crumbs";
import { DealBadge } from "@/components/DealBadge";
import { OfferLink } from "@/components/OfferLink";
import { PriceHistory } from "@/components/PriceHistory";
import { SimilarStrip } from "@/components/SimilarStrip";
import { MileagePrice } from "@/components/charts/MileagePrice";
import { PriceHistogram } from "@/components/charts/PriceHistogram";
import { shortSource } from "@/lib/format";
import {
  getListing,
  getPrices,
  getScatter,
  getSimilar,
  getYearBreakdown,
} from "@/lib/queries";
import { makeHref, modelHref } from "@/lib/slug";
import { bodySpec, driveSpec, fuelSpec, gearboxSpec } from "@/lib/spec";
import {
  ArrowUpRight,
  Banknote,
  Building2,
  Calendar,
  CalendarClock,
  ChartColumn,
  CircleSlash,
  Compass,
  Copy,
  Cylinder,
  Gauge,
  Gavel,
  History,
  ImageOff,
  MapPin,
  Palette,
  Store,
  Timer,
  Users,
  Zap,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

/*
 * Krotszy odswiez niz na stronach marki: tu liczy sie cena i to, czy oferta
 * jeszcze zyje, a jedno i drugie zmienia sie w ciagu doby.
 */
export const revalidate = 900;

const pln = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("pl-PL");
const day = new Intl.DateTimeFormat("pl-PL", { day: "2-digit", month: "short", year: "numeric" });

/** Polska odmiana: "1 dzien", "3 dni", "12 dni". */
function daysPl(n: number): string {
  return n === 1 ? "1 dzień" : `${n} dni`;
}

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const id = parseId((await params).id);
  const o = id ? await getListing(id) : null;
  if (!o) return { title: "Nie znaleziono oferty" };

  const name = [o.make, o.model, o.trim].filter(Boolean).join(" ");
  const title = `${name}${o.year ? ` (${o.year})` : ""}${
    o.priceGross ? ` — ${pln.format(o.priceGross)}` : ""
  }`;
  const description =
    `${name} po leasingu` +
    (o.mileageKm != null ? `, ${num.format(o.mileageKm)} km` : "") +
    (fuelSpec(o.fuel) ? `, ${fuelSpec(o.fuel)?.label}` : "") +
    `. Oferta z ${shortSource(o.sourceName)}` +
    (o.marketPrice ? `, mediana rynkowa ${pln.format(o.marketPrice)}.` : ".");

  return {
    title,
    description,
    alternates: { canonical: `/oferta/${o.id}` },
    /*
     * Oferta zniknieta zostaje dostepna dla czytelnika, ale nie ma po co
     * siedziec w indeksie — tresci juz nie ma, a link prowadzi donikad.
     */
    robots: o.status === "active" ? undefined : { index: false, follow: true },
    openGraph: { title, description, type: "website" },
  };
}

/**
 * Jedna pozycja tabeli danych technicznych.
 *
 * Pomijamy tez goly myslnik: czesc zrodel wpisuje "-" albo "—" tam, gdzie
 * pola po prostu nie podano, a przepisany wprost wyglada na dziure w danych.
 */
function Row({
  label,
  value,
  Icon,
}: {
  label: string;
  value: React.ReactNode;
  Icon?: typeof Gauge;
}) {
  if (value == null || value === "" || value === "-" || value === "—") return null;
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--color-line)] py-2 last:border-0">
      <dt className="flex items-center gap-2 text-[13px] text-neutral-500">
        {Icon && <Icon size={13} className="shrink-0 text-neutral-700" />}
        {label}
      </dt>
      <dd className="text-right text-[13px] font-medium text-neutral-200">{value}</dd>
    </div>
  );
}

export default async function OfferPage({ params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) notFound();

  const o = await getListing(id);
  if (!o) notFound();

  /*
   * Kontekst rynkowy tego egzemplarza. Trzy zapytania wiecej, ale to one
   * odrozniaja te strone od skopiowanego ogloszenia: pokazuja, gdzie ta
   * konkretna sztuka stoi wsrod pozostalych.
   */
  const [similar, prices, scatter, years] = await Promise.all([
    getSimilar(o),
    getPrices(o.make, o.model),
    getScatter(o.make, o.model),
    getYearBreakdown(o.make, o.model),
  ]);

  const sameYear = o.year ? years.find((y) => y.year === o.year) : undefined;
  const name = [o.make, o.model].filter(Boolean).join(" ");
  const isAuction = o.offerKind === "auction";
  const gone = o.status !== "active";

  // PriceHistory sam odsiewa punkty bez ceny — patrz components/PriceHistory.tsx.
  const points = o.history;

  // Blizniak wart pokazania to taki, ktory jest TANSZY i ma porownywalna cene.
  const cheaperTwin = o.twins.find(
    (t) =>
      t.offerKind !== "auction" &&
      t.priceGross != null &&
      o.priceGross != null &&
      t.priceGross < o.priceGross,
  );

  return (
    <main className="mx-auto max-w-[1100px] px-4 py-6">
      <Crumbs
        items={[
          { label: o.make, href: makeHref(o.make) },
          { label: o.model, href: modelHref(o.make, o.model) },
          { label: o.year ? `${o.year}` : "Oferta" },
        ]}
      />

      {gone && (
        /*
          Zniknieta oferta nie jest bledem 404 — adres mogl trafic do indeksu
          albo na czyjas liste. Mowimy wprost, co sie stalo, i kierujemy dalej.
        */
        <p className="mb-5 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
          <CircleSlash size={16} className="shrink-0" />
          Ta oferta zniknęła ze źródła
          {o.goneAt && ` ${day.format(o.goneAt)}`} — najpewniej auto zostało sprzedane. Podobne
          egzemplarze są niżej.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-100">
            {name} {o.year && <span className="text-neutral-500">{o.year}</span>}
          </h1>
          {o.trim && <p className="mt-0.5 text-sm text-neutral-400">{o.trim}</p>}

          <div className="mt-4 overflow-hidden rounded-xl border border-[var(--color-line)] bg-black/40">
            {o.thumbnailUrl ? (
              // Hot-link do zrodla — swiadomie zwykly <img>, patrz next.config.ts
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={o.thumbnailUrl}
                alt={`${name}${o.year ? ` ${o.year}` : ""}`}
                className="aspect-[4/3] w-full object-cover"
              />
            ) : (
              <div className="flex aspect-[4/3] flex-col items-center justify-center gap-1 text-neutral-700">
                <ImageOff size={22} />
                <span className="text-xs">brak zdjęcia</span>
              </div>
            )}
          </div>

          <section className="mt-6">
            <h2 className="mb-2 text-lg font-semibold text-neutral-100">Dane pojazdu</h2>
            <dl className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-1">
              <Row label="Rocznik" value={o.year} Icon={Calendar} />
              <Row
                label="Przebieg"
                value={o.mileageKm != null ? `${num.format(o.mileageKm)} km` : null}
                Icon={Gauge}
              />
              <Row label="Paliwo" value={fuelSpec(o.fuel)?.label} Icon={fuelSpec(o.fuel)?.Icon} />
              <Row
                label="Skrzynia"
                value={gearboxSpec(o.gearbox)?.label}
                Icon={gearboxSpec(o.gearbox)?.Icon}
              />
              <Row label="Napęd" value={driveSpec(o.drive)?.label} Icon={Compass} />
              <Row label="Moc" value={o.powerHp ? `${o.powerHp} KM` : null} Icon={Zap} />
              <Row
                label="Pojemność"
                value={o.engineCcm ? `${num.format(o.engineCcm)} cm³` : null}
                Icon={Cylinder}
              />
              <Row label="Nadwozie" value={o.body} Icon={bodySpec(o.body)?.Icon} />
              <Row label="Kolor" value={o.color} Icon={Palette} />
              <Row label="Miejsc" value={o.seats} Icon={Users} />
              <Row
                label="Pierwsza rejestracja"
                value={o.firstRegistrationAt ? day.format(o.firstRegistrationAt) : null}
                Icon={CalendarClock}
              />
              <Row
                label="VIN"
                value={
                  o.vin ? (
                    <Link
                      href={`/vin/${o.vin}`}
                      className="font-mono underline decoration-dotted underline-offset-2 hover:text-accent"
                    >
                      {o.vin}
                    </Link>
                  ) : null
                }
              />
              <Row label="Sprzedający" value={o.seller} Icon={Store} />
              <Row label="Lokalizacja" value={o.city} Icon={MapPin} />
              <Row label="Źródło" value={shortSource(o.sourceName)} Icon={Building2} />
              {/*
                Ile dni oferta jest w obrocie. To jedyna liczba na tej stronie,
                ktora mowi cos o SPRZEDAJACYM, a nie o aucie: im dluzej auto
                stoi, tym wieksza dzwignia w negocjacji.
              */}
              <Row
                label="W bazie od"
                value={`${day.format(o.firstSeenAt)} · ${daysPl(
                  Math.max(0, Math.round((Date.now() - o.firstSeenAt.getTime()) / 86_400_000)),
                )}`}
                Icon={History}
              />
            </dl>
          </section>

          {/*
            Pozycja tego egzemplarza na tle rynku. To jest ta czesc strony,
            ktorej NIE MA w ogloszeniu u zrodla: sprzedawca pokazuje swoja
            cene, ale nie powie, ze piecdziesiat innych sztuk tego modelu
            stoi taniej.
          */}
          {o.priceGross != null && o.offerKind !== "auction" && prices.length >= 6 && (
            <section className="mt-6">
              <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-neutral-100">
                <ChartColumn size={17} className="text-neutral-600" />
                Ta oferta na tle rynku
              </h2>
              <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
                <p className="mb-4 text-[13px] leading-relaxed text-neutral-400">
                  Rozkład cen {name} w całej bazie — {prices.length} ofert „kup teraz” z
                  wszystkich źródeł. Zielona kreska to ta sztuka.
                </p>
                <PriceHistogram prices={prices} marker={o.priceGross} />

                {sameYear && (
                  <div className="mt-4 border-t border-[var(--color-line)] pt-3">
                    <p className="text-[13px] leading-relaxed text-neutral-400">
                      Wszystkie wersje rocznika <span className="text-neutral-200">{o.year}</span>{" "}
                      mają medianę{" "}
                      <span className="font-medium text-neutral-200">
                        {pln.format(sameYear.medianPrice)}
                      </span>{" "}
                      przy {num.format(sameYear.total)} ofertach
                      {sameYear.medianMileage != null && (
                        <> i medianie przebiegu {num.format(sameYear.medianMileage)} km</>
                      )}
                      .{" "}
                      {o.priceGross < sameYear.medianPrice ? (
                        <span className="text-emerald-400">
                          Ta sztuka jest o {pln.format(sameYear.medianPrice - o.priceGross)} tańsza
                          od tej mediany.
                        </span>
                      ) : (
                        <span className="text-neutral-500">
                          Ta sztuka jest o {pln.format(o.priceGross - sameYear.medianPrice)} droższa
                          od tej mediany.
                        </span>
                      )}
                    </p>

                    {/*
                      Bez tego zdania strona sama sobie przeczy: plakietka mowi
                      "37% pod rynkiem", a akapit wyzej "drozsza od mediany
                      rocznika". Obie liczby sa poprawne, tylko licza co innego —
                      plakietka porownuje z autami o tym samym przebiegu, paliwie
                      i skrzyni, a mediana rocznika bierze WSZYSTKIE wersje,
                      lacznie z najtansza odmiana nadwozia i silnika.
                    */}
                    {o.dealScore != null && o.marketPrice != null && (
                      <p className="mt-2 text-[12px] leading-relaxed text-neutral-600">
                        Mediana rocznika obejmuje wszystkie wersje, także tańsze nadwozia i
                        słabsze silniki, więc bywa niższa od ceny konkretnego egzemplarza. Ocena
                        okazji obok liczona jest z węższego koszyka: to samo paliwo, skrzynia i
                        zbliżony przebieg.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}

          {scatter.length >= 6 && (
            <section className="mt-6">
              <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-neutral-100">
                <Gauge size={17} className="text-neutral-600" />
                Cena a przebieg w tym modelu
              </h2>
              <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
                <p className="mb-3 text-[13px] leading-relaxed text-neutral-400">
                  Każdy punkt to jedna oferta {name}. Ta sztuka jest zaznaczona na zielono —
                  jeśli leży pod linią trendu, jest tańsza, niż wynikałoby z jej przebiegu.
                </p>
                <MileagePrice points={scatter} highlight={o.id} />
              </div>
            </section>
          )}

          {points.filter((h) => h.priceGross != null).length > 1 && (
            <section className="mt-6">
              <h2 className="mb-2 text-lg font-semibold text-neutral-100">Historia ceny</h2>
              <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
                <PriceHistory points={points} />
              </div>
            </section>
          )}
        </div>

        {/* Kolumna decyzyjna: cena, ocena okazji i wyjscie do zrodla. */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
            <p className="text-3xl font-bold tabular-nums text-neutral-100">
              {o.priceGross != null ? (
                pln.format(o.priceGross)
              ) : (
                <span className="text-xl text-zinc-400">cena na zapytanie</span>
              )}
            </p>

            {o.priceGross == null ? (
              <p className="mt-1 text-[13px] text-zinc-500">
                Sprzedawca wystawia to auto wyłącznie w leasingu albo najmie.
              </p>
            ) : isAuction ? (
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[13px] text-violet-300">
                <Gavel size={14} />
                Aukcja — to bieżąca oferta w licytacji, nie cena zakupu.
                {o.auctionEndsAt && (
                  <span className="flex items-center gap-1 text-violet-200">
                    <Timer size={13} />
                    koniec {day.format(o.auctionEndsAt)}
                  </span>
                )}
              </p>
            ) : (
              o.priceNet != null && (
                <p className="mt-1 flex items-center gap-1.5 text-[13px] text-neutral-500">
                  <Banknote size={13} />
                  netto {pln.format(o.priceNet)}
                </p>
              )
            )}

            {o.dealScore != null && o.marketPrice != null && (
              <div className="mt-4 border-t border-[var(--color-line)] pt-4">
                <DealBadge score={o.dealScore} />
                <p className="mt-2 text-[13px] leading-relaxed text-neutral-400">
                  Mediana rynkowa dla tego rocznika, przedziału przebiegu, paliwa i skrzyni to{" "}
                  <span className="font-medium text-neutral-200">{pln.format(o.marketPrice)}</span>
                  , policzona z {o.dealSamples} porównywalnych ofert
                  {o.dealFromSold && " już sprzedanych"}.
                </p>
              </div>
            )}

            {o.twins.length > 0 && (
              /*
                Ten sam VIN u innego zrodla. Rozjazd cen miedzy kanalami siega
                kilkudziesieciu tysiecy i jest najmocniejszym sygnalem w bazie —
                dlatego nie scalamy takich ofert, tylko stawiamy obok siebie.
              */
              <div className="mt-4 border-t border-[var(--color-line)] pt-4">
                <p className="flex items-center gap-1.5 text-[13px] font-medium text-neutral-200">
                  <Copy size={13} />
                  Ta sama sztuka gdzie indziej
                </p>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {o.twins.map((t) => (
                    <li key={t.id} className="text-[13px]">
                      <Link
                        href={`/oferta/${t.id}`}
                        className="flex items-baseline justify-between gap-2 text-neutral-400 transition-colors hover:text-accent"
                      >
                        <span className="truncate">{shortSource(t.sourceName)}</span>
                        <span className="shrink-0 tabular-nums">
                          {t.priceGross != null ? pln.format(t.priceGross) : "—"}
                          {t.offerKind === "auction" && " (aukcja)"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {cheaperTwin && cheaperTwin.priceGross != null && o.priceGross != null && (
                  <p className="mt-2 text-[13px] text-emerald-400">
                    Taniej o {pln.format(o.priceGross - cheaperTwin.priceGross)} w{" "}
                    {shortSource(cheaperTwin.sourceName)}.
                  </p>
                )}
              </div>
            )}

            {/*
              Wyjscie do zrodla. Transakcja odbywa sie tam — nie sprzedajemy aut
              ani nie posredniczymy, wiec to musi byc jasne i widoczne.
            */}
            <OfferLink
              href={o.url}
              external
              offer={{
                id: o.id,
                make: o.make,
                model: o.model,
                year: o.year,
                price: o.priceGross,
                source: o.sourceName,
                dealScore: o.dealScore,
                kind: o.offerKind,
                z: "strona_oferty",
              }}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-black transition-colors hover:bg-white"
            >
              {gone ? "Sprawdź w źródle" : `Zobacz w ${shortSource(o.sourceName)}`}
              <ArrowUpRight size={15} />
            </OfferLink>
            <p className="mt-2 text-[11px] leading-relaxed text-neutral-600">
              Oferta i transakcja po stronie sprzedawcy. Nie pośredniczymy w sprzedaży.
            </p>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-[13px]">
            <Link
              href={modelHref(o.make, o.model)}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-neutral-400 transition-colors hover:border-accent/70 hover:text-accent"
            >
              <Gauge size={14} />
              Ceny {name} po roczniku
            </Link>
          </div>
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-semibold text-neutral-100">
            Podobne {name}
            {o.year && <span className="text-neutral-500"> z lat {o.year - 2}–{o.year + 2}</span>}
          </h2>
          <SimilarStrip rows={similar} />
        </section>
      )}
    </main>
  );
}
