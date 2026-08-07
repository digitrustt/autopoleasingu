"use client";

import { track } from "@/components/Analytics";
import { Bell, CircleCheck, Loader2 } from "lucide-react";
import { useState } from "react";

/**
 * Zapis na powiadomienia o nowych ofertach.
 *
 * Formularz przejmuje AKTYWNE FILTRY z listy zamiast pytać o markę i model
 * od nowa. Użytkownik dopiero co je ustawił i widzi wyniki — powtarzanie tego
 * w osobnym kreatorze jest najpewniejszym sposobem, żeby nikt się nie zapisał.
 *
 * Pokazujemy się tylko wtedy, gdy jakiś filtr jest ustawiony — bez filtrów ten
 * formularz nie miałby czego przejąć. Zapis na przegląd ogólny jest możliwy,
 * ale w stopce: patrz FooterSignup.
 */
export function AlertSignup({
  filters,
  total,
}: {
  filters: Record<string, string | undefined>;
  total: number;
}) {
  const active = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v != null && v !== ""),
  ) as Record<string, string>;

  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  if (Object.keys(active).length === 0) return null;

  // Czytelny opis tego, na co się zapisujesz — złożony z tych samych filtrów.
  const label = [
    active.make,
    active.model,
    active.priceMax ? `do ${Number(active.priceMax).toLocaleString("pl-PL")} zł` : null,
    active.yearMin ? `od ${active.yearMin}` : null,
    active.dealMin ? `okazje ≥${active.dealMin}%` : null,
    active.fuel,
  ]
    .filter(Boolean)
    .join(" · ");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError(null);

    const res = await fetch("/api/alerty", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, label: label || null, filters: active }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(data.error ?? "Coś poszło nie tak");
      setState("idle");
      return;
    }
    track("alert_zapis", { label, ...active });
    setState("done");
  }

  if (state === "done") {
    return (
      <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm">
        <CircleCheck size={17} className="shrink-0 text-emerald-400" />
        <span className="text-neutral-200">
          Sprawdź skrzynkę — wysłaliśmy link potwierdzający. Bez kliknięcia w niego nie wyślemy
          Ci nic więcej.
        </span>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-3"
    >
      <p className="flex items-center gap-2 text-sm text-neutral-300">
        <Bell size={16} className="shrink-0 text-neutral-500" />
        <span>
          Powiadom mnie o nowych ofertach
          {label && <span className="text-neutral-500"> · {label}</span>}
        </span>
      </p>

      <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="twoj@email.pl"
          className="min-w-[200px] flex-1 rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-3 py-2 text-sm outline-none transition-colors placeholder:text-neutral-600 focus:border-accent/70 sm:flex-none"
        />
        <button
          type="submit"
          disabled={state === "sending"}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white disabled:opacity-60"
        >
          {state === "sending" && <Loader2 size={14} className="animate-spin" />}
          Zapisz się
        </button>
      </div>

      {error && <p className="w-full text-xs text-rose-400">{error}</p>}

      <p className="w-full text-[11px] text-neutral-600">
        Wyślemy maila z prośbą o potwierdzenie. Sprawdzamy raz na dobę, wypisanie jednym
        kliknięciem w każdej wiadomości. Adresu nie przekazujemy nikomu —{" "}
        <a href="/polityka-prywatnosci" className="underline hover:text-accent">
          polityka prywatności
        </a>
        .
      </p>

      <span className="sr-only">{total} pasujących ofert</span>
    </form>
  );
}
