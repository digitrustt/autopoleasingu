import { ArrowLeft } from "lucide-react";
import Link from "next/link";

/**
 * Wspolny uklad stron prawnych — waska kolumna, jeden rytm naglowkow.
 *
 * Osobny komponent, bo trzy strony pisane niezaleznie rozjechalyby sie po
 * pierwszej edycji, a to wlasnie one musza wygladac na spojna calosc:
 * czytelnik ocenia po nich, czy serwis jest powazny.
 */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  /** Data ostatniej zmiany — bez niej dokument prawny jest bezwartosciowy. */
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-[760px] px-4 py-6">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-neutral-400 transition-colors hover:text-accent"
      >
        <ArrowLeft size={15} />
        Wróć do listy
      </Link>

      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="mb-8 text-xs text-neutral-600">Ostatnia aktualizacja: {updated}</p>

      <div className="flex flex-col gap-6 text-[15px] leading-relaxed text-neutral-300">
        {children}
      </div>
    </main>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 font-semibold text-neutral-100">{title}</h2>
      <div className="flex flex-col gap-2 text-neutral-400">{children}</div>
    </section>
  );
}

/**
 * Miejsce na dane operatora, ktorych NIE ZMYSLAM.
 *
 * Wpisanie tu wymyslonej nazwy firmy, NIP-u czy adresu byloby stworzeniem
 * falszywego dokumentu prawnego — gorszym niz jego brak. Placeholder jest
 * widoczny celowo, zeby nie dalo sie o nim zapomniec przed publikacja.
 */
export function ToFill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[13px] text-amber-300">
      {children}
    </span>
  );
}
