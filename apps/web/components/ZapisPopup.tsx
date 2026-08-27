"use client";

import { track } from "@/components/Analytics";
import { ZapisForm } from "@/components/ZapisForm";
import { readConsent } from "@/lib/consent";
import { Bell, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

/**
 * Nakladka z propozycja zapisu, pokazywana po obejrzeniu TRZECH ofert.
 *
 * Po co: zmierzone po trzech tygodniach — 76 osob, 36% z nich klikalo przejscie
 * do sprzedawcy, a zapisow na powiadomienia bylo zero. 92% ludzi bylo na stronie
 * dokladnie jeden dzien i nigdy nie wrocilo. Serwis nie mial zadnego mechanizmu
 * powrotu, wiec kazdy miesiac zaczynal sie od zera.
 *
 * Prog to trzy oferty, nie jedna. Ktos, kto otworzyl trzecia oferte, szuka
 * konkretnego auta — a nie trafil tu z przypadkowego linku. Zmierzone: mediana
 * sesji to 2-3 odslony, wiec trzecia oferta wypada juz w gornej polowie
 * zaangazowania i nakladka nie zlapie przelotnych wejsc.
 *
 * ZASADY, KTORE TRZYMAJA TO PO STRONIE UCZCIWOSCI:
 *
 *  - Raz na sesje i nigdy wiecej po zamknieciu. Zamkniecie zapisuje sie
 *    w localStorage NA STALE. Nakladka, ktora wraca po odmowie, jest gorsza
 *    niz jej brak: kosztuje zaufanie, ktorego przy 76 uzytkownikach nie ma
 *    z czego oddawac.
 *  - Nie pokazuje sie, dopoki wisi baner zgody na cookies. Dwie nakladki naraz
 *    to sciana, ktora zamyka sie odruchowo, razem z cala strona.
 *  - Escape i klikniecie w tlo zamykaja. Krzyzyk jest pelnowymiarowy, nie
 *    szescioma pikselami w rogu.
 *  - Tresc mowi dokladnie, co przyjdzie: jeden mail dziennie, dwanascie ofert.
 *    Bez "ekskluzywnych okazji" i bez licznika, ktory udaje, ze cos ucieka.
 */

const KLUCZ_DECYZJA = "zapis_popup_decyzja";
const KLUCZ_LICZNIK = "zapis_popup_obejrzane";
const PROG = 3;

/** localStorage bywa niedostepny (tryb prywatny, blokady) — nigdy nie wywalamy strony. */
function czytaj(store: Storage, k: string): string | null {
  try {
    return store.getItem(k);
  } catch {
    return null;
  }
}
function zapisz(store: Storage, k: string, v: string): void {
  try {
    store.setItem(k, v);
  } catch {
    /* trudno */
  }
}

export function ZapisPopup() {
  const pathname = usePathname();
  const [widoczny, setWidoczny] = useState(false);
  const [wjechal, setWjechal] = useState(false);

  const schowaj = useCallback((powod: "zamkniete" | "zapisano") => {
    zapisz(localStorage, KLUCZ_DECYZJA, powod);
    setWjechal(false);
    // Domykamy dopiero po animacji, zeby nakladka nie znikala skokiem.
    setTimeout(() => setWidoczny(false), 150);
  }, []);

  useEffect(() => {
    if (!pathname?.startsWith("/oferta/")) return;
    // Decyzja juz zapadla — zamkniete albo zapisane. Nie wracamy.
    if (czytaj(localStorage, KLUCZ_DECYZJA)) return;
    // Baner cookies ma pierwszenstwo: dwie nakladki naraz to sciana.
    if (readConsent() === null) return;

    const obejrzane = new Set(
      (czytaj(sessionStorage, KLUCZ_LICZNIK) ?? "").split(",").filter(Boolean),
    );
    obejrzane.add(pathname);
    zapisz(sessionStorage, KLUCZ_LICZNIK, [...obejrzane].join(","));
    if (obejrzane.size < PROG) return;

    /*
     * Sekunda zwloki. Nakladka wjezdzajaca w trakcie ladowania tresci laduje
     * na czyms, czego czlowiek jeszcze nie przeczytal, i zamyka sie odruchowo.
     */
    const t = setTimeout(() => {
      setWidoczny(true);
      requestAnimationFrame(() => setWjechal(true));
      track("popup_pokazany", { obejrzane: obejrzane.size });
    }, 1000);
    return () => clearTimeout(t);
  }, [pathname]);

  useEffect(() => {
    if (!widoczny) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        track("popup_zamkniety", { jak: "escape" });
        schowaj("zamkniete");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [widoczny, schowaj]);

  if (!widoczny) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center p-4 transition-opacity duration-150 sm:items-center ${
        wjechal ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Tlo klikalne — zamkniecie nie moze wymagac trafienia w krzyzyk. */}
      <button
        type="button"
        aria-label="Zamknij"
        onClick={() => {
          track("popup_zamkniety", { jak: "tlo" });
          schowaj("zamkniete");
        }}
        className="absolute inset-0 cursor-default bg-black/70"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="zapis-popup-tytul"
        className={`relative w-full max-w-[460px] rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-2xl transition-transform duration-150 ${
          wjechal ? "translate-y-0" : "translate-y-2"
        }`}
      >
        <button
          type="button"
          onClick={() => {
            track("popup_zamkniety", { jak: "krzyzyk" });
            schowaj("zamkniete");
          }}
          aria-label="Zamknij"
          className="absolute right-3 top-3 rounded-lg p-2 text-neutral-500 transition-colors hover:bg-[var(--color-ink)] hover:text-neutral-200"
        >
          <X size={16} />
        </button>

        <p className="flex items-center gap-2 pr-8 text-[15px] font-medium text-neutral-100">
          <Bell size={16} className="shrink-0 text-neutral-500" />
          <span id="zapis-popup-tytul">Przysyłać Ci najlepsze okazje?</span>
        </p>

        <p className="mt-2 text-[13px] leading-relaxed text-neutral-400">
          Codziennie przeglądamy 26 źródeł poleasingowych i wybieramy oferty najbardziej
          odstające od ceny rynkowej. Jeden mail dziennie, dwanaście ofert — bez niczego
          poza tym.
        </p>

        <div className="mt-4">
          <ZapisForm
            typ="popup"
            label="Najlepsze nowe okazje"
            autoFocus
            onDone={() => {
              // Zamykamy z opoznieniem: potwierdzenie musi byc przeczytane.
              setTimeout(() => schowaj("zapisano"), 2600);
            }}
          />
        </div>
      </div>
    </div>
  );
}
