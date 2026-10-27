import Link from "next/link";

const POZYCJE = [
  { href: "/poradnik/gdzie-jest-numer-vin", tekst: "Gdzie jest numer VIN w samochodzie" },
  { href: "/poradnik/rok-produkcji-z-vin", tekst: "Jak odczytać rok produkcji z numeru VIN" },
  { href: "/poradnik/kody-producentow-vin", tekst: "Kody producentów w numerze VIN" },
];

/**
 * Trzy poradniki o VIN-ie w jednym bloku.
 *
 * Search Console (27.10.2026): wszystkie trzy w stanie "zeskanowana, ale
 * niezindeksowana". Link prowadzil do nich prawie wylacznie z /vin, a to nie
 * jest strona, ktora robot odwiedza czesto. Stoja tu na stronach, ktore
 * odwiedza najczesciej: ofertach i stronach VIN.
 */
export function PoradnikiVin({ className = "" }: { className?: string }) {
  return (
    <nav className={className} aria-label="Poradniki o numerze VIN">
      <h2 className="mb-3 text-base font-semibold text-neutral-100">Numer VIN: poradniki</h2>
      <ul className="flex flex-wrap gap-2 text-[13px]">
        {POZYCJE.map((p) => (
          <li key={p.href}>
            <Link
              href={p.href}
              className="inline-block rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-1.5 text-neutral-300 transition-colors hover:border-neutral-600 hover:text-neutral-100"
            >
              {p.tekst}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
