"use client";

import { track } from "@/components/Analytics";
import { Bell, CircleCheck, Loader2 } from "lucide-react";
import { useState } from "react";

/**
 * Zapis na dzienny przeglad najlepszych okazji — w stopce, bez filtrow.
 *
 * Powstal, bo formularz nad lista pokazuje sie WYLACZNIE przy ustawionym
 * filtrze i przez to byl praktycznie niewidoczny: nie znalazl go nawet
 * wlasciciel serwisu (pytanie "gdzie sie mozna zapisac"). Stopka jest miejscem, gdzie ludzie szukaja rzeczy
 * "ogolnych", i jest na kazdej podstronie.
 *
 * Bez filtrow subskrypcja lapie wszystkie nowe oferty, ale worker sortuje je
 * po deal score i tnie do dwunastu — wiec to jeden mail dziennie z najlepszymi
 * okazjami, a nie zrzut bazy.
 */
export function FooterSignup() {
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
      // Pusty obiekt filtrow = przeglad ogolny; etykiete nadaje serwer.
      body: JSON.stringify({ email, filters: {} }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(data.error ?? "Coś poszło nie tak");
      setState("idle");
      return;
    }
    track("alert_zapis", { typ: "stopka" });
    setState("done");
  }

  if (state === "done") {
    return (
      <p className="flex items-center gap-2 text-[13px] text-emerald-400">
        <CircleCheck size={15} className="shrink-0" />
        Sprawdź skrzynkę — wysłaliśmy link potwierdzający.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Bell size={14} className="shrink-0 text-neutral-600" />
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="twoj@email.pl"
          aria-label="Adres e-mail do powiadomień o nowych ofertach"
          className="w-44 rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-2.5 py-1.5 text-[13px] outline-none transition-colors placeholder:text-neutral-600 focus:border-accent/70"
        />
        <button
          type="submit"
          disabled={state === "sending"}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-[13px] text-neutral-300 transition-colors hover:border-accent/70 hover:text-accent disabled:opacity-60"
        >
          {state === "sending" && <Loader2 size={13} className="animate-spin" />}
          Powiadom mnie
        </button>
      </div>
      {error ? (
        <p className="text-[11px] text-rose-400">{error}</p>
      ) : (
        <p className="text-[11px] text-neutral-600">
          Raz dziennie, najlepsze nowe okazje. Wypisanie jednym kliknięciem.
        </p>
      )}
    </form>
  );
}
