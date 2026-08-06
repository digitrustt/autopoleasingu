"use client";

import { Option, Select } from "@/components/Select";
import { shortSource } from "@/lib/format";
import {
  Banknote,
  Gauge,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

const SORTS: Option[] = [
  { value: "deal_desc", label: "Najlepsze okazje" },
  { value: "new", label: "Najnowsze" },
  { value: "price_asc", label: "Cena rosnąco" },
  { value: "price_desc", label: "Cena malejąco" },
  { value: "mileage_asc", label: "Przebieg rosnąco" },
  { value: "year_desc", label: "Rocznik" },
  { value: "power_desc", label: "Moc" },
];

const KINDS: Option[] = [
  { value: "", label: "Kup teraz + aukcje" },
  { value: "fixed", label: "Tylko kup teraz" },
  { value: "auction", label: "Tylko aukcje" },
];

const FUELS: Option[] = [
  { value: "", label: "Każde paliwo" },
  { value: "petrol", label: "Benzyna" },
  { value: "diesel", label: "Diesel" },
  { value: "hybrid", label: "Hybryda" },
  { value: "phev", label: "PHEV" },
  { value: "electric", label: "Elektryk" },
  { value: "lpg", label: "LPG" },
];

const GEARBOXES: Option[] = [
  { value: "", label: "Każda skrzynia" },
  { value: "automatic", label: "Automat" },
  { value: "manual", label: "Manual" },
];

const DEALS: Option[] = [
  { value: "", label: "Każda cena" },
  { value: "10", label: "≥10% pod rynkiem" },
  { value: "15", label: "≥15% pod rynkiem" },
  { value: "25", label: "≥25% pod rynkiem" },
];

const BODIES: Option[] = [
  { value: "", label: "Każde nadwozie" },
  { value: "suv", label: "SUV" },
  { value: "kombi", label: "Kombi" },
  { value: "hatchback", label: "Hatchback" },
  { value: "sedan", label: "Sedan" },
  { value: "coupe", label: "Coupé" },
  { value: "van", label: "Van" },
];

const inputCls =
  "rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2 text-sm " +
  "outline-none transition-colors placeholder:text-neutral-600 hover:border-neutral-600 " +
  "focus:border-accent/70";

export interface FilterState {
  q?: string;
  make?: string;
  model?: string;
  source?: string;
  priceMin?: string;
  priceMax?: string;
  yearMin?: string;
  yearMax?: string;
  mileageMax?: string;
  powerMin?: string;
  fuel?: string;
  gearbox?: string;
  body?: string;
  sort?: string;
  kind?: string;
  twinsOnly?: string;
  withPrice?: string;
  dealMin?: string;
}

/** Ile filtrow poza sortowaniem jest aktywnych — do plakietki przy "Więcej". */
function countActive(c: FilterState): number {
  const keys: (keyof FilterState)[] = [
    "q", "make", "model", "source", "priceMin", "priceMax", "yearMin", "yearMax",
    "mileageMax", "powerMin", "fuel", "gearbox", "body", "kind", "twinsOnly", "withPrice", "dealMin",
  ];
  return keys.filter((k) => c[k] && c[k] !== "").length;
}

export function Filters({
  makes,
  models,
  sources,
  current,
}: {
  makes: string[];
  models: string[];
  sources: { id: string; name: string; active: number }[];
  current: FilterState;
}) {
  const router = useRouter();
  const activeCount = countActive(current);

  /*
   * Przejmujemy submit, zeby nawigacja byla kliencka. Zwykly GET przeladowuje
   * cala strone, przez co granica Suspense z radarem nigdy sie nie uruchamia,
   * a przegladarka na moment pokazuje bialy ekran. router.push zostawia naglowek
   * i filtry na miejscu i podmienia sama liste.
   *
   * `method="get"` na formularzu zostaje: bez JS-u strona nadal dziala,
   * a URL wychodzi identyczny.
   */
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);

    /*
     * Wklejony VIN prowadzi wprost do historii egzemplarza, a nie do wyszukiwania
     * po tytule — szukanie "WBA11EG0005297078" wsrod marek i modeli nie zwrocilo
     * by nic. VIN ma 17 znakow i nie zawiera I, O ani Q.
     */
    const q = String(data.get("q") ?? "").trim().toUpperCase();
    if (/^[A-HJ-NPR-Z0-9]{17}$/.test(q)) {
      router.push(`/vin/${encodeURIComponent(q)}`);
      return;
    }

    const sp = new URLSearchParams();
    for (const [k, v] of data.entries()) {
      const val = String(v).trim();
      // Puste pola pomijamy, zeby URL nie puchl od "?q=&make=&model=".
      if (val) sp.set(k, val);
    }
    const qs = sp.toString();
    router.push(qs ? `/?${qs}` : "/");
  }

  // Zaawansowane zostaja otwarte, jesli cokolwiek w nich siedzi — inaczej filtr
  // dzialalby "niewidzialnie" i wynik nie zgadzalby sie z tym, co widac.
  const advancedUsed = [
    current.priceMin, current.yearMax, current.mileageMax,
    current.powerMin, current.fuel, current.gearbox, current.body, current.dealMin,
  ].some((v) => v && v !== "");
  const [open, setOpen] = useState(advancedUsed);

  const makeOptions: Option[] = [
    { value: "", label: "Każda marka" },
    ...makes.map((m) => ({ value: m, label: m })),
  ];
  const modelOptions: Option[] = [
    { value: "", label: models.length ? "Każdy model" : "Najpierw marka" },
    ...models.map((m) => ({ value: m, label: m })),
  ];
  const sourceOptions: Option[] = [
    { value: "", label: "Wszystkie źródła" },
    ...sources.map((s) => ({
      value: s.id,
      label: shortSource(s.name),
      hint: String(s.active),
    })),
  ];

  return (
    // Zwykly GET — filtry ladują w URL-u, wiec strona jest linkowalna i cache'owalna.
    <form method="get" onSubmit={onSubmit} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
          />
          <input
            name="q"
            defaultValue={current.q ?? ""}
            placeholder="Marka, model, wersja lub VIN…"
            className={`${inputCls} w-full pl-9`}
          />
        </div>

        <Select
          name="make"
          value={current.make}
          options={makeOptions}
          placeholder="Każda marka"
          searchable
          className="w-44"
        />
        <Select
          name="model"
          value={current.model}
          options={modelOptions}
          placeholder={models.length ? "Każdy model" : "Najpierw marka"}
          searchable
          className="w-44"
        />
        <Select
          name="source"
          value={current.source}
          options={sourceOptions}
          placeholder="Wszystkie źródła"
          searchable
          className="w-52"
        />
        <Select
          name="kind"
          value={current.kind}
          options={KINDS}
          placeholder="Kup teraz + aukcje"
          className="w-44"
        />
        <Select
          name="sort"
          value={current.sort ?? "new"}
          options={SORTS}
          placeholder="Najnowsze"
          className="w-44"
        />

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
            open
              ? "border-accent/70 text-accent"
              : "border-[var(--color-line)] text-neutral-300 hover:border-neutral-600"
          }`}
        >
          <SlidersHorizontal size={15} />
          Więcej
          {activeCount > 0 && (
            <span className="ml-0.5 rounded-full bg-accent px-1.5 text-[11px] font-semibold text-black">
              {activeCount}
            </span>
          )}
        </button>

        <button
          type="submit"
          className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white active:bg-neutral-300"
        >
          Filtruj
        </button>

        {activeCount > 0 && (
          <Link
            href="/"
            title="Wyczyść filtry"
            className="flex items-center gap-1.5 rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-200"
          >
            <RotateCcw size={14} />
          </Link>
        )}
      </div>

      {open && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--color-line)] bg-black/20 p-2">
          <span className="flex items-center gap-1.5 pl-1 pr-1 text-xs text-neutral-500">
            <Banknote size={14} /> Cena
          </span>
          <input
            name="priceMin"
            type="number"
            min={0}
            step={5000}
            defaultValue={current.priceMin ?? ""}
            placeholder="od"
            className={`${inputCls} w-24`}
          />
          <input
            name="priceMax"
            type="number"
            min={0}
            step={5000}
            defaultValue={current.priceMax ?? ""}
            placeholder="do"
            className={`${inputCls} w-24`}
          />

          <span className="flex items-center gap-1.5 pl-2 pr-1 text-xs text-neutral-500">
            Rocznik
          </span>
          <input
            name="yearMin"
            type="number"
            min={1990}
            max={2030}
            defaultValue={current.yearMin ?? ""}
            placeholder="od"
            className={`${inputCls} w-20`}
          />
          <input
            name="yearMax"
            type="number"
            min={1990}
            max={2030}
            defaultValue={current.yearMax ?? ""}
            placeholder="do"
            className={`${inputCls} w-20`}
          />

          <span className="flex items-center gap-1.5 pl-2 pr-1 text-xs text-neutral-500">
            <Gauge size={14} /> Przebieg do
          </span>
          <input
            name="mileageMax"
            type="number"
            min={0}
            step={10000}
            defaultValue={current.mileageMax ?? ""}
            placeholder="km"
            className={`${inputCls} w-24`}
          />

          <span className="pl-2 pr-1 text-xs text-neutral-500">Moc od</span>
          <input
            name="powerMin"
            type="number"
            min={0}
            step={10}
            defaultValue={current.powerMin ?? ""}
            placeholder="KM"
            className={`${inputCls} w-20`}
          />

          <Select
            name="fuel"
            value={current.fuel}
            options={FUELS}
            placeholder="Każde paliwo"
            className="w-40"
          />
          <Select
            name="gearbox"
            value={current.gearbox}
            options={GEARBOXES}
            placeholder="Każda skrzynia"
            className="w-40"
          />
          <Select
            name="body"
            value={current.body}
            options={BODIES}
            placeholder="Każde nadwozie"
            className="w-40"
          />
          {/*
            Filtr okazji dziala tylko na ofertach z wycena — a te maja komplet
            porownywalnych sztuk. Reszta wypada sama, bo NULL nie przechodzi
            porownania (patrz buildWhere).
          */}
          <Select
            name="dealMin"
            value={current.dealMin}
            options={DEALS}
            placeholder="Każda cena"
            className="w-48"
          />

          {/*
            Dwa przelaczniki, ktore odpowiadaja na konkretne pytania:
            "pokaz tylko to, co moge kupic za gotowke" i "pokaz sztuki
            wystawione w kilku miejscach naraz" — czyli rdzen calego projektu.
          */}
          <Toggle
            name="withPrice"
            checked={current.withPrice === "1"}
            label="Tylko z ceną"
            icon={<Banknote size={13} />}
          />
          <Toggle
            name="twinsOnly"
            checked={current.twinsOnly === "1"}
            label="Ten sam VIN gdzie indziej"
            icon={<Sparkles size={13} />}
          />
        </div>
      )}
    </form>
  );
}

/** Przelacznik na checkboxie — natywny input trzyma stan i trafia do GET-a sam. */
function Toggle({
  name,
  checked,
  label,
  icon,
}: {
  name: string;
  checked: boolean;
  label: string;
  icon: React.ReactNode;
}) {
  const [on, setOn] = useState(checked);
  return (
    <button
      type="button"
      onClick={() => setOn((v) => !v)}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-colors ${
        on
          ? "border-accent/70 bg-white/10 text-white"
          : "border-[var(--color-line)] text-neutral-400 hover:border-neutral-600"
      }`}
    >
      {on ? <X size={13} className="opacity-70" /> : icon}
      {label}
      {on && <input type="hidden" name={name} value="1" />}
    </button>
  );
}
