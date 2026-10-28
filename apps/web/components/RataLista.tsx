"use client";

import { track } from "@/components/Analytics";
import { linkKredytu } from "@/components/FinansowanieBlok";
import { otworzPartnera } from "@/lib/wyjscie";
import { ArrowUpRight, Landmark } from "lucide-react";

/**
 * Link do kredytu na stronach z listami (model, kategoria), nad wynikami.
 *
 * Do 28.10.2026 kredyt byl tylko na stronie pojedynczej oferty, a polowa wejsc
 * z Google laduje na modelach i kategoriach (np. "do 100 tys. SUV"), czyli u ludzi,
 * ktorzy wlasnie wybieraja auto. Tekst bez zadnej liczby: patrz FinansowanieBlok,
 * zadnych stawek, rat ani RRSO. Etykieta `lista-...` rozroznia to miejsce w panelu
 * Comperialead od ofert (`oferta-`, `cena-oferta-`, `pasek-`, `popup-`).
 */
export function RataLista({ etykieta }: { etykieta: string }) {
  const href = linkKredytu(`lista-${etykieta}`);
  if (!href) return null;
  return (
    <button
      type="button"
      onClick={() => {
        track("finansowanie_klik", { gdzie: "lista", strona: etykieta });
        otworzPartnera(href);
      }}
      className="group mb-5 flex max-w-[640px] items-center justify-between gap-3 rounded-lg border border-accent/50 bg-accent/10 px-3 py-2.5 text-left transition-colors hover:border-accent hover:bg-accent/15"
    >
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-[14px] font-semibold text-neutral-100">
          <Landmark size={16} className="shrink-0 text-accent" />
          <span className="truncate">Kupujesz na raty? Sprawdź ratę kredytu</span>
        </span>
        <span className="mt-0.5 block text-[12px] text-neutral-400">
          Kredyt samochodowy online · <span className="text-neutral-600">link partnerski</span>
        </span>
      </span>
      <ArrowUpRight size={17} className="shrink-0 text-accent transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}
