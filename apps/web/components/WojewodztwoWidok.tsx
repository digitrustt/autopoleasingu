import { Crumbs } from "@/components/Crumbs";
import { MarkaGrid } from "@/components/MarkaGrid";
import { MiastaLista } from "@/components/MiastaLista";
import { OfferCard } from "@/components/OfferCard";
import { StatStrip } from "@/components/StatStrip";
import { shortSource } from "@/lib/format";
import {
  getCitiesWithCounts,
  getCityMakes,
  getCitySellers,
  getCityStats,
  getListings,
} from "@/lib/queries";
import { slugify } from "@/lib/slug";
import { WOJEWODZTWA, type Wojewodztwo, wojewodztwoMiejsca } from "@/lib/wojewodztwa";
import { Building2, Map as MapIcon, MapPin, TrendingDown } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

const pln = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("pl-PL");

/** Od ilu ofert miasto ma wlasna strone — ten sam prog co w /poleasingowe/[co]. */
const PROG_STRONY_MIASTA = 30;

/**
 * Miejsca z bazy nalezace do wojewodztwa — komplet pisowni do filtra oraz
 * lista miast scalona po slugu (tak jak na stronach miast).
 */
export async function miejscaWojewodztwa(w: Wojewodztwo) {
  // Prog 1: do regionu liczy sie kazde auto, takze z miejsca bez wlasnej strony.
  const wszystkie = await getCitiesWithCounts(1);
  const moje = wszystkie.filter((m) => m.city && wojewodztwoMiejsca(m.city)?.slug === w.slug);

  const miasta = new Map<string, { city: string; total: number }>();
  for (const m of moje) {
    const key = slugify(m.city ?? "");
    const juz = miasta.get(key);
    // Zapytanie sortuje malejaco, wiec pierwszy wariant jest dominujacy.
    if (juz) juz.total += m.total;
    else miasta.set(key, { city: m.city ?? "", total: m.total });
  }

  return {
    warianty: moje.map((m) => m.city).filter((c): c is string => c != null),
    miasta: [...miasta.entries()]
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.total - a.total),
  };
}

/**
 * Strona wojewodztwa — "auta poleasingowe dolnośląskie".
 *
 * Osobny widok, bo region to ani miasto, ani kategoria: nie ma jednej nazwy
 * w bazie, tylko zbior miejsc (patrz lib/wojewodztwa.ts), a jego najwazniejsza
 * trescia jest wlasnie lista tych miejsc z liczba aut.
 */
export async function WojewodztwoWidok({ w }: { w: Wojewodztwo }) {
  const { warianty, miasta } = await miejscaWojewodztwa(w);
  if (warianty.length === 0) notFound();

  const [stats, marki, sprzedawcy, oferty] = await Promise.all([
    getCityStats(warianty),
    getCityMakes(warianty),
    getCitySellers(warianty),
    getListings({ city: warianty, sort: "deal_desc", withPrice: "1" }, 1, 24),
  ]);
  if (stats.total === 0) notFound();

  /*
   * Link tylko do miast, ktore MAJA strone. Miejsce z kilkoma autami liczy sie
   * do regionu, ale jego adres dalby 404 — pokazujemy je wiec bez linku.
   */
  const zeStrona = miasta.filter((m) => m.total >= PROG_STRONY_MIASTA);
  const bezStrony = miasta.filter((m) => m.total < PROG_STRONY_MIASTA);

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6">
      <Crumbs items={[{ label: "Miasta i regiony", href: "/poleasingowe" }, { label: w.nazwa }]} />

      <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight text-neutral-100">
        <MapIcon size={22} className="text-neutral-600" />
        Samochody poleasingowe — województwo {w.nazwa}
      </h1>
      <p className="mb-5 mt-1 max-w-[70ch] text-sm leading-relaxed text-neutral-400">
        {num.format(stats.total)} aut poleasingowych wystawionych w województwie {w.wMiejscowniku},
        w {num.format(miasta.length)} {miasta.length === 1 ? "miejscu" : "miejscach"}, zebranych
        z {stats.sources} źródeł: firm leasingowych, CFM i programów dealerskich.{" "}
        {num.format(stats.makes)} marek, {num.format(stats.deals)} ofert poniżej mediany rynkowej.
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

      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-neutral-100">
          <MapPin size={17} className="text-neutral-600" />
          Gdzie stoją auta w województwie {w.wMiejscowniku}
        </h2>
        {zeStrona.length > 0 && (
          <MiastaLista
            miasta={zeStrona.map((m) => ({
              city: m.city,
              href: `/poleasingowe/${m.key}`,
              total: m.total,
            }))}
          />
        )}
        {bezStrony.length > 0 && (
          <p className="mt-3 max-w-[90ch] text-[13px] leading-relaxed text-neutral-500">
            Pojedyncze auta także w:{" "}
            {bezStrony.map((m) => `${m.city} (${num.format(m.total)})`).join(", ")}.
          </p>
        )}
      </section>

      {sprzedawcy.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-neutral-100">
            <Building2 size={17} className="text-neutral-600" />
            Kto wystawia auta w tym regionie
          </h2>
          <ul className="flex flex-wrap gap-2">
            {sprzedawcy.map((s) => (
              <li
                key={s.sourceName}
                className="flex items-baseline gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2 text-[13px] text-neutral-200"
              >
                {shortSource(s.sourceName)}
                <span className="text-[11px] tabular-nums text-neutral-600">
                  {num.format(s.total)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {marki.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-neutral-100">
            Marki dostępne w województwie {w.wMiejscowniku}
          </h2>
          <MarkaGrid marki={marki} />
        </section>
      )}

      {oferty.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-neutral-100">
            <TrendingDown size={17} className="text-emerald-400" />
            Najlepsze okazje — {w.nazwa}
          </h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
            {oferty.map((o, i) => (
              <OfferCard key={o.id} o={o} index={i} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-[13px] uppercase tracking-wide text-neutral-600">
          Inne województwa
        </h2>
        <ul className="flex flex-wrap gap-2">
          {WOJEWODZTWA.filter((x) => x.slug !== w.slug).map((x) => (
            <li key={x.slug}>
              <Link
                href={`/poleasingowe/${x.slug}`}
                className="rounded-lg border border-[var(--color-line)] px-2.5 py-1.5 text-[13px] text-neutral-300 transition-colors hover:border-accent/70 hover:text-accent"
              >
                {x.nazwa}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
