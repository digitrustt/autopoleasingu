import { TriangleAlert } from "lucide-react";

const day = new Intl.DateTimeFormat("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
const num = new Intl.NumberFormat("pl-PL");

/**
 * Historia pojazdu — dane, ktore mamy, i nasz sygnal o rozbieznym przebiegu.
 *
 * Do 28.10.2026 stal tu rzad przyciskow do CEPiK, autoDNA i carVertical (ten
 * ostatni zwyklym linkiem, bez identyfikatora partnera, wiec sprzedaz z tego
 * miejsca nie byla przypisywana nam). Umowa z carVertical (pkt 5) zabrania
 * promowania innych dostawcow raportow, wiec zostaly tylko dane. Raport
 * carVertical z linkiem partnerskim jest tuz pod tym blokiem (HistoriaBlok).
 *
 * Historii konkretnego auta nie da sie pobrac za darmo i nie udajemy, ze da:
 * api.cepik.gov.pl jest statystyczne (bez VIN-u), a darmowe dekodery VIN na
 * europejskich numerach zwracaja tylko marke i kraj.
 */
export function VehicleHistory({
  vin,
  registration,
  firstRegistrationAt,
  mileageSpread,
}: {
  vin: string;
  registration: string | null;
  firstRegistrationAt: Date | null;
  /** Rozbieznosc przebiegu miedzy zrodlami — nasz wlasny sygnal, za darmo. */
  mileageSpread: { min: number; max: number; sources: number } | null;
}) {
  return (
    <section className="mb-6">
      <h2 className="mb-3 text-sm font-semibold text-neutral-300">Historia pojazdu</h2>

      {/*
        Rozbieznosc przebiegu to jedyny element historii, ktory liczymy sami —
        i jest darmowy. Ten sam VIN u dwoch sprzedawcow z roznym przebiegiem
        znaczy albo nieaktualne dane u jednego z nich, albo cos do wyjasnienia.
      */}
      {mileageSpread && mileageSpread.max - mileageSpread.min > 1000 && (
        <div className="mb-3 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <TriangleAlert size={18} className="mt-0.5 shrink-0 text-amber-400" />
          <div>
            <p className="font-semibold text-amber-300">
              Rozbieżny przebieg: {num.format(mileageSpread.min)}–{num.format(mileageSpread.max)} km
            </p>
            <p className="text-sm text-neutral-400">
              To samo auto ma różny przebieg w {mileageSpread.sources} źródłach — różnica{" "}
              {num.format(mileageSpread.max - mileageSpread.min)} km. Zwykle znaczy to nieaktualne
              dane u jednego ze sprzedawców, ale warto zapytać.
            </p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Field label="VIN" value={vin} mono />
          <Field label="Nr rejestracyjny" value={registration} mono />
          <Field
            label="Pierwsza rejestracja"
            value={firstRegistrationAt ? day.format(firstRegistrationAt) : null}
          />
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-neutral-600">{label}</p>
      <p className={`${mono ? "font-mono tracking-wide" : ""} ${value ? "" : "text-neutral-600"}`}>
        {value ?? "brak w źródle"}
      </p>
    </div>
  );
}
