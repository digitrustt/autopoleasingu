"use client";

import { track } from "@/components/Analytics";
import { CarImage } from "@/components/CarImage";
import { MileagePrice } from "@/components/charts/MileagePrice";
import { type YearBar, YearBars } from "@/components/charts/YearBars";
import type { ScatterData } from "@/lib/queries";
import { modelHref } from "@/lib/slug";
import { ArrowRight, Info } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useEffect, useRef, useState } from "react";

const zl = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("pl-PL");
const tysLiczba = (v: number) => (v / 1000).toLocaleString("pl-PL", { maximumFractionDigits: 1 });
const tys = (v: number) => `${tysLiczba(v)} tys.`;

const pole =
  "h-11 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-3 text-[15px] text-neutral-100 [color-scheme:dark] transition-colors focus:border-neutral-500 focus:outline-none disabled:opacity-40";
const etykieta = "mb-1.5 block text-[12px] font-medium uppercase tracking-wide text-neutral-500";
const karta = "rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)]";

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
  lata: YearBar[];
  wykres: ScatterData;
  podobne: {
    id: number;
    nazwa: string;
    year: number | null;
    km: number | null;
    cena: number | null;
    miasto: string | null;
    zdjecie: string | null;
    zrodlo: string;
  }[];
}
export interface SzybkiWybor {
  etykieta: string;
  marka: string;
  model: string;
  rok: number;
  km: number;
}
interface Zapytanie {
  marka: string;
  model: string;
  rok: string;
  km: string;
  paliwo: string;
}

/**
 * Wycena auta na prawdziwych cenach ofert — w przegladarce, z jednym
 * zapytaniem do /api/wycena (cache na CDN).
 *
 * UKLAD (przebudowa 20.10.2026 — pierwsza wersja byla sciana szarych ramek
 * z drobnym tekstem, wynik ginal): u gory naglowek strony obok karty
 * formularza, pod spodem wynik z duza cena, paskiem przedzialu i kafelkami,
 * dalej wykresy w tym samym stylu co na stronach modeli.
 *
 * `children` to naglowek strony renderowany na serwerze (H1 i opis musza
 * byc w HTML dla wyszukiwarki, a ukladem rzadzi ten komponent).
 *
 * Mowimy wprost, co to za liczba: mediana cen OFERT dealerow i leasingodawcow.
 * Prywatnie dostaje sie zwykle mniej, w skupie jeszcze mniej — bez procentow,
 * ktorych nie umiemy zmierzyc.
 *
 * Adres moze przyjsc z wypelnionymi polami (?marka=&model=&rok=&km=) — z linku
 * na stronie modelu albo udostepniony wynik. Komplet pol = liczymy od razu.
 */
export function WycenaAuta({
  marki,
  szybkie,
  children,
}: {
  marki: string[];
  szybkie: SzybkiWybor[];
  children: ReactNode;
}) {
  const [marka, setMarka] = useState("");
  const [modele, setModele] = useState<{ slug: string; nazwa: string }[]>([]);
  const [model, setModel] = useState("");
  const [rok, setRok] = useState("");
  const [km, setKm] = useState("");
  const [paliwo, setPaliwo] = useState("");
  const [wynik, setWynik] = useState<Wynik | null>(null);
  const [stan, setStan] = useState<"" | "liczy" | "blad">("");
  /* Model do ustawienia, gdy dojdzie lista modeli marki (wejscie z linku albo szybki wybor). */
  const czekajacyModel = useRef("");
  const wynikRef = useRef<HTMLElement>(null);

  function policz(z: Zapytanie) {
    const przebieg = Number(z.km.replace(/\s/g, ""));
    if (!z.marka || !z.model || !z.rok || !Number.isFinite(przebieg)) return;
    setStan("liczy");
    const q = new URLSearchParams({ make: z.marka, model: z.model, year: z.rok, km: String(przebieg) });
    if (z.paliwo) q.set("fuel", z.paliwo);
    fetch(`/api/wycena?${q}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((w: Wynik) => {
        setWynik(w);
        setStan("");
        track("wycena", { marka: z.marka, model: z.model, rok: Number(z.rok), km: przebieg, paliwo: z.paliwo, n: w.cena?.n ?? 0 });
        const u = new URLSearchParams({ marka: z.marka, model: z.model, rok: z.rok, km: String(przebieg) });
        window.history.replaceState(null, "", `?${u}`);
        requestAnimationFrame(() => wynikRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
      })
      .catch(() => setStan("blad"));
  }

  function ustaw(z: Omit<Zapytanie, "paliwo">, odRazu: boolean) {
    const m = marki.find((x) => x.toLowerCase() === z.marka.toLowerCase()) ?? "";
    czekajacyModel.current = z.model;
    setMarka(m);
    setRok(z.rok);
    setKm(z.km);
    setPaliwo("");
    if (odRazu && m && z.model && z.rok && z.km) policz({ ...z, marka: m, paliwo: "" });
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: tylko przy wejsciu na strone
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (!q.get("marka")) return;
    ustaw(
      { marka: q.get("marka") ?? "", model: q.get("model") ?? "", rok: q.get("rok") ?? "", km: q.get("km") ?? "" },
      true,
    );
  }, []);

  useEffect(() => {
    setModele([]);
    setModel("");
    if (!marka) return;
    fetch(`/api/cena-rynkowa?make=${encodeURIComponent(marka)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((lista: { slug: string; nazwa: string }[]) => {
        setModele(lista);
        const czeka = czekajacyModel.current;
        if (czeka && lista.some((x) => x.slug === czeka)) setModel(czeka);
        czekajacyModel.current = "";
      })
      .catch(() => setModele([]));
  }, [marka]);

  const gotowe = Boolean(marka && model && rok && km.trim());
  const lata = Array.from({ length: 22 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div>
      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
        <div>
          {children}
          {szybkie.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 text-[12px] font-medium uppercase tracking-wide text-neutral-500">
                Sprawdź na przykładzie
              </p>
              <div className="flex flex-wrap gap-2">
                {szybkie.map((s) => (
                  <button
                    key={s.etykieta}
                    type="button"
                    onClick={() => ustaw({ marka: s.marka, model: s.model, rok: String(s.rok), km: String(s.km) }, true)}
                    className="rounded-full border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-1.5 text-[13px] text-neutral-300 transition-colors hover:border-neutral-500 hover:text-neutral-100"
                  >
                    {s.etykieta}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            policz({ marka, model, rok, km, paliwo });
          }}
          className={`${karta} p-5 shadow-2xl shadow-black/40`}
        >
          <p className="mb-4 text-base font-semibold text-neutral-100">Dane auta</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 sm:col-span-1">
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
            <label className="col-span-2 sm:col-span-1">
              <span className={etykieta}>Model</span>
              <select value={model} onChange={(e) => setModel(e.target.value)} className={pole} disabled={modele.length === 0}>
                <option value="">{marka ? "Wybierz" : "Najpierw marka"}</option>
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
              <span className={etykieta}>Przebieg</span>
              <span className="relative block">
                <input
                  inputMode="numeric"
                  placeholder="90 000"
                  value={km}
                  onChange={(e) => setKm(e.target.value)}
                  className={`${pole} pr-10`}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[13px] text-neutral-500">
                  km
                </span>
              </span>
            </label>
            <label className="col-span-2">
              <span className={etykieta}>Paliwo (opcjonalnie)</span>
              <select value={paliwo} onChange={(e) => setPaliwo(e.target.value)} className={pole}>
                {PALIWA.map(([v, t]) => (
                  <option key={v} value={v}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="submit"
            disabled={!gotowe || stan === "liczy"}
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-accent text-[15px] font-semibold text-black transition-colors hover:bg-white disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
          >
            {stan === "liczy" ? "Liczę…" : "Wyceń auto"}
            {stan !== "liczy" && <ArrowRight size={17} />}
          </button>
          <p className="mt-2 text-center text-[12px] text-neutral-500">
            {gotowe ? "Bez rejestracji, bez telefonu." : "Uzupełnij markę, model, rocznik i przebieg."}
          </p>
          {stan === "blad" && (
            <p className="mt-2 text-center text-[13px] text-red-400">Nie udało się policzyć. Spróbuj za chwilę.</p>
          )}
        </form>
      </section>

      {wynik && (
        <section ref={wynikRef} className="mt-12 scroll-mt-6" aria-live="polite">
          <WynikWyceny w={wynik} />
        </section>
      )}
    </div>
  );
}

function WynikWyceny({ w }: { w: Wynik }) {
  // Przy przebiegu za malo aut — pokazujemy rocznik bez przebiegu i mowimy to.
  const glowna = w.cena && w.cena.n >= MIN_AUT ? w.cena : null;
  const pokaz = glowna ?? (w.rocznik && w.rocznik.n >= MIN_AUT ? w.rocznik : null);
  const nazwa = `${w.make} ${w.model}`;

  if (!pokaz) {
    return (
      <div className={`${karta} p-6`}>
        <p className="text-lg font-semibold text-neutral-100">Za mało danych, żeby wycenić to auto</p>
        <p className="mt-1 max-w-[60ch] text-sm leading-relaxed text-neutral-400">
          Mamy mniej niż {MIN_AUT} ofert {nazwa} z rocznika {w.year}. Spróbuj sąsiedniego rocznika albo bez wyboru
          paliwa.
        </p>
      </div>
    );
  }

  /*
   * Typowy przebieg rocznika zamiast "rocznik starszy o rok taniej o X%".
   * Tamto potrafilo wyjsc na plus (starsze Corolle bywaja drozsze) i tylko
   * mylilo, a przebieg wprost mowi, czy twoje auto jest lepsze od typowego.
   */
  const tenRok = w.lata.find((l) => l.year === w.year);
  const typowyKm = tenRok?.medianMileage ?? null;
  const ocenaKm =
    typowyKm == null || typowyKm <= 0
      ? "brak danych"
      : w.km < typowyKm * 0.9
        ? "twoje auto ma mniej — to plus"
        : w.km > typowyKm * 1.1
          ? "twoje auto ma więcej"
          : "twoje auto jest w normie";
  const na10k = w.wykres.slope != null && w.wykres.n >= 20 ? -w.wykres.slope * 10_000 : null;
  const lataWykres = [...w.lata].filter((l) => l.year != null && l.total >= 3).slice(0, 10);

  const kafelki: [string, string, string][] = [
    ["Ofert w wycenie", num.format(pokaz.n), glowna ? "ten rocznik, przebieg ±25 tys. km" : "cały rocznik"],
    ["Połowa aut kosztuje", `${tysLiczba(pokaz.p25)}–${tysLiczba(pokaz.p75)} tys. zł`, "środkowe 50% ofert"],
    [`Typowy przebieg ${w.year}`, typowyKm != null ? `${tys(typowyKm)} km` : "—", ocenaKm],
    ["Każde 10 tys. km", na10k != null && na10k > 0 ? `−${zl.format(na10k)}` : "—", "linia trendu dla rocznika"],
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className={`${karta} overflow-hidden`}>
        <div className="grid gap-8 p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center lg:p-8">
          <div>
            <p className="text-[12px] font-medium uppercase tracking-wide text-neutral-500">Szacunkowa wartość</p>
            <p className="mt-1 text-[15px] text-neutral-300">
              {nazwa} · {w.year} · {num.format(w.km)} km
            </p>
            <p className="mt-3 text-5xl font-bold tracking-tight tabular-nums text-neutral-100">
              {zl.format(pokaz.mediana)}
            </p>
            <p className="mt-2 text-sm text-neutral-400">
              mediana cen {num.format(pokaz.n)} {glowna ? "podobnych ofert" : "ofert tego rocznika"}
            </p>
          </div>
          <PasekPrzedzialu c={pokaz} />
        </div>

        <dl className="grid grid-cols-2 gap-px border-t border-[var(--color-line)] bg-[var(--color-line)] lg:grid-cols-4">
          {kafelki.map(([l, v, h]) => (
            <div key={l} className="bg-[var(--color-panel)] px-4 py-4 sm:px-5">
              <dt className="text-[11px] uppercase tracking-wide text-neutral-600">{l}</dt>
              <dd className="mt-1 text-[15px] font-semibold tabular-nums text-neutral-100 sm:text-lg">{v}</dd>
              <p className="text-[11px] leading-tight text-neutral-600">{h}</p>
            </div>
          ))}
        </dl>

        <p className="flex gap-2 border-t border-[var(--color-line)] px-6 py-3 text-[13px] leading-relaxed text-neutral-500">
          <Info size={15} className="mt-0.5 shrink-0" />
          <span>
            {!glowna && "Przy twoim przebiegu mamy za mało ofert, więc to cały rocznik — auto z dużym przebiegiem będzie tańsze. "}
            To ceny ofert dealerów i leasingodawców, także aut już sprzedanych. Sprzedając prywatnie, dostaniesz zwykle
            mniej, w skupie — jeszcze mniej.
          </span>
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {w.wykres.n >= 6 && (
          <div className={`${karta} p-5`}>
            <h2 className="text-base font-semibold text-neutral-100">Cena a przebieg</h2>
            <p className="mb-4 text-[13px] text-neutral-500">
              {nazwa} {w.year} w ofertach · pionowa kreska to twój przebieg
            </p>
            <MileagePrice dane={w.wykres} znacznik={w.km} />
          </div>
        )}
        {lataWykres.length > 1 && (
          <div className={`${karta} p-5`}>
            <h2 className="text-base font-semibold text-neutral-100">Ile kosztuje każdy rocznik</h2>
            <p className="mb-4 text-[13px] text-neutral-500">Mediana cen aktualnych ofert {nazwa}</p>
            <YearBars rows={lataWykres} wyrozniony={w.year} />
          </div>
        )}
      </div>

      {w.podobne.length > 0 && (
        <div>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-neutral-100">Podobne auta w ofertach teraz</h2>
            <Link href={modelHref(w.make, w.model)} className="text-[13px] text-neutral-400 hover:text-accent">
              Wszystkie {nazwa} →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {w.podobne.map((o) => (
              <Link
                key={o.id}
                href={`/oferta/${o.id}`}
                className={`${karta} group overflow-hidden transition-colors hover:border-neutral-600`}
              >
                <div className="aspect-[16/10] overflow-hidden bg-black/40">
                  <CarImage src={o.zdjecie} alt={o.nazwa} className="h-full w-full object-cover" />
                </div>
                <div className="p-4">
                  <p className="font-medium text-neutral-100">{o.nazwa}</p>
                  <p className="mt-0.5 text-[13px] text-neutral-500">
                    {[o.year, o.km != null ? `${num.format(o.km)} km` : null, o.miasto].filter(Boolean).join(" · ")}
                  </p>
                  <div className="mt-3 flex items-baseline justify-between">
                    {o.cena != null && (
                      <span className="text-lg font-semibold tabular-nums text-neutral-100">{zl.format(o.cena)}</span>
                    )}
                    <span className="text-[12px] text-neutral-600">{o.zrodlo}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <Link
        href="/kalkulator-pcc-samochodu"
        className={`${karta} flex items-center justify-between gap-4 p-5 transition-colors hover:border-neutral-600`}
      >
        <span>
          <span className="block font-medium text-neutral-100">Sprzedajesz prywatnie?</span>
          <span className="text-[13px] text-neutral-500">
            Kupujący zapłaci 2% PCC od wartości rynkowej — policz to i opłaty rejestracyjne.
          </span>
        </span>
        <ArrowRight size={18} className="shrink-0 text-neutral-500" />
      </Link>
    </div>
  );
}

/**
 * Pasek przedzialu: srodkowe 50% ofert (p25–p75) na osi z zapasem po bokach,
 * z kreska mediany. Liczby pod paskiem, zeby nie wchodzily na wypelnienie.
 */
function PasekPrzedzialu({ c }: { c: Cena }) {
  const zapas = (c.p75 - c.p25) * 0.6 || c.mediana * 0.1;
  const od = c.p25 - zapas;
  const doZ = c.p75 + zapas;
  const x = (v: number) => `${((v - od) / (doZ - od)) * 100}%`;
  return (
    <div>
      <div className="relative mb-2 h-6">
        <span
          className="absolute -translate-x-1/2 whitespace-nowrap text-[12px] font-semibold text-neutral-100"
          style={{ left: x(c.mediana) }}
        >
          mediana
        </span>
      </div>
      <div className="relative h-3 rounded-full bg-[var(--color-ink)]">
        <span
          className="absolute inset-y-0 rounded-full bg-[var(--chart-1-dim)]"
          style={{ left: x(c.p25), right: `calc(100% - ${x(c.p75)})` }}
        />
        <span
          className="absolute -top-1.5 h-6 w-1 -translate-x-1/2 rounded-full bg-[var(--color-accent)]"
          style={{ left: x(c.mediana) }}
        />
      </div>
      <div className="relative mt-2 h-10 text-[13px] tabular-nums">
        <span className="absolute -translate-x-1/2 whitespace-nowrap text-center" style={{ left: x(c.p25) }}>
          <span className="block text-neutral-200">{zl.format(c.p25)}</span>
          <span className="block text-[11px] text-neutral-600">tańsza ćwiartka</span>
        </span>
        <span className="absolute -translate-x-1/2 whitespace-nowrap text-center" style={{ left: x(c.p75) }}>
          <span className="block text-neutral-200">{zl.format(c.p75)}</span>
          <span className="block text-[11px] text-neutral-600">droższa ćwiartka</span>
        </span>
      </div>
      <p className="mt-1 text-[12px] text-neutral-500">Połowa podobnych aut jest wystawiona w tym przedziale.</p>
    </div>
  );
}
