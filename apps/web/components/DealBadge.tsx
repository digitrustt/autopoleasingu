import { TrendingDown } from "lucide-react";

/**
 * Ocena okazji: o ile procent oferta jest ponizej mediany koszyka
 * porownywalnych sztuk (ten sam model, rocznik, przedzial przebiegu, paliwo
 * i skrzynia).
 *
 * PROGI SA CELOWO WYSOKIE. Rozklad ocen w tej bazie jest dzwonowy i skupiony
 * wokol zera — polowa ofert miesci sie w ±10% od mediany, bo tak wyglada
 * normalny rynek. Podswietlanie 5% robiloby z plakietki dekoracje na kazdym
 * kafelku; dopiero 15% to sygnal, a 25% to rzadkosc (45 sztuk na 5280 ocenionych).
 *
 * Ofert bez oceny NIE podpisujemy w ogole. "Brak danych" i "cena rynkowa" to
 * dwie rozne rzeczy, a mylenie ich jest gorsze niz milczenie.
 */
export function DealBadge({ score, compact = false }: { score: number; compact?: boolean }) {
  const pct = Math.round(score * 100);
  if (pct < 10) return null;

  const strong = pct >= 25;

  return (
    <span
      className={`flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
        strong ? "bg-emerald-400 text-black" : "bg-emerald-500/15 text-emerald-300"
      }`}
      title={`${pct}% poniżej mediany porównywalnych ofert`}
    >
      <TrendingDown size={11} />
      {pct}%{!compact && " pod rynkiem"}
    </span>
  );
}
