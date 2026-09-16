"use client";

import { sprobujPrzeladowac, zglosBlad } from "@/lib/blad-klienta";
import { useEffect, useState } from "react";
import "./globals.css";

/**
 * Ostatnia linia obrony — blad w samym layoucie (naglowek, stopka, nakladki).
 *
 * Zastepuje CALY dokument, stad wlasne <html> i <body>. Naglowka tu nie ma
 * celowo: skoro wywrocil sie layout, to naglowek moze byc wlasnie tym, co sie
 * wywrocilo. Link do strony glownej jest zwyklym <a>, nie <Link> — po awarii
 * layoutu nawigacja kliencka jest ostatnim, na czym chcemy polegac.
 */
export default function BladGlobalny({ error }: { error: Error & { digest?: string } }) {
  const [przeladowuje, setPrzeladowuje] = useState(true);

  useEffect(() => {
    zglosBlad(error, "global");
    if (!sprobujPrzeladowac(error)) setPrzeladowuje(false);
  }, [error]);

  return (
    <html lang="pl">
      <body className="flex min-h-screen flex-col antialiased">
        {!przeladowuje && (
          <main className="mx-auto flex max-w-[560px] flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
            <h1 className="text-xl font-semibold text-neutral-100">Coś nie zadziałało</h1>
            <p className="text-sm leading-relaxed text-neutral-400">
              Strona nie wczytała się poprawnie. Najczęściej pomaga odświeżenie — zwłaszcza jeśli
              karta była otwarta od dłuższego czasu.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white"
              >
                Odśwież stronę
              </button>
              <a
                href="/"
                className="rounded-lg border border-[var(--color-line)] px-4 py-2 text-sm text-neutral-300 transition-colors hover:border-accent/70 hover:text-accent"
              >
                Strona główna
              </a>
            </div>
          </main>
        )}
      </body>
    </html>
  );
}
