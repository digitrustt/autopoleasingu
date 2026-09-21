"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

export interface Option {
  value: string;
  label: string;
  /** Prawa strona wiersza — np. liczba ofert w danym zrodle. */
  hint?: string;
}

/**
 * Lista rozwijana w stylu reszty formularza. Natywny <select> renderuje sie
 * widgetem systemowym, wiec na ciemnym motywie wyglada jak wklejka z innego
 * serwisu — a przy 60 markach jest tez nie do przeszukania.
 *
 * Formularz filtrow to zwykly GET (linkowalny URL), dlatego wybor trafia do
 * ukrytego <input>, a nie do stanu Reacta gdzies wyzej.
 */
export function Select({
  name,
  value,
  options,
  placeholder,
  searchable = false,
  multiple = false,
  className = "",
}: {
  name: string;
  /** Jedna wartosc albo kilka — przy `multiple` tablica. */
  value?: string | string[];
  options: Option[];
  placeholder: string;
  /** Wlacza pole wyszukiwania w srodku — dla dlugich list (marki, zrodla). */
  searchable?: boolean;
  /**
   * Wielokrotny wybor. Lista nie zamyka sie po kliknieciu, a do formularza
   * idzie tyle ukrytych pol, ile wybrano — przegladarka wysle wtedy parametr
   * kilka razy ("?make=BMW&make=Audi"), a strona glowna to rozumie.
   */
  multiple?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [wybrane, setWybrane] = useState<string[]>(
    value == null || value === "" ? [] : Array.isArray(value) ? value : [value],
  );
  const selected = wybrane[0] ?? "";
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const current = options.find((o) => o.value === selected);
  /* Podpis na przycisku: przy kilku wyborach nie miescimy nazw, wiec liczymy. */
  const etykieta =
    wybrane.length > 1
      ? `${options.find((o) => o.value === wybrane[0])?.label ?? wybrane[0]} +${wybrane.length - 1}`
      : (current?.label ?? "");

  const shown = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query, searchable]);

  // Klik poza komponentem zamyka liste — bez tego zostaje otwarta przy kolejnym.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (open && searchable) searchRef.current?.focus();
    if (!open) {
      setQuery("");
      setActive(0);
    }
  }, [open, searchable]);

  function choose(v: string) {
    if (!multiple) {
      setWybrane(v ? [v] : []);
      setOpen(false);
      return;
    }
    // Pusta wartosc to pozycja "Kazda marka" — czysci caly wybor.
    if (!v) {
      setWybrane([]);
      setOpen(false);
      return;
    }
    /*
     * Lista ZOSTAJE OTWARTA. Przy wielokrotnym wyborze zamykanie po kazdym
     * kliknieciu zmuszaloby do otwierania jej od nowa przy kazdej marce —
     * czyli dokladnie do tego, co ten tryb ma usunac.
     */
    setWybrane((poprz) =>
      poprz.includes(v) ? poprz.filter((x) => x !== v) : [...poprz, v],
    );
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") return setOpen(false);
    if (!open && (e.key === "Enter" || e.key === "ArrowDown")) {
      e.preventDefault();
      return setOpen(true);
    }
    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, shown.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = shown[active];
      if (opt) choose(opt.value);
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {/* To pole niesie wartosc do GET-a; sam przycisk nie jest kontrolka formularza. */}
      {/*
        Jedno pole na kazda wybrana wartosc. Przegladarka wysle wtedy ten sam
        parametr kilka razy, a `many` na stronie glownej zlozy z tego tablice.
        Przy pustym wyborze nie ma zadnego pola, wiec parametr nie trafia do URL-a.
      */}
      {wybrane.map((v) => (
        <input key={v} type="hidden" name={name} value={v} />
      ))}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border bg-[var(--color-panel)] px-3 py-2 text-left text-sm transition-colors ${
          open
            ? "border-accent/70"
            : "border-[var(--color-line)] hover:border-neutral-600"
        }`}
      >
        <span className={`truncate ${current ? "" : "text-neutral-500"}`}>
          {etykieta || placeholder}
        </span>
        <ChevronDown
          size={15}
          className={`shrink-0 text-neutral-500 transition-transform duration-200 ${
            open ? "rotate-180 text-accent" : ""
          }`}
        />
      </button>

      {open && (
        <div
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full min-w-[200px] overflow-hidden rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] shadow-xl shadow-black/40"
        >
          {searchable && (
            <div className="flex items-center gap-2 border-b border-[var(--color-line)] px-3 py-2">
              <Search size={14} className="shrink-0 text-neutral-500" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onKeyDown}
                placeholder="Szukaj…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-600"
              />
            </div>
          )}

          <div className="max-h-60 overflow-y-auto py-1">
            {shown.length === 0 ? (
              <p className="px-3 py-2 text-sm text-neutral-500">Brak dopasowań</p>
            ) : (
              shown.map((o, i) => {
                const isSel = o.value ? wybrane.includes(o.value) : wybrane.length === 0;
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="option"
                    aria-selected={isSel}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(o.value)}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-sm transition-colors ${
                      i === active ? "bg-white/10 text-white" : "text-neutral-300"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Check
                        size={13}
                        className={`shrink-0 text-accent ${isSel ? "" : "invisible"}`}
                      />
                      <span className="truncate">{o.label}</span>
                    </span>
                    {o.hint && (
                      <span className="shrink-0 text-[11px] tabular-nums text-neutral-500">
                        {o.hint}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
