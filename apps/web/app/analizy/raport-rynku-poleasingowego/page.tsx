import { Crumbs } from "@/components/Crumbs";
import { StatStrip } from "@/components/StatStrip";
import {
  getRaportCzasWOfercie,
  getRaportNapedyWgRocznika,
  getRaportObnizki,
  getRaportPrzekroj,
  getStats,
} from "@/lib/queries";
import { makeHref } from "@/lib/slug";
import { FileChartColumn } from "lucide-react";
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
const proc = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 });
const dzien = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "long", year: "numeric" });

/** Poczatek okresu obserwacji znikniec — ten sam co RAPORT_OD w lib/queries.ts. */
const OD = new Date("2026-08-17");

export const metadata: Metadata = {
  title: "Rynek aut poleasingowych w liczbach — raport z ponad 20 tys. ofert",
  description:
    "Które modele znikają z ofert najszybciej, jak często sprzedający obniżają ceny, ile " +
    "diesli zostało we flotach i ile kosztuje typowe auto po leasingu. Raport z danych " +
    "26 źródeł, przeliczany codziennie.",
  alternates: { canonical: "/analizy/raport-rynku-poleasingowego" },
};

/**
 * Raport rynku — strona, do ktorej maja linkowac media.
 *
 * Wszystko, co tu jest, MUSI wytrzymac pytanie dziennikarza "skad to wiecie":
 * dlatego kazda sekcja mowi, z ilu aut jest liczona, a na koncu stoi
 * metodologia z ograniczeniami. Nie dopisywac wnioskow, ktorych dane nie
 * dzwigaja ("auta drozeja", "rynek rosnie") — mamy niecale dwa miesiace
 * obserwacji, wiec trendu w czasie nie da sie z tego uczciwie wyczytac.
 */
export default async function RaportRynku() {
  await connection();
  // W dwoch turach: szesc agregacji naraz przy puli pieciu polaczen konczylo sie 504.
  const [stats, czas, obnizki] = await Promise.all([
    getStats(),
    getRaportCzasWOfercie(),
    getRaportObnizki(),
  ]);
  const [napedy, przekroj] = await Promise.all([getRaportNapedyWgRocznika(), getRaportPrzekroj()]);

  const dzis = dzien.format(new Date());
  const najszybsze = czas.slice(0, 10);
  const najwolniejsze = [...czas].reverse().slice(0, 10);
  const maxDni = Math.max(...najwolniejsze.map((c) => c.dni), 1);
  const udzialObnizek = obnizki.wszystkich > 0 ? (obnizki.zObnizka / obnizki.wszystkich) * 100 : 0;
  const pierwszy = napedy[0];
  const ostatni = napedy[napedy.length - 1];

  return (
    <main className="mx-auto max-w-[860px] px-4 py-6">
      <Crumbs items={[{ label: "Analizy" }, { label: "Raport rynku poleasingowego" }]} />

      <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight text-neutral-100">
        <FileChartColumn size={22} className="text-neutral-600" />
        Rynek aut poleasingowych w liczbach
      </h1>
      <p className="mb-5 mt-1 text-sm text-neutral-500">
        Policzone z {num.format(stats.active)} aktywnych ofert z 26 źródeł — firm leasingowych,
        firm zarządzających flotami i programów dealerskich. Stan na {dzis}, przeliczane
        codziennie.
      </p>

      <StatStrip
        items={[
          { label: "Ofert w bazie", value: num.format(stats.active), hint: "26 źródeł" },
          { label: "Mediana ceny", value: pln.format(przekroj.mediana), hint: "„kup teraz”" },
          { label: "Mediana przebiegu", value: `${num.format(przekroj.przebieg)} km` },
          { label: "Typowy rocznik", value: String(przekroj.rocznik), hint: "mediana" },
          { label: "Do 100 tys. zł", value: `${proc.format(przekroj.do100)}%`, hint: "ofert" },
        ]}
      />

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold text-neutral-100">Najważniejsze wnioski</h2>
        <ul className="flex max-w-[72ch] list-disc flex-col gap-2 pl-5 text-[15px] leading-relaxed text-neutral-300">
          {najszybsze[0] && najwolniejsze[0] && (
            <li>
              Najszybciej z ofert znika{" "}
              <span className="text-neutral-100">
                {najszybsze[0].make} {najszybsze[0].linia}
              </span>{" "}
              — połowa egzemplarzy w ciągu {proc.format(najszybsze[0].dni)} dnia. Najdłużej czeka{" "}
              <span className="text-neutral-100">
                {najwolniejsze[0].make} {najwolniejsze[0].linia}
              </span>
              : {proc.format(najwolniejsze[0].dni)} dnia.
            </li>
          )}
          <li>
            <span className="text-neutral-100">{proc.format(udzialObnizek)}%</span> ofert miało
            przynajmniej jedną obniżkę ceny. Typowa obniżka to{" "}
            {proc.format(obnizki.medianaProc)}%, czyli {pln.format(obnizki.medianaZl)}.
          </li>
          {pierwszy && ostatni && (
            <li>
              Diesel wychodzi z flot: w roczniku {pierwszy.year} to{" "}
              {proc.format(pierwszy.diesel)}% aut, w roczniku {ostatni.year} już tylko{" "}
              <span className="text-neutral-100">{proc.format(ostatni.diesel)}%</span>. Hybrydy
              urosły w tym czasie z {proc.format(pierwszy.hybrydy)}% do{" "}
              {proc.format(ostatni.hybrydy)}%.
            </li>
          )}
          <li>
            Auto po leasingu to nie zawsze tani samochód: tylko {proc.format(przekroj.do50)}%
            ofert kosztuje do 50 tys. zł, a {proc.format(przekroj.ponad200)}% — ponad 200 tys. zł.
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-1 text-lg font-semibold text-neutral-100">
          Które modele znikają z ofert najszybciej
        </h2>
        <p className="mb-3 max-w-[72ch] text-[13px] leading-relaxed text-neutral-500">
          Mediana liczby dni od pojawienia się oferty do jej zniknięcia. Tylko oferty „kup teraz”,
          które pojawiły się po {dzien.format(OD)}, i tylko modele z co najmniej 40 takimi
          ofertami.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { tytul: "Najkrócej w ofercie", rows: najszybsze },
            { tytul: "Najdłużej w ofercie", rows: najwolniejsze },
          ].map((t) => (
            <div
              key={t.tytul}
              className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4"
            >
              <h3 className="mb-3 text-[13px] uppercase tracking-wide text-neutral-600">
                {t.tytul}
              </h3>
              <ol className="flex flex-col gap-2">
                {t.rows.map((c) => (
                  <li key={`${c.make}-${c.linia}`} className="text-[13px]">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-neutral-200">
                        <Link href={makeHref(c.make)} className="hover:text-accent">
                          {c.make}
                        </Link>{" "}
                        {c.linia}
                      </span>
                      <span className="shrink-0 tabular-nums text-neutral-100">
                        {proc.format(c.dni)} dnia
                        <span className="ml-1.5 text-[11px] text-neutral-600">
                          z {num.format(c.n)}
                        </span>
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-[var(--color-ink)]">
                      <div
                        className="h-1.5 rounded-full bg-neutral-500"
                        style={{ width: `${Math.max(3, (c.dni / maxDni) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-1 text-lg font-semibold text-neutral-100">
          Jak często sprzedający obniżają ceny
        </h2>
        <p className="mb-3 max-w-[72ch] text-[13px] leading-relaxed text-neutral-500">
          Porównujemy cenę każdej oferty dzień po dniu. Liczone z {num.format(obnizki.wszystkich)}{" "}
          ofert „kup teraz” obserwowanych od początku działania serwisu.
        </p>
        <StatStrip
          items={[
            { label: "Ofert z obniżką", value: `${proc.format(udzialObnizek)}%` },
            { label: "Typowa obniżka", value: `${proc.format(obnizki.medianaProc)}%`, hint: "mediana" },
            { label: "W złotych", value: pln.format(obnizki.medianaZl), hint: "mediana" },
            { label: "Obniżek łącznie", value: num.format(obnizki.obnizek) },
          ]}
        />
      </section>

      {napedy.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-1 text-lg font-semibold text-neutral-100">
            Napęd, przebieg i cena według rocznika
          </h2>
          <p className="mb-3 max-w-[72ch] text-[13px] leading-relaxed text-neutral-500">
            Udział napędów wśród aut danego rocznika oraz mediana przebiegu i ceny. Floty kupują
            dziś inne auta niż pięć lat temu — i to widać w tym, co z nich wraca na rynek.
          </p>
          <div className="overflow-x-auto rounded-xl border border-[var(--color-line)]">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-line)] text-left text-[11px] uppercase tracking-wide text-neutral-600">
                  <th className="px-4 py-2.5 font-medium">Rocznik</th>
                  <th className="px-4 py-2.5 text-right font-medium">Aut</th>
                  <th className="px-4 py-2.5 text-right font-medium">Diesel</th>
                  <th className="px-4 py-2.5 text-right font-medium">Benzyna</th>
                  <th className="px-4 py-2.5 text-right font-medium">Hybrydy</th>
                  <th className="px-4 py-2.5 text-right font-medium">Elektryki</th>
                  <th className="px-4 py-2.5 text-right font-medium">Przebieg</th>
                  <th className="px-4 py-2.5 text-right font-medium">Cena</th>
                </tr>
              </thead>
              <tbody>
                {napedy.map((r) => (
                  <tr key={r.year} className="border-b border-[var(--color-line)] last:border-0">
                    <td className="px-4 py-2 font-medium text-neutral-200">{r.year}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-neutral-500">
                      {num.format(r.n)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-neutral-100">
                      {proc.format(r.diesel)}%
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-neutral-300">
                      {proc.format(r.benzyna)}%
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-neutral-300">
                      {proc.format(r.hybrydy)}%
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-neutral-300">
                      {proc.format(r.elektryki)}%
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-neutral-400">
                      {r.przebieg != null ? `${num.format(r.przebieg)} km` : "—"}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums text-neutral-100">
                      {r.cena != null ? pln.format(r.cena) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[12px] text-neutral-600">
            Hybrydy łącznie z plug-in. Cena to mediana ofert „kup teraz”.
          </p>
        </section>
      )}

      <section className="mb-8">
        <h2 className="mb-1 text-lg font-semibold text-neutral-100">
          Czego jest najwięcej na rynku
        </h2>
        <p className="mb-3 max-w-[72ch] text-[13px] leading-relaxed text-neutral-500">
          Piętnaście najczęstszych modeli wśród ofert „kup teraz”, z medianą ceny i rocznika.
        </p>
        <div className="overflow-x-auto rounded-xl border border-[var(--color-line)]">
          <table className="w-full min-w-[440px] text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line)] text-left text-[11px] uppercase tracking-wide text-neutral-600">
                <th className="px-4 py-2.5 font-medium">Model</th>
                <th className="px-4 py-2.5 text-right font-medium">Ofert</th>
                <th className="px-4 py-2.5 text-right font-medium">Mediana ceny</th>
                <th className="px-4 py-2.5 text-right font-medium">Rocznik</th>
              </tr>
            </thead>
            <tbody>
              {przekroj.top.map((m) => (
                <tr
                  key={`${m.make}-${m.linia}`}
                  className="border-b border-[var(--color-line)] last:border-0"
                >
                  <td className="px-4 py-2 font-medium text-neutral-200">
                    <Link href={makeHref(m.make)} className="hover:text-accent">
                      {m.make}
                    </Link>{" "}
                    {m.linia}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-neutral-400">
                    {num.format(m.n)}
                  </td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums text-neutral-100">
                    {pln.format(m.cena)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-neutral-500">{m.rocznik}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <h2 className="mb-2 text-lg font-semibold text-neutral-100">
          Metodologia — i czego te liczby NIE mówią
        </h2>
        <ul className="flex flex-col gap-2 text-[13px] leading-relaxed text-neutral-300">
          <li>
            Dane zbieramy codziennie z 26 publicznych źródeł: serwisów sprzedażowych firm
            leasingowych, firm zarządzających flotami, aukcji poleasingowych i programów aut
            używanych producentów. To nie jest cały rynek aut używanych w Polsce.
          </li>
          <li>
            <span className="font-medium">„Zniknęła z oferty” nie zawsze znaczy „sprzedana”.</span>{" "}
            Sprzedający mógł zdjąć ogłoszenie albo przenieść auto. Czas w ofercie jest więc górnym
            przybliżeniem tempa sprzedaży, a nie jego pomiarem.
          </li>
          <li>
            Zniknięcia obserwujemy od {dzien.format(OD)}. To za krótko, żeby mówić o trendach
            w czasie — raport opisuje stan rynku, nie jego zmianę.
          </li>
          <li>
            Ceny i czasy liczymy wyłącznie z ofert „kup teraz”. Licytacje pomijamy, bo bieżąca
            stawka nie jest ceną sprzedaży.
          </li>
          <li>
            Nazwy modeli łączymy w linie (np. BMW 520d i 530e to Seria 5). Przy rzadkich wersjach
            przypisanie bywa przybliżone.
          </li>
        </ul>
      </section>

      <section className="mb-6 rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
        <h2 className="mb-2 text-lg font-semibold text-neutral-100">Dla mediów</h2>
        <p className="max-w-[72ch] text-[13px] leading-relaxed text-neutral-300">
          Dane z tego raportu można cytować i przedrukowywać z podaniem źródła:{" "}
          <span className="text-neutral-100">autopoleasingu.pl</span>, z linkiem do tej strony.
          Liczby odświeżają się codziennie, więc przy cytowaniu warto podać datę. Jeśli
          potrzebujesz innego przekroju — konkretnej marki, miasta albo segmentu — napisz:{" "}
          <a
            href="mailto:kontakt@autopoleasingu.pl"
            className="underline decoration-dotted underline-offset-2 hover:text-accent"
          >
            kontakt@autopoleasingu.pl
          </a>
          .
        </p>
      </section>

      <p className="text-[13px] text-neutral-500">
        Zobacz też:{" "}
        <Link
          href="/analizy/utrata-wartosci"
          className="underline decoration-dotted underline-offset-2 hover:text-accent"
        >
          ile auto traci na wartości
        </Link>
        ,{" "}
        <Link
          href="/analizy/ten-sam-vin-dwie-ceny"
          className="underline decoration-dotted underline-offset-2 hover:text-accent"
        >
          ten sam samochód, dwie ceny
        </Link>{" "}
        i{" "}
        <Link
          href="/dane"
          className="underline decoration-dotted underline-offset-2 hover:text-accent"
        >
          pełne dane rynkowe
        </Link>
        .
      </p>
    </main>
  );
}
