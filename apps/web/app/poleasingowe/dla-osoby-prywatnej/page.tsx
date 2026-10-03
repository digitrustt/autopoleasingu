import { Crumbs } from "@/components/Crumbs";
import { OfferCard } from "@/components/OfferCard";
import { StatStrip } from "@/components/StatStrip";
import { ZapisPasek } from "@/components/ZapisPasek";
import { getFilterStats, getListings } from "@/lib/queries";
import { TrendingDown, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
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
  title: "Auta poleasingowe dla osoby prywatnej — jak kupić i gdzie szukać",
  description:
    "Czy osoba prywatna może kupić auto poleasingowe? Tak. Wyjaśniamy różnicę między ofertą " +
    "„kup teraz” a licytacją, cenę brutto i netto, fakturę VAT i VAT-marżę oraz podatek PCC — " +
    "i pokazujemy aktualne oferty z ceną brutto.",
  alternates: { canonical: "/poleasingowe/dla-osoby-prywatnej" },
};

/*
 * Pytania i odpowiedzi w jednym miejscu: ta sama tresc idzie na strone
 * i do danych strukturalnych, wiec nie moga sie rozjechac.
 *
 * TRZYMAC SIE FAKTOW OGOLNYCH. Regulaminy aukcji roznia sie miedzy
 * leasingodawcami i zmieniaja w czasie — dlatego nigdzie nie piszemy "aukcja X
 * dopuszcza osoby prywatne", tylko odsylamy do regulaminu przy ofercie.
 */
const FAQ: { q: string; a: string }[] = [
  {
    q: "Czy osoba prywatna może kupić auto poleasingowe?",
    a:
      "Tak. Samochody po leasingu sprzedają firmy leasingowe, firmy zarządzające flotami " +
      "i dealerzy — i większość z nich sprzedaje także osobom prywatnym. Wyjątkiem bywają " +
      "licytacje: część aukcji jest przeznaczona wyłącznie dla firm, co wynika z regulaminu " +
      "danej platformy.",
  },
  {
    q: "Czym różni się oferta „kup teraz” od licytacji?",
    a:
      "W ofercie „kup teraz” cena jest ostateczna i zwykle podana brutto — tyle zapłacisz. " +
      "Na licytacji widzisz aktualną stawkę, która do końca aukcji może wzrosnąć, często " +
      "podaną netto. Żeby licytować, trzeba się zarejestrować, a część platform wymaga wadium.",
  },
  {
    q: "Cena netto czy brutto — ile zapłaci osoba prywatna?",
    a:
      "Osoba prywatna płaci cenę brutto i nie odzyska podatku VAT. Jeśli oferta podaje cenę " +
      "netto, trzeba doliczyć 23%. W naszej wyszukiwarce wszystkie ceny są przeliczone na " +
      "brutto, także te z aukcji.",
  },
  {
    q: "Faktura VAT 23% czy VAT-marża — co to zmienia?",
    a:
      "Dla osoby prywatnej niewiele: w obu przypadkach płacisz kwotę z faktury. Różnica ma " +
      "znaczenie dla firm, bo tylko z faktury VAT 23% można odliczyć podatek. Auta poleasingowe " +
      "są najczęściej sprzedawane właśnie na fakturę VAT 23%.",
  },
  {
    q: "Czy od auta poleasingowego płaci się podatek PCC?",
    a:
      "Kupując od firmy na fakturę VAT albo VAT-marżę, nie płacisz 2% podatku od czynności " +
      "cywilnoprawnych. PCC dotyczy umów kupna-sprzedaży między osobami prywatnymi.",
  },
  {
    q: "Czy auto poleasingowe można kupić na raty?",
    a:
      "Tak. Osoba prywatna może sfinansować zakup kredytem samochodowym lub gotówkowym, " +
      "a część sprzedających oferuje też leasing konsumencki. Na stronie oferty z ceną jest " +
      "odnośnik do sprawdzenia finansowania.",
  },
];

/**
 * "Auta poleasingowe dla osoby prywatnej" — fraza, ktora Google podpowiada,
 * a zadna strona serwisu na nia nie odpowiadala.
 *
 * To strona z TRESCIA i z ofertami naraz: czlowiek, ktory to wpisuje, najpierw
 * chce wiedziec, czy w ogole moze kupic, a zaraz potem — co moze kupic. Oferty
 * ograniczamy do "kup teraz" z cena, bo to jedyna grupa, o ktorej mozemy
 * uczciwie powiedziec "tyle zaplacisz" bez czytania regulaminu aukcji.
 */
export default async function DlaOsobyPrywatnej() {
  await connection();

  const kupTeraz = { kind: "fixed", withPrice: "1" } as const;
  const [stale, aukcje, oferty] = await Promise.all([
    getFilterStats(kupTeraz),
    getFilterStats({ kind: "auction" }),
    getListings({ ...kupTeraz, sort: "deal_desc" }, 1, 24),
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
      <Crumbs
        items={[{ label: "Kategorie", href: "/poleasingowe" }, { label: "Dla osoby prywatnej" }]}
      />

      <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight text-neutral-100">
        <UserRound size={22} className="text-neutral-600" />
        Auta poleasingowe dla osoby prywatnej
      </h1>
      <p className="mb-5 mt-1 max-w-[70ch] text-sm leading-relaxed text-neutral-400">
        Tak, osoba prywatna może kupić samochód po leasingu. Najprościej z oferty „kup teraz”:
        cena jest ostateczna, podana brutto, a sprzedający wystawia fakturę. Takich ofert mamy
        dziś {num.format(stale.total)} z {stale.sources} źródeł. Licytacji jest{" "}
        {num.format(aukcje.total)} — tam cena jeszcze rośnie, a zasady zależą od regulaminu.
      </p>

      <StatStrip
        items={[
          { label: "Ofert „kup teraz”", value: num.format(stale.total), hint: "cena brutto" },
          {
            label: "Mediana ceny",
            value: stale.medianPrice ? pln.format(stale.medianPrice) : "—",
          },
          { label: "Najtaniej", value: stale.minPrice ? pln.format(stale.minPrice) : "—" },
          {
            label: "Przebieg",
            value: stale.medianMileage != null ? `${num.format(stale.medianMileage)} km` : "—",
            hint: "mediana",
          },
          { label: "Poniżej rynku", value: num.format(stale.deals), hint: "co najmniej 10%" },
        ]}
      />

      <section className="mb-8 max-w-[80ch]">
        <h2 className="mb-3 text-lg font-semibold text-neutral-100">
          Co warto wiedzieć przed zakupem
        </h2>
        <dl className="space-y-4">
          {FAQ.map((f) => (
            <div
              key={f.q}
              className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-3"
            >
              <dt className="text-[15px] font-medium text-neutral-100">{f.q}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-neutral-400">{f.a}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-[12px] leading-relaxed text-neutral-600">
          To informacje ogólne, nie porada prawna ani podatkowa. Warunki sprzedaży — w tym to, kto
          może kupować — określa zawsze sprzedający przy konkretnej ofercie.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-[13px] uppercase tracking-wide text-neutral-600">
          Szukaj według budżetu
        </h2>
        <ul className="flex flex-wrap gap-2">
          {[30, 40, 50, 60, 80, 100, 150].map((tys) => (
            <li key={tys}>
              <Link
                href={`/poleasingowe/do-${tys}-tys`}
                className="rounded-lg border border-[var(--color-line)] px-2.5 py-1.5 text-[13px] text-neutral-300 transition-colors hover:border-accent/70 hover:text-accent"
              >
                do {tys} tys. zł
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {oferty.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-100">
              <TrendingDown size={17} className="text-emerald-400" />
              Najlepsze okazje „kup teraz”
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

      <ZapisPasek
        typ="osoba-prywatna"
        tytul="Powiadomić o nowych ofertach „kup teraz”?"
        opis="Tylko auta z ceną ostateczną, bez licytacji. Jeden mail dziennie, gdy dojdą nowe."
        label="Kup teraz — bez licytacji"
        filters={{ kind: "fixed" }}
      />
    </main>
  );
}
