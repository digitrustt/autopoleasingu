import { Crumbs } from "@/components/Crumbs";
import { FaqBlok, type PytanieFaq } from "@/components/FaqBlok";
import { LeasingLista } from "@/components/LeasingLista";
import { OfferCard } from "@/components/OfferCard";
import { RataLista } from "@/components/RataLista";
import { StatStrip } from "@/components/StatStrip";
import { ZapisPasek } from "@/components/ZapisPasek";
import { oferty } from "@/lib/format";
import { rozwiazModel } from "@/lib/model";
import {
  getListings,
  getRocznikMiesiace,
  getRocznikPrzebiegi,
  getRocznikSprzedane,
  getRocznikWersje,
  getYearBreakdown,
  getYearSold,
} from "@/lib/queries";
import { rocznikHref, rocznikOk } from "@/lib/roczniki";
import { makeHref, modelHref, slugify } from "@/lib/slug";
import { fuelSpec } from "@/lib/spec";
import { SlidersHorizontal } from "lucide-react";
import type { Metadata } from "next";
import Link from "@/components/Link";
import { notFound } from "next/navigation";

/* Raz na dobe — patrz komentarz w [make]/[model]/page.tsx. */
export const revalidate = 86_400;

/* Bez tego `revalidate` nie dziala na trasie z parametrem — patrz [make]/[model]/page.tsx. */
export async function generateStaticParams() {
  return [];
}

const pln = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("pl-PL");
const miesiacFmt = new Intl.DateTimeFormat("pl-PL", { month: "long", year: "numeric" });

const PRZEDZIALY = ["do 50 tys. km", "50–100 tys. km", "100–150 tys. km", "ponad 150 tys. km"];

/**
 * Wszystko, czego strona potrzebuje, w jednym miejscu — metadata i tresc licza
 * z tych samych liczb, wiec tytul nie moze obiecac ofert, ktorych nie ma.
 * Zwraca null, gdy rocznik nie przekracza progu: strona rocznika z kilkoma
 * ofertami bylaby powtorzeniem wiersza tabeli ze strony modelu.
 */
async function dane(makeSlug: string, modelSlug: string, rok: string) {
  if (!/^(19|20)\d{2}$/.test(rok)) return null;
  const year = Number(rok);
  const found = await rozwiazModel(makeSlug, modelSlug);
  if (!found) return null;
  const { make, model, aliasy } = found;

  const [years, sprzedane] = await Promise.all([
    getYearBreakdown(make, aliasy),
    getYearSold(make, aliasy),
  ]);
  const ten = years.find((y) => y.year === year);
  const tenSprzedane = sprzedane.find((s) => s.year === year);
  if (!rocznikOk(ten?.total ?? 0, tenSprzedane?.sold ?? 0)) return null;

  // Sasiednie roczniki z wlasna strona — linkowanie poziome w obrebie modelu.
  const inne = [...new Set([...years, ...sprzedane].map((r) => r.year as number))]
    .filter((y) => y !== year)
    .filter((y) =>
      rocznikOk(
        years.find((r) => r.year === y)?.total ?? 0,
        sprzedane.find((r) => r.year === y)?.sold ?? 0,
      ),
    )
    .sort((a, b) => b - a);

  return { make, model, aliasy, year, ten, tenSprzedane, inne };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ make: string; model: string; rok: string }>;
}): Promise<Metadata> {
  const { make: ms, model: mos, rok } = await params;
  const d = await dane(ms, mos, rok);
  if (!d) return { title: "Nie znaleziono rocznika" };
  const name = `${d.make} ${d.model} ${d.year}`;
  const n = d.ten?.total ?? 0;

  /*
   * Tytul pod zapytania "skoda octavia 2021", "octavia 2021 cena", "... przebieg"
   * — rocznik w tresci zapytania to cala roznica wobec strony modelu, ktora
   * celuje w "octavia poleasingowa".
   */
  const title =
    n > 0
      ? `${name} — ceny i przebiegi, ${num.format(n)} ${oferty(n)}${d.ten ? ` od ${pln.format(d.ten.minPrice)}` : ""}`
      : `${name} — ceny i przebiegi sprzedanych aut`;
  const description =
    `Ile kosztuje ${name}? ` +
    (d.ten ? `Mediana ceny ${pln.format(d.ten.medianPrice)}` : "") +
    (d.tenSprzedane && d.tenSprzedane.sold >= 3
      ? `${d.ten ? ", a" : "Auta"} sprzedane w ostatnich 180 dniach kosztowały typowo ${pln.format(d.tenSprzedane.soldMedian)}`
      : "") +
    ". Przebiegi, wersje silnikowe, zmiany cen i aktualne oferty po leasingu.";

  return {
    title,
    description,
    alternates: { canonical: rocznikHref(d.make, d.model, d.year) },
    openGraph: { title, description, type: "website" },
  };
}

export default async function RocznikPage({
  params,
}: {
  params: Promise<{ make: string; model: string; rok: string }>;
}) {
  const { make: ms, model: mos, rok } = await params;
  const d = await dane(ms, mos, rok);
  if (!d) notFound();
  const { make, model, aliasy, year, ten, tenSprzedane, inne } = d;
  const name = `${make} ${model} ${year}`;

  const [ofertyRocznika, miesiace, przebiegi, wersje, sprzedane] = await Promise.all([
    getListings({ make, model: aliasy, yearMin: year, yearMax: year, sort: "deal_desc" }, 1, 24),
    getRocznikMiesiace(make, aliasy, year),
    getRocznikPrzebiegi(make, aliasy, year),
    getRocznikWersje(make, aliasy, year),
    getRocznikSprzedane(make, aliasy, year),
  ]);

  // Miesiac z dwiema ofertami to nie trend — pokazujemy dopiero od trzech.
  const trend = miesiace.filter((m) => m.n >= 3);
  const soldOk = tenSprzedane && tenSprzedane.sold >= 3 ? tenSprzedane : null;
  const etykieta = `rok-${slugify(make)}-${slugify(model)}-${year}`;

  const ld = ten
    ? {
        "@context": "https://schema.org",
        "@type": "Product",
        name,
        brand: { "@type": "Brand", name: make },
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: "PLN",
          lowPrice: ten.minPrice,
          offerCount: ten.total,
          availability: "https://schema.org/InStock",
        },
      }
    : null;

  const najczestsza = wersje[0];
  const pytania: PytanieFaq[] = [
    ...(ten
      ? [
          {
            q: `Ile kosztuje ${name}?`,
            a:
              `Mediana ceny ${name} w ofertach „kup teraz” to ${pln.format(ten.medianPrice)}, ` +
              `najtańszy egzemplarz kosztuje ${pln.format(ten.minPrice)} ` +
              `(${num.format(ten.total)} ${oferty(ten.total)}).` +
              (soldOk
                ? ` Auta z tego rocznika, które zniknęły z ofert w ostatnich 180 dniach, ` +
                  `kosztowały typowo ${pln.format(soldOk.soldMedian)}.`
                : ""),
          },
        ]
      : []),
    ...(ten?.medianMileage != null
      ? [
          {
            q: `Jaki przebieg mają auta ${name}?`,
            a:
              `Mediana przebiegu to ${num.format(ten.medianMileage)} km.` +
              (przebiegi.length > 1
                ? " " +
                  przebiegi
                    .map((p) => `${PRZEDZIALY[p.przedzial]}: ${num.format(p.n)} szt.`)
                    .join(", ")
                : ""),
          },
        ]
      : []),
    ...(najczestsza
      ? [
          {
            q: `Jakie silniki ma ${name}?`,
            a:
              `Najwięcej ofert to ${fuelSpec(najczestsza.fuel)?.label ?? najczestsza.fuel ?? "wersja"} ` +
              `${najczestsza.powerHp} KM (${num.format(najczestsza.n)} szt., mediana ` +
              `${pln.format(najczestsza.mediana)}).`,
          },
        ]
      : []),
    {
      q: `${name} na raty albo w leasing — czy to możliwe?`,
      a:
        "Zwykle tak: osoba prywatna kredytem samochodowym, firma leasingiem. Warunki ustala " +
        "bank albo leasingodawca, więc ratę sprawdzisz u niego.",
      link: { href: "/poleasingowe/w-leasingu", tekst: "Auta poleasingowe w leasingu." },
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

      <Crumbs
        items={[
          { label: make, href: makeHref(make) },
          { label: model, href: modelHref(make, model) },
          { label: String(year) },
        ]}
      />

      <h1 className="text-2xl font-bold tracking-tight text-neutral-100">{name}</h1>
      <p className="mb-5 mt-1 max-w-[70ch] text-sm leading-relaxed text-neutral-400">
        {ten
          ? `${num.format(ten.total)} ${oferty(ten.total)} ${name} „kup teraz” od leasingodawców, firm flotowych i dealerów`
          : `Brak aktywnych ofert ${name} „kup teraz”`}
        {soldOk && `, a ${num.format(soldOk.sold)} kolejnych zniknęło z ofert w ostatnich 180 dniach`}.
        Poniżej: ile kosztuje ten rocznik, jak zmieniały się ceny, jakie są przebiegi i wersje
        silnikowe. Pozostałe roczniki porównasz na stronie{" "}
        <Link href={modelHref(make, model)} className="text-accent hover:underline">
          {make} {model} poleasingowe
        </Link>
        .
      </p>

      <RataLista etykieta={etykieta} />

      <StatStrip
        items={[
          { label: "Ofert", value: num.format(ten?.total ?? 0), hint: "„kup teraz”" },
          { label: "Mediana", value: ten ? pln.format(ten.medianPrice) : "—" },
          { label: "Najtaniej", value: ten ? pln.format(ten.minPrice) : "—" },
          {
            label: "Sprzedane",
            value: soldOk ? pln.format(soldOk.soldMedian) : "—",
            hint: soldOk ? `mediana, ${num.format(soldOk.sold)} szt. / 180 dni` : "za mało danych",
          },
          {
            label: "Przebieg",
            value: ten?.medianMileage != null ? `${num.format(ten.medianMileage)} km` : "—",
            hint: "mediana",
          },
        ]}
      />

      {ofertyRocznika.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-neutral-100">Oferty {name}</h2>
            <Link
              href={`/?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&yearMin=${year}&yearMax=${year}`}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-[13px] text-neutral-400 transition-colors hover:border-accent/70 hover:text-accent"
            >
              <SlidersHorizontal size={14} />
              Wszystkie z filtrami
            </Link>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
            {ofertyRocznika.map((o, i) => (
              <OfferCard key={o.id} o={o} index={i} />
            ))}
          </div>
        </section>
      )}

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        {trend.length >= 2 && (
          <section>
            <h2 className="mb-1 text-lg font-semibold text-neutral-100">Jak zmieniała się cena</h2>
            <p className="mb-3 text-[13px] text-neutral-500">
              Mediana ceny ofert {name}, które pojawiły się u nas w danym miesiącu (także tych,
              które już zniknęły). Pierwszy miesiąc obejmuje też oferty wystawione wcześniej.
            </p>
            <div className="overflow-x-auto rounded-xl border border-[var(--color-line)]">
              <table className="w-full min-w-[360px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-line)] text-left text-[11px] uppercase tracking-wide text-neutral-600">
                    <th className="px-4 py-2.5 font-medium">Miesiąc</th>
                    <th className="px-4 py-2.5 text-right font-medium">Ofert</th>
                    <th className="px-4 py-2.5 text-right font-medium">Mediana</th>
                  </tr>
                </thead>
                <tbody>
                  {trend.map((m) => (
                    <tr key={m.miesiac} className="border-b border-[var(--color-line)] last:border-0">
                      <td className="px-4 py-2.5 text-neutral-200">
                        {miesiacFmt.format(new Date(`${m.miesiac}-01T12:00:00`))}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-neutral-400">{num.format(m.n)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-neutral-100">
                        {pln.format(m.mediana)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {przebiegi.length > 0 && (
          <section>
            <h2 className="mb-1 text-lg font-semibold text-neutral-100">Przebieg a cena</h2>
            <p className="mb-3 text-[13px] text-neutral-500">
              Aktywne oferty {name} w przedziałach przebiegu.
            </p>
            <div className="overflow-x-auto rounded-xl border border-[var(--color-line)]">
              <table className="w-full min-w-[360px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-line)] text-left text-[11px] uppercase tracking-wide text-neutral-600">
                    <th className="px-4 py-2.5 font-medium">Przebieg</th>
                    <th className="px-4 py-2.5 text-right font-medium">Ofert</th>
                    <th className="px-4 py-2.5 text-right font-medium">Mediana</th>
                  </tr>
                </thead>
                <tbody>
                  {przebiegi.map((p) => (
                    <tr key={p.przedzial} className="border-b border-[var(--color-line)] last:border-0">
                      <td className="px-4 py-2.5 text-neutral-200">{PRZEDZIALY[p.przedzial]}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-neutral-400">{num.format(p.n)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-neutral-100">
                        {pln.format(p.mediana)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {wersje.length > 0 && (
          <section>
            <h2 className="mb-1 text-lg font-semibold text-neutral-100">Wersje silnikowe</h2>
            <p className="mb-3 text-[13px] text-neutral-500">
              Paliwo i moc z ofert, w których sprzedawca je podał.
            </p>
            <div className="overflow-x-auto rounded-xl border border-[var(--color-line)]">
              <table className="w-full min-w-[360px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-line)] text-left text-[11px] uppercase tracking-wide text-neutral-600">
                    <th className="px-4 py-2.5 font-medium">Wersja</th>
                    <th className="px-4 py-2.5 text-right font-medium">Ofert</th>
                    <th className="px-4 py-2.5 text-right font-medium">Mediana</th>
                  </tr>
                </thead>
                <tbody>
                  {wersje.map((w) => (
                    <tr
                      key={`${w.fuel}-${w.powerHp}`}
                      className="border-b border-[var(--color-line)] last:border-0"
                    >
                      <td className="px-4 py-2.5 text-neutral-200">
                        {fuelSpec(w.fuel)?.label ?? w.fuel ?? "—"} · {w.powerHp} KM
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-neutral-400">{num.format(w.n)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-neutral-100">
                        {pln.format(w.mediana)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {sprzedane.length > 0 && (
          <section>
            <h2 className="mb-1 text-lg font-semibold text-neutral-100">Ostatnio sprzedane</h2>
            <p className="mb-3 text-[13px] text-neutral-500">
              Oferty, które zniknęły w ostatnich 180 dniach — ostatnia cena i ile dni wisiały.
            </p>
            <div className="overflow-x-auto rounded-xl border border-[var(--color-line)]">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-line)] text-left text-[11px] uppercase tracking-wide text-neutral-600">
                    <th className="px-4 py-2.5 font-medium">Wersja</th>
                    <th className="px-4 py-2.5 text-right font-medium">Przebieg</th>
                    <th className="px-4 py-2.5 text-right font-medium">Cena</th>
                    <th className="px-4 py-2.5 text-right font-medium">Dni w ofercie</th>
                  </tr>
                </thead>
                <tbody>
                  {sprzedane.map((s, i) => (
                    <tr key={i} className="border-b border-[var(--color-line)] last:border-0">
                      <td className="max-w-[220px] truncate px-4 py-2.5 text-neutral-300">{s.trim ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-neutral-500">
                        {s.mileageKm != null ? `${num.format(s.mileageKm)} km` : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-neutral-100">
                        {s.priceGross != null ? pln.format(s.priceGross) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-neutral-500">{s.dni}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      <FaqBlok tytul={`${name}: najczęstsze pytania`} pytania={pytania} />

      <LeasingLista etykieta={etykieta} gdzie="rocznik" tekst={`Kupujesz na firmę? Sprawdź leasing ${make} ${model}`} />

      {inne.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-neutral-100">
            Inne roczniki {make} {model}
          </h2>
          <ul className="flex flex-wrap gap-2 text-[13px]">
            {inne.map((y) => (
              <li key={y}>
                <Link
                  href={rocznikHref(make, model, y)}
                  className="inline-block rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-1.5 text-neutral-300 transition-colors hover:border-neutral-600 hover:text-neutral-100"
                >
                  {make} {model} {y}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ZapisPasek
        typ="rocznik"
        tytul={`Powiadomić o nowych ${name}?`}
        opis="Sprawdzamy wszystkie źródła codziennie. Jeden mail dziennie, gdy pojawi się nowa oferta albo któraś stanieje."
        label={name}
        filters={{ make, model, yearMin: String(year), yearMax: String(year) }}
      />
    </main>
  );
}
