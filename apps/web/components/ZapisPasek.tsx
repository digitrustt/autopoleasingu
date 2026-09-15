import { ZapisForm } from "@/components/ZapisForm";
import { Bell } from "lucide-react";

/**
 * Kontekstowy zapis na powiadomienia — na stronach ofert, modeli i kategorii.
 *
 * Roznica wobec stopki jest cala w `filters`: zapis ze strony BMW X3 przychodzi
 * juz zawezony do BMW X3, a obietnica mowi o TYM aucie, nie o "nowych ofertach"
 * w ogolnosci. Zmierzone zachowanie, ktore to uzasadnia: ludzie klikaja
 * "Filtruj" 264 razy, czyli przychodza po konkretny egzemplarz, a nie
 * pooglada rynek.
 *
 * Swiadomie NIE jest to nakladka. Popup ma jedno wystapienie na sesje i wlasne
 * wyzwalacze (patrz ZapisPopup) — gdyby kazda strona rzucala okienkiem, serwis
 * zamienilby sie w to, przed czym ludzie zamykaja karty.
 *
 * DWA WARIANTY, BO DWA MIEJSCA:
 *
 *  - `pasek` to szeroka sekcja na dole strony. Dziala tam, gdzie tresc konczy
 *    sie naturalnie (model, kategoria, marka x miasto) i czlowiek doczytal.
 *  - `kolumna` to waski blok w kolumnie decyzyjnej strony oferty, pod
 *    przyciskiem wyjscia. Powstal, bo na stronie oferty pasek stal NA SAMYM
 *    DOLE, pod tabela danych i pod podobnymi autami — czyli w miejscu, do
 *    ktorego dojezdza garstka. Kolumna decyzyjna to jedyny kawalek tej strony,
 *    ktory kazdy ma przed oczami.
 */
export function ZapisPasek({
  tytul,
  opis,
  filters,
  label,
  typ,
  wariant = "pasek",
}: {
  tytul: string;
  opis: string;
  filters?: Record<string, string>;
  label?: string | null;
  typ: string;
  wariant?: "pasek" | "kolumna";
}) {
  if (wariant === "kolumna") {
    return (
      <section className="mt-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] p-3">
        <p className="flex items-center gap-2 text-[13px] font-medium text-neutral-100">
          <Bell size={15} className="shrink-0 text-neutral-400" />
          {tytul}
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-neutral-500">{opis}</p>
        <div className="mt-2.5">
          <ZapisForm filters={filters} label={label} typ={typ} />
        </div>
      </section>
    );
  }

  return (
    <section className="mt-10 grid gap-x-10 gap-y-5 rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-5 md:grid-cols-[minmax(0,1fr)_400px] md:items-center">
      <div>
        <p className="flex items-center gap-2 text-[15px] font-medium text-neutral-100">
          <Bell size={16} className="shrink-0 text-neutral-500" />
          {tytul}
        </p>
        <p className="mt-1.5 max-w-[54ch] text-[13px] leading-relaxed text-neutral-500">{opis}</p>
      </div>
      <ZapisForm filters={filters} label={label} typ={typ} />
    </section>
  );
}
