import { Logo } from "@/components/Logo";
import { SearchX } from "lucide-react";
import Link from "next/link";

/**
 * Wlasna 404.
 *
 * Zrobila sie potrzebna z chwila, gdy adresy marek trafily na pierwszy poziom
 * (`/bmw`): kazdy nieznany adres laduje teraz w tej samej dynamicznej trasie
 * i konczy sie tutaj. Domyslny ekran Next.js bylby jedyna strona w serwisie
 * bez naszej stylistyki — i to akurat ta, na ktorej ludzie ladują po literowce
 * albo po nieaktualnym linku z wyszukiwarki.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-[560px] flex-col items-center gap-4 px-4 py-24 text-center">
      <SearchX size={30} className="text-neutral-700" />
      <h1 className="text-xl font-semibold text-neutral-100">Nie ma takiej strony</h1>
      <p className="text-sm leading-relaxed text-neutral-400">
        Adres jest błędny albo oferta zniknęła z bazy. Oferty poleasingowe schodzą szybko, więc
        drugie bywa częstsze.
      </p>
      <Link
        href="/"
        className="rounded-lg border border-[var(--color-line)] px-4 py-2 text-sm text-neutral-300 transition-colors hover:border-accent/70 hover:text-accent"
      >
        Wróć do <Logo className="text-sm" />
      </Link>
    </main>
  );
}
