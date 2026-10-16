"use client";

import { track } from "@/components/Analytics";
import { ArrowUpRight, FileSearch, ShieldCheck } from "lucide-react";

/**
 * Raport historii pojazdu u partnera (carVertical) — przy VIN-ie.
 *
 * Najlepiej dopasowany sposob zarabiania w serwisie: ludzie wchodza tu po
 * konkretne auto, czesto wprost po numerze VIN, a przed zakupem auta za
 * kilkadziesiat tysiecy chca wiedziec, czy bylo rozbite i czy przebieg jest
 * prawdziwy. Warunki z 16.10.2026: 4 € za sprzedany raport, 20% rabatu dla
 * kupujacego.
 *
 * UMOWA (16.10.2026): tresc o carVertical uzgadniamy z nimi przed publikacja
 * (pkt 1.1), przy linku musi byc jasne, ze usluge sprzedaje carVertical
 * (pkt 1.3), a w trakcie umowy nie promujemy innych dostawcow raportow
 * historii (pkt 5) — dlatego nie pokazujemy tu np. etykiety autoDNA.
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
  wariant = "kolumna",
}: {
  vin: string | null;
  /** Skad klikniecie — do pomiaru, ktore miejsce sprzedaje. */
  gdzie: string;
  sourceId?: string | null;
  nazwa?: string | null;
  /**
   * "duzy" — szeroki blok pod zdjeciem oferty, z akcentowym przyciskiem.
   * Tam patrzy kazdy, kto oglada auto, a w bocznej kolumnie ginal miedzy
   * finansowaniem a zapisem (decyzja wlasciciela, 16.10.2026).
   */
  wariant?: "kolumna" | "duzy";
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

  const otworz = () => {
    track("historia_klik", { gdzie, vin: vin ?? null, zrodlo: sourceId ?? null, wariant });
    window.open(href, "_blank", "noopener,noreferrer");
  };

  if (wariant === "duzy") {
    return (
      <section className="mt-4 flex flex-col gap-3 rounded-xl border border-accent/40 bg-accent/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
            <ShieldCheck size={18} />
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-neutral-100">
              Sprawdź historię tego auta przed zakupem
              {kod && (
                <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-black">
                  20% taniej
                </span>
              )}
            </p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-neutral-400">
              Raport historii pojazdu carVertical po numerze VIN: szkody, przebiegi, kradzieże
              {kod ? `. Z kodem ${kod} 20% taniej` : ""}.{" "}
              <span className="text-neutral-600">
                Usługę sprzedaje carVertical; to link partnerski.
              </span>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={otworz}
          className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-black transition-colors hover:bg-white"
        >
          Sprawdź historię
          <ArrowUpRight size={15} />
        </button>
      </section>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-neutral-700 bg-[var(--color-ink)] p-3">
      <button
        type="button"
        onClick={otworz}
        className="group flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="min-w-0">
          <span className="flex items-center gap-2 text-[13px] font-medium text-neutral-100">
            <FileSearch size={15} className="shrink-0 text-neutral-400" />
            <span className="truncate">Sprawdź historię tego auta</span>
            {kod && (
              <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-black">
                −20%
              </span>
            )}
          </span>
          <span className="mt-0.5 block text-[12px] text-neutral-500">
            Raport carVertical po VIN · <span className="text-neutral-600">link partnerski</span>
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
