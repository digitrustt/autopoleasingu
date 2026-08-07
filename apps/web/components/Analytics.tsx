"use client";

import { readConsent } from "@/lib/consent";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { Suspense, useEffect, useRef } from "react";

/**
 * Analityka — uruchamiana WYŁĄCZNIE po zgodzie użytkownika.
 *
 * PostHog, bo pytanie brzmiało „co użytkownik robi, skąd przyszedł, ile czasu
 * spędza". Zwykły licznik odsłon tego nie powie; potrzebne są zdarzenia,
 * ścieżki i czas sesji.
 *
 * Host jest europejski (eu.i.posthog.com) — dane nie wychodzą poza EOG, co
 * zdejmuje cały problem transferu do USA, który przy Google Analytics wymaga
 * osobnej podstawy prawnej.
 *
 * Bez klucza w env komponent nie robi NIC. Dzięki temu lokalny development
 * i podglądy nie zaśmiecają statystyk, a brak konfiguracji nie wywala strony.
 */
const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

let started = false;

function start() {
  if (started || !KEY) return;
  started = true;

  posthog.init(KEY, {
    api_host: HOST,
    /*
     * Odsłony wysyłamy ręcznie z efektu niżej. Automatyczne liczenie w App
     * Routerze gubi nawigację kliencką — filtry zmieniaja tylko query string,
     * więc bez tego cała praca z wyszukiwarką byłaby niewidoczna.
     */
    capture_pageview: false,
    capture_pageleave: true, // stąd bierze się czas spędzony na stronie
    autocapture: true, // kliknięcia i formularze bez ręcznego oprzyrządowania
    persistence: "localStorage+cookie",
    /*
     * Maskujemy wszystkie pola tekstowe w nagraniach. Do wyszukiwarki ludzie
     * wpisują czasem VIN albo numer rejestracyjny — to dane konkretnego auta
     * i nie ma powodu, żeby lądowały w nagraniu sesji.
     */
    session_recording: { maskAllInputs: true },
  });
}

function stop() {
  if (!started) return;
  posthog.opt_out_capturing();
  posthog.reset();
}

/** Odsłony + zmiany filtrów. Osobno, bo useSearchParams wymaga Suspense. */
function PageViews() {
  const pathname = usePathname();
  const search = useSearchParams();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!started) return;
    const url = pathname + (search.toString() ? `?${search}` : "");
    // Bez tego React w trybie ścisłym wysyła każdą odsłonę dwa razy.
    if (last.current === url) return;
    last.current = url;

    posthog.capture("$pageview", {
      $current_url: window.location.origin + url,
      // Własne pola: dzięki nim widać, po czym ludzie filtrują, a nie tylko
      // że „byli na stronie głównej".
      filtr_sort: search.get("sort"),
      filtr_marka: search.get("make"),
      filtr_okazje: search.get("dealMin"),
      filtr_zrodlo: search.get("source"),
    });
  }, [pathname, search]);

  return null;
}

export function Analytics() {
  useEffect(() => {
    if (readConsent() === "granted") start();

    const onChange = (e: Event) => {
      const v = (e as CustomEvent<string>).detail;
      if (v === "granted") start();
      else stop();
    };
    window.addEventListener("ap-consent-change", onChange);
    return () => window.removeEventListener("ap-consent-change", onChange);
  }, []);

  return (
    <Suspense fallback={null}>
      <PageViews />
    </Suspense>
  );
}

/**
 * Zdarzenie własne — wołane z komponentów przy istotnych akcjach.
 * Nic nie robi bez zgody, więc można wołać bezwarunkowo.
 */
export function track(event: string, props?: Record<string, unknown>): void {
  if (!started) return;
  posthog.capture(event, props);
}
