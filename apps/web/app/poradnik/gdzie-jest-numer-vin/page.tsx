import { Crumbs } from "@/components/Crumbs";
import { HistoriaBlok } from "@/components/HistoriaBlok";
import { Faq, Lista, Sekcja, Uwaga, type Pytanie } from "@/components/Poradnik";
import { VinSzukaj } from "@/components/VinSzukaj";
import type { Metadata } from "next";
import Link from "@/components/Link";

export const metadata: Metadata = {
  title: "Gdzie jest numer VIN w samochodzie i w dokumentach",
  description:
    "Gdzie szukać VIN-u: dowód rejestracyjny (pole E), szyba, tabliczka znamionowa, nadwozie, " +
    "polisa OC. Jak sprawdzić, czy numery w aucie i w papierach się zgadzają.",
  alternates: { canonical: "/poradnik/gdzie-jest-numer-vin" },
};

const a = "underline decoration-dotted underline-offset-2 hover:text-accent";

const pytania: Pytanie[] = [
  {
    q: "W którym polu dowodu rejestracyjnego jest VIN?",
    a: "W polu E. To 17-znakowy numer identyfikacyjny pojazdu.",
  },
  {
    q: "Czy VIN da się sprawdzić bez oglądania auta?",
    a:
      "Tak, jeśli sprzedawca poda go w ogłoszeniu albo na prośbę. W autach poleasingowych VIN " +
      "często jest wprost w ofercie. Brak zgody na podanie numeru to sygnał ostrzegawczy.",
  },
  {
    q: "Co zrobić, gdy VIN w aucie różni się od tego w dowodzie?",
    a:
      "Nie kupować, dopóki rozbieżność się nie wyjaśni. Numer wybity na nadwoziu, na tabliczce " +
      "i w dokumentach musi być identyczny — różnica może oznaczać przebitkę albo auto złożone z dwóch.",
  },
  {
    q: "Ile znaków ma numer VIN?",
    a: "Siedemnaście. Nie ma w nim liter I, O i Q, żeby nie myliły się z cyframi 1 i 0.",
  },
];

/**
 * "Gdzie jest VIN" / "gdzie znalezc numer VIN" — fraza z duzym ruchem,
 * czysto informacyjna. Tresc statyczna, bez bazy (zero kosztu na Vercelu).
 *
 * Tylko miejsca wspolne dla prawie wszystkich aut. Dokladne polozenie
 * numeru wybitego na nadwoziu rozni sie miedzy modelami, wiec NIE podajemy
 * go per marka — zla wskazowka jest gorsza niz odeslanie do instrukcji.
 */
export default function GdzieVin() {
  return (
    <main className="mx-auto max-w-[860px] px-4 py-6">
      <Crumbs items={[{ label: "Poradniki", href: "/poradnik" }, { label: "Gdzie jest numer VIN" }]} />

      <h1 className="mb-2 text-2xl font-bold tracking-tight text-neutral-100">
        Gdzie jest numer VIN w samochodzie
      </h1>
      <p className="mb-6 max-w-[72ch] text-[15px] leading-relaxed text-neutral-400">
        VIN to 17-znakowy numer nadwozia — jedyny identyfikator, który zostaje z autem przez całe
        życie, niezależnie od tablic i właścicieli. Znajdziesz go w kilku miejscach w aucie
        i w dokumentach, a przed zakupem warto sprawdzić, że wszędzie jest ten sam.
      </p>

      <Sekcja tytul="W dokumentach">
        <Lista>
          <li>
            <strong className="text-neutral-100">Dowód rejestracyjny</strong> — pole E.
          </li>
          <li>
            <strong className="text-neutral-100">Polisa OC</strong> — numer nadwozia jest w danych
            pojazdu.
          </li>
          <li>
            <strong className="text-neutral-100">Karta pojazdu, faktura, umowa kupna</strong> — o ile
            auto je ma; przy autach poleasingowych także dokumenty od leasingodawcy.
          </li>
          <li>
            <strong className="text-neutral-100">Ogłoszenie</strong> — w ofertach poleasingowych VIN
            bywa podany wprost; u nas jest w danych technicznych każdej oferty, która go ma.
          </li>
        </Lista>
      </Sekcja>

      <Sekcja tytul="W samochodzie">
        <Lista>
          <li>
            <strong className="text-neutral-100">Pod przednią szybą</strong> — w większości
            nowszych aut tabliczka z numerem jest widoczna z zewnątrz, w dolnym rogu szyby po stronie
            kierowcy.
          </li>
          <li>
            <strong className="text-neutral-100">Tabliczka znamionowa</strong> — zwykle na słupku
            drzwi kierowcy albo pasażera, czasem w komorze silnika.
          </li>
          <li>
            <strong className="text-neutral-100">Numer wybity na nadwoziu</strong> — najczęściej
            w komorze silnika na przegrodzie albo pod wykładziną przy przednim fotelu. Dokładne
            miejsce podaje instrukcja obsługi danego modelu.
          </li>
          <li>
            <strong className="text-neutral-100">W elektronice auta</strong> — w nowszych autach VIN
            pokazuje komputer pokładowy albo aplikacja producenta, a odczyta go też każdy
            diagnostyczny interfejs OBD.
          </li>
        </Lista>
      </Sekcja>

      <Uwaga>
        Przed zakupem porównaj numer z szyby, z tabliczki i wybity na nadwoziu z tym w dowodzie
        rejestracyjnym. Muszą być identyczne co do znaku. Ślady szlifowania, kleju albo
        przemalowania wokół numeru to powód, żeby odpuścić.
      </Uwaga>

      <Sekcja tytul="Masz VIN — co dalej">
        <p>
          Wpisz go poniżej. Sprawdzimy, czy ten egzemplarz był albo jest w ofertach poleasingowych
          i po ile, oraz odczytamy, co mówi sam numer — producenta, kraj i rok, o ile ta marka go
          zapisuje (
          <Link href="/poradnik/rok-produkcji-z-vin" className={a}>
            nie każda zapisuje
          </Link>
          ).
        </p>
        <VinSzukaj />
        <p>
          Podstawowe dane z polskiej ewidencji są bezpłatnie w historiapojazdu.gov.pl (potrzebny też
          numer rejestracyjny i data pierwszej rejestracji). Szkody, przebiegi i kradzieże po samym
          VIN-ie pokazuje płatny raport:
        </p>
        <HistoriaBlok vin={null} gdzie="poradnik-gdzie-vin" wariant="duzy" />
      </Sekcja>

      <Faq pytania={pytania} />
    </main>
  );
}
