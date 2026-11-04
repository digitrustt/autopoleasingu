import { Crumbs } from "@/components/Crumbs";
import { LeasingLista } from "@/components/LeasingLista";
import { OfferCard } from "@/components/OfferCard";
import { ZapisPasek } from "@/components/ZapisPasek";
import { getMenuData } from "@/lib/menu";
import { getFilterStats, getListings } from "@/lib/queries";
import { makeHref } from "@/lib/slug";
import { Briefcase } from "lucide-react";
import type { Metadata } from "next";
import Link from "@/components/Link";
import { connection } from "next/server";

/* Raz na dobe i dopiero na zadanie — patrz komentarz w analizy/utrata-wartosci. */
export const revalidate = 86_400;

const pln = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("pl-PL");

export const metadata: Metadata = {
  title: "Samochody poleasingowe w leasingu — leasing auta używanego dla firm",
  description:
    "Czy auto poleasingowe można wziąć w leasing? Zwykle tak. Wyjaśniamy, jak wygląda leasing " +
    "samochodu używanego, czym różni się leasing operacyjny od finansowego i kredytu, " +
    "a poniżej pokazujemy oferty z fakturą VAT.",
  alternates: { canonical: "/poleasingowe/w-leasingu" },
};

/*
 * Ta sama tresc idzie na strone i do danych strukturalnych.
 *
 * Bez liczb o warunkach (wklad, okres, oprocentowanie, wiek auta w latach) z tych
 * samych powodow co na stronie "na raty": nie obiecujemy niczego w imieniu
 * leasingodawcy, a warunki roznia sie miedzy firmami. Podatki opisujemy tylko
 * ogolnie i odsylamy do ksiegowego — to nie jest porada podatkowa.
 */
const FAQ: { q: string; a: string }[] = [
  {
    q: "Czy samochód poleasingowy można wziąć w leasing?",
    a:
      "Zwykle tak. Leasingodawcy finansują nie tylko nowe auta, ale też używane, a auta " +
      "poleasingowe sprzedają głównie firmy: leasingodawcy, floty i dealerzy. Warunki, " +
      "w tym dopuszczalny wiek samochodu na koniec umowy, ustala konkretny leasingodawca.",
  },
  {
    q: "Leasing operacyjny czy finansowy?",
    a:
      "W leasingu operacyjnym właścicielem auta przez czas umowy jest leasingodawca, " +
      "a firma zalicza raty do kosztów. W leasingu finansowym auto od początku jest " +
      "środkiem trwałym firmy, która je amortyzuje. Który wariant jest korzystniejszy, " +
      "zależy od formy opodatkowania, więc warto to ustalić z księgowym.",
  },
  {
    q: "Czy osoba prywatna może wziąć auto poleasingowe w leasing?",
    a:
      "Leasing konsumencki istnieje, ale oferuje go niewiele firm. Kupując prywatnie, " +
      "zwykle finansuje się auto kredytem samochodowym.",
  },
  {
    q: "Czy do leasingu potrzebna jest faktura VAT?",
    a:
      "Leasingodawca kupuje auto od sprzedawcy i potrzebuje dokumentu sprzedaży. Faktura " +
      "VAT jest najprostsza, ale część leasingodawców finansuje też auta z fakturą VAT-marża " +
      "albo od osoby prywatnej. Oferta z ceną netto oznacza fakturę VAT.",
  },
  {
    q: "Jak sprawdzić leasing dla konkretnego auta?",
    a:
      "Wybierz ofertę i kliknij „Kupujesz na firmę? Sprawdź leasing”. Otworzy się wniosek " +
      "online u partnera, gdzie podajesz dane firmy i widzisz warunki. Nie liczymy rat " +
      "za ciebie i nie znamy twoich warunków.",
  },
];

const KATEGORIE = [
  { href: "/poleasingowe/do-100-tys", label: "do 100 tys. zł" },
  { href: "/poleasingowe/do-150-tys", label: "do 150 tys. zł" },
  { href: "/poleasingowe/suv", label: "SUV" },
  { href: "/poleasingowe/kombi", label: "kombi" },
  { href: "/poleasingowe/dostawcze", label: "dostawcze" },
  { href: "/poleasingowe/automat", label: "z automatem" },
  { href: "/poleasingowe/hybrydy", label: "hybrydy" },
  { href: "/poleasingowe/elektryki", label: "elektryki" },
];

const chip =
  "inline-block rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-1.5 text-neutral-300 transition-colors hover:border-neutral-600 hover:text-neutral-100";

/**
 * "Samochody poleasingowe w leasingu" — odpowiednik strony "na raty" dla firm.
 *
 * Search Console (30.10.2026): zapytania "leasing samochodow poleasingowych <miasto>"
 * staly na pozycjach 5-11 bez strony, ktora by na nie odpowiadala, a "<model> leasing
 * uzywane" na ~40. Przyciski MyLease maja osobne etykiety (`lista-w-leasingu-*`).
 *
 * Oferty: tylko z cena netto, bo tylko przy nich wiemy, ze sprzedawca wystawia
 * fakture VAT, a to pierwsze pytanie firmy kupujacej w leasingu.
 */
export default async function WLeasingu() {
  await connection();

  const zFaktura = { kind: "fixed", withPrice: "1", vat: "1" } as const;
  const [wszystkie, vat, oferty, menu] = await Promise.all([
    getFilterStats({ kind: "fixed", withPrice: "1" }),
    getFilterStats(zFaktura),
    getListings({ ...zFaktura, priceMin: 50_000, priceMax: 300_000, sort: "deal_desc" }, 1, 12),
    getMenuData(),
  ]);
  const marki = menu.marki.slice(0, 16);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6">
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: dane strukturalne, tresc wlasna
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Crumbs items={[{ label: "Kategorie", href: "/poleasingowe" }, { label: "W leasingu" }]} />

      <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight text-neutral-100">
        <Briefcase size={22} className="text-neutral-600" />
        Samochody poleasingowe w leasingu
      </h1>
      <p className="mb-5 mt-1 max-w-[70ch] text-sm leading-relaxed text-neutral-400">
        Auto po leasingu można zwykle wziąć w leasing jeszcze raz — tym razem jako samochód
        używany. Mamy dziś {num.format(wszystkie.total)} ofert „kup teraz” z {wszystkie.sources}{" "}
        źródeł, w tym {num.format(vat.total)} z podaną ceną netto, czyli na fakturę VAT
        {vat.medianPrice ? ` (mediana ${pln.format(vat.medianPrice)} brutto)` : ""}. Poniżej: jak
        wygląda leasing auta używanego, czym różni się od kredytu i oferty z fakturą.
      </p>

      <LeasingLista etykieta="w-leasingu-gora" gdzie="w-leasingu" />

      <section className="mb-8 max-w-[80ch]">
        <h2 className="mb-3 text-lg font-semibold text-neutral-100">
          Jak wziąć samochód poleasingowy w leasing
        </h2>
        <ol className="list-decimal space-y-2 pl-5 text-[14px] leading-relaxed text-neutral-400">
          <li>
            <strong className="font-medium text-neutral-300">Wybierz auto z ceną „kup teraz”.</strong>{" "}
            Leasingodawca finansuje konkretną kwotę, a przy licytacji cena jeszcze rośnie.
          </li>
          <li>
            <strong className="font-medium text-neutral-300">Sprawdź formę sprzedaży.</strong> Cena
            netto przy ofercie oznacza fakturę VAT. Przy samej cenie brutto zapytaj sprzedawcę,
            jaki dokument wystawia.
          </li>
          <li>
            <strong className="font-medium text-neutral-300">Sprawdź historię.</strong>{" "}
            <Link href="/vin" className="text-accent hover:underline">
              Historia pojazdu po numerze VIN
            </Link>{" "}
            pokaże przebieg i szkody — leasingodawca i tak o nie zapyta.
          </li>
          <li>
            <strong className="font-medium text-neutral-300">Złóż wniosek leasingowy.</strong>{" "}
            Podajesz dane firmy i auta, leasingodawca ocenia wniosek i odkupuje samochód od
            sprzedawcy. Ty odbierasz auto i płacisz raty leasingowe.
          </li>
        </ol>
      </section>

      {oferty.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-neutral-100">
              Auta poleasingowe z fakturą VAT
            </h2>
            <Link
              href="/?kind=fixed&withPrice=1"
              className="rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-[13px] text-neutral-400 transition-colors hover:border-accent/70 hover:text-accent"
            >
              Wszystkie {num.format(wszystkie.total)} „kup teraz”
            </Link>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
            {oferty.map((o, i) => (
              <OfferCard key={o.id} o={o} index={i} />
            ))}
          </div>
        </section>
      )}

      <LeasingLista etykieta="w-leasingu-srodek" gdzie="w-leasingu" />

      <section className="mb-8 max-w-[80ch]">
        <h2 className="mb-3 text-lg font-semibold text-neutral-100">Leasing czy kredyt</h2>
        <p className="text-[14px] leading-relaxed text-neutral-400">
          Leasing to produkt dla firm i osób prowadzących działalność: raty leasingowe zwykle
          rozlicza się w kosztach. Osoba prywatna finansuje zakup{" "}
          <Link href="/poleasingowe/na-raty" className="text-accent hover:underline">
            kredytem samochodowym
          </Link>
          . Jeśli kupujesz na firmę i wahasz się między jednym a drugim, porównaj obie opcje
          z księgowym — skutki podatkowe są różne.
        </p>
      </section>

      <section className="mb-8 max-w-[80ch]">
        <h2 className="mb-3 text-lg font-semibold text-neutral-100">Najczęstsze pytania</h2>
        <dl className="space-y-4 text-[14px] leading-relaxed">
          {FAQ.map((f) => (
            <div key={f.q}>
              <dt className="font-medium text-neutral-200">{f.q}</dt>
              <dd className="mt-1 text-neutral-400">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-neutral-100">Według marki</h2>
        <ul className="flex flex-wrap gap-2 text-[13px]">
          {marki.map((m) => (
            <li key={m.make}>
              <Link href={makeHref(m.make)} className={chip}>
                {m.make} poleasingowe <span className="text-neutral-600">{num.format(m.total)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-neutral-100">Według kategorii</h2>
        <ul className="flex flex-wrap gap-2 text-[13px]">
          {KATEGORIE.map((k) => (
            <li key={k.href}>
              <Link href={k.href} className={chip}>
                Poleasingowe {k.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <LeasingLista etykieta="w-leasingu-dol" gdzie="w-leasingu" />

      <ZapisPasek
        typ="w-leasingu"
        tytul="Powiadomić o nowych ofertach „kup teraz”?"
        opis="Tylko auta z ceną ostateczną. Jeden mail dziennie, gdy dojdą nowe."
        label="oferty „kup teraz”"
        filters={{ kind: "fixed", withPrice: "1" }}
      />
    </main>
  );
}
