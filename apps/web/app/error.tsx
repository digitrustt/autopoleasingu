"use client";

import { sprobujPrzeladowac, zglosBlad } from "@/lib/blad-klienta";
import { RefreshCw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Granica bledow dla podstron. Naglowek i stopka z layoutu zostaja na miejscu,
 * wiec czlowiek ma skad wrocic — w odroznieniu od domyslnego bialego ekranu
 * Next.js, ktory zostawial go z samym komunikatem. Patrz lib/blad-klienta.ts.
 */
export default function Blad({ error }: { error: Error & { digest?: string } }) {
  // Dopoki trwa przeladowanie, nie pokazujemy ekranu bledu — mignalby i zniknal.
  const [przeladowuje, setPrzeladowuje] = useState(true);

  useEffect(() => {
    zglosBlad(error, "segment");
    if (!sprobujPrzeladowac(error)) setPrzeladowuje(false);
  }, [error]);

  if (przeladowuje) return null;

  return (
    <main className="mx-auto flex max-w-[560px] flex-col items-center gap-4 px-4 py-24 text-center">
      <TriangleAlert size={30} className="text-neutral-700" />
      <h1 className="text-xl font-semibold text-neutral-100">Coś nie zadziałało</h1>
      <p className="text-sm leading-relaxed text-neutral-400">
        Ta strona nie wczytała się poprawnie. Najczęściej pomaga odświeżenie — zwłaszcza jeśli
        karta była otwarta od dłuższego czasu.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          /*
           * Pelne przeladowanie, nie `reset()` z Next.js. `reset` ponawia render
           * z tymi samymi plikami JS — przy starej wersji strony dostalby ten sam
           * blad drugi raz. Przeladowanie pobiera pliki na nowo.
           */
          onClick={() => window.location.reload()}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white"
        >
          <RefreshCw size={14} />
          Odśwież stronę
        </button>
        <Link
          href="/"
          className="rounded-lg border border-[var(--color-line)] px-4 py-2 text-sm text-neutral-300 transition-colors hover:border-accent/70 hover:text-accent"
        >
          Strona główna
        </Link>
      </div>
    </main>
  );
}
