"use client";

import { track } from "@/components/Analytics";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Pole do wklejenia VIN-u.
 *
 * Strony /vin/… istnialy od dawna, ale nie dalo sie do nich dojsc inaczej niz
 * klikajac w konkretnej ofercie. Kto ogladal auto u sprzedawcy i chcial
 * sprawdzic, czy ta sama sztuka nie stoi taniej gdzie indziej, nie mial jak.
 *
 * Walidacja jest CELOWO minimalna: sprawdzamy dlugosc i alfabet VIN-u (17
 * znakow, bez I, O i Q — te sa wykluczone przez ISO 3779, zeby nie mylily sie
 * z jedynka i zerem). Cyfra kontrolna dziala tylko w VIN-ach amerykanskich,
 * wiec sprawdzanie jej odrzucaloby wiekszosc aut z polskiego rynku.
 */
const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

export function VinSzukaj({ autoFocus = false }: { autoFocus?: boolean }) {
  const router = useRouter();
  const [vin, setVin] = useState("");
  const [blad, setBlad] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    // Ludzie wklejaja VIN ze spacjami i myslnikami z dokumentow.
    const czysty = vin.replace(/[\s-]/g, "").toUpperCase();

    if (!VIN_RE.test(czysty)) {
      setBlad(
        czysty.length !== 17
          ? `VIN ma 17 znaków, wpisano ${czysty.length}`
          : "VIN zawiera znaki spoza dozwolonych (bez I, O i Q)",
      );
      return;
    }
    track("vin_szukaj", { wmi: czysty.slice(0, 3) });
    router.push(`/vin/${czysty}`);
  }

  return (
    <form onSubmit={submit}>
      <div className="flex items-center gap-1 rounded-xl border border-[var(--color-line)] bg-[var(--color-ink)] p-1 transition-colors focus-within:border-neutral-600">
        <Search size={16} className="ml-2.5 shrink-0 text-neutral-600" />
        <input
          value={vin}
          onChange={(e) => {
            setVin(e.target.value);
            setBlad(null);
          }}
          placeholder="WBA8H71090A727423"
          aria-label="Numer VIN"
          spellCheck={false}
          autoComplete="off"
          // biome-ignore lint/a11y/noAutofocus: to jedyne pole na tej stronie
          autoFocus={autoFocus}
          maxLength={25}
          className="min-w-0 flex-1 bg-transparent px-2 py-2 font-mono text-sm uppercase outline-none placeholder:font-sans placeholder:normal-case placeholder:text-neutral-600"
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-black transition-colors hover:bg-white"
        >
          Sprawdź
        </button>
      </div>
      {blad && <p className="mt-2 text-[11px] text-rose-400">{blad}</p>}
    </form>
  );
}
