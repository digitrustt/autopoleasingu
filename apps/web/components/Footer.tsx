import { FooterSignup } from "@/components/FooterSignup";
import { Logo } from "@/components/Logo";
import Link from "next/link";

/**
 * Stopka — pas na pelna szerokosc okna, tresc zawezona do tych samych
 * 1400px co lista ofert.
 *
 * Ramka i tlo ida od krawedzi do krawedzi, zeby stopka czytala sie jako
 * osobne pietro strony, a nie jako kolejny akapit doklejony pod ostatnia
 * karta. Tekst mimo to trzyma sie siatki `main`, inaczej logo w stopce
 * nie stalo by w jednej pionowej linii z logo w naglowku.
 *
 * Reszta interfejsu jest bezbarwna, zeby kolor niosl wylacznie informacje
 * (zielony = nowa, bursztyn = przecena, fiolet = aukcja). Stopka trzyma sie
 * tej samej zasady — jedyny mocny akcent to przycisk zapisu, bo to jedyna
 * rzecz, ktora ma tu cokolwiek robic.
 */
const LINKS = [
  { href: "/zrodla", label: "Źródła" },
  { href: "/regulamin", label: "Regulamin" },
  { href: "/polityka-prywatnosci", label: "Prywatność" },
  { href: "/cookies", label: "Cookies" },
];

export function Footer() {
  return (
    <footer className="mt-16 border-t border-[var(--color-line)] bg-[var(--color-panel)]/40">
      {/*
        Zapis na powiadomienia jest w stopce, bo formularz nad lista pokazuje
        sie tylko przy ustawionym filtrze i przez to byl nie do znalezienia.
      */}
      <div className="mx-auto grid max-w-[1400px] gap-x-12 gap-y-6 px-4 py-10 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div>
          <p className="text-[15px] font-medium text-neutral-100">Nie przegap okazji</p>
          <p className="mt-1.5 max-w-[52ch] text-[13px] leading-relaxed text-neutral-500">
            Codziennie przeglądamy 26 źródeł poleasingowych i wybieramy oferty najbardziej
            odstające od ceny rynkowej. Jedna wiadomość dziennie, dwanaście najlepszych.
          </p>
        </div>

        <FooterSignup />
      </div>

      <div className="border-t border-[var(--color-line)]">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-x-8 gap-y-3 px-4 py-5 text-[13px] text-neutral-500">
          <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <Logo />
            {/*
              Zdanie, ktore musi tu byc: serwis nie sprzedaje aut i nie posredniczy.
              Bez tego uzytkownik moze wziac nas za sprzedajacego i miec roszczenia
              o rzeczy, na ktore nie mamy wplywu.
            */}
            <span className="text-neutral-600">
              Porównywarka ofert. Nie sprzedajemy aut ani nie pośredniczymy.
            </span>
          </p>

          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="transition-colors hover:text-accent">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
