"use client";

import { track } from "@/components/Analytics";
import { ArrowUpRight, FileSearch } from "lucide-react";

/**
 * Raport historii pojazdu u partnera (carVertical) — przy VIN-ie.
 *
 * Najlepiej dopasowany sposob zarabiania w serwisie: ludzie wchodza tu po
 * konkretne auto, czesto wprost po numerze VIN, a przed zakupem auta za
 * kilkadziesiat tysiecy chca wiedziec, czy bylo rozbite i czy przebieg jest
 * prawdziwy. Warunki z 16.10.2026: 4 € za sprzedany raport, 20% rabatu dla
 * kupujacego.
 *
 * NIE POKAZUJEMY PRZY AUTOMARKECIE. Automarket daje w ogloszeniu bezplatny
 * raport autoDNA, wiec nikt nie zaplaci za drugi — a przycisk tylko by mylil.
 *
 * PRZYCISK, NIE ODNOSNIK — z tego samego powodu co w FinansowanieBlok: roboty
 * wchodzily w kazdy link partnerski na stronie i nabijaly tysiace klikniec.
 *
 * Bez skonfigurowanego linku nie renderujemy nic. Adres partnera i kod rabatowy
 * ida ze zmiennych srodowiskowych, zeby po podpisaniu umowy wystarczylo je
 * wpisac na Vercelu, bez zmian w kodzie.
 */
export function HistoriaBlok({
  vin,
  gdzie,
  sourceId,
  nazwa,
}: {
  vin: string | null;
  /** Skad klikniecie — do pomiaru, ktore miejsce sprzedaje. */
  gdzie: string;
  sourceId?: string | null;
  nazwa?: string | null;
}) {
  const bazowy = process.env.NEXT_PUBLIC_AFILIACJA_HISTORIA;
  const kod = process.env.NEXT_PUBLIC_AFILIACJA_HISTORIA_KOD;
  if (!bazowy) return null;
  if (sourceId === "automarket") return null;

  /*
   * VIN doklejamy, jesli partner przyjmuje go w adresie (`{vin}` w szablonie).
   * Bez tego czlowiek wpisze go sam na stronie partnera — dziala, ale gorzej.
   */
  const href = vin ? bazowy.replace("{vin}", encodeURIComponent(vin)) : bazowy.replace("{vin}", "");

  return (
    <div className="mt-3 rounded-lg border border-neutral-700 bg-[var(--color-ink)] p-3">
      <button
        type="button"
        onClick={() => {
          track("historia_klik", { gdzie, vin: vin ?? null, zrodlo: sourceId ?? null });
          window.open(href, "_blank", "noopener,noreferrer");
        }}
        className="group flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="min-w-0">
          <span className="flex items-center gap-2 text-[13px] font-medium text-neutral-100">
            <FileSearch size={15} className="shrink-0 text-neutral-400" />
            <span className="truncate">
              {nazwa ? `Sprawdź historię: ${nazwa}` : "Sprawdź historię tego auta"}
            </span>
          </span>
          <span className="mt-0.5 block text-[12px] text-neutral-500">
            Szkody, przebiegi, kradzieże po VIN
            {kod ? ` · kod ${kod} = 20% taniej` : ""} ·{" "}
            <span className="text-neutral-600">link partnerski</span>
          </span>
        </span>
        <ArrowUpRight
          size={16}
          className="shrink-0 text-neutral-500 transition-colors group-hover:text-accent"
        />
      </button>
    </div>
  );
}
