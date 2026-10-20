import { Crumbs } from "@/components/Crumbs";
import { HistoriaBlok } from "@/components/HistoriaBlok";
import { Faq, Sekcja, type Pytanie } from "@/components/Poradnik";
import { VinSzukaj } from "@/components/VinSzukaj";
import { wmiStaty } from "@/lib/cache-filtrow";
import { getVinMarka } from "@/lib/queries";
import { makeHref, slugify } from "@/lib/slug";
import { type Marka, OPIS_WERDYKTU, krajZVin, wgMarek, werdykt } from "@/lib/vin";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

/* Raz na dobe — dane zmieniaja sie tylko z porannym zaciagiem. */
export const revalidate = 86_400;

/*
 * Pusta lista: nic nie budujemy z gory, a kazdy adres trafia do cache'u po
 * pierwszym wejsciu. Bez tej funkcji `revalidate` na trasie z parametrem
 * nie dziala — patrz komentarz w app/[make]/page.tsx.
 */
export async function generateStaticParams() {
  return [];
}

const num = new Intl.NumberFormat("pl-PL");
const pln = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0,
});
const proc = (x: number) => `${Math.round(x * 100)}%`;
/** 2-4 oferty, 5+ ofert (ale 22-24 oferty). */
const oferty = (n: number) =>
  n % 10 >= 2 && n % 10 <= 4 && !(n % 100 >= 12 && n % 100 <= 14) ? "oferty" : "ofert";
const a = "underline decoration-dotted underline-offset-2 hover:text-accent";

/**
 * Marki z wiarygodnymi kodami producenta (patrz wgMarek: co najmniej 100
 * numerow). Inne adresy to 404 — strona bez danych bylaby tym samym
 * tekstem z podmieniona nazwa marki.
 */
async function znajdz(slug: string): Promise<Marka | null> {
  const marki = wgMarek(await wmiStaty());
  return marki.find((m) => slugify(m.make) === slug.toLowerCase()) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ make: string }>;
}): Promise<Metadata> {
  const { make: slug } = await params;
  const m = await znajdz(slug);
  if (!m) return {};
  return {
    title: `Sprawdź VIN ${m.make} — dekoder, rok produkcji i historia auta`,
    description:
      `Jak odczytać VIN ${m.make}: kody producenta, kraj i czy 10. znak naprawdę oznacza rok — ` +
      `sprawdzone na ${num.format(m.n)} numerach. Plus egzemplarze ${m.make} wystawione u kilku sprzedawców naraz.`,
    alternates: { canonical: `/vin/marka/${slugify(m.make)}` },
  };
}

/**
 * "Sprawdz VIN BMW", "dekoder VIN Toyota", "historia BMW po VIN".
 *
 * Kazda strona stoi na danych, ktorych zwykle dekodery nie maja: kody
 * producenta tej marki z naszej bazy, zmierzone, czy 10. znak to rok, i lista
 * tych samych aut wystawionych w kilku miejscach po roznych cenach. Nie
 * dopisywac tresci "o marce" bez pokrycia w danych — wtedy to szablon.
 */
export default async function VinMarki({ params }: { params: Promise<{ make: string }> }) {
  const { make: slug } = await params;
  const m = await znajdz(slug);
  if (!m) notFound();
  const dane = await getVinMarka(m.make);

  const rokZdanie =
    m.werdykt === "zapisuje"
      ? `U ${m.make} 10. znak VIN-u oznacza rok modelowy — na ${num.format(m.n)} numerach z naszej bazy zgadza się z rocznikiem w ${proc(m.zgodnosc)} przypadków (czasem rok modelowy jest o jeden późniejszy, to normalne).`
      : m.werdykt === "nie-zapisuje"
        ? `U ${m.make} roku z VIN-u nie odczytasz. Standardowa tabelka kodów trafia w rocznik tylko w ${proc(m.zgodnosc)} z ${num.format(m.n)} numerów z naszej bazy — ten producent zapisuje w 10. znaku coś innego. Rocznik sprawdź w dowodzie rejestracyjnym.`
        : m.werdykt === "nie-zawsze"
          ? `U ${m.make} rok z 10. znaku zgadza się w ${proc(m.zgodnosc)} z ${num.format(m.n)} numerów — część modeli stosuje zapis, część nie. Traktuj go jako wskazówkę, nie dowód.`
          : `U ${m.make} zależy to od fabryki, czyli od pierwszych trzech znaków numeru — szczegóły w tabeli niżej.`;

  const pytania: Pytanie[] = [
    {
      q: `Jak sprawdzić VIN ${m.make}?`,
      a:
        `Wpisz 17-znakowy numer w wyszukiwarkę na tej stronie. Pokażemy, co wynika z samego numeru, ` +
        `a jeśli to auto było w ofertach poleasingowych — wszystkie jego wystawienia i historię ceny. ` +
        `Szkody, przebiegi i kradzieże pokazuje płatny raport carVertical.`,
    },
    { q: `Czy z VIN ${m.make} odczytam rok produkcji?`, a: rokZdanie },
    {
      q: `Jakie kody producenta ma ${m.make}?`,
      a:
        `W naszej bazie numery ${m.make} zaczynają się od: ${m.kody.map((k) => k.wmi).join(", ")}. ` +
        "Różne kody to zwykle różne fabryki albo rynki.",
    },
  ];

  return (
    <main className="mx-auto max-w-[860px] px-4 py-6">
      <Crumbs items={[{ label: "Sprawdź VIN", href: "/vin" }, { label: m.make }]} />

      <h1 className="mb-2 text-2xl font-bold tracking-tight text-neutral-100">Sprawdź VIN {m.make}</h1>
      <p className="mb-5 max-w-[72ch] text-[15px] leading-relaxed text-neutral-400">
        Mamy {num.format(dane.wszystkie)} numerów VIN aut {m.make} z ofert poleasingowych, w tym{" "}
        {num.format(dane.aktywne)} w aktualnych ogłoszeniach. Wpisz numer — sprawdzimy, czy to auto
        stoi gdzieś taniej, i odczytamy, co mówi sam VIN.
      </p>

      <div className="mb-6">
        <VinSzukaj />
      </div>

      <HistoriaBlok vin={null} gdzie="vin-marka" wariant="duzy" nazwa={m.make} />

      <div className="mt-8">
        <Sekcja tytul={`Jak odczytać VIN ${m.make}`}>
          <p>
            Pierwsze trzy znaki to kod producenta (WMI), znaki 4–9 opisują model i wersję, 10. to rok
            modelowy, 11. fabryka, a ostatnie sześć — numer seryjny.
          </p>
          <p>{rokZdanie}</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-[13px]">
              <thead className="text-neutral-500">
                <tr className="border-b border-[var(--color-line)]">
                  <th className="py-2 pr-3 font-medium">Kod producenta</th>
                  <th className="py-2 pr-3 font-medium">Kraj kodu</th>
                  <th className="py-2 pr-3 text-right font-medium">Numerów</th>
                  <th className="py-2 font-medium">Rok z 10. znaku</th>
                </tr>
              </thead>
              <tbody>
                {m.kody.map((k) => {
                  const w = OPIS_WERDYKTU[werdykt(k.zgodnosc)];
                  return (
                    <tr key={k.wmi} className="border-b border-[var(--color-line)]/60">
                      <td className="py-2 pr-3 font-mono text-neutral-200">{k.wmi}</td>
                      <td className="py-2 pr-3 text-neutral-400">{krajZVin(k.wmi) ?? "—"}</td>
                      <td className="py-2 pr-3 text-right text-neutral-400">{num.format(k.n)}</td>
                      <td className={`py-2 ${w.kolor}`}>
                        {w.tekst} <span className="text-neutral-500">({proc(k.zgodnosc)})</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[13px] text-neutral-500">
            Więcej o kodach roku i markach, u których to nie działa:{" "}
            <Link href="/poradnik/rok-produkcji-z-vin" className={a}>
              jak odczytać rok produkcji z VIN
            </Link>
            .
          </p>
        </Sekcja>

        {dane.blizniaki.length > 0 && (
          <Sekcja tytul={`Ten sam ${m.make} u kilku sprzedawców`}>
            <p>
              {num.format(dane.ileBlizniakow)} egzemplarzy {m.make} stoi teraz w więcej niż jednym
              miejscu naraz — z tym samym numerem VIN, często po różnych cenach. Największe różnice:
            </p>
            <ul className="flex flex-col divide-y divide-[var(--color-line)] rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)]">
              {dane.blizniaki.map((b) => (
                <li key={b.vin}>
                  <Link
                    href={`/vin/${b.vin}`}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-[14px] transition-colors hover:bg-[var(--color-ink)]"
                  >
                    <span className="text-neutral-200">
                      {m.make} {b.model}
                      {b.year ? ` · ${b.year}` : ""}
                      <span className="ml-2 font-mono text-[12px] text-neutral-500">{b.vin}</span>
                    </span>
                    <span className="text-[13px] text-neutral-400">
                      {b.miejsc} {oferty(b.miejsc)}
                      {b.roznica != null && b.roznica > 0 && (
                        <span className="ml-2 text-emerald-400">różnica {pln.format(b.roznica)}</span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Sekcja>
        )}

        <Faq pytania={pytania} />

        <p className="text-[14px] text-neutral-400">
          Zobacz też:{" "}
          <Link href={makeHref(m.make)} className={a}>
            {m.make} poleasingowe — aktualne oferty
          </Link>{" "}
          ·{" "}
          <Link href="/vin" className={a}>
            sprawdź VIN dowolnej marki
          </Link>
        </p>
      </div>
    </main>
  );
}
