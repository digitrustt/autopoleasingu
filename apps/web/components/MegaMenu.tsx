"use client";

import type { MenuData } from "@/lib/menu";
import { makeHref, slugify } from "@/lib/slug";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Rozwijane menu w naglowku.
 *
 * Po co, poza wygladem: to jest STALY zestaw linkow z KAZDEJ strony serwisu do
 * marek, kategorii i miast. Przy 2 301 zaindeksowanych stronach, sredniej
 * pozycji 26 i zerze linkow z zewnatrz, linkowanie wewnetrzne jest jedyna
 * dzwignia pozycji, ktora nie wymaga kupowania linkow.
 *
 * DZIALA BEZ JAVASCRIPTU dla robota indeksujacego: panele sa w HTML od razu,
 * tylko ukryte klasa. Gdyby powstawaly dopiero po kliknieciu, Google nie
 * zobaczylby ani jednego z tych linkow i cala korzysc by przepadla.
 *
 * Otwieranie klikniecim, nie najechaniem. Menu otwierajace sie samo przy
 * przejezdzaniu myszka nad naglowkiem zaslania tresc, kiedy nikt o to nie
 * prosil — a na dotyku "najechanie" i tak nie istnieje.
 */
export function MegaMenu({
  dane,
  linki,
}: {
  dane: MenuData;
  /** Statyczne pozycje obok rozwijanych — renderowane w tym samym pasku. */
  linki: { href: string; label: string }[];
}) {
  const [otwarte, setOtwarte] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const sciezka = usePathname();

  // Zmiana strony zamyka menu — inaczej zostaje otwarte nad nowa trescia.
  useEffect(() => setOtwarte(null), []);

  useEffect(() => {
    if (!otwarte) return;
    const naKlik = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOtwarte(null);
    };
    const naKlawisz = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOtwarte(null);
    };
    document.addEventListener("mousedown", naKlik);
    document.addEventListener("keydown", naKlawisz);
    return () => {
      document.removeEventListener("mousedown", naKlik);
      document.removeEventListener("keydown", naKlawisz);
    };
  }, [otwarte]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: zamykamy przy KAZDEJ zmianie adresu
  useEffect(() => setOtwarte(null), [sciezka]);

  const przycisk = (klucz: string, etykieta: string) => (
    <button
      type="button"
      onClick={() => setOtwarte(otwarte === klucz ? null : klucz)}
      aria-expanded={otwarte === klucz}
      aria-haspopup="true"
      className={`flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors ${
        otwarte === klucz
          ? "bg-white/[0.08] text-neutral-100"
          : "text-neutral-400 hover:bg-white/[0.05] hover:text-neutral-100"
      }`}
    >
      {etykieta}
      <ChevronDown
        size={13}
        className={`transition-transform ${otwarte === klucz ? "rotate-180" : ""}`}
      />
    </button>
  );

  return (
    <div ref={boxRef} className="flex min-w-0 flex-1 items-center">
      {/*
        Pasek przewijany poziomo — ale PANELE MUSZA BYC POZA NIM. `overflow-x`
        tworzy kontekst przycinania, wiec panel wyswietlony wewnatrz zostalby
        przyciety do wysokosci paska i praktycznie niewidoczny. Stad podzial:
        przyciski i linki w srodku, panele jako rodzenstwo.
      */}
      <nav className="-mx-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {przycisk("marki", "Marki")}
        {przycisk("gdzie", "Miasta i firmy")}
        {linki.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="shrink-0 rounded-lg px-2.5 py-1.5 text-[13px] text-neutral-400 transition-colors hover:bg-[var(--color-panel)] hover:text-neutral-100"
          >
            {l.label}
          </Link>
        ))}
      </nav>

      {/*
        Panel na calej szerokosci tresci, nie przyklejony do przycisku.
        Kolumny z kilkunastoma pozycjami w waskim dymku sa nieczytelne, a tu
        i tak jest cala szerokosc do dyspozycji.
      */}
      <div
        hidden={otwarte !== "marki"}
        className="absolute inset-x-0 top-14 border-b border-white/[0.07] bg-[var(--color-ink)]/95 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.75)] backdrop-blur-2xl"
      >
        <div className="mx-auto max-w-[1400px] px-4 py-5">
          <div className="mb-3 flex items-baseline justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Najwięcej ofert</p>
            <Link href="/" className="text-[12px] text-neutral-500 hover:text-accent">
              Wszystkie marki i filtry →
            </Link>
          </div>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3 lg:grid-cols-6">
            {dane.marki.map((m) => (
              <li key={m.make}>
                <Link
                  href={makeHref(m.make)}
                  className="flex items-baseline justify-between gap-2 rounded-lg px-2.5 py-2 text-[13px] text-neutral-300 transition-colors hover:bg-white/[0.06] hover:text-neutral-50"
                >
                  <span className="truncate">{m.make}</span>
                  <span className="shrink-0 text-[11px] tabular-nums text-neutral-600">
                    {m.total}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div
        hidden={otwarte !== "gdzie"}
        className="absolute inset-x-0 top-14 border-b border-white/[0.07] bg-[var(--color-ink)]/95 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.75)] backdrop-blur-2xl"
      >
        <div className="mx-auto grid max-w-[1400px] gap-6 px-4 py-5 md:grid-cols-2">
          <div>
            <div className="mb-3 flex items-baseline justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Miasta</p>
              <Link href="/poleasingowe" className="text-[12px] text-neutral-500 hover:text-accent">
                Wszystkie →
              </Link>
            </div>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
              {dane.miasta.map((m) => (
                <li key={m.city}>
                  <Link
                    href={`/poleasingowe/${slugify(m.city ?? "")}`}
                    className="flex items-baseline justify-between gap-2 rounded-lg px-2.5 py-2 text-[13px] text-neutral-300 transition-colors hover:bg-white/[0.06] hover:text-neutral-50"
                  >
                    <span className="truncate">{m.city}</span>
                    <span className="shrink-0 text-[11px] tabular-nums text-neutral-600">
                      {m.total}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="mb-3 flex items-baseline justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Leasingodawcy</p>
              <Link href="/zrodla" className="text-[12px] text-neutral-500 hover:text-accent">
                Wszystkie źródła →
              </Link>
            </div>
            <ul className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
              {dane.zrodla.map((z) => (
                <li key={z.id}>
                  <Link
                    href={`/leasingodawca/${z.id}`}
                    className="flex items-baseline justify-between gap-2 rounded-lg px-2.5 py-2 text-[13px] text-neutral-300 transition-colors hover:bg-white/[0.06] hover:text-neutral-50"
                  >
                    <span className="truncate">{z.name}</span>
                    <span className="shrink-0 text-[11px] tabular-nums text-neutral-600">
                      {z.active}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
