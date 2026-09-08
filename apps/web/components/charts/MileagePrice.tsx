"use client";

import type { ScatterData } from "@/lib/queries";
import { useId, useRef, useState } from "react";

const pln = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("pl-PL");

const W = 600;
const H = 240;

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
 * narysowania chmury sa przyciete.
 *
 * CO BYLO ZLE: punkty w kolorze #525a66 o promieniu 3,5 px — czyli szare,
 * ponizej progu widocznosci i ponizej minimalnego rozmiaru znacznika. Podpisy
 * osi istnialy tylko dla przebiegu i tylko na skrajach, wiec z wykresu nie dalo
 * sie odczytac ceny ZADNEGO punktu. Nie bylo najezdzania — a chmura punktow bez
 * niego jest ozdoba, nie narzedziem: widac ksztalt, nie widac ani jednej oferty.
 *
 * Podpisy osi stoja w HTML wokol SVG, nie w srodku niego. SVG jest skalowany
 * przez viewBox, wiec tekst w nim rosnie i maleje razem z szerokoscia okna —
 * na telefonie robil sie nieczytelny, na monitorze nieproporcjonalnie duzy.
 */
export function MileagePrice({
  dane,
  highlight,
}: {
  dane: ScatterData;
  /** Id oferty, ktora ma byc wyrozniona — uzywane na stronie oferty. */
  highlight?: number;
}) {
  const id = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [blisko, setBlisko] = useState<{ x: number; y: number; km: number; cena: number } | null>(
    null,
  );

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
  const M = 10; // margines, zeby punkty przy krawedzi nie byly przyciete
  const sx = (v: number) => M + ((v - xMin) / xSpan) * (W - 2 * M);
  const sy = (v: number) => M + (H - 2 * M) - ((v - yMin) / ySpan) * (H - 2 * M);

  // Spadek na 10 tys. km — jedyna liczba, ktora ktokolwiek z tego wyniesie.
  const per10k = slope != null ? -slope * 10_000 : 0;
  const linia = slope != null && intercept != null;

  /*
   * Najblizszy punkt zamiast trafiania w znacznik.
   *
   * Punkt o promieniu 4 px jest celem, w ktory nikt nie trafia. Liczymy wiec
   * odleglosc do wszystkich punktow w ukladzie viewBoxa i pokazujemy ten
   * najblizszy — wystarczy byc OBOK, nie na nim.
   */
  function najblizszy(e: React.PointerEvent<SVGSVGElement>) {
    const el = svgRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const mx = ((e.clientX - r.left) / r.width) * W;
    const my = ((e.clientY - r.top) / r.height) * H;
    let best: (typeof pts)[number] | null = null;
    let bestD = Number.POSITIVE_INFINITY;
    for (const p of pts) {
      const d = (sx(p.mileageKm) - mx) ** 2 + (sy(p.priceGross) - my) ** 2;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    // 40 jednostek viewBoxa — poza tym promieniem nie zgadujemy, o co chodzilo.
    if (!best || bestD > 40 * 40) return setBlisko(null);
    setBlisko({
      x: sx(best.mileageKm),
      y: sy(best.priceGross),
      km: best.mileageKm,
      cena: best.priceGross,
    });
  }

  const osY = [0, 0.5, 1].map((t) => yMin + ySpan * t);

  return (
    <figure className="m-0">
      <div className="flex gap-2">
        <div className="flex h-[240px] w-[54px] shrink-0 flex-col justify-between text-right text-[10px] tabular-nums text-neutral-600">
          {[...osY].reverse().map((v) => (
            <span key={v} className="leading-none">
              {Math.round(v / 1000)} tys.
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="h-[240px] w-full touch-none"
            role="img"
            aria-label={`Cena wobec przebiegu, ${n} ofert`}
            onPointerMove={najblizszy}
            onPointerLeave={() => setBlisko(null)}
          >
            <title>Cena wobec przebiegu</title>

            {/* Siatka: wlos, ciagly, o krok od powierzchni. */}
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <line
                key={t}
                x1={0}
                x2={W}
                y1={M + (H - 2 * M) * t}
                y2={M + (H - 2 * M) * t}
                stroke="var(--chart-grid)"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            ))}

            {pts.map((p) => {
              const on = highlight === p.id;
              return (
                <circle
                  key={p.id}
                  cx={sx(p.mileageKm)}
                  cy={sy(p.priceGross)}
                  r={on ? 6 : 4}
                  fill={on ? "var(--color-accent)" : "var(--chart-1)"}
                  fillOpacity={on ? 1 : 0.55}
                  /* Pierscien w kolorze powierzchni — punkty czytelne tam, gdzie na siebie zachodza. */
                  stroke="var(--color-panel)"
                  strokeWidth={on ? 2 : 1.5}
                />
              );
            })}

            {/*
              Trend RYSOWANY NA WIERZCHU chmury i przerywany. Przerywana kreska
              to konwencja "to jest model, nie dane" — inaczej czytelnik bierze
              ja za kolejna serie pomiarow.
            */}
            {linia && (
              <line
                x1={sx(xMin)}
                y1={sy((intercept as number) + (slope as number) * xMin)}
                x2={sx(xMax)}
                y2={sy((intercept as number) + (slope as number) * xMax)}
                stroke="var(--color-accent)"
                strokeOpacity={0.75}
                strokeWidth={2}
                strokeDasharray="6 5"
                vectorEffect="non-scaling-stroke"
              />
            )}

            {blisko && (
              <circle
                cx={blisko.x}
                cy={blisko.y}
                r={7}
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>

          <div className="mt-1 flex justify-between text-[10px] tabular-nums text-neutral-600">
            {[0, 1, 2, 3].map((k) => {
              const tys = Math.round((xMin + (xSpan * k) / 3) / 1000);
              // "0 tys. km" czyta sie glupio — przy zerze zostaje samo "0 km".
              return <span key={k}>{tys === 0 ? "0 km" : `${num.format(tys)} tys. km`}</span>;
            })}
          </div>
        </div>
      </div>

      {/* Stala wysokosc — tresc pod wykresem nie moze skakac przy najezdzaniu. */}
      <div className="mt-2 h-8">
        {blisko ? (
          <p
            id={`${id}-dymek`}
            role="status"
            className="rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2.5 py-1.5 text-[12px] leading-tight"
          >
            <span className="font-semibold tabular-nums text-neutral-100">
              {pln.format(blisko.cena)}
            </span>{" "}
            <span className="text-neutral-500">przy {num.format(blisko.km)} km</span>
          </p>
        ) : (
          <p className="px-0.5 text-[11px] text-neutral-600">
            {per10k > 0
              ? `Linia trendu: średnio −${pln.format(per10k)} na każde 10 tys. km · ${n} ofert`
              : `${n} ofert · zależność od przebiegu jest tu nieczytelna`}
          </p>
        )}
      </div>
    </figure>
  );
}
