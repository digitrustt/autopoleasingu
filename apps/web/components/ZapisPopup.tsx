"use client";

import { track } from "@/components/Analytics";
import { ZapisForm } from "@/components/ZapisForm";
import { hasConsentDecision } from "@/lib/consent";
import { SYGNAL_WYJSCIA } from "@/lib/zapis-sygnal";
import { Bell, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Nakladka z propozycja zapisu. Dwa wyzwalacze: druga obejrzana oferta ALBO
 * wyjscie do sprzedawcy.
 *
 * Po co w ogole: zmierzone po trzech tygodniach — 76 osob, 36% z nich klikalo
 * przejscie do sprzedawcy, a zapisow na powiadomienia bylo zero. 92% ludzi bylo
 * na stronie dokladnie jeden dzien i nigdy nie wrocilo. Serwis nie mial zadnego
 * mechanizmu powrotu, wiec kazdy miesiac zaczynal sie od zera.
 *
 * DLACZEGO PROG SPADL Z TRZECH OFERT NA DWIE. Zmierzone na czternastu dniach:
 * 264 osoby weszly na serwis, ale nakladke zobaczylo 20 z nich — 7,5%. Ze 140
 * sesji, w ktorych ktos w ogole otworzyl oferte, 83 konczyly sie na jednej
 * ofercie, a 29 na dwoch: 112 ze 140 sesji NIGDY nie dochodzilo do progu.
 * Nakladka nie miala niskiej konwersji, tylko prawie nie istniala. Prog dwoch
 * ofert podnosi liczbe kwalifikujacych sie sesji z 28 do 57.
 *
 * DRUGI WYZWALACZ — WYJSCIE DO SPRZEDAWCY. To robi 38% odwiedzajacych i jest to
 * najmocniejszy sygnal zamiaru, jaki ten serwis widzi. Lapie tez cala grupe,
 * ktorej prog liczbowy nie zlapie nigdy: czlowieka, ktory wszedl z Google
 * prosto na jedna oferte, kliknal "zobacz u sprzedawcy" i na tym skonczyl.
 *
 * Nakladka po wyjsciu czeka, az czlowiek WROCI do karty (visibilitychange), a
 * nie pokazuje sie w tle. Nie chodzi o uprzejmosc, tylko o pomiar: nakladka
 * wyrenderowana w ukrytej karcie wyslalaby `popup_pokazany` za pokaz, ktorego
 * nikt nie zobaczyl, i zafalszowala caly lejek zapisow.
 *
 * ZASADY, KTORE TRZYMAJA TO PO STRONIE UCZCIWOSCI:
 *
 *  - Raz na sesje i nigdy wiecej po zamknieciu. Zamkniecie zapisuje sie
 *    w localStorage NA STALE. Nakladka, ktora wraca po odmowie, jest gorsza
 *    niz jej brak: kosztuje zaufanie, ktorego przy tym ruchu nie ma z czego
 *    oddawac. Oba wyzwalacze dziela ten sam zamek — zadne "a moze teraz".
 *  - Nie pokazuje sie, dopoki wisi baner cookies (czyli dopoki czlowiek sam
 *    czegos w nim nie kliknie). Dwie nakladki naraz to sciana, ktora zamyka
 *    sie odruchowo, razem z cala strona.
 *  - Escape i klikniecie w tlo zamykaja. Krzyzyk jest pelnowymiarowy, nie
 *    szescioma pikselami w rogu.
 *  - Tresc mowi dokladnie, co przyjdzie: jeden mail dziennie, dwanascie ofert.
 *    Bez "ekskluzywnych okazji" i bez licznika, ktory udaje, ze cos ucieka.
 */

const KLUCZ_DECYZJA = "zapis_popup_decyzja";
const KLUCZ_LICZNIK = "zapis_popup_obejrzane";
const PROG = 2;

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

/**
 * Wspolny zamek obu wyzwalaczy: decyzja o zapisie juz zapadla albo wisi baner.
 *
 * Pytamy o WLASNA decyzje w banerze, nie o `readConsent`. Od 17.09.2026 zgoda
 * jest domyslnie udzielona (patrz lib/consent.ts), wiec `readConsent() !== null`
 * bylo juz zawsze prawdziwe — nakladka wjezdzalaby NA baner, a dwie nakladki
 * naraz to sciana, ktora czlowiek zamyka odruchowo razem z cala strona.
 */
function wolno(): boolean {
  if (czytaj(localStorage, KLUCZ_DECYZJA)) return false;
  return hasConsentDecision();
}

type Powod = "oferty" | "wyjscie";

/*
 * Tresc zalezy od tego, SKAD przyszlo wywolanie. Po wyjsciu do sprzedawcy
 * czlowiek ma juz w drugiej karcie konkretne auto — obietnica "przysylac
 * okazje" jest wtedy nie na temat. Na temat jest to, co wlasnie robi: sprawdza
 * jedna sztuke, ktora za tydzien moze nie istniec.
 *
 * Liczba "co trzecia oferta znika w ciagu tygodnia" jest ZMIERZONA, nie
 * szacowana: 16 348 ofert, ktore pojawily sie od 17 sierpnia i zdazyly
 * przezyc swoje siedem dni, z czego 5 583 zniknelo w tym czasie — 34,2%.
 * Mediana zycia oferty, ktora zniknela, to 6,9 dnia. Nie podnosic tej liczby
 * bez ponownego przeliczenia; to jedyne twarde zdanie na tej nakladce.
 */
const TRESC: Record<Powod, { tytul: string; opis: string; label: string }> = {
  oferty: {
    tytul: "Przysyłać Ci najlepsze okazje?",
    opis:
      "Co trzecia oferta znika w ciągu tygodnia — sprzedana albo zdjęta. Codziennie " +
      "przeglądamy 26 źródeł i wysyłamy dwanaście ofert najbardziej odstających od ceny " +
      "rynkowej. Jeden mail dziennie, nic poza tym.",
    label: "Najlepsze nowe okazje",
  },
  wyjscie: {
    tytul: "Dać znać, gdy trafi się podobne?",
    opis:
      "Co trzecia oferta znika w ciągu tygodnia — sprzedana albo zdjęta. Jeśli ta Ci " +
      "ucieknie, dowiesz się o następnej tego samego dnia, w którym się pojawi. Jeden " +
      "mail dziennie, tylko gdy faktycznie coś doszło.",
    label: "Najlepsze nowe okazje",
  },
};

export function ZapisPopup() {
  const pathname = usePathname();
  const [widoczny, setWidoczny] = useState(false);
  const [wjechal, setWjechal] = useState(false);
  const [powod, setPowod] = useState<Powod>("oferty");

  const schowaj = useCallback((decyzja: "zamkniete" | "zapisano") => {
    zapisz(localStorage, KLUCZ_DECYZJA, decyzja);
    setWjechal(false);
    // Domykamy dopiero po animacji, zeby nakladka nie znikala skokiem.
    setTimeout(() => setWidoczny(false), 150);
  }, []);

  const pokaz = useCallback((p: Powod, dane: Record<string, unknown>) => {
    setPowod(p);
    setWidoczny(true);
    requestAnimationFrame(() => setWjechal(true));
    track("popup_pokazany", { powod: p, ...dane });
  }, []);

  /* WYZWALACZ 1: druga obejrzana oferta w tej sesji. */
  useEffect(() => {
    if (!pathname?.startsWith("/oferta/")) return;
    if (!wolno()) return;

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
    const t = setTimeout(() => pokaz("oferty", { obejrzane: obejrzane.size }), 1000);
    return () => clearTimeout(t);
  }, [pathname, pokaz]);

  /*
   * WYZWALACZ 2: wyjscie do sprzedawcy.
   *
   * Link otwiera sie w nowej karcie, wiec nasza traci widocznosc. Czekamy na
   * powrot — i dopiero wtedy pokazujemy. Gdyby karta nigdy nie zostala ukryta
   * (bywa: ustawienia przegladarki, blokada wyskakujacych okien), po 1,2 s
   * pokazujemy mimo to, zeby ten wyzwalacz nie przepadl po cichu.
   */
  const uzbrojony = useRef(false);
  useEffect(() => {
    const odpal = () => {
      if (!uzbrojony.current || document.hidden) return;
      uzbrojony.current = false;
      if (!wolno()) return;
      pokaz("wyjscie", {});
    };

    const naWyjscie = () => {
      if (widoczny || !wolno()) return;
      uzbrojony.current = true;
      setTimeout(odpal, 1200);
    };
    const naPowrot = () => {
      // Chwila zwloki: nakladka wpadajaca w sekundzie przelaczania kart miga.
      if (!document.hidden) setTimeout(odpal, 600);
    };

    window.addEventListener(SYGNAL_WYJSCIA, naWyjscie);
    document.addEventListener("visibilitychange", naPowrot);
    return () => {
      window.removeEventListener(SYGNAL_WYJSCIA, naWyjscie);
      document.removeEventListener("visibilitychange", naPowrot);
    };
  }, [widoczny, pokaz]);

  useEffect(() => {
    if (!widoczny) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        track("popup_zamkniety", { jak: "escape", powod });
        schowaj("zamkniete");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [widoczny, schowaj, powod]);

  if (!widoczny) return null;

  const tresc = TRESC[powod];

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
          track("popup_zamkniety", { jak: "tlo", powod });
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
            track("popup_zamkniety", { jak: "krzyzyk", powod });
            schowaj("zamkniete");
          }}
          aria-label="Zamknij"
          className="absolute right-3 top-3 rounded-lg p-2 text-neutral-500 transition-colors hover:bg-[var(--color-ink)] hover:text-neutral-200"
        >
          <X size={16} />
        </button>

        <p className="flex items-center gap-2 pr-8 text-[15px] font-medium text-neutral-100">
          <Bell size={16} className="shrink-0 text-neutral-500" />
          <span id="zapis-popup-tytul">{tresc.tytul}</span>
        </p>

        <p className="mt-2 text-[13px] leading-relaxed text-neutral-400">{tresc.opis}</p>

        <div className="mt-4">
          <ZapisForm
            typ={`popup-${powod}`}
            label={tresc.label}
            autoFocus
            onDone={() => {
              // Zamykamy z opoznieniem: komunikat o zapisie musi byc przeczytany.
              setTimeout(() => schowaj("zapisano"), 2600);
            }}
          />
        </div>
      </div>
    </div>
  );
}
