import { ExternalLink, ShieldCheck, TriangleAlert } from "lucide-react";

const day = new Intl.DateTimeFormat("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
const num = new Intl.NumberFormat("pl-PL");

/**
 * Historia pojazdu — szkody, rejestracje, przebiegi z przegladow.
 *
 * TEGO NIE DA SIE POBRAC ZA DARMO i nie udajemy, ze da. Sprawdzone:
 *   - api.cepik.gov.pl dziala, ale jest STATYSTYCZNE: filtruje po wojewodztwie
 *     i dacie, zwraca rekordy bez VIN-u. Pojedynczego auta tam nie znajdziesz.
 *   - historiapojazdu.gov.pl to jedyna oficjalna sciezka do historii konkretnego
 *     pojazdu, ale jest formularzem bez API i wymaga TRZECH danych naraz.
 *   - darmowe dekodery VIN (NHTSA vPIC) na europejskich numerach zwracaja tylko
 *     marke i kraj produkcji.
 *
 * Dlatego zamiast obiecywac raport, robimy jedno konkretne ulatwienie: zbieramy
 * komplet danych, ktorego wymaga CEPiK, i podajemy go gotowy do przeklejenia.
 * Bez numeru rejestracyjnego i daty pierwszej rejestracji sam VIN jest tam
 * bezuzyteczny — a wlasnie te dwa pola wyrzucalismy do niedawna.
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
  const hasCepikSet = registration != null && firstRegistrationAt != null;

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
        <div className="mb-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Field label="VIN" value={vin} mono />
          <Field label="Nr rejestracyjny" value={registration} mono />
          <Field
            label="Pierwsza rejestracja"
            value={firstRegistrationAt ? day.format(firstRegistrationAt) : null}
          />
        </div>

        {hasCepikSet ? (
          <p className="mb-3 flex items-center gap-1.5 text-xs text-emerald-400">
            <ShieldCheck size={14} />
            Mamy komplet danych wymaganych przez CEPiK — wystarczy je przekleić.
          </p>
        ) : (
          <p className="mb-3 text-xs text-neutral-500">
            CEPiK wymaga VIN-u, numeru rejestracyjnego <em>i</em> daty pierwszej rejestracji.
            To źródło nie podaje {registration == null ? "numeru rejestracyjnego" : "daty rejestracji"},
            więc raport trzeba będzie uzupełnić ręcznie.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Report
            href="https://historiapojazdu.gov.pl/"
            name="CEPiK — Historia pojazdu"
            note="oficjalny, bezpłatny"
          />
          <Report href={`https://www.autodna.pl/check/${vin}`} name="autoDNA" note="płatny raport" />
          <Report
            href={`https://www.carvertical.com/pl/check?vin=${encodeURIComponent(vin)}`}
            name="carVertical"
            note="płatny raport"
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

function Report({ href, name, note }: { href: string; name: string; note: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm transition-colors hover:border-accent/70 hover:text-accent"
    >
      {name}
      <span className="text-[11px] text-neutral-500">{note}</span>
      <ExternalLink size={13} />
    </a>
  );
}
