import { Crumbs } from "@/components/Crumbs";
import { Faq, Lista, Sekcja, Uwaga } from "@/components/Poradnik";
import { StatStrip } from "@/components/StatStrip";
import { ZapisPasek } from "@/components/ZapisPasek";
import {
  getRaportNapedyWgRocznika,
  getRaportObnizki,
  getRaportPrzekroj,
  getStats,
} from "@/lib/queries";
import { CircleHelp } from "lucide-react";
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

export const metadata: Metadata = {
  title: "Czy warto kupić auto poleasingowe? Odpowiedź w danych z ponad 20 tys. ofert",
  description:
    "Zalety i wady aut po leasingu policzone na realnych ofertach: przebiegi według rocznika, " +
    "ceny, częstość obniżek. Bez ogólników — z liczbami i z tym, na co uważać.",
  alternates: { canonical: "/poradnik/czy-warto-kupic-auto-poleasingowe" },
};

const a = "underline decoration-dotted underline-offset-2 hover:text-accent";

/**
 * "Auto poleasingowe czy warto" — jedna z najczesciej podpowiadanych fraz.
 *
 * Kazdy portal odpowiada na nia tym samym zestawem ogolnikow. My mamy liczby,
 * wiec tekst jest zbudowany wokol nich: kazda zaleta i kazda wada stoi obok
 * danej, ktora ja potwierdza albo oslabia. Nie dopisywac twierdzen, ktorych
 * nie da sie pokazac w bazie.
 */
export default async function CzyWarto() {
  await connection();
  const [stats, lata, obnizki, przekroj] = await Promise.all([
    getStats(),
    getRaportNapedyWgRocznika(),
    getRaportObnizki(),
    getRaportPrzekroj(),
  ]);

  const udzialObnizek = obnizki.wszystkich > 0 ? (obnizki.zObnizka / obnizki.wszystkich) * 100 : 0;
  // Trzylatek to typowy wiek auta wracajacego z leasingu.
  const rok = new Date().getFullYear();
  const trzylatek = lata.find((l) => l.year === rok - 3);

  return (
    <main className="mx-auto max-w-[860px] px-4 py-6">
      <Crumbs
        items={[{ label: "Poradniki", href: "/poradnik" }, { label: "Czy warto kupić poleasingowe" }]}
      />

      <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight text-neutral-100">
        <CircleHelp size={22} className="text-neutral-600" />
        Czy warto kupić auto poleasingowe?
      </h1>
      <p className="mb-5 mt-1 max-w-[72ch] text-sm leading-relaxed text-neutral-400">
        Krótko: zwykle tak, jeśli wiesz, co kupujesz. Auto po leasingu to najczęściej kilkuletni
        samochód z jednym właścicielem i fakturą, ale z przebiegiem wyższym niż u prywatnego
        sprzedawcy. Poniżej liczby z {num.format(stats.active)} aktualnych ofert.
      </p>

      <StatStrip
        items={[
          { label: "Ofert w bazie", value: num.format(stats.active), hint: "26 źródeł" },
          { label: "Mediana ceny", value: pln.format(przekroj.mediana), hint: "„kup teraz”" },
          { label: "Typowy rocznik", value: String(przekroj.rocznik), hint: "mediana" },
          { label: "Mediana przebiegu", value: `${num.format(przekroj.przebieg)} km` },
          { label: "Ofert z obniżką", value: `${proc.format(udzialObnizek)}%` },
        ]}
      />

      <Sekcja tytul="Co przemawia za">
        <Lista>
          <li>
            <span className="text-neutral-100">To młode auta.</span> Typowy samochód w ofercie to
            rocznik {przekroj.rocznik} — leasing trwa zwykle kilka lat, więc na rynek wracają
            egzemplarze, które mają przed sobą większość życia.
          </li>
          <li>
            <span className="text-neutral-100">Znana historia.</span> Sprzedającym jest firma
            leasingowa, firma flotowa albo dealer, a nie przypadkowy handlarz. Dostajesz fakturę,
            a samochód zwykle miał jednego użytkownika.
          </li>
          <li>
            <span className="text-neutral-100">Jest z czego wybierać.</span> W jednym momencie na
            rynku jest ponad {num.format(Math.floor(stats.active / 1000) * 1000)} takich aut, więc
            ten sam model da się porównać w kilkunastu egzemplarzach.
          </li>
          <li>
            <span className="text-neutral-100">Ceny da się sprawdzić.</span> To samo auto bywa
            wystawione w dwóch miejscach w różnych cenach —{" "}
            <Link href="/analizy/ten-sam-vin-dwie-ceny" className={a}>
              pokazujemy takie przypadki
            </Link>
            .
          </li>
        </Lista>
      </Sekcja>

      <Sekcja tytul="Co przemawia przeciw">
        <Lista>
          <li>
            <span className="text-neutral-100">Przebiegi są wysokie.</span> Auta flotowe jeżdżą
            dużo.
            {trzylatek?.przebieg != null && (
              <>
                {" "}
                Trzyletni samochód (rocznik {trzylatek.year}) ma u nas medianę{" "}
                {num.format(trzylatek.przebieg)} km.
              </>
            )}{" "}
            Tabela niżej pokazuje to rocznik po roczniku.
          </li>
          <li>
            <span className="text-neutral-100">Na aukcjach kupujesz bez gwarancji.</span>{" "}
            Regulaminy aukcji poleasingowych zwykle wyłączają gwarancję sprzedającego, a firmom
            także rękojmię. Oględziny i dokumenty są tu ważniejsze niż u dealera.
          </li>
          <li>
            <span className="text-neutral-100">Cena netto potrafi zmylić.</span> Część ofert,
            zwłaszcza licytacje, podaje cenę netto. Osoba prywatna dopłaci 23% VAT. W naszej
            wyszukiwarce wszystkie ceny są przeliczone na brutto.
          </li>
          <li>
            <span className="text-neutral-100">To nie zawsze okazja.</span> Tylko{" "}
            {proc.format(przekroj.do50)}% ofert kosztuje do 50 tys. zł. Auto po leasingu bywa
            tańsze od podobnego u prywatnego sprzedawcy, ale nie jest z definicji tanie.
          </li>
        </Lista>
      </Sekcja>

      {lata.length > 0 && (
        <section className="mb-7">
          <h2 className="mb-1 text-lg font-semibold text-neutral-100">
            Przebieg i cena według rocznika
          </h2>
          <p className="mb-3 max-w-[72ch] text-[13px] leading-relaxed text-neutral-500">
            Mediany z aktualnych ofert. Cena dotyczy ofert „kup teraz”.
          </p>
          <div className="overflow-x-auto rounded-xl border border-[var(--color-line)]">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-line)] text-left text-[11px] uppercase tracking-wide text-neutral-600">
                  <th className="px-4 py-2.5 font-medium">Rocznik</th>
                  <th className="px-4 py-2.5 text-right font-medium">Aut</th>
                  <th className="px-4 py-2.5 text-right font-medium">Przebieg</th>
                  <th className="px-4 py-2.5 text-right font-medium">Cena</th>
                </tr>
              </thead>
              <tbody>
                {[...lata].reverse().map((r) => (
                  <tr key={r.year} className="border-b border-[var(--color-line)] last:border-0">
                    <td className="px-4 py-2 font-medium text-neutral-200">{r.year}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-neutral-500">
                      {num.format(r.n)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-neutral-300">
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
        </section>
      )}

      <Sekcja tytul="Czy cenę da się negocjować">
        <p>
          Sprzedający sami obniżają ceny: {proc.format(udzialObnizek)}% ofert „kup teraz” miało
          przynajmniej jedną obniżkę. Typowa obniżka to {proc.format(obnizki.medianaProc)}%, czyli
          około {pln.format(obnizki.medianaZl)}. Mniej więcej co czwarta oferta z czasem tanieje,
          więc nie zawsze trzeba kupować pierwszego dnia — możesz{" "}
          <Link href="/poleasingowe/okazje" className={a}>
            przejrzeć oferty poniżej ceny rynkowej
          </Link>{" "}
          albo ustawić powiadomienie na konkretny model.
        </p>
      </Sekcja>

      <Sekcja tytul="Jak sprawdzić auto przed zakupem">
        <Lista>
          <li>
            Sprawdź historię w bezpłatnym serwisie historiapojazdu.gov.pl — potrzebne są numer
            rejestracyjny, VIN i data pierwszej rejestracji.
          </li>
          <li>
            Wpisz VIN w naszej{" "}
            <Link href="/vin" className={a}>
              wyszukiwarce VIN
            </Link>
            , żeby zobaczyć, czy to samo auto nie jest wystawione gdzie indziej taniej.
          </li>
          <li>Porównaj przebieg z medianą dla rocznika z tabeli wyżej.</li>
          <li>
            Przy aukcji przeczytaj opis i regulamin: rodzaj ceny, prowizję, wadium i terminy. Zasady
            dwóch największych platform opisaliśmy osobno:{" "}
            <Link href="/poradnik/aukcje-pko-leasing" className={a}>
              PKO Leasing
            </Link>{" "}
            i{" "}
            <Link href="/poradnik/aukcje-efl-poleasingowe" className={a}>
              EFL
            </Link>
            .
          </li>
        </Lista>
      </Sekcja>

      <Uwaga>
        Liczby pochodzą z ofert zebranych z 26 źródeł i odświeżają się codziennie. Opisują rynek
        aut poleasingowych, a nie konkretny egzemplarz — stan każdego samochodu trzeba sprawdzić
        osobno. Metodologia:{" "}
        <Link href="/analizy/raport-rynku-poleasingowego" className={a}>
          raport rynku poleasingowego
        </Link>
        .
      </Uwaga>

      <Faq
        pytania={[
          {
            q: "Czy auto poleasingowe to dobry wybór dla osoby prywatnej?",
            a: "Zwykle tak: to kilkuletnie auta z jednym użytkownikiem, sprzedawane przez firmę na fakturę. Trzeba liczyć się z wyższym przebiegiem i sprawdzić, czy cena jest podana brutto.",
          },
          {
            q: "Jakie przebiegi mają auta poleasingowe?",
            a: "Wyższe niż auta prywatne w tym samym wieku, bo jeździły we flotach. Aktualne mediany dla każdego rocznika pokazujemy w tabeli na tej stronie.",
          },
          {
            q: "Czy auto poleasingowe ma gwarancję?",
            a: "To zależy od sprzedającego. Programy aut używanych dealerów często dają gwarancję, a na aukcjach poleasingowych sprzedający zwykle jej nie udziela.",
          },
        ]}
      />

      <ZapisPasek
        typ="poradnik-czy-warto"
        tytul="Przysyłać najlepsze okazje poleasingowe?"
        opis="Raz dziennie dwanaście ofert najbardziej odstających od ceny rynkowej."
        label="Najlepsze nowe okazje"
        filters={{}}
      />
    </main>
  );
}
