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
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 text-[13px] text-neutral-500">
        <p>
          <span className="text-neutral-300">
            auto<span className="text-accent">poleasingu</span>
            <span className="text-neutral-600">.pl</span>
          </span>
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
