import { Crumbs } from "@/components/Crumbs";
import { StatStrip } from "@/components/StatStrip";
import { getStats, getTopSpreads, getVinSpread } from "@/lib/queries";
import { Copy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const revalidate = 86_400;

const pln = new Intl.NumberFormat("pl-PL", {
  style: "currency", currency: "PLN", maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("pl-PL");

export const metadata: Metadata = {
  title: "Ten sam samochód, dwie ceny — analiza rynku poleasingowego",
  description:
    "Ponad sto samochodów jest w tej chwili wystawionych równocześnie w dwóch miejscach po " +
    "różnych cenach. Ten sam numer VIN, różnica sięgająca 90 tysięcy złotych. Dane z 26 źródeł.",
  alternates: { canonical: "/analizy/ten-sam-vin-dwie-ceny" },
};

/**
 * Analiza rozjazdow cen po VIN.
 *
 * To NIE jest wpis blogowy w zwyklym sensie i celowo nie wyglada jak wpis.
 * Zmierzone wczesniej: frazy poradnikowe w tej kategorii ("auto poleasingowe
 * wady", "jak kupic auto poleasingowe") nie maja w Google zadnych podpowiedzi,
 * czyli praktycznie zadnego popytu. Pisanie pod nie byloby strata czasu,
 * a przy okazji dokladnie tym, za co autor dostal na Reddicie "AI slop".
 *
 * Zadaniem tej strony jest co innego: byc materialem, ktory ktos ZALINKUJE —
 * redakcja motoryzacyjna, forum, watek na Wykopie. Dlatego liczby licza sie
 * TUTAJ, na zywo, a nie sa przepisane z pliku: tekst, ktory sam sie aktualizuje,
 * nie zdezaktualizuje sie tydzien po publikacji. Przy pierwszym pomiarze
 * najwiekszy rozjazd wynosil 80 tys. zl, cztery dni pozniej 90 tys.
 *
 * Kazde auto ma link do wlasnej strony VIN, zeby dalo sie sprawdzic, a nie
 * tylko uwierzyc.
 */
export default async function Analiza() {
  const [stats, agg, top] = await Promise.all([getStats(), getVinSpread(), getTopSpreads(10)]);
  const dzis = new Date().toISOString().slice(0, 10);

  return (
    <main className="mx-auto max-w-[860px] px-4 py-6">
      <Crumbs items={[{ label: "Analizy" }, { label: "Ten sam VIN, dwie ceny" }]} />

      <h1 className="text-2xl font-bold tracking-tight text-neutral-100">
        Ten sam samochód, dwie ceny
      </h1>
      <p className="mb-1 mt-1 text-sm text-neutral-500">
        Analiza {num.format(stats.active)} ofert poleasingowych z 26 źródeł. Stan na {dzis},
        przeliczane codziennie.
      </p>

      <p className="mb-5 mt-4 max-w-[72ch] text-[15px] leading-relaxed text-neutral-300">
        Auto poleasingowe kupuje się dla udokumentowanej historii i jednego właściciela.
        Sprawdza się rocznik, przebieg, wyposażenie. Prawie nikt nie sprawdza jednej rzeczy:
        czy ten konkretny egzemplarz nie stoi równocześnie gdzie indziej taniej.
      </p>
      <p className="mb-6 max-w-[72ch] text-[15px] leading-relaxed text-neutral-400">
        Bo nie ma jak. Firma leasingowa pokazuje swoją ofertę, dealer swoją, portal
        ogłoszeniowy trzecią. Żaden z nich nie powie, że to samo auto wisi u konkurencji
        o kilkadziesiąt tysięcy taniej — nie dlatego, że ukrywa, tylko dlatego, że sam tego
        nie widzi.
      </p>

      {agg?.par != null && (
        <StatStrip
          items={[
            { label: "Aut z rozbieżnością", value: num.format(agg.par) },
            { label: "Różnica ≥ 10 tys.", value: num.format(agg.ponad10k) },
            { label: "Największa różnica", value: agg.max ? pln.format(agg.max) : "—" },
            { label: "Mediana różnicy", value: agg.mediana ? pln.format(agg.mediana) : "—" },
            { label: "Suma różnic", value: agg.suma ? pln.format(Number(agg.suma)) : "—" },
          ]}
        />
      )}

      <section className="mb-8">
        <h2 className="mb-1 text-lg font-semibold text-neutral-100">
          Największe rozbieżności — dziś
        </h2>
        <p className="mb-3 text-[13px] text-neutral-500">
          Każdy wiersz to jeden numer VIN, czyli fizycznie jeden samochód, wystawiony
          równocześnie w kilku miejscach. Kliknij, żeby zobaczyć obie oferty.
        </p>
        <div className="overflow-x-auto rounded-xl border border-[var(--color-line)]">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line)] text-left text-[11px] uppercase tracking-wide text-neutral-600">
                <th className="px-4 py-2.5 font-medium">Auto</th>
                <th className="px-4 py-2.5 text-right font-medium">Taniej</th>
                <th className="px-4 py-2.5 text-right font-medium">Drożej</th>
                <th className="px-4 py-2.5 text-right font-medium">Różnica</th>
              </tr>
            </thead>
            <tbody>
              {top.map((t) => (
                <tr
                  key={t.vin}
                  className="border-b border-[var(--color-line)] last:border-0 hover:bg-[var(--color-panel)]"
                >
                  <td className="px-4 py-2">
                    <Link
                      href={`/vin/${t.vin}`}
                      className="font-medium text-neutral-200 underline decoration-dotted underline-offset-2 hover:text-accent"
                    >
                      {t.auto} {t.rok ?? ""}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-neutral-400">
                    {pln.format(t.taniej)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-neutral-400">
                    {pln.format(t.drozej)}
                  </td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums text-emerald-400">
                    {pln.format(t.roznica)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-neutral-100">Skąd biorą się takie różnice</h2>
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-[15px] leading-relaxed text-neutral-400">
          <li>
            <span className="text-neutral-200">Ten sam samochód w kilku kanałach.</span>{" "}
            Leasingodawca wystawia auto u siebie, równocześnie oddaje je dealerowi w komis,
            a ten wstawia je jeszcze na portal ogłoszeniowy. Każdy kanał ma własną marżę.
          </li>
          <li>
            <span className="text-neutral-200">Różne momenty aktualizacji.</span> Jeden
            sprzedawca obniżył cenę tydzień temu, drugi jeszcze nie.
          </li>
          <li>
            <span className="text-neutral-200">Różny zakres oferty.</span> Czasem droższa
            zawiera pakiet serwisowy albo przedłużoną gwarancję — i wtedy różnica jest pozorna.
            Dlatego przy każdym aucie podajemy linki do obu ogłoszeń.
          </li>
        </ol>
      </section>

      <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
        <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-neutral-100">
          <Copy size={17} className="text-neutral-600" />
          Metodologia
        </h2>
        <ul className="flex flex-col gap-1.5 text-[13px] leading-relaxed text-neutral-400">
          <li>Dane zbierane raz na dobę z 26 źródeł poleasingowych.</li>
          <li>Porównanie wyłącznie po pełnym, 17-znakowym numerze VIN.</li>
          <li>
            Do zestawienia wchodzą tylko oferty „kup teraz" i tylko wtedy, gdy ten sam VIN
            występuje u RÓŻNYCH źródeł. Ceny aukcyjne pomijamy — bieżąca stawka w licytacji
            jeszcze urośnie i nie jest ceną zakupu.
          </li>
          <li>
            Liczby przeliczają się codziennie. Przy pierwszym pomiarze 17 sierpnia największa
            różnica wynosiła 80 000 zł; skład zestawienia zmienia się razem z rynkiem.
          </li>
          <li>
            Serwis jest bezpłatny, nie sprzedaje samochodów i nie pośredniczy. Pełna
            metodologia i dane rynkowe:{" "}
            <Link href="/dane" className="underline decoration-dotted underline-offset-2 hover:text-accent">
              /dane
            </Link>
            .
          </li>
        </ul>
      </section>
    </main>
  );
}
