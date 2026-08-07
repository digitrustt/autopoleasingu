"use client";

import { type Consent, readConsent, writeConsent } from "@/lib/consent";
import { Cookie } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Baner zgody na analitykę.
 *
 * Wcześniej serwis nie zbierał niczego i baner byłby pustym rytuałem — teraz
 * zbiera, więc zgoda jest realnie potrzebna i musi być UPRZEDNIA: analityka
 * startuje dopiero po kliknięciu, nigdy wcześniej.
 *
 * Dwa przyciski o równej wadze. „Odrzuć" schowane pod linkiem albo w szarym,
 * ledwo widocznym tekście jest tak zwanym dark patternem i w EU podważa
 * ważność samej zgody — musi być tak samo łatwe jak akceptacja.
 */
export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Renderujemy dopiero po stronie klienta: na serwerze nie wiadomo,
    // czy użytkownik już zdecydował, a mignięcie banera przy każdym
    // wejściu byłoby gorsze niż jego brak.
    if (readConsent() !== null) return;
    setVisible(true);

    /*
     * ZGODA PRZEZ PRZEWINIĘCIE — decyzja właściciela serwisu, podjęta
     * świadomie po zgłoszeniu zastrzeżenia.
     *
     * Uwaga dla przyszłego czytelnika: wytyczne EROD 05/2020 wskazują scroll
     * jako przykład zachowania, które NIE stanowi ważnej zgody w rozumieniu
     * RODO — jest czynnością nawigacyjną, nie jednoznacznym działaniem
     * potwierdzającym. Jeśli ten mechanizm ma zostać usunięty, wystarczy
     * skasować ten useEffect; przyciski działają niezależnie.
     *
     * Próg jest celowo wysoki (600 px) i liczony dopiero po sekundzie:
     * przywrócenie pozycji przewijania przez przeglądarkę albo przypadkowy
     * ruch kółkiem nie mogą uchodzić za decyzję.
     */
    const SCROLL_PX = 600;
    const armAt = Date.now() + 1000;
    let done = false;

    const onScroll = () => {
      if (done || Date.now() < armAt) return;
      if (window.scrollY < SCROLL_PX) return;
      done = true;
      writeConsent("granted");
      setVisible(false);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  function decide(v: Consent) {
    writeConsent(v);
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Zgoda na analitykę"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--color-line)] bg-[var(--color-panel)]/95 backdrop-blur"
    >
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3.5">
        <p className="flex max-w-[70ch] items-center gap-2.5 text-[13px] leading-relaxed text-neutral-400">
          <Cookie size={18} className="shrink-0 text-neutral-500" />
          <span>
            Używamy ciasteczek do anonimowych statystyk. Przewijając stronę dalej, wyrażasz
            zgodę.{" "}
            <Link href="/cookies" className="underline underline-offset-2 hover:text-accent">
              Szczegóły
            </Link>
          </span>
        </p>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => decide("denied")}
            className="rounded-lg border border-[var(--color-line)] px-4 py-2 text-sm text-neutral-300 transition-colors hover:border-neutral-600"
          >
            Odrzuć
          </button>
          <button
            type="button"
            onClick={() => decide("granted")}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white"
          >
            Wyrażam zgodę
          </button>
        </div>
      </div>
    </div>
  );
}

/** Przełącznik do zmiany decyzji — na stronie /cookies. */
export function ConsentToggle() {
  const [current, setCurrent] = useState<Consent | null>(null);

  useEffect(() => setCurrent(readConsent()), []);

  function set(v: Consent) {
    writeConsent(v);
    setCurrent(v);
  }

  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
      <p className="mb-3 text-sm text-neutral-300">
        Twój obecny wybór:{" "}
        <strong className={current === "granted" ? "text-emerald-400" : "text-neutral-100"}>
          {current === "granted"
            ? "analityka włączona"
            : current === "denied"
              ? "analityka wyłączona"
              : "jeszcze nie zdecydowano"}
        </strong>
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => set("denied")}
          className="rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-sm text-neutral-300 transition-colors hover:border-neutral-600"
        >
          Wyłącz
        </button>
        <button
          type="button"
          onClick={() => set("granted")}
          className="rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-sm text-neutral-300 transition-colors hover:border-accent/70 hover:text-accent"
        >
          Włącz
        </button>
      </div>
    </div>
  );
}
