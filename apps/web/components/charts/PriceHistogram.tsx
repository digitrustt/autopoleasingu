"use client";

import type { PriceHistogramData } from "@/lib/queries";
import { useId, useState } from "react";

const pln = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("pl-PL");

/** Skrocona cena na os: 182 800 -> "183 tys.". */
function short(v: number): string {
  return `${Math.round(v / 1000)} tys.`;
}

/** Podzialka osi Y w okraglych liczbach — 0 / 10 / 20, nigdy 0 / 7 / 14. */
function podzialka(peak: number): number[] {
  const krok = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000].find((k) => peak / k <= 4) ?? 2000;
  const out: number[] = [];
  for (let v = 0; v <= peak; v += krok) out.push(v);
  return out;
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
 *
 * CO BYLO ZLE W POPRZEDNIEJ WERSJI: slupki mialy kolor neutral-700/60, ktory
 * na tle panelu jest praktycznie niewidoczny; nie bylo ani osi Y, ani siatki,
 * ani wartosci — na osi X stały tylko dwie skrajne ceny, wiec z wykresu nie
 * dalo sie odczytac ANI JEDNEJ liczby. Podpowiedz wisiala na atrybucie `title`,
 * czyli pojawiala sie po sekundzie, systemowym dymkiem, poza stylistyka strony.
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
  const id = useId();
  const [aktywny, setAktywny] = useState<number | null>(null);

  const { min, max, total, counts } = dane;
  if (counts.length === 0 || total < 6 || max === min) return null;

  const bins = counts.length;
  const width = (max - min) / bins;
  const peak = Math.max(...counts);
  const osY = podzialka(peak);
  const gora = osY[osY.length - 1];

  const markerBin =
    marker != null && marker >= min && marker <= max
      ? Math.min(bins - 1, Math.floor((marker - min) / width))
      : null;
  const markerPct =
    marker != null && marker >= min && marker <= max ? ((marker - min) / (max - min)) * 100 : null;

  return (
    <figure className="m-0">
      <div className="flex gap-2">
        {/*
          Gutter na podpisy osi Y. Wczesniej wykres nie mial osi wcale, wiec
          wysokosc slupka nie znaczyla zadnej konkretnej liczby.
        */}
        <div className="flex h-32 w-8 shrink-0 flex-col justify-between text-right text-[10px] tabular-nums text-neutral-600">
          {[...osY].reverse().map((v) => (
            <span key={v} className="leading-none">
              {v}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          {/* Siatka: wlos w kolorze o krok od powierzchni, ciagly, cofniety. */}
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
            {osY.map((v) => (
              <span key={v} className="h-px w-full bg-[var(--chart-grid)]" />
            ))}
          </div>

          <div className="relative flex h-32 items-end gap-[2px]">
            {counts.map((c, i) => {
              const wyroznik = markerBin === i;
              const czynny = aktywny === i;
              return (
                <button
                  key={`${min}-${i}`}
                  type="button"
                  aria-describedby={czynny ? `${id}-dymek` : undefined}
                  onPointerEnter={() => setAktywny(i)}
                  onPointerLeave={() => setAktywny(null)}
                  onFocus={() => setAktywny(i)}
                  onBlur={() => setAktywny(null)}
                  /*
                    Slupek JEST celem najechania — bez celownika, zgodnie z regula
                    dla wykresow slupkowych. Cel siega calej wysokosci kolumny,
                    zeby nie trzeba bylo trafiac w kilkupikselowy pasek przy dole.
                  */
                  className="group relative flex h-full min-w-0 flex-1 cursor-default items-end"
                >
                  <span
                    className={`w-full rounded-t-[4px] transition-colors ${
                      wyroznik
                        ? "bg-[var(--color-accent)]"
                        : czynny
                          ? "bg-[var(--chart-1)]"
                          : "bg-[var(--chart-1-dim)]"
                    }`}
                    style={{ height: `${Math.max(2, (c / gora) * 100)}%` }}
                  />
                </button>
              );
            })}

            {markerPct != null && (
              <span
                className="pointer-events-none absolute inset-y-0 w-px bg-[var(--color-accent)]"
                style={{ left: `${markerPct}%` }}
              />
            )}
          </div>

          {/*
            Podpisy osi X w czterech miejscach, nie w dwoch skrajnych. Bez
            posrednich wartosci nie dalo sie odczytac, gdzie jest srodek rynku.
          */}
          <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-neutral-600">
            {[0, 1, 2, 3].map((k) => (
              <span key={k}>{short(min + ((max - min) * k) / 3)}</span>
            ))}
          </div>
        </div>
      </div>

      {/*
        Dymek pod wykresem, nie nad slupkiem: przy wysokosci 128 px nakladka
        zaslanialaby sasiednie slupki, czyli dokladnie to, co czlowiek porownuje.
        Wysokosc jest zarezerwowana na stale, zeby tresc pod spodem nie skakala.
      */}
      <div className="mt-2 h-8">
        {aktywny != null ? (
          <p
            id={`${id}-dymek`}
            role="status"
            className="rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-2.5 py-1.5 text-[12px] leading-tight"
          >
            <span className="font-semibold tabular-nums text-neutral-100">
              {num.format(counts[aktywny])}{" "}
              {counts[aktywny] === 1 ? "oferta" : counts[aktywny] < 5 ? "oferty" : "ofert"}
            </span>{" "}
            <span className="text-neutral-500">
              w przedziale {pln.format(min + aktywny * width)} –{" "}
              {pln.format(min + (aktywny + 1) * width)}
            </span>
          </p>
        ) : (
          <p className="px-0.5 text-[11px] text-neutral-600">
            {num.format(total)} ofert · najedź na słupek, żeby zobaczyć przedział
          </p>
        )}
      </div>

      {marker != null && cheaper != null && (
        <figcaption className="mt-1 text-[11px] text-neutral-300">
          <span className="mr-1.5 inline-block h-2 w-2 rounded-[2px] bg-[var(--color-accent)] align-middle" />
          {markerLabel}: {pln.format(marker)} — tańsza od{" "}
          {Math.round(((total - cheaper) / total) * 100)}% ofert
        </figcaption>
      )}
    </figure>
  );
}
