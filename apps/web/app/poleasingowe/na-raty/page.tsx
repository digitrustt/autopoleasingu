import { Crumbs } from "@/components/Crumbs";
import { OfferCard } from "@/components/OfferCard";
import { RataLista } from "@/components/RataLista";
import { ZapisPasek } from "@/components/ZapisPasek";
import { getFilterStats, getListings } from "@/lib/queries";
import { Landmark } from "lucide-react";
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
  title: "Samochody poleasingowe na raty — jak kupić auto po leasingu na kredyt",
  description:
    "Czy auto poleasingowe można kupić na kredyt? Zwykle tak. Wyjaśniamy, jak to wygląda, " +
    "na co patrzeć przy porównywaniu ofert kredytu i czym kredyt różni się od leasingu, " +
    "a poniżej pokazujemy aktualne oferty „kup teraz”.",
  alternates: { canonical: "/poleasingowe/na-raty" },
};

/*
 * Pytania i odpowiedzi w jednym miejscu: ta sama tresc idzie na strone i do danych
 * strukturalnych, wiec nie moga sie rozjechac.
 *
 * CZEGO TU NIE MA, I BYC NIE MOZE: zadnych stawek, rat, okresow kredytowania,
 * wkladu wlasnego w procentach ani RRSO jako liczby. Reklama kredytu konsumenckiego
 * z jakakolwiek liczba wymaga podania RRSO i reprezentatywnego przykladu — patrz
 * komentarz w FinansowanieBlok. Nie obiecujemy tez niczego w imieniu banku
 * (czasu decyzji, braku zaswiadczen). Opisujemy ogolnie, a warunki odsylamy
 * do kredytodawcy.
 */
const FAQ: { q: string; a: string }[] = [
  {
    q: "Czy samochód poleasingowy można kupić na kredyt?",
    a:
      "Zwykle tak. Auto po leasingu jest zwykłym samochodem używanym, więc można je " +
      "sfinansować kredytem samochodowym tak samo jak każde inne. Warunki ustala bank " +
      "i zależą od twojej zdolności kredytowej, od kwoty oraz od sprzedawcy, więc " +
      "ratę trzeba sprawdzić u kredytodawcy.",
  },
  {
    q: "Kredyt czy leasing — co wybrać?",
    a:
      "Osoba prywatna kupuje auto na kredyt. Leasing jest produktem dla firm: kupując " +
      "samochód na działalność, można rozważyć leasing zamiast kredytu. To dwie " +
      "różne umowy z innymi skutkami podatkowymi, więc przy zakupie na firmę warto " +
      "to omówić z księgowym.",
  },
  {
    q: "Co wpływa na wysokość raty?",
    a:
      "Kwota kredytu, okres spłaty, wkład własny, oprocentowanie i dodatkowe koszty, " +
      "takie jak prowizja czy ubezpieczenie. Porównując oferty, patrz na RRSO, czyli " +
      "całkowity roczny koszt kredytu, a nie tylko na samą ratę.",
  },
  {
    q: "Jak sprawdzić ratę dla konkretnego auta?",
    a:
      "Wybierz ofertę „kup teraz” i kliknij „Kup na raty — sprawdź ratę” przy cenie. " +
      "Otworzy się wniosek online u partnera, gdzie podasz własne dane. Nie wykonujemy " +
      "żadnych obliczeń za ciebie i nie znamy twoich warunków.",
  },
  {
    q: "Co sprawdzić przed zakupem na raty?",
    a:
      "Historię auta po numerze VIN (szkody, przebieg), warunki umowy kredytowej oraz " +
      "całkowity koszt, a nie samą ratę. Kupując od leasingodawcy albo dealera, " +
      "zapytaj też, czy sprzedawca wystawia fakturę i na jakich zasadach.",
  },
];

const PROGI = [
  { href: "/poleasingowe/do-60-tys", label: "do 60 tys. zł" },
  { href: "/poleasingowe/do-80-tys", label: "do 80 tys. zł" },
  { href: "/poleasingowe/do-100-tys", label: "do 100 tys. zł" },
  { href: "/poleasingowe/do-150-tys", label: "do 150 tys. zł" },
  { href: "/poleasingowe/do-100-tys-suv", label: "SUV do 100 tys. zł" },
  { href: "/poleasingowe/do-80-tys-kombi", label: "kombi do 80 tys. zł" },
  { href: "/poleasingowe/do-100-tys-automat", label: "z automatem do 100 tys. zł" },
  { href: "/poleasingowe/hybrydy", label: "hybrydy" },
];

/**
 * "Samochody poleasingowe na raty" — fraza, w ktorej czlowiek ma juz zamiar
 * kupna i szuka finansowania. Jedyna strona serwisu, ktora odpowiada na pytanie
 * o kredyt wprost, zamiast chowac go w przycisku przy ofercie. Przyciski kredytu
 * maja osobne etykiety (`lista-na-raty-*`), zeby w panelu Comperialead bylo widac,
 * ktory z trzech dziala.
 *
 * Oferty: "kup teraz" od 60 tys. zl, bo 49 z 52 klikniec w kredyt bylo przy takich
 * autach (patrz lib/kredyt.ts).
 */
export default async function NaRaty() {
  await connection();

  const kupTeraz = { kind: "fixed", withPrice: "1" } as const;
  const [stale, oferty] = await Promise.all([
    getFilterStats(kupTeraz),
    getListings({ ...kupTeraz, priceMin: 60_000, priceMax: 200_000, sort: "deal_desc" }, 1, 12),
  ]);

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
      <Crumbs items={[{ label: "Kategorie", href: "/poleasingowe" }, { label: "Na raty" }]} />

      <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight text-neutral-100">
        <Landmark size={22} className="text-neutral-600" />
        Samochody poleasingowe na raty
      </h1>
      <p className="mb-5 mt-1 max-w-[70ch] text-sm leading-relaxed text-neutral-400">
        Auto po leasingu można zwykle kupić na kredyt samochodowy tak samo jak każde inne używane.
        Mamy dziś {num.format(stale.total)} ofert „kup teraz” z {stale.sources} źródeł, a mediana
        ceny to {stale.medianPrice ? pln.format(stale.medianPrice) : "—"}. Poniżej: jak to wygląda,
        na co patrzeć przy porównywaniu kredytów i gotowe oferty.
      </p>

      <RataLista etykieta="na-raty-gora" gdzie="na-raty" />

      <section className="mb-8 max-w-[80ch]">
        <h2 className="mb-3 text-lg font-semibold text-neutral-100">
          Jak kupić samochód poleasingowy na kredyt
        </h2>
        <ol className="list-decimal space-y-2 pl-5 text-[14px] leading-relaxed text-neutral-400">
          <li>
            <strong className="font-medium text-neutral-300">Wybierz auto.</strong> Najprościej
            z oferty „kup teraz”, bo cena jest ostateczna. Przy licytacji kwota jeszcze rośnie,
            więc trudno z góry ustalić, ile kredytu potrzebujesz.
          </li>
          <li>
            <strong className="font-medium text-neutral-300">Sprawdź historię.</strong> Przed
            decyzją zerknij na{" "}
            <Link href="/vin" className="text-accent hover:underline">
              historię pojazdu po numerze VIN
            </Link>
            : szkody i przebieg wpływają na cenę, a więc i na kwotę, którą finansujesz.
          </li>
          <li>
            <strong className="font-medium text-neutral-300">Sprawdź ratę u kredytodawcy.</strong>{" "}
            Wniosek online podajesz po stronie partnera, gdzie wpisujesz własne dane i widzisz
            ofertę dla siebie.
          </li>
          <li>
            <strong className="font-medium text-neutral-300">Porównaj całkowity koszt.</strong>{" "}
            Patrz na RRSO i dodatkowe opłaty, a nie tylko na ratę. Dopiero wtedy wracasz do
            sprzedawcy i podpisujesz umowę.
          </li>
        </ol>
      </section>

      {oferty.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-neutral-100">
              Auta „kup teraz”, które najczęściej kupuje się na raty
            </h2>
            <Link
              href="/?kind=fixed&withPrice=1"
              className="rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-[13px] text-neutral-400 transition-colors hover:border-accent/70 hover:text-accent"
            >
              Wszystkie {num.format(stale.total)} z filtrami
            </Link>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
            {oferty.map((o, i) => (
              <OfferCard key={o.id} o={o} index={i} />
            ))}
          </div>
        </section>
      )}

      <RataLista etykieta="na-raty-srodek" gdzie="na-raty" />

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
        <h2 className="mb-3 text-lg font-semibold text-neutral-100">Przeglądaj według budżetu</h2>
        <ul className="flex flex-wrap gap-2 text-[13px]">
          {PROGI.map((p) => (
            <li key={p.href}>
              <Link
                href={p.href}
                className="inline-block rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-1.5 text-neutral-300 transition-colors hover:border-neutral-600 hover:text-neutral-100"
              >
                Poleasingowe {p.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <RataLista etykieta="na-raty-dol" gdzie="na-raty" />

      <ZapisPasek
        typ="na-raty"
        tytul="Powiadomić o nowych ofertach „kup teraz”?"
        opis="Tylko auta z ceną ostateczną. Jeden mail dziennie, gdy dojdą nowe."
        label="oferty „kup teraz”"
        filters={{ kind: "fixed", withPrice: "1" }}
      />
    </main>
  );
}
