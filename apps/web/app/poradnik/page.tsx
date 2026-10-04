import { Crumbs } from "@/components/Crumbs";
import { PORADNIKI } from "@/lib/poradniki";
import { BookOpen } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Poradniki — jak kupić auto poleasingowe",
  description:
    "Poradniki o zakupie aut po leasingu oparte na danych z ponad 20 tys. ofert i na " +
    "regulaminach aukcji: czy warto, jak licytować w PKO Leasing i EFL, na co uważać.",
  alternates: { canonical: "/poradnik" },
};

const DODATKOWE = [
  {
    href: "/poleasingowe/dla-osoby-prywatnej",
    tytul: "Auta poleasingowe dla osoby prywatnej",
    opis: "Kup teraz czy licytacja, cena netto i brutto, faktura i PCC.",
  },
  {
    href: "/analizy/raport-rynku-poleasingowego",
    tytul: "Raport rynku poleasingowego",
    opis: "Które modele znikają najszybciej, jak często tanieją oferty, ile diesli zostało.",
  },
  {
    href: "/analizy/utrata-wartosci",
    tytul: "Ile auto traci na wartości",
    opis: "Mediany cen rocznik po roczniku.",
  },
];

/** Spis poradnikow. Statyczny — nie dotyka bazy. */
export default function Poradniki() {
  const pozycje = [
    ...PORADNIKI.map((p) => ({ href: `/poradnik/${p.slug}`, tytul: p.tytul, opis: p.opis })),
    ...DODATKOWE,
  ];
  return (
    <main className="mx-auto max-w-[860px] px-4 py-6">
      <Crumbs items={[{ label: "Poradniki" }]} />
      <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight text-neutral-100">
        <BookOpen size={22} className="text-neutral-600" />
        Poradniki
      </h1>
      <p className="mb-5 mt-1 max-w-[70ch] text-sm leading-relaxed text-neutral-400">
        Jak kupić auto po leasingu i nie przepłacić. Piszemy na podstawie danych z naszej bazy
        i regulaminów czytanych u źródła, a nie ogólników.
      </p>
      <ul className="flex flex-col gap-2">
        {pozycje.map((p) => (
          <li key={p.href}>
            <Link
              href={p.href}
              className="block rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-3 transition-colors hover:border-neutral-600 hover:bg-[var(--color-ink)]"
            >
              <span className="text-[15px] font-medium text-neutral-100">{p.tytul}</span>
              <span className="mt-0.5 block text-[13px] text-neutral-500">{p.opis}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
