const pln = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("pl-PL");

import type { ScatterData } from "@/lib/queries";

const W = 600;
const H = 260;
const PAD = { left: 8, right: 8, top: 10, bottom: 8 };

/**
 * Cena wobec przebiegu — chmura punktow z linia trendu.
 *
 * To jedyny wykres w serwisie, ktory pokazuje ZALEZNOSC, a nie rozklad:
 * ile realnie kosztuje kazde dziesiec tysiecy kilometrow na tym konkretnym
 * modelu. Odpowiada na pytanie, z ktorym ludzie przychodza do wyszukiwarki
 * ofert poleasingowych — czy doplacic za mniejszy przebieg, czy wziac
 * tanszy egzemplarz i przejechac te kilometry samemu.
 *
 * Linia to zwykla regresja liniowa metoda najmniejszych kwadratow, ale liczona
 * W BAZIE (`regr_slope`, `regr_intercept`) i z CALOSCI danych. Punkty do
 * narysowania chmury sa przyciete — przy 1250 ofertach i tak nakladaja sie na
 * siebie na szerokosci 600 pikseli, a przesylanie ich wszystkich potrafilo
 * przekroczyc limit transferu bazy.
 */
export function MileagePrice({
  dane,
  highlight,
}: {
  dane: ScatterData;
  /** Id oferty, ktora ma byc wyrozniona — uzywane na stronie oferty. */
  highlight?: number;
}) {
  const { points, n, slope, intercept, xMin, xMax, yMin, yMax } = dane;
  if (n < 6 || xMin == null || xMax == null || yMin == null || yMax == null) return null;

  const pts = points.filter(
    (p): p is { id: number; mileageKm: number; priceGross: number } =>
      p.mileageKm != null && p.priceGross != null,
  );
  if (pts.length === 0) return null;

  // Zerowy zakres (wszystkie auta o tym samym przebiegu) dzielilby przez zero.
  const xSpan = xMax - xMin || 1;
  const ySpan = yMax - yMin || 1;

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const sx = (v: number) => PAD.left + ((v - xMin) / xSpan) * innerW;
  const sy = (v: number) => PAD.top + innerH - ((v - yMin) / ySpan) * innerH;

  // Spadek na 10 tys. km — jedyna liczba, ktora ktokolwiek z tego wyniesie.
  const per10k = slope != null ? -slope * 10_000 : 0;
  const linia = slope != null && intercept != null;

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-[260px] w-full"
        role="img"
        aria-label={`Cena wobec przebiegu, ${n} ofert`}
      >
        <title>Cena wobec przebiegu</title>

        {/* Siatka pozioma — cztery linie wystarcza za skale. */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={PAD.left}
            x2={W - PAD.right}
            y1={PAD.top + innerH * t}
            y2={PAD.top + innerH * t}
            stroke="var(--color-line)"
            strokeWidth={1}
          />
        ))}

        {linia && (
          <line
            x1={sx(xMin)}
            y1={sy((intercept as number) + (slope as number) * xMin)}
            x2={sx(xMax)}
            y2={sy((intercept as number) + (slope as number) * xMax)}
            stroke="#8b95a1"
            strokeWidth={1.5}
            strokeDasharray="5 4"
          />
        )}

        {pts.map((p) => {
          const on = highlight === p.id;
          return (
            <circle
              key={p.id}
              cx={sx(p.mileageKm)}
              cy={sy(p.priceGross)}
              r={on ? 6 : 3.5}
              fill={on ? "#34d399" : "#525a66"}
              stroke={on ? "#0b0d10" : "none"}
              strokeWidth={on ? 2 : 0}
            />
          );
        })}
      </svg>

      <div className="mt-1 flex items-center justify-between text-[11px] tabular-nums text-neutral-600">
        <span>{num.format(xMin)} km</span>
        <span>{num.format(xMax)} km</span>
      </div>
      <p className="mt-0.5 text-center text-[11px] text-neutral-500">
        {per10k > 0
          ? `średnio −${pln.format(per10k)} na każde 10 tys. km · ${n} ofert`
          : `${n} ofert · zależność od przebiegu jest tu nieczytelna`}
      </p>
    </div>
  );
}
