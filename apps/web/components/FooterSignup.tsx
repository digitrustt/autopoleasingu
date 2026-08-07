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
      <p className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-[13px] text-neutral-200 md:w-[400px]">
        <CircleCheck size={16} className="shrink-0 text-emerald-400" />
        Sprawdź skrzynkę — wysłaliśmy link potwierdzający.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="md:w-[400px]">
      {/*
        Pole i przycisk w jednej ramce: przy dwoch osobnych obwodkach stopka
        zaczynala wygladac jak formularz kontaktowy z 2010 roku.
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
