import { Scale, TrendingDown, TrendingUp } from "lucide-react";

const pln = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0,
});

/**
 * Cena oferty na tle mediany koszyka porownywalnych sztuk.
 *
 * Pasek jest skalowany do ±40% wokol mediany, bo tyle wynosi realna rozpietosc
 * w tej bazie — rozklad ocen jest dzwonowy i skupiony wokol zera. Skala liniowa
 * od zera splaszczylaby wszystko w okolice srodka i nie byloby widac roznicy
 * miedzy "troche taniej" a "okazja".
 */
export function Valuation({
  price,
  marketPrice,
  dealScore,
  samples,
  fromSold,
}: {
  price: number;
  marketPrice: number;
  dealScore: number;
  samples: number | null;
  fromSold: boolean;
}) {
  const pct = Math.round(dealScore * 100);
  const cheaper = pct > 0;
  const diff = Math.abs(marketPrice - price);

  // Pozycja ceny na pasku: 50% = mediana, 0% = -40%, 100% = +40%.
  const clamped = Math.max(-0.4, Math.min(0.4, -dealScore));
  const pos = 50 + (clamped / 0.4) * 50;

  return (
    <section className="mb-6">
      <h2 className="mb-3 text-sm font-semibold text-neutral-300">Wycena rynkowa</h2>

      <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <p
            className={`flex items-center gap-1.5 text-lg font-bold ${
              cheaper ? "text-emerald-400" : "text-neutral-300"
            }`}
          >
            {cheaper ? <TrendingDown size={18} /> : <TrendingUp size={18} />}
            {cheaper ? `${pct}% poniżej rynku` : `${Math.abs(pct)}% powyżej rynku`}
          </p>
          <p className="text-sm text-neutral-400">
            {cheaper ? "taniej" : "drożej"} o {pln.format(diff)}
          </p>
        </div>

        <div className="relative mb-2 h-1.5 rounded-full bg-black/50">
          {/* Mediana — punkt odniesienia, zawsze w polowie. */}
          <span className="absolute left-1/2 top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-neutral-600" />
          <span
            className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ${
              cheaper ? "bg-emerald-400" : "bg-neutral-300"
            }`}
            style={{ left: `${pos}%` }}
          />
        </div>

        <div className="mb-3 flex justify-between text-[11px] text-neutral-600">
          <span>taniej</span>
          <span>mediana {pln.format(marketPrice)}</span>
          <span>drożej</span>
        </div>

        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-neutral-500">
          <Scale size={13} className="mt-px shrink-0" />
          <span>
            Porównanie z {samples ?? "?"} ofertami tego samego modelu i rocznika, w tym samym
            przedziale przebiegu, z tym samym paliwem i skrzynią.{" "}
            {fromSold ? (
              /*
                Mediana z ofert, ktore zniknely, jest blizsza cenie transakcyjnej —
                auto faktycznie po niej zeszlo z rynku. Ceny wiszace sa zyczeniowe.
              */
              <span className="text-emerald-400/80">
                Liczona z cen ofert już sprzedanych, więc bliższa cenie transakcyjnej.
              </span>
            ) : (
              <span>
                Liczona z cen aktualnie wystawionych — to ceny ofertowe, zwykle wyższe od
                transakcyjnych.
              </span>
            )}{" "}
            Aukcje są wykluczone, bo ich cena rośnie w czasie.
          </span>
        </p>
      </div>
    </section>
  );
}
