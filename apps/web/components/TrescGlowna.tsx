import { GRUPY } from "@/lib/filtry";
import { WOJEWODZTWA } from "@/lib/wojewodztwa";
import { getMenuData } from "@/lib/menu";
import { slugMiasta } from "@/lib/miasta";
import { makeHref } from "@/lib/slug";
import Link from "next/link";

const num = new Intl.NumberFormat("pl-PL");
const pln = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0,
});

const chip =
  "inline-block rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-1.5 text-[13px] text-neutral-300 transition-colors hover:border-neutral-600 hover:text-neutral-100";

/**
 * Tresc pod listingiem na stronie glownej, pokazywana tylko bez filtrow.
 *
 * Strona glowna byla samym narzedziem: naglowek, formularz i siatka aut, bez
 * ani jednego akapitu. Search Console pokazywal "samochody poleasingowe" na
 * pozycji ~75 — Google nie mial z czego wywnioskowac, ze to strona o tym
 * temacie, a nie wyszukiwarka z dynamiczna lista. Tu sa: akapity o samym
 * zjawisku, wezel linkow do kategorii, marek i miast (strona glowna rozdaje
 * dzieki temu autorytet w dol) oraz odpowiedzi na pytania, ktore ludzie
 * wpisuja.
 *
 * Liczby (oferty, mediana) przychodza z propsow, wiec tekst nie starzeje sie
 * miedzy zaciagami. Zadnych stawek i warunkow kredytu — patrz FinansowanieBlok.
 */
export async function TrescGlowna({
  aktywne,
  mediana,
  zrodel,
}: {
  aktywne: number;
  mediana: number;
  zrodel: number;
}) {
  const menu = await getMenuData();
  const marki = menu.marki.slice(0, 16);
  const miasta = menu.miasta.slice(0, 16);

  return (
    <section className="mt-12 max-w-[900px] border-t border-[var(--color-line)] pt-8" aria-labelledby="co-to-poleasingowe">
      <h2 id="co-to-poleasingowe" className="text-xl font-semibold text-neutral-100">
        Samochody poleasingowe — co to takiego i skąd się biorą
      </h2>
      <div className="mt-3 space-y-3 text-[14px] leading-relaxed text-neutral-400">
        <p>
          Samochód poleasingowy to auto, które przez kilka lat jeździło w leasingu, najczęściej
          firmowym, a po zakończeniu umowy wraca do sprzedaży. Firmy leasingowe i wypożyczalnie
          długoterminowe (CFM) wymieniają floty regularnie, więc na rynku jest stale dużo
          jednorazowych egzemplarzy z podobnego rocznika. Zwykle mają jednego właściciela i
          serwis w ASO, ale to trzeba zawsze sprawdzić w konkretnym ogłoszeniu.
        </p>
        <p>
          Sprzedają je leasingodawcy, dealerzy marek, wyspecjalizowane salony i platformy
          aukcyjne, każdy na swojej stronie. Autopoleasingu.pl zbiera je w jednym miejscu: teraz{" "}
          {num.format(aktywne)} aktywnych ofert z {zrodel} źródeł, z medianą ceny {pln.format(mediana)}.
          Oferty odświeżamy codziennie, a przy każdej widać historię zmian ceny i to, czy ten sam
          VIN wystawiono u kilku sprzedawców naraz.
        </p>
      </div>

      <h2 className="mt-8 text-xl font-semibold text-neutral-100">Na co patrzeć przy zakupie auta po leasingu</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-[14px] leading-relaxed text-neutral-400">
        <li>
          <strong className="font-medium text-neutral-300">Cena względem rynku.</strong> Przy każdej
          ofercie porównujemy ją z medianą dla tego samego rocznika, przebiegu, paliwa i skrzyni.
          Tak widać, które auta są poniżej rynku (
          <Link href="/poleasingowe/okazje" className="text-accent hover:underline">
            okazje poleasingowe
          </Link>
          ).
        </li>
        <li>
          <strong className="font-medium text-neutral-300">Historia pojazdu.</strong> Numer VIN
          pozwala sprawdzić przebieg, szkody i poprzednich właścicieli. Zobacz{" "}
          <Link href="/poradnik/gdzie-jest-numer-vin" className="text-accent hover:underline">
            gdzie jest numer VIN
          </Link>
          , jak{" "}
          <Link href="/poradnik/rok-produkcji-z-vin" className="text-accent hover:underline">
            odczytać z niego rok produkcji
          </Link>{" "}
          i co znaczą{" "}
          <Link href="/poradnik/kody-producentow-vin" className="text-accent hover:underline">
            kody producentów
          </Link>
          . Resztę opisujemy w{" "}
          <Link href="/poradnik/czy-warto-kupic-auto-poleasingowe" className="text-accent hover:underline">
            poradniku: czy warto kupić auto poleasingowe
          </Link>
          .
        </li>
        <li>
          <strong className="font-medium text-neutral-300">Rodzaj sprzedawcy i faktura.</strong> Część
          aut jest sprzedawana z fakturą VAT, część jako sprzedaż bez VAT. To zmienia ostateczny
          koszt, więc warunki sprawdź u sprzedawcy (
          <Link href="/poleasingowe/dla-osoby-prywatnej" className="text-accent hover:underline">
            auta poleasingowe dla osoby prywatnej
          </Link>
          ).
        </li>
        <li>
          <strong className="font-medium text-neutral-300">Kup teraz czy licytacja.</strong> Kwota
          w licytacji jeszcze rośnie, dlatego kategorie cenowe na stronie pokazują wyłącznie oferty
          „kup teraz”.
        </li>
      </ul>

      <h2 className="mt-8 text-xl font-semibold text-neutral-100">Samochody poleasingowe według kategorii</h2>
      <div className="mt-3 space-y-4">
        {GRUPY.filter((g) => g.tytul !== "Pozostałe").map((g) => (
          <div key={g.tytul}>
            <h3 className="mb-2 text-[13px] font-medium text-neutral-500">{g.tytul}</h3>
            <ul className="flex flex-wrap gap-2">
              {g.pozycje.map((k) => (
                <li key={k.slug}>
                  <Link href={`/poleasingowe/${k.slug}`} className={chip}>
                    {k.h1}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="text-[13px] text-neutral-500">
          Pełny spis, razem z ofertami z automatem i 7-osobowymi:{" "}
          <Link href="/poleasingowe" className="text-accent hover:underline">
            wszystkie kategorie
          </Link>
          .
        </p>
      </div>

      <h2 className="mt-8 text-xl font-semibold text-neutral-100">Samochody poleasingowe według województwa</h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {WOJEWODZTWA.map((w) => (
          <li key={w.slug}>
            <Link href={`/poleasingowe/${w.slug}`} className={chip}>
              {w.nazwa}
            </Link>
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-xl font-semibold text-neutral-100">Poleasingowe według marki</h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {marki.map((m) => (
          <li key={m.make}>
            <Link href={makeHref(m.make)} className={chip}>
              {m.make} poleasingowe <span className="text-neutral-600">{num.format(m.total)}</span>
            </Link>
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-xl font-semibold text-neutral-100">Samochody poleasingowe w twoim mieście</h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {miasta.map((m) => (
          <li key={m.city}>
            <Link href={`/poleasingowe/${slugMiasta(m.city ?? "")}`} className={chip}>
              {m.city} <span className="text-neutral-600">{num.format(m.total)}</span>
            </Link>
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-xl font-semibold text-neutral-100">Najczęstsze pytania</h2>
      <dl className="mt-3 space-y-4 text-[14px] leading-relaxed">
        <div>
          <dt className="font-medium text-neutral-200">Czy warto kupić samochód poleasingowy?</dt>
          <dd className="mt-1 text-neutral-400">
            Często tak, bo to auta z udokumentowanym serwisem, sprzedawane po kilku latach, gdy
            największy spadek wartości jest już za nimi. Warunek: sprawdzić historię po numerze VIN i
            porównać cenę z rynkiem, co robimy przy każdej ofercie.
          </dd>
        </div>
        <div>
          <dt className="font-medium text-neutral-200">Ile kosztują samochody poleasingowe?</dt>
          <dd className="mt-1 text-neutral-400">
            Mediana cen w naszej bazie to teraz {pln.format(mediana)}. Zakres jest szeroki: od{" "}
            <Link href="/poleasingowe/do-30-tys" className="text-accent hover:underline">
              aut do 30 tys. zł
            </Link>{" "}
            po{" "}
            <Link href="/poleasingowe/do-150-tys" className="text-accent hover:underline">
              samochody do 150 tys. zł
            </Link>{" "}
            i droższe.
          </dd>
        </div>
        <div>
          <dt className="font-medium text-neutral-200">Czy auto poleasingowe można kupić na raty?</dt>
          <dd className="mt-1 text-neutral-400">
            Zwykle tak, kredytem samochodowym. Warunki zależą od banku, od sprzedawcy i od twojej
            zdolności kredytowej, więc ratę sprawdzisz u kredytodawcy, a nie u nas. Więcej w
            artykule{" "}
            <Link href="/poleasingowe/na-raty" className="text-accent hover:underline">
              samochody poleasingowe na raty
            </Link>
            .
          </dd>
        </div>
        <div>
          <dt className="font-medium text-neutral-200">Czy auto poleasingowe można wziąć w leasing?</dt>
          <dd className="mt-1 text-neutral-400">
            Kupując na firmę — zwykle tak. Leasingodawcy finansują też auta używane, a samochody
            poleasingowe sprzedają głównie firmy wystawiające fakturę. Warunki ustala leasingodawca.
            Więcej:{" "}
            <Link href="/poleasingowe/w-leasingu" className="text-accent hover:underline">
              samochody poleasingowe w leasingu
            </Link>
            .
          </dd>
        </div>
        <div>
          <dt className="font-medium text-neutral-200">Gdzie szukać aut po leasingu?</dt>
          <dd className="mt-1 text-neutral-400">
            Oferty są rozproszone po stronach leasingodawców, dealerów i aukcji. Zebraliśmy{" "}
            <Link href="/zrodla" className="text-accent hover:underline">
              {zrodel} źródeł
            </Link>{" "}
            w jednym wyszukiwaniu, żeby nie trzeba było sprawdzać ich osobno.
          </dd>
        </div>
      </dl>
    </section>
  );
}
