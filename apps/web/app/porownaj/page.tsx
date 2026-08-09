import { Crumbs } from "@/components/Crumbs";
import { PARY } from "@/lib/pary";
import { Scale } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const revalidate = 86_400;

export const metadata: Metadata = {
  title: "Porównania modeli po leasingu",
  description:
    "Ceny modeli poleasingowych zestawione parami — mediana, cena minimalna i rozbicie po " +
    "roczniku dla obu stron. Dane z 26 źródeł, aktualizowane codziennie.",
  alternates: { canonical: "/porownaj" },
};

/**
 * Spis porownan.
 *
 * Bez tej strony 313 podstron nie mialoby zadnego linku prowadzacego — a
 * strona odlinkowana praktycznie nie istnieje dla wyszukiwarki. Obustronne
 * na gorze, bo to one maja najmocniejszy sygnal popytu (patrz lib/pary.ts).
 */
export default function PorownaniaPage() {
  const mocne = PARY.filter((p) => p.obustronna);
  const reszta = PARY.filter((p) => !p.obustronna);

  const Lista = ({ pary }: { pary: typeof PARY }) => (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-2">
      {pary.map((p) => (
        <li key={p.slug}>
          <Link
            href={`/porownaj/${p.slug}`}
            className="block truncate rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2.5 text-sm text-neutral-300 transition-colors hover:border-accent/40 hover:text-accent"
          >
            {p.a.make} {p.a.model} <span className="text-neutral-600">czy</span> {p.b.make}{" "}
            {p.b.model}
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6">
      <Crumbs items={[{ label: "Porównania" }]} />

      <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight text-neutral-100">
        <Scale size={22} className="text-neutral-600" />
        Porównania modeli po leasingu
      </h1>
      <p className="mb-6 mt-1 max-w-[70ch] text-sm leading-relaxed text-neutral-400">
        {PARY.length} zestawień, w których obie strony mają w naszej bazie realną liczbę ofert.
        Każde pokazuje mediany, ceny minimalne i utratę wartości po roczniku — policzone z
        26 źródeł poleasingowych, a nie z cenników producenta.
      </p>

      <h2 className="mb-3 text-lg font-semibold text-neutral-100">
        Najczęściej porównywane ({mocne.length})
      </h2>
      <div className="mb-8">
        <Lista pary={mocne} />
      </div>

      <h2 className="mb-3 text-lg font-semibold text-neutral-100">Pozostałe ({reszta.length})</h2>
      <Lista pary={reszta} />
    </main>
  );
}
