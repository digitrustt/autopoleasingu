const pln = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0,
});

/** Skrocona cena na os: 182 800 -> "183 tys.". */
function short(v: number): string {
  return `${Math.round(v / 1000)} tys.`;
}

/**
 * Rozklad cen w segmencie, opcjonalnie ze znacznikiem jednej oferty.
 *
 * Sama mediana nie mowi, czy rynek jest jednolity. Dwa modele o tej samej
 * medianie 180 tys. wygladaja identycznie w tabeli, a jeden ma wszystkie
 * sztuki w przedziale 170–190, drugi polowe po 120 i polowe po 240. Dopiero
 * rozklad pokazuje, ze w tym drugim "mediana" nie opisuje zadnego realnego auta.
 *
 * Ze znacznikiem odpowiada na jedyne pytanie, ktore ma znaczenie na stronie
 * konkretnej oferty: gdzie TO auto stoi wsrod pozostalych.
 */
export function PriceHistogram({
  prices,
  marker,
  markerLabel = "ta oferta",
}: {
  prices: number[];
  /** Cena wyrozniona pionowa kreska. */
  marker?: number | null;
  markerLabel?: string;
}) {
  if (prices.length < 6) return null;

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (max === min) return null;

  /*
   * Liczba przedzialow rosnie z liczba ofert, ale nie powyzej 16 — przy
   * wiekszej liczbie slupki robia sie wezsze od odstepu miedzy nimi i wykres
   * zamienia sie w grzebien, z ktorego nic nie widac.
   */
  const bins = Math.min(16, Math.max(6, Math.round(Math.sqrt(prices.length))));
  const width = (max - min) / bins;

  const counts = new Array<number>(bins).fill(0);
  for (const p of prices) {
    // Ostatnia probka (p === max) wpadlaby do nieistniejacego przedzialu.
    const i = Math.min(bins - 1, Math.floor((p - min) / width));
    counts[i]++;
  }
  const peak = Math.max(...counts);

  const markerPct =
    marker != null && marker >= min && marker <= max
      ? ((marker - min) / (max - min)) * 100
      : null;

  // Ile ofert jest tanszych — konkretna liczba obok wykresu.
  const cheaper = marker != null ? prices.filter((p) => p < marker).length : null;

  return (
    <div>
      <div className="relative flex h-28 items-end gap-[2px]">
        {counts.map((c, i) => {
          const inBin =
            marker != null && Math.min(bins - 1, Math.floor((marker - min) / width)) === i;
          return (
            <span
              key={`${min}-${i}`}
              className={`min-w-0 flex-1 rounded-t-sm ${
                inBin ? "bg-emerald-500/70" : "bg-neutral-700/60"
              }`}
              style={{ height: `${Math.max(3, (c / peak) * 100)}%` }}
              title={`${pln.format(min + i * width)} – ${pln.format(min + (i + 1) * width)}: ${c}`}
            />
          );
        })}

        {markerPct != null && (
          <span
            className="pointer-events-none absolute inset-y-0 w-px bg-emerald-400"
            style={{ left: `${markerPct}%` }}
          />
        )}
      </div>

      {/*
        Skala i podpis w dwoch wierszach, nie w jednym. Przy szerokosci
        telefonu zdanie o pozycji oferty wciskalo sie miedzy dwie liczby
        i wszystkie trzy zlewaly sie w jeden nieczytelny pasek.
      */}
      <div className="mt-1.5 flex items-center justify-between text-[11px] tabular-nums text-neutral-600">
        <span>{short(min)}</span>
        {marker == null && <span>{prices.length} ofert</span>}
        <span>{short(max)}</span>
      </div>

      {marker != null && cheaper != null && (
        <p className="mt-1 text-center text-[11px] text-emerald-400">
          {markerLabel}: {pln.format(marker)} — tańsza od{" "}
          {Math.round(((prices.length - cheaper) / prices.length) * 100)}% ofert
        </p>
      )}
    </div>
  );
}
