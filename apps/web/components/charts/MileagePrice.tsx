const pln = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("pl-PL");

export interface Point {
  id: number;
  mileageKm: number | null;
  priceGross: number | null;
  year: number | null;
}

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
 * Linia to zwykla regresja liniowa metoda najmniejszych kwadratow. Przy tej
 * liczbie punktow (kilkadziesiat) cokolwiek bardziej wyrafinowanego udawaloby
 * precyzje, ktorej w danych nie ma.
 */
export function MileagePrice({
  points,
  highlight,
}: {
  points: Point[];
  /** Id oferty, ktora ma byc wyrozniona — uzywane na stronie oferty. */
  highlight?: number;
}) {
  const pts = points.filter(
    (p): p is Point & { mileageKm: number; priceGross: number } =>
      p.mileageKm != null && p.priceGross != null,
  );
  if (pts.length < 6) return null;

  const xs = pts.map((p) => p.mileageKm);
  const ys = pts.map((p) => p.priceGross);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  // Zerowy zakres (wszystkie auta o tym samym przebiegu) dzielilby przez zero.
  const xSpan = xMax - xMin || 1;
  const ySpan = yMax - yMin || 1;

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const sx = (v: number) => PAD.left + ((v - xMin) / xSpan) * innerW;
  const sy = (v: number) => PAD.top + innerH - ((v - yMin) / ySpan) * innerH;

  // Regresja liniowa: y = a + b·x.
  const n = pts.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
  }
  const b = sxx === 0 ? 0 : sxy / sxx;
  const a = my - b * mx;
  // Spadek na 10 tys. km — jedyna liczba, ktora ktokolwiek z tego wyniesie.
  const per10k = -b * 10_000;

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

        {b !== 0 && (
          <line
            x1={sx(xMin)}
            y1={sy(a + b * xMin)}
            x2={sx(xMax)}
            y2={sy(a + b * xMax)}
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

      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] tabular-nums text-neutral-600">
        <span>{num.format(xMin)} km</span>
        <span className="text-neutral-500">
          {per10k > 0
            ? `średnio −${pln.format(per10k)} na każde 10 tys. km · ${n} ofert`
            : `${n} ofert · zależność od przebiegu jest tu nieczytelna`}
        </span>
        <span>{num.format(xMax)} km</span>
      </div>
    </div>
  );
}
