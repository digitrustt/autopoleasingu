import { ZapisForm } from "@/components/ZapisForm";
import { Bell } from "lucide-react";

/**
 * Kontekstowy pasek zapisu — wstawiany na stronach ofert, modeli i kategorii.
 *
 * Roznica wobec stopki jest cala w `filters`: zapis ze strony BMW X3 przychodzi
 * juz zawezony do BMW X3, a obietnica mowi o TYM aucie, nie o "nowych ofertach"
 * w ogolnosci. Zmierzone zachowanie, ktore to uzasadnia: ludzie klikaja
 * "Filtruj" 264 razy, czyli przychodza po konkretny egzemplarz, a nie
 * pooglada rynek.
 *
 * Swiadomie NIE jest to nakladka. Popup ma jedno wystapienie na sesje i wlasny
 * prog (patrz ZapisPopup) — gdyby kazda strona rzucala okienkiem, serwis
 * zamienilby sie w to, przed czym ludzie zamykaja karty.
 */
export function ZapisPasek({
  tytul,
  opis,
  filters,
  label,
  typ,
}: {
  tytul: string;
  opis: string;
  filters?: Record<string, string>;
  label?: string | null;
  typ: string;
}) {
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
