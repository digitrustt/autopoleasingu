"use client";

import { track } from "@/components/Analytics";
import { MileagePrice } from "@/components/charts/MileagePrice";
import type { ScatterData } from "@/lib/queries";
import Link from "next/link";
import { useEffect, useState } from "react";

const zl = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("pl-PL");

const pole =
  "w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-3 py-2 text-sm text-neutral-100 [color-scheme:dark] focus:border-neutral-600 focus:outline-none disabled:opacity-50";
const etykieta = "mb-1 block text-[13px] text-neutral-400";
const a = "underline decoration-dotted underline-offset-2 hover:text-accent";

const PALIWA: [string, string][] = [
  ["", "Dowolne"],
  ["petrol", "Benzyna"],
  ["diesel", "Diesel"],
  ["hybrid", "Hybryda"],
  ["phev", "Hybryda plug-in"],
  ["electric", "Elektryczny"],
  ["lpg", "LPG"],
];

/** Ponizej tylu aut mediana to przypadek, nie rynek. */
const MIN_AUT = 5;

interface Cena {
  n: number;
  mediana: number;
  p25: number;
  p75: number;
}
interface Wynik {
  make: string;
  model: string;
  year: number;
  km: number;
  cena: Cena | null;
  rocznik: Cena | null;
  lata: { year: number; n: number; mediana: number }[];
  wykres: ScatterData;
  podobne: { id: number; nazwa: string; year: number | null; km: number | null; cena: number | null; miasto: string | null }[];
}

/**
 * Wycena auta na prawdziwych cenach ofert — w przegladarce, z jednym
 * zapytaniem do /api/wycena (cache na CDN).
 *
 * Mowimy wprost, co to za liczba: mediana cen OFERT dealerow i leasingodawcow
 * dla tego modelu, rocznika i podobnego przebiegu. Prywatnie dostaje sie
 * zwykle mniej, w skupie jeszcze mniej — nie podajemy tu procentow, ktorych
 * nie umiemy zmierzyc.
 *
 * Adres moze przyjsc z wypelnionymi polami (?marka=&model=&rok=&km=) — np.
 * z linku na stronie modelu. Czytamy go w przegladarce, zeby strona zostala
 * statyczna.
 */
export function WycenaAuta({ marki }: { marki: string[] }) {
  const [marka, setMarka] = useState("");
  const [modele, setModele] = useState<{ slug: string; nazwa: string }[]>([]);
  const [model, setModel] = useState("");
  const [rok, setRok] = useState("");
  const [km, setKm] = useState("");
  const [paliwo, setPaliwo] = useState("");
  const [wynik, setWynik] = useState<Wynik | null>(null);
  const [stan, setStan] = useState<"" | "liczy" | "blad">("");
  const [modelZAdresu, setModelZAdresu] = useState("");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const m = q.get("marka");
    if (m) setMarka(marki.find((x) => x.toLowerCase() === m.toLowerCase()) ?? "");
    setModelZAdresu(q.get("model") ?? "");
    setRok(q.get("rok") ?? "");
    setKm(q.get("km") ?? "");
  }, [marki]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: modelZAdresu tylko raz, przy wejsciu z linku
  useEffect(() => {
    setModele([]);
    setModel("");
    if (!marka) return;
    fetch(`/api/cena-rynkowa?make=${encodeURIComponent(marka)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((lista: { slug: string; nazwa: string }[]) => {
        setModele(lista);
        if (modelZAdresu && lista.some((x) => x.slug === modelZAdresu)) setModel(modelZAdresu);
        setModelZAdresu("");
      })
      .catch(() => setModele([]));
  }, [marka]);

  const przebieg = Number(km.replace(/\s/g, ""));
  const gotowe = marka && model && rok && km !== "" && Number.isFinite(przebieg);

  function wycen(e: React.FormEvent) {
    e.preventDefault();
    if (!gotowe) return;
    setStan("liczy");
    const q = new URLSearchParams({ make: marka, model, year: rok, km: String(przebieg) });
    if (paliwo) q.set("fuel", paliwo);
    fetch(`/api/wycena?${q}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((w: Wynik) => {
        setWynik(w);
        setStan("");
        track("wycena", { marka, model, rok: Number(rok), km: przebieg, paliwo, n: w.cena?.n ?? 0 });
        // Adres do udostepnienia i powrotu — bez przeladowania strony.
        const u = new URLSearchParams({ marka, model, rok, km: String(przebieg) });
        window.history.replaceState(null, "", `?${u}`);
      })
      .catch(() => setStan("blad"));
  }

  const lata = Array.from({ length: 22 }, (_, i) => new Date().getFullYear() - i);

  // Przy przebiegu za malo aut — pokazujemy rocznik bez przebiegu i mowimy to.
  const glowna = wynik?.cena && wynik.cena.n >= MIN_AUT ? wynik.cena : null;
  const zapas = !glowna && wynik?.rocznik && wynik.rocznik.n >= MIN_AUT ? wynik.rocznik : null;
  const pokaz = glowna ?? zapas;
  const tenRok = wynik?.lata.find((l) => l.year === wynik.year);
  const starszy = wynik?.lata.find((l) => l.year === wynik.year - 1);
  const spadek =
    tenRok && starszy && tenRok.n >= MIN_AUT && starszy.n >= MIN_AUT && tenRok.mediana > 0
      ? (tenRok.mediana - starszy.mediana) / tenRok.mediana
      : null;

  return (
    <div>
      <form
        onSubmit={wycen}
        className="grid gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4 sm:grid-cols-2 lg:grid-cols-6"
      >
        <label className="lg:col-span-1">
          <span className={etykieta}>Marka</span>
          <select value={marka} onChange={(e) => setMarka(e.target.value)} className={pole}>
            <option value="">Wybierz</option>
            {marki.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="lg:col-span-1">
          <span className={etykieta}>Model</span>
          <select value={model} onChange={(e) => setModel(e.target.value)} className={pole} disabled={modele.length === 0}>
            <option value="">Wybierz</option>
            {modele.map((m) => (
              <option key={m.slug} value={m.slug}>
                {m.nazwa}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={etykieta}>Rocznik</span>
          <select value={rok} onChange={(e) => setRok(e.target.value)} className={pole}>
            <option value="">Wybierz</option>
            {lata.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={etykieta}>Przebieg (km)</span>
          <input inputMode="numeric" placeholder="np. 90 000" value={km} onChange={(e) => setKm(e.target.value)} className={pole} />
        </label>
        <label>
          <span className={etykieta}>Paliwo</span>
          <select value={paliwo} onChange={(e) => setPaliwo(e.target.value)} className={pole}>
            {PALIWA.map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={!gotowe || stan === "liczy"}
            className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white disabled:opacity-40"
          >
            {stan === "liczy" ? "Liczę…" : "Wyceń auto"}
          </button>
        </div>
      </form>

      {stan === "blad" && (
        <p className="mt-4 text-sm text-red-400">Nie udało się policzyć wyceny. Spróbuj ponownie za chwilę.</p>
      )}

      {wynik && (
        <div className="mt-6 flex flex-col gap-6" aria-live="polite">
          {pokaz ? (
            <section className="rounded-xl border border-accent/40 bg-accent/5 p-5">
              <p className="text-[13px] text-neutral-400">
                {wynik.make} {wynik.model} · {wynik.year} · {num.format(wynik.km)} km
              </p>
              <p className="mt-1 text-3xl font-bold text-neutral-100">{zl.format(pokaz.mediana)}</p>
              <p className="mt-1 text-sm text-neutral-300">
                Połowa podobnych aut kosztuje od {zl.format(pokaz.p25)} do {zl.format(pokaz.p75)}.
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-neutral-500">
                {glowna
                  ? `Mediana cen ${num.format(pokaz.n)} ofert tego modelu z tego rocznika, z przebiegiem ±25 tys. km od twojego.`
                  : `Przy twoim przebiegu mamy za mało ofert, więc to mediana ${num.format(pokaz.n)} ofert tego rocznika bez względu na przebieg — auto z dużym przebiegiem będzie tańsze.`}{" "}
                To ceny ofert dealerów i leasingodawców, w tym aut już sprzedanych. Sprzedając prywatnie,
                dostaniesz zwykle mniej, a w skupie jeszcze mniej.
              </p>
            </section>
          ) : (
            <p className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4 text-sm text-neutral-400">
              Mamy za mało ofert {wynik.make} {wynik.model} z rocznika {wynik.year}, żeby podać wiarygodną
              wycenę. Spróbuj sąsiedniego rocznika albo bez wyboru paliwa.
            </p>
          )}

          {wynik.wykres.n >= 6 && (
            <section>
              <h2 className="mb-2 text-base font-semibold text-neutral-100">
                Cena a przebieg — {wynik.make} {wynik.model} {wynik.year}
              </h2>
              <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-3">
                <MileagePrice dane={wynik.wykres} />
              </div>
            </section>
          )}

          {wynik.lata.length > 1 && (
            <section>
              <h2 className="mb-2 text-base font-semibold text-neutral-100">Ile kosztuje każdy rocznik</h2>
              {spadek != null && spadek > 0 && (
                <p className="mb-2 text-[13px] text-neutral-400">
                  Rocznik {wynik.year - 1} jest w ofertach średnio o {Math.round(spadek * 100)}% tańszy niż{" "}
                  {wynik.year}.
                </p>
              )}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[360px] text-left text-[13px]">
                  <thead className="text-neutral-500">
                    <tr className="border-b border-[var(--color-line)]">
                      <th className="py-2 pr-3 font-medium">Rocznik</th>
                      <th className="py-2 pr-3 text-right font-medium">Mediana ceny</th>
                      <th className="py-2 text-right font-medium">Aktualnych ofert</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wynik.lata.slice(0, 10).map((l) => (
                      <tr
                        key={l.year}
                        className={`border-b border-[var(--color-line)]/60 ${l.year === wynik.year ? "text-accent" : "text-neutral-300"}`}
                      >
                        <td className="py-1.5 pr-3">{l.year}</td>
                        <td className="py-1.5 pr-3 text-right">{zl.format(l.mediana)}</td>
                        <td className="py-1.5 text-right text-neutral-500">{num.format(l.n)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {wynik.podobne.length > 0 && (
            <section>
              <h2 className="mb-2 text-base font-semibold text-neutral-100">Podobne auta w ofertach teraz</h2>
              <ul className="flex flex-col divide-y divide-[var(--color-line)] rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)]">
                {wynik.podobne.map((o) => (
                  <li key={o.id}>
                    <Link
                      href={`/oferta/${o.id}`}
                      className="flex flex-wrap items-baseline justify-between gap-x-4 px-4 py-2.5 text-[14px] hover:bg-[var(--color-ink)]"
                    >
                      <span className="text-neutral-200">
                        {o.nazwa}
                        <span className="ml-2 text-[13px] text-neutral-500">
                          {[o.year, o.km != null ? `${num.format(o.km)} km` : null, o.miasto].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      {o.cena != null && <span className="text-neutral-100">{zl.format(o.cena)}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="text-[13px] leading-relaxed text-neutral-400">
            Sprzedajesz prywatnie? Kupujący zapłaci 2% PCC od wartości rynkowej —{" "}
            <Link href="/kalkulator-pcc-samochodu" className={a}>
              kalkulator PCC i opłat rejestracyjnych
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}
