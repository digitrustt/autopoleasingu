import { MegaMenu } from "@/components/MegaMenu";
import { Logo } from "@/components/Logo";
import { getMenuData } from "@/lib/menu";
import Link from "next/link";

/**
 * Staly naglowek na kazdej podstronie.
 *
 * POWOD: do tej pory serwis nie mial go wcale. Strona glowna miala wlasny
 * naglowek wpisany w tresc, podstrony marek i ofert mialy okruszki, a
 * /zrodla, /regulamin, /cookies i /vin/<numer> nie mialy NIC — czlowiek, ktory
 * wszedl tam prosto z wyszukiwarki, nie mial zadnego widocznego sposobu, zeby
 * przejsc do reszty serwisu. Okruszki niby prowadza do strony glownej, ale to
 * szary tekst 13 px w linii z reszta sciezki; nikt nie czyta go jako "powrot".
 *
 * Ma znaczenie takze dla wyszukiwarki: staly zestaw linkow z KAZDEJ strony do
 * kategorii, porownan i danych rynkowych rozprowadza autorytet po serwisie.
 * Przy 2 301 zaindeksowanych stronach, z ktorych 950 dostaje wyswietlenia, a
 * srednia pozycja to 26, linkowanie wewnetrzne jest jedyna dzwignia pozycji,
 * ktora nie wymaga kupowania linkow z zewnatrz.
 *
 * Przyklejony do gory, bo powrot ma byc dostepny bez przewijania do konca
 * dlugiej listy ofert. Polprzezroczyste tlo z rozmyciem, zeby tresc pod spodem
 * byla widoczna i naglowek nie odcinal sie jak osobny pasek.
 */
const LINKI = [
  { href: "/poleasingowe", label: "Kategorie" },
  { href: "/porownaj", label: "Porównania" },
  { href: "/dane", label: "Dane rynkowe" },
  { href: "/vin", label: "Sprawdź VIN" },
];

export async function Header() {
  const menu = await getMenuData();

  return (
    /*
      NIE `sticky`. Naglowek odjezdza razem z trescia — przy dlugiej liscie ofert
      pasek przyklejony do gory zabiera pionowy ekran tam, gdzie jest go najmniej,
      a powrot do gory zalatwia klawisz Home albo przewijanie.
      `relative` jest natomiast konieczne: panele megamenu pozycjonuja sie
      wzgledem CALEGO naglowka, zeby isc przez pelna szerokosc okna. Gdyby
      punktem odniesienia byl kontener 1400 px, panel konczylby sie w powietrzu
      przed krawedzia ekranu.

      BEZ `backdrop-blur` na naglowku. Element z tym filtrem tworzy backdrop root
      dla swoich potomkow — panel megamenu probowal wtedy rozmywac zawartosc
      naglowka zamiast strony pod soba, wiec tresc czytala sie przez panel na
      wylot. Skoro naglowek nie jest przyklejony, i tak nigdy na nic nie nachodzi,
      wiec rozmycie nie mialo tu zadnego zadania. Szklo zostaje na panelach.
    */
    <header className="relative z-40 border-b border-white/[0.07] bg-[var(--color-ink)]">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-4">
        <Link
          href="/"
          aria-label="Strona główna — wszystkie oferty"
          className="shrink-0 transition-opacity hover:opacity-80"
        >
          <Logo className="text-[15px]" />
        </Link>

        <MegaMenu dane={menu} linki={LINKI} />
      </div>
    </header>
  );
}
