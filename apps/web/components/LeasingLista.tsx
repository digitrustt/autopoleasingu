"use client";

import { track } from "@/components/Analytics";
import { linkLeasingu } from "@/components/FinansowanieBlok";
import { otworzPartnera } from "@/lib/wyjscie";
import { ArrowUpRight, Briefcase } from "lucide-react";

/**
 * Link do leasingu (MyLease) na stronach z listami — odpowiednik RataLista.
 *
 * 30.10.2026: w Search Console 417 zapytan "<model> leasing" (5,9 tys. wyswietlen
 * w 3 mies.) trafialo na strony modeli z pozycji ~35, a na samych stronach modeli
 * slowo "leasing" nie padalo ani razu, nie bylo tez przycisku. MyLease obsluguje
 * WYLACZNIE firmy, stad tekst "na firme" — osobe prywatna kierujemy do kredytu.
 * Bez liczb (rat, wkladu, okresu), jak przy kredycie. Etykieta `lista-...` jak
 * w RataLista, ale w osobnym programie sieci, wiec sie nie myla.
 */
export function LeasingLista({
  etykieta,
  gdzie = "lista",
  tekst = "Kupujesz na firmę? Sprawdź leasing",
}: {
  etykieta: string;
  gdzie?: string;
  tekst?: string;
}) {
  const href = linkLeasingu(`lista-${etykieta}`);
  if (!href) return null;
  return (
    <button
      type="button"
      onClick={() => {
        track("leasing_klik", { gdzie, strona: etykieta });
        otworzPartnera(href);
      }}
      className="group mb-5 flex w-full max-w-[640px] items-center justify-between gap-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2.5 text-left transition-colors hover:border-accent/70"
    >
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-[14px] font-semibold text-neutral-100">
          <Briefcase size={16} className="shrink-0 text-accent" />
          <span className="truncate">{tekst}</span>
        </span>
        <span className="mt-0.5 block text-[12px] text-neutral-400">
          Leasing dla firm online · <span className="text-neutral-600">link partnerski</span>
        </span>
      </span>
      <ArrowUpRight size={17} className="shrink-0 text-accent transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}
