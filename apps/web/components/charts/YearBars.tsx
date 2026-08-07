const pln = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("pl-PL");

export interface YearBar {
  year: number | null;
  total: number;
  minPrice: number;
  medianPrice: number;
  medianMileage: number | null;
}

/**
 * Mediana ceny wedlug rocznika jako slupki.
 *
 * Ta sama tresc co tabela obok, ale odpowiada na inne pytanie. Z tabeli
 * odczytuje sie konkretna liczbe, ze slupkow widac KSZTALT utraty wartosci —
 * gdzie krzywa sie lamie i ktory rocznik jest nieproporcjonalnie tani.
 * To jest wlasnie ta informacja, po ktora warto wejsc na strone modelu.
 *
 * Rysujemy divami, nie SVG: slupki sa poziome i maja etykiety w srodku,
 * wiec skladaja sie z tekstu, ktory ma byc zaznaczalny i czytany przez
 * czytniki ekranu. SVG wymagaloby recznego pozycjonowania kazdego napisu.
 */
export function YearBars({ rows }: { rows: YearBar[] }) {
  const max = Math.max(...rows.map((r) => r.medianPrice));
  if (!Number.isFinite(max) || max <= 0) return null;

  // Od najstarszego, zeby utrata wartosci czytala sie z lewa na prawo w czasie.
  const ordered = [...rows].sort((a, b) => (a.year ?? 0) - (b.year ?? 0));

  return (
    <ol className="flex flex-col gap-1.5">
      {ordered.map((r) => (
        <li key={r.year} className="flex items-center gap-3">
          <span className="w-11 shrink-0 text-right text-[13px] tabular-nums text-neutral-500">
            {r.year}
          </span>

          <span className="relative h-7 min-w-0 flex-1 overflow-hidden rounded-md bg-[var(--color-ink)]">
            <span
              className="absolute inset-y-0 left-0 rounded-md bg-neutral-700/60"
              style={{ width: `${Math.max(4, (r.medianPrice / max) * 100)}%` }}
            />
            {/*
              Cena stoi NA slupku, nie za nim: przy najkrotszym slupku etykieta
              za nim wypadala na srodek pustego pola i wygladala na oderwana.
            */}
            <span className="absolute inset-y-0 left-2.5 flex items-center text-[12px] font-semibold tabular-nums text-neutral-100">
              {pln.format(r.medianPrice)}
            </span>
          </span>

          {/*
            Przebieg i liczba sztuk MUSZA byc poza slupkiem. Wpisane w niego
            absolutnie wpadaly na wypelnienie przy najdluzszym roczniku —
            szary tekst na szarym tle robil sie zupelnie nieczytelny.
          */}
          <span className="flex w-[112px] shrink-0 justify-end gap-2 text-[11px] tabular-nums text-neutral-600">
            {r.medianMileage != null && <span>{num.format(r.medianMileage)} km</span>}
            <span>{num.format(r.total)} szt.</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
