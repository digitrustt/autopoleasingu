import { CarImage } from "@/components/CarImage";
import { makeHref } from "@/lib/slug";
import Link from "next/link";

const pln = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("pl-PL");

export interface MarkaKafelek {
  make: string;
  total: number;
  minPrice: number | null;
  thumb: string | null;
}

/**
 * Siatka marek ze zdjeciem przykladowego auta.
 *
 * Listy marek — na stronie leasingodawcy, miasta i kategorii — byly siatka
 * golego tekstu: nazwa po lewej, dwie liczby po prawej, dwadziescia cztery
 * jednakowe wiersze. Nic nie przyciagalo wzroku i nic nie podpowiadalo, czym
 * te auta w ogole sa.
 *
 * Ten sam wzorzec co ModelGrid na stronie marki — ktory juz wczesniej dostal
 * zdjecia z tego samego powodu. Trzymamy jeden wyglad dla marek i modeli, zeby
 * przejscie miedzy poziomami nie wygladalo jak zmiana serwisu.
 */
export function MarkaGrid({ marki }: { marki: MarkaKafelek[] }) {
  if (marki.length === 0) return null;

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {marki.map((m, i) => (
        <li key={m.make}>
          <Link
            href={makeHref(m.make)}
            className="group flex h-full flex-col overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] transition-colors hover:border-neutral-600"
          >
            <div className="relative aspect-[16/10] overflow-hidden bg-[var(--color-ink)]">
              <CarImage
                src={m.thumb}
                alt={m.make}
                /* Pierwszy rzad laduje sie od razu — reszta dopiero przy przewijaniu. */
                priority={i < 6}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
              />
            </div>
            {/*
              Podpis POD zdjeciem, nie na nim. Przy kategoriach napis na zdjeciu
              dziala, bo slow jest jedno i krotkie. Nazwy marek bywaja dlugie
              ("Mercedes-Benz", "Land Rover") i razem z dwiema liczbami nie
              mieszcza sie czytelnie na przyciemnieniu.
            */}
            <div className="flex flex-1 flex-col justify-between gap-0.5 px-3 py-2">
              <span className="text-[13px] font-medium leading-tight text-neutral-100">
                {m.make}
              </span>
              <span className="flex items-baseline gap-1.5 text-[11px] tabular-nums text-neutral-500">
                <span className="text-neutral-300">{num.format(m.total)}</span>
                {m.minPrice != null && <span>od {pln.format(m.minPrice)}</span>}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
