const pln = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0,
});

/** Skrocona cena na os: 182 800 -> "183 tys.". */
function short(v: number): string {
  return `${Math.round(v / 1000)} tys.`;
}

import type { PriceHistogramData } from "@/lib/queries";

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
  dane,
  marker,
  cheaper,
  markerLabel = "ta oferta",
}: {
  /* Kubelki policzone w bazie — patrz getPriceHistogram. */
  dane: PriceHistogramData;
  /** Cena wyrozniona pionowa kreska. */
  marker?: number | null;
  /** Ile ofert jest tanszych od `marker` — liczone osobnym zapytaniem. */
  cheaper?: number | null;
  markerLabel?: string;
}) {
  const { min, max, total, counts } = dane;
  if (counts.length === 0 || total < 6 || max === min) return null;

  const bins = counts.length;
  const width = (max - min) / bins;
  const peak = Math.max(...counts);

  const markerPct =
    marker != null && marker >= min && marker <= max ? ((marker - min) / (max - min)) * 100 : null;

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
        {marker == null && <span>{total} ofert</span>}
        <span>{short(max)}</span>
      </div>

      {marker != null && cheaper != null && (
        <p className="mt-1 text-center text-[11px] text-emerald-400">
          {markerLabel}: {pln.format(marker)} — tańsza od{" "}
          {Math.round(((total - cheaper) / total) * 100)}% ofert
        </p>
      )}
    </div>
  );
}
