import { FooterSignup } from "@/components/FooterSignup";
import { Logo } from "@/components/Logo";
import Link from "next/link";

/**
 * Stopka — celowo jedna linia.
 *
 * Reszta interfejsu jest bezbarwna, zeby kolor niosl wylacznie informacje
 * (zielony = nowa, bursztyn = przecena, fiolet = aukcja). Stopka trzyma sie tej
 * samej zasady: same odnosniki, zero ramek, zero tla, nic co konkuruje
 * z lista ofert.
 */
const LINKS = [
  { href: "/zrodla", label: "Źródła" },
  { href: "/regulamin", label: "Regulamin" },
  { href: "/polityka-prywatnosci", label: "Prywatność" },
  { href: "/cookies", label: "Cookies" },
];

export function Footer() {
  return (
    <footer className="mx-auto mt-12 max-w-[1400px] border-t border-[var(--color-line)] px-4 py-6">
      {/*
        Zapis na powiadomienia w stopce, bo formularz nad lista pokazuje sie
        tylko przy ustawionym filtrze i przez to byl niewidoczny.
      */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-x-6 gap-y-4 border-b border-[var(--color-line)] pb-5">
        <p className="max-w-[46ch] text-[13px] leading-relaxed text-neutral-400">
          <span className="text-neutral-200">Nie przegap okazji.</span> Codziennie sprawdzamy
          26 źródeł i wybieramy oferty najbardziej odstające od ceny rynkowej.
        </p>
        <FooterSignup />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 text-[13px] text-neutral-500">
        <p>
          <Logo />
          {/*
            Zdanie, ktore musi tu byc: serwis nie sprzedaje aut i nie posredniczy.
            Bez tego uzytkownik moze wziac nas za sprzedajacego i miec roszczenia
            o rzeczy, na ktore nie mamy wplywu.
          */}
          <span className="ml-2 text-neutral-600">
            Porównywarka ofert. Nie sprzedajemy aut ani nie pośredniczymy.
          </span>
        </p>

        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="transition-colors hover:text-accent">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
