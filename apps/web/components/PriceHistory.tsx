const pln = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0,
});
const day = new Intl.DateTimeFormat("pl-PL", { day: "2-digit", month: "short" });

export interface PricePoint {
  priceGross: number | null;
  capturedAt: Date;
}

/**
 * Przebieg ceny jednej oferty jako sparkline.
 *
 * To dane, ktorych NIE MA zadne zrodlo: portal pokazuje cene dzisiejsza, nie to,
 * ze spadla dwa razy w ciagu miesiaca. Wykres rysujemy sami w SVG — biblioteka
 * do wykresow wazylaby wiecej niz cala reszta strony.
 *
 * Przy jednym punkcie nie ma czego rysowac: pojedynczy snapshot to nie historia,
 * tylko pierwszy pomiar, wiec pokazujemy sam podpis zamiast plaskiej kreski
 * udajacej "cena stabilna".
 */
export function PriceHistory({ points }: { points: PricePoint[] }) {
  const priced = points.filter((p): p is PricePoint & { priceGross: number } => p.priceGross != null);

  if (priced.length === 0) return null;

  if (priced.length === 1) {
    return (
      <p className="mt-3 text-[11px] text-neutral-600">
        Jeden pomiar ceny ({day.format(priced[0].capturedAt)}) — historia zbiera się od kolejnego
        przebiegu.
      </p>
    );
  }

  const values = priced.map((p) => p.priceGross);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const first = values[0];
  const last = values[values.length - 1];
  const change = last - first;

  const W = 240;
  const H = 36;
  // Plaska seria dzieli przez zero — wtedy rysujemy linie w polowie wysokosci.
  const span = max - min || 1;
  const pts = priced.map((p, i) => {
    const x = (i / (priced.length - 1)) * W;
    const y = H - ((p.priceGross - min) / span) * H;
    return `${x.toFixed(1)},${max === min ? (H / 2).toFixed(1) : y.toFixed(1)}`;
  });

  const dropped = change < 0;

  return (
    <div className="mt-3 border-t border-[var(--color-line)] pt-3">
      <div className="flex items-center gap-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className={`h-9 w-full max-w-[240px] ${dropped ? "text-emerald-400" : "text-neutral-500"}`}
          fill="none"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polyline
            points={pts.join(" ")}
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <div className="shrink-0 text-right text-[11px] leading-tight">
          <p className={dropped ? "font-semibold text-emerald-400" : "text-neutral-500"}>
            {change === 0
              ? "bez zmian"
              : `${change > 0 ? "+" : "−"}${pln.format(Math.abs(change))}`}
          </p>
          <p className="text-neutral-600">
            {priced.length} pomiarów · od {day.format(priced[0].capturedAt)}
          </p>
        </div>
      </div>
    </div>
  );
}
