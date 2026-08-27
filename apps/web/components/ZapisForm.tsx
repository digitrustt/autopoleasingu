"use client";

import { track } from "@/components/Analytics";
import { Bell, CircleCheck, Loader2 } from "lucide-react";
import { useState } from "react";

/**
 * Jeden formularz zapisu na powiadomienia dla wszystkich miejsc w serwisie.
 *
 * Powstal, bo zapis stal wylacznie w stopce i w pasku nad lista (ten drugi
 * tylko przy ustawionym filtrze). Zmierzone po trzech tygodniach: 76 osob,
 * 36% z nich klikalo przejscie do sprzedawcy, a zapisow bylo ZERO (jedyny
 * w bazie byl testowy). Problem nie lezal w ofercie, tylko w tym, ze formularz
 * stal tam, gdzie nikt nie dojezdza.
 *
 * `filters` trafiaja do subskrypcji, wiec zapis ze strony modelu przychodzi
 * juz zawezony do tego modelu — czlowiek nie musi niczego wybierac drugi raz.
 * Serwer i tak filtruje pola po bialej liscie (api/alerty).
 */
export function ZapisForm({
  filters = {},
  label = null,
  typ,
  onDone,
  autoFocus = false,
}: {
  filters?: Record<string, string>;
  label?: string | null;
  /** Skad przyszedl zapis — jedyny sposob, zeby wiedziec, ktore miejsce dziala. */
  typ: string;
  onDone?: () => void;
  autoFocus?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError(null);

    const res = await fetch("/api/alerty", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, label, filters }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(data.error ?? "Coś poszło nie tak");
      setState("idle");
      return;
    }
    track("alert_zapis", { typ });
    setState("done");
    onDone?.();
  }

  if (state === "done") {
    return (
      <p className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-[13px] text-neutral-200">
        <CircleCheck size={16} className="shrink-0 text-emerald-400" />
        Sprawdź skrzynkę — wysłaliśmy link potwierdzający.
      </p>
    );
  }

  return (
    <form onSubmit={submit}>
      {/*
        Pole i przycisk w jednej ramce: przy dwoch osobnych obwodkach formularz
        zaczyna wygladac jak formularz kontaktowy z 2010 roku.
      */}
      <div className="flex items-center gap-1 rounded-xl border border-[var(--color-line)] bg-[var(--color-ink)] p-1 transition-colors focus-within:border-neutral-600">
        <Bell size={15} className="ml-2.5 shrink-0 text-neutral-600" />
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="twoj@email.pl"
          aria-label="Adres e-mail do powiadomień o nowych ofertach"
          autoFocus={autoFocus}
          className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-neutral-600"
        />
        <button
          type="submit"
          disabled={state === "sending"}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium text-black transition-colors hover:bg-white disabled:opacity-60"
        >
          {state === "sending" && <Loader2 size={13} className="animate-spin" />}
          Powiadom mnie
        </button>
      </div>

      {error ? (
        <p className="mt-2 text-[11px] text-rose-400">{error}</p>
      ) : (
        <p className="mt-2 text-[11px] leading-relaxed text-neutral-600">
          Wyślemy mail z prośbą o potwierdzenie. Wypisanie jednym kliknięciem, adresu nie
          przekazujemy nikomu.
        </p>
      )}
    </form>
  );
}
