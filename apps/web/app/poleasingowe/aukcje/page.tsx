import { Crumbs } from "@/components/Crumbs";
import { OfferCard } from "@/components/OfferCard";
import { ZapisPasek } from "@/components/ZapisPasek";
import { getAukcjaDealer, getAukcjePlatformy, getListings } from "@/lib/queries";
import { Gavel } from "lucide-react";
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
  title: "Aukcje samochodów poleasingowych — wszystkie licytacje w jednym miejscu",
  description:
    "Auta z aukcji leasingowych EFL, PKO Leasing, AutoPrzetarg, CarArena i innych w jednej " +
    "liście. Jak licytować, co z ceną netto i prowizją, i o ile drożej te same auta wracają " +
    "później u dealerów.",
  alternates: { canonical: "/poleasingowe/aukcje" },
};

/** Platformy, dla ktorych mamy poradnik z zasadami z regulaminu. */
const PORADNIKI: Record<string, string> = {
  poleasingowe: "/poradnik/aukcje-efl-poleasingowe",
  pkoaukcje: "/poradnik/aukcje-pko-leasing",
};

/*
 * Odpowiedzi ogolne, bo zasady roznia sie miedzy platformami. Konkrety (wadium,
 * prowizja, terminy) sa w poradnikach EFL i PKO, spisane z regulaminow — tu nie
 * powtarzamy liczb, ktore w innym serwisie moga byc inne.
 */
const FAQ: { q: string; a: string }[] = [
  {
    q: "Kto może licytować na aukcjach aut poleasingowych?",
    a:
      "Zależy od platformy. Na aukcjach PKO Leasing kupują i firmy, i osoby prywatne. " +
      "W EFL (Poleasingowe.pl) osoby prywatne też mogą licytować, ale część aukcji jest tylko " +
      "dla firm — wynika to z opisu konkretnej aukcji. Zawsze trzeba założyć konto w serwisie " +
      "organizatora.",
  },
  {
    q: "Czy cena na aukcji jest netto czy brutto?",
    a:
      "Leasingodawcy zwykle podają cenę netto, a osoba prywatna dopłaca do niej 23% VAT. " +
      "My przy aukcjach pokazujemy kwotę brutto, żeby dało się ją porównać z ofertami „kup teraz”.",
  },
  {
    q: "Ile kosztuje zakup na aukcji poza samą ceną?",
    a:
      "Do wylicytowanej kwoty dochodzi prowizja organizatora, a przy części aukcji trzeba " +
      "wpłacić wadium, które przegranym wraca. Wysokość prowizji i wadium różni się między " +
      "serwisami — sprawdź ją przed licytacją, nie po wygranej.",
  },
  {
    q: "Aukcja czy „kup teraz” u dealera?",
    a:
      "Na aukcji płacisz zwykle mniej, ale kupujesz auto bez przygotowania i gwarancji, " +
      "w krótkim terminie płatności i odbioru. Dealer dolicza do tego swoją marżę, przegląd " +
      "i gwarancję. Poniżej pokazujemy, o ile drożej te same auta pojawiają się potem u dealerów.",
  },
  {
    q: "Czy auto z aukcji można kupić w leasing albo na kredyt?",
    a:
      "Można, ale terminy płatności na aukcjach są krótkie, a kwota znana dopiero po wygranej, " +
      "więc finansowanie trzeba mieć ustalone wcześniej. Przy autach „kup teraz” jest to prostsze.",
  },
];

/**
 * "Aukcje samochodow poleasingowych" — huby nie bylo, choc zbieramy ~900 licytacji
 * z 7 platform (30.10.2026). Search Console: zapytania o konkretne aukcje (PKO,
 * Dawro, AutoPrzetarg, Ayvens) na pozycjach 6-10, ogolne "aukcje aut poleasingowych"
 * na 46 — nie bylo strony, ktora by na nie odpowiadala.
 *
 * Sekcja "aukcja a dealer" to dane, ktorych nie ma nikt inny: te same VIN-y
 * sledzone od licytacji do oferty dealera. Strona sluzy tez jako cel do dzielenia
 * sie ta analiza.
 */
export default async function Aukcje() {
  await connection();

  const [platformy, dealer, oferty] = await Promise.all([
    getAukcjePlatformy(),
    getAukcjaDealer(),
    getListings({ kind: "auction", sort: "new" }, 1, 12),
  ]);
  const razem = platformy.reduce((s, p) => s + p.total, 0);

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
      <Crumbs items={[{ label: "Kategorie", href: "/poleasingowe" }, { label: "Aukcje" }]} />

      <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight text-neutral-100">
        <Gavel size={22} className="text-neutral-600" />
        Aukcje samochodów poleasingowych
      </h1>
      <p className="mb-6 mt-1 max-w-[70ch] text-sm leading-relaxed text-neutral-400">
        Leasingodawcy sprzedają część aut na własnych aukcjach internetowych, każdy w innym
        serwisie. Zbieramy je w jednym miejscu: teraz {num.format(razem)} aut na licytacji
        z {platformy.length} platform. Ceny pokazujemy brutto, żeby dało się je porównać
        z ofertami „kup teraz”.
      </p>

      <section className="mb-8 max-w-[80ch]">
        <h2 className="mb-3 text-lg font-semibold text-neutral-100">Platformy aukcyjne</h2>
        <ul className="divide-y divide-[var(--color-line)] rounded-xl border border-[var(--color-line)]">
          {platformy.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-[14px]">
              <Link href={`/leasingodawca/${p.id}`} className="font-medium text-neutral-200 hover:text-accent">
                {p.name}
              </Link>
              <span className="flex items-center gap-3 text-neutral-500">
                {PORADNIKI[p.id] && (
                  <Link href={PORADNIKI[p.id]} className="text-[13px] text-accent hover:underline">
                    zasady
                  </Link>
                )}
                <span className="tabular-nums">{num.format(p.total)} aut</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {dealer.n >= 10 && (
        <section className="mb-8 max-w-[80ch]">
          <h2 className="mb-2 text-lg font-semibold text-neutral-100">
            O ile drożej te same auta wracają u dealerów
          </h2>
          <p className="mb-3 text-[14px] leading-relaxed text-neutral-400">
            Śledzimy auta po numerze VIN. {num.format(dealer.n)} aut po zakończonej licytacji
            pojawiło się później u innego sprzedawcy ze stałą ceną — typowo po{" "}
            {num.format(dealer.medianaDni)} dniach i o{" "}
            <strong className="font-semibold text-neutral-200">
              {pln.format(dealer.medianaRoznicy)} drożej ({dealer.medianaProc > 0 ? "+" : ""}
              {dealer.medianaProc}%)
            </strong>
            . Droższych było {num.format(dealer.drozej)} z {num.format(dealer.n)}.
          </p>
          <p className="mb-4 text-[13px] leading-relaxed text-neutral-500">
            Zastrzeżenia: z aukcji widzimy ostatnią kwotę licytacji, więc cena końcowa mogła być
            nieco wyższa. Dealer dolicza też przygotowanie auta i gwarancję, więc różnica to nie
            czysta marża. Pomijamy pary z różnicą poniżej −30% i powyżej +50% jako
            prawdopodobne błędy dopasowania.
          </p>
          <div className="overflow-x-auto rounded-xl border border-[var(--color-line)]">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-line)] text-left text-[11px] uppercase tracking-wide text-neutral-600">
                  <th className="px-4 py-2.5 font-medium">Auto</th>
                  <th className="px-4 py-2.5 text-right font-medium">Aukcja</th>
                  <th className="px-4 py-2.5 text-right font-medium">Dealer</th>
                  <th className="px-4 py-2.5 text-right font-medium">Różnica</th>
                  <th className="px-4 py-2.5 text-right font-medium">Po dniach</th>
                </tr>
              </thead>
              <tbody>
                {dealer.przyklady.map((p, i) => (
                  <tr key={i} className="border-b border-[var(--color-line)] last:border-0">
                    <td className="px-4 py-2.5 text-neutral-200">
                      {p.make} {p.model}
                      {p.year ? ` ${p.year}` : ""}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-neutral-400">
                      {pln.format(p.cena_aukcja)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-neutral-300">
                      {pln.format(p.cena_dealer)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-neutral-100">
                      {p.cena_dealer >= p.cena_aukcja ? "+" : "−"}
                      {pln.format(Math.abs(p.cena_dealer - p.cena_aukcja))}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-neutral-500">{p.dni}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {oferty.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-neutral-100">Najnowsze licytacje</h2>
            <Link
              href="/?kind=auction"
              className="rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-[13px] text-neutral-400 transition-colors hover:border-accent/70 hover:text-accent"
            >
              Wszystkie {num.format(razem)} z filtrami
            </Link>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
            {oferty.map((o, i) => (
              <OfferCard key={o.id} o={o} index={i} />
            ))}
          </div>
        </section>
      )}

      <section className="mb-8 max-w-[80ch]">
        <h2 className="mb-3 text-lg font-semibold text-neutral-100">
          Jak kupić auto na aukcji poleasingowej
        </h2>
        <ol className="list-decimal space-y-2 pl-5 text-[14px] leading-relaxed text-neutral-400">
          <li>
            <strong className="font-medium text-neutral-300">Załóż konto</strong> w serwisie
            organizatora i sprawdź, czy aukcja jest dla wszystkich, czy tylko dla firm.
          </li>
          <li>
            <strong className="font-medium text-neutral-300">Policz koszt całkowity:</strong>{" "}
            kwota licytacji, VAT (jeśli cena jest netto, a kupujesz prywatnie) i prowizja
            organizatora. Ustal sobie limit, zanim zaczniesz licytować.
          </li>
          <li>
            <strong className="font-medium text-neutral-300">Sprawdź auto:</strong> opis stanu,
            zdjęcia, oględziny na placu, jeśli są możliwe, i{" "}
            <Link href="/vin" className="text-accent hover:underline">
              historię po numerze VIN
            </Link>
            .
          </li>
          <li>
            <strong className="font-medium text-neutral-300">Licytuj i pilnuj terminów.</strong>{" "}
            Po wygranej płatność i odbiór mają zwykle krótkie terminy — miej pieniądze
            i transport gotowe wcześniej.
          </li>
        </ol>
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
        <p className="mt-4 text-[13px] text-neutral-500">
          Zobacz też:{" "}
          <Link href="/analizy/ten-sam-vin-dwie-ceny" className="text-accent hover:underline">
            ten sam VIN u kilku sprzedawców w różnych cenach
          </Link>
          .
        </p>
      </section>

      <ZapisPasek
        typ="aukcje"
        tytul="Powiadomić o nowych aukcjach?"
        opis="Codziennie sprawdzamy wszystkie platformy. Jeden mail dziennie, gdy dojdą nowe licytacje."
        label="aukcje aut poleasingowych"
        filters={{ kind: "auction" }}
      />
    </main>
  );
}
