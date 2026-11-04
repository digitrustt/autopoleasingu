import { Crumbs } from "@/components/Crumbs";
import { HistoriaBlok } from "@/components/HistoriaBlok";
import { KalkulatorPcc } from "@/components/KalkulatorPcc";
import { Faq, Lista, Sekcja, Uwaga, type Pytanie } from "@/components/Poradnik";
import { UbezpieczenieBlok } from "@/components/UbezpieczenieBlok";
import { filtryMarek } from "@/lib/cache-filtrow";
import { OPLATY, PCC_DNI, REJESTRACJA_DNI, STAN_NA } from "@/lib/oplaty";
import type { Metadata } from "next";
import Link from "@/components/Link";

/* Strona prawie statyczna — z bazy tylko lista marek (bufor na godzine). */
export const revalidate = 86_400;

const zl = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", maximumFractionDigits: 2 });
const a = "underline decoration-dotted underline-offset-2 hover:text-accent";

export const metadata: Metadata = {
  title: "Kalkulator PCC od zakupu samochodu i opłat rejestracyjnych 2026",
  description:
    "Policz podatek PCC (2%) i koszt rejestracji auta: dowód, tablice, pozwolenie czasowe. " +
    "Terminy PCC-3 i rejestracji oraz porównanie ceny z medianą prawdziwych ofert.",
  alternates: { canonical: "/kalkulator-pcc-samochodu" },
};

const pytania: Pytanie[] = [
  {
    q: "Ile wynosi PCC od zakupu samochodu?",
    a: "2% wartości rynkowej auta. Płaci kupujący, gdy kupuje od osoby prywatnej na umowę kupna-sprzedaży. Przy wartości do 1000 zł podatku nie ma.",
  },
  {
    q: "Czy płaci się PCC za auto poleasingowe?",
    a:
      "Zwykle nie. Leasingodawcy i dealerzy sprzedają na fakturę VAT albo VAT-marża, a taka sprzedaż nie podlega PCC. " +
      "PCC zapłacisz, gdy kupujesz od osoby prywatnej — także takiej, która wcześniej wykupiła auto z leasingu.",
  },
  {
    q: "Ile mam czasu na złożenie PCC-3?",
    a: `${PCC_DNI} dni od podpisania umowy. W tym samym terminie trzeba zapłacić podatek. Jeśli termin wypada w weekend albo święto, przesuwa się na najbliższy dzień roboczy.`,
  },
  {
    q: "Od jakiej kwoty liczy się PCC — z umowy czy rynkowej?",
    a:
      "Od wartości rynkowej. Zwykle przyjmuje się cenę z umowy, ale jeśli jest wyraźnie niższa od typowej dla tego modelu, " +
      "rocznika i stanu, urząd skarbowy może wezwać do jej podwyższenia.",
  },
  {
    q: "Ile kosztuje rejestracja samochodu w 2026 roku?",
    a:
      `Z zachowaniem dotychczasowych tablic ${zl.format(OPLATY.dowod)} za dowód, zwykle plus ${zl.format(OPLATY.pozwolenieZUrzedu)} za pozwolenie czasowe. ` +
      `Z nowymi tablicami dochodzi ${zl.format(OPLATY.tablice)} za tablice i ${zl.format(OPLATY.nalepkiLegalizacyjne)} za nalepki legalizacyjne.`,
  },
  {
    q: "Ile jest czasu na rejestrację kupionego auta?",
    a: `${REJESTRACJA_DNI} dni od zakupu. Sprzedający ma tyle samo czasu na zgłoszenie zbycia pojazdu.`,
  },
];

/**
 * "Kalkulator PCC samochod", "ile kosztuje rejestracja auta".
 *
 * Kwoty i terminy mieszkaja w lib/oplaty.ts razem z podstawa prawna i data
 * odczytu — nie wpisywac ich recznie w tresc, tylko brac stamtad.
 */
export default async function KalkulatorPccStrona() {
  const marki = await filtryMarek();

  return (
    <main className="mx-auto max-w-[1000px] px-4 py-6">
      <Crumbs items={[{ label: "Kalkulator PCC i opłat rejestracyjnych" }]} />

      <h1 className="mb-2 text-2xl font-bold tracking-tight text-neutral-100">
        Kalkulator PCC od zakupu samochodu i opłat rejestracyjnych
      </h1>
      <p className="mb-6 max-w-[72ch] text-[15px] leading-relaxed text-neutral-400">
        Policz, ile zapłacisz po zakupie auta: podatek od czynności cywilnoprawnych i opłaty
        w wydziale komunikacji. Jeśli podasz model i rocznik, porównamy cenę z umowy z medianą
        prawdziwych ofert — bo urząd liczy PCC od wartości rynkowej, nie od tego, co wpiszesz.
      </p>

      <KalkulatorPcc marki={marki} />

      <div className="mt-10">
        <Sekcja tytul="Kiedy płaci się PCC przy zakupie auta">
          <p>
            PCC płaci kupujący, gdy kupuje auto od osoby prywatnej na umowę kupna-sprzedaży. Stawka
            to 2% wartości rynkowej. Podatku nie ma, gdy:
          </p>
          <Lista>
            <li>
              kupujesz od firmy na fakturę — VAT, VAT-marża albo od firmy zwolnionej z VAT; tak sprzedaje
              większość leasingodawców i dealerów aut poleasingowych,
            </li>
            <li>wartość rynkowa auta nie przekracza 1000 zł.</li>
          </Lista>
        </Sekcja>

        <Sekcja tytul="Wartość rynkowa a cena z umowy">
          <p>
            Podstawą PCC jest wartość rynkowa: cena, jaką osiąga się za podobne auta — ten sam model,
            rocznik, stan i przebieg. Zwykle urząd przyjmuje kwotę z umowy, ale gdy jest wyraźnie zaniżona,
            może wezwać do jej podwyższenia, a potem sam ją określić.
          </p>
          <p>
            Dlatego kalkulator pokazuje medianę ofert z naszej bazy aut poleasingowych. To ceny ofert
            dealerów i leasingodawców, a nie transakcji między osobami prywatnymi, więc traktuj je jako punkt
            odniesienia. Jeśli płacisz mniej z konkretnego powodu — uszkodzenia, duży przebieg — opisz to
            w umowie.
          </p>
        </Sekcja>

        <Sekcja tytul="Jak złożyć PCC-3">
          <Lista>
            <li>
              Termin: {PCC_DNI} dni od podpisania umowy — w tym czasie składasz deklarację i płacisz podatek.
            </li>
            <li>
              Gdzie: w urzędzie skarbowym właściwym dla miejsca zamieszkania kupującego, najprościej online
              przez e-Urząd Skarbowy na podatki.gov.pl.
            </li>
            <li>Zapłata: na swój indywidualny mikrorachunek podatkowy.</li>
          </Lista>
        </Sekcja>

        <Sekcja tytul="Opłaty rejestracyjne w 2026 roku">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-[14px]">
              <tbody>
                {(
                  [
                    ["Dowód rejestracyjny", OPLATY.dowod],
                    ["Pozwolenie czasowe (wydawane przez urząd)", OPLATY.pozwolenieZUrzedu],
                    ["Pozwolenie czasowe na wniosek", OPLATY.pozwolenieNaWniosek],
                    ["Tablice rejestracyjne samochodowe", OPLATY.tablice],
                    ["Nalepki legalizacyjne na tablice", OPLATY.nalepkiLegalizacyjne],
                    ["Tablice indywidualne", OPLATY.tabliceIndywidualne],
                    ["Pełnomocnictwo (osoba spoza najbliższej rodziny)", OPLATY.pelnomocnictwo],
                  ] as const
                ).map(([n, v]) => (
                  <tr key={n} className="border-b border-[var(--color-line)]/60">
                    <td className="py-2 pr-3 text-neutral-300">{n}</td>
                    <td className="py-2 text-right text-neutral-100">{zl.format(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Od 10 czerwca 2026 przy zachowaniu dotychczasowych tablic nie trzeba ich ponownie legalizować —
            wystarczy oświadczenie, że są czytelne i mają nienaruszoną nalepkę. Rejestracja auta kupionego
            z tablicami kosztuje wtedy zwykle {zl.format(OPLATY.dowod + OPLATY.pozwolenieZUrzedu)}.
          </p>
        </Sekcja>

        <Uwaga>
          Stawki według rozporządzenia Ministra Infrastruktury w sprawie opłat za dowód rejestracyjny,
          pozwolenie czasowe i tablice (tekst jednolity Dz.U. 2025 poz. 553), stan na {STAN_NA}.
          Ministerstwo przygotowało projekt podwyżki tych opłat — do dnia aktualizacji nie wszedł w życie.
          Kalkulator nie jest poradą podatkową.
        </Uwaga>

        <Sekcja tytul="Przed zakupem i zaraz po nim">
          <p>
            Zanim podpiszesz umowę, sprawdź historię auta po numerze VIN — możesz go wpisać w{" "}
            <Link href="/vin" className={a}>
              naszą wyszukiwarkę
            </Link>
            , a szkody, przebiegi i kradzieże pokazuje raport:
          </p>
          <HistoriaBlok vin={null} gdzie="kalkulator-pcc" wariant="duzy" />
          <p className="mt-4">
            Po zakupie polisa OC sprzedającego przechodzi na ciebie i chroni auto do końca okresu, na który
            ją zawarto. Możesz ją wypowiedzieć i kupić własną — często taniej niż kontynuacja cudzej:
          </p>
          <UbezpieczenieBlok gdzie="kalkulator-pcc" />
        </Sekcja>

        <Faq pytania={pytania} />
      </div>
    </main>
  );
}
