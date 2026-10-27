"use client";

import { track } from "@/components/Analytics";
import { linkKredytu } from "@/components/FinansowanieBlok";
import { OfferLink } from "@/components/OfferLink";
import { otworzPartnera } from "@/lib/wyjscie";
import type { KontekstWyjscia } from "@/lib/zapis-sygnal";
import { ArrowUpRight, Landmark } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Przypiety pasek na telefonie: rata + przejscie do sprzedawcy.
 *
 * Na telefonie karta z cena stoi nad zdjeciem, a pod nia sa historia cen,
 * wykresy i tabela — kto przewinie, traci oba przyciski z oczu. Pasek
 * wjezdza dopiero, gdy karta ceny zniknie u gory ekranu, wiec nigdy nie
 * dubluje przyciskow widocznych w tej samej chwili.
 */
export function PasekOferty({
  ofertaId,
  cena,
  href,
  sourceId,
  zrodlo,
  kontekst,
  offer,
  pokazKredyt = true,
}: {
  ofertaId: number;
  cena: number;
  href: string;
  sourceId: string;
  zrodlo: string;
  kontekst: KontekstWyjscia;
  offer: Record<string, unknown>;
  /** Tanie auto: pasek niesie samo przejscie do sprzedawcy. Patrz lib/kredyt.ts. */
  pokazKredyt?: boolean;
}) {
  const [widoczny, setWidoczny] = useState(false);
  const kredyt = pokazKredyt ? linkKredytu(`pasek-oferta-${ofertaId}`) : null;

  useEffect(() => {
    /*
     * Pasek wjezdza, gdy z ekranu znika PRZYCISK wyjscia do sprzedawcy, a nie
     * cala karta ceny (27.10.2026). Karta zawiera tez ocene ceny, ten sam VIN
     * u innych zrodel i zapis na alert, wiec bywa wyzsza niz ekran telefonu —
     * pasek pokazywal sie dopiero daleko pod nia i mial 0 klikniec.
     */
    const cel = document.getElementById("wyjscie-oferty") ?? document.getElementById("karta-ceny");
    if (!cel) return;
    const obs = new IntersectionObserver(([e]) =>
      setWidoczny(!e.isIntersecting && e.boundingClientRect.bottom < 0),
    );
    obs.observe(cel);
    return () => obs.disconnect();
  }, []);

  return (
    <>
      {/* Miejsce na pasek, zeby nie zaslanial stopki. */}
      <div className="h-20 lg:hidden" aria-hidden />
      <div
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-line)] bg-[var(--color-panel)]/95 px-3 pb-[calc(0.625rem+env(safe-area-inset-bottom))] pt-2.5 backdrop-blur transition-transform duration-200 lg:hidden ${
          widoczny ? "translate-y-0" : "pointer-events-none translate-y-full"
        }`}
      >
        <div className="mx-auto flex max-w-[600px] gap-2">
          {kredyt && (
            <button
              type="button"
              onClick={() => {
                track("finansowanie_klik", { oferta: ofertaId, cena, gdzie: "pasek" });
                otworzPartnera(kredyt);
              }}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-accent/60 bg-accent/10 px-3 py-2.5 text-sm font-semibold text-neutral-100"
            >
              <Landmark size={15} className="text-accent" />
              Sprawdź ratę
            </button>
          )}
          <OfferLink
            href={href}
            external
            sourceId={sourceId}
            kontekst={kontekst}
            offer={{ ...offer, z: "pasek_oferty" }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2.5 text-sm font-medium text-black"
          >
            <span className="truncate">Zobacz w {zrodlo}</span>
            <ArrowUpRight size={15} className="shrink-0" />
          </OfferLink>
        </div>
      </div>
    </>
  );
}
