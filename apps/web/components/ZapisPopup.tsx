"use client";

import { track } from "@/components/Analytics";
import { ZapisForm } from "@/components/ZapisForm";
import { banerWidoczny } from "@/lib/consent";
import {
  GOTOWOSC,
  KLUCZ_DECYZJA,
  type KontekstWyjscia,
  type PrzedWyjsciem,
  SYGNAL_PRZED_WYJSCIEM,
} from "@/lib/zapis-sygnal";
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
 * Od 2.10.2026 nakladka pokazuje sie PRZED wyjsciem: klikniecie "Zobacz w ..."
 * jest wstrzymane, a do sprzedawcy przenosi zapis albo kazde zamkniecie.
 * Wczesniej czekala na powrot do naszej karty, a wiekszosc ludzi nie wracala.
 *
 * ZASADY, KTORE TRZYMAJA TO PO STRONIE UCZCIWOSCI:
 *
 *  - Zamkniecie ZAWSZE przenosi do oferty — krzyzyk, tlo, Escape i "przejdz
 *    bez zapisu". To propozycja, nie bramka.
 *  - Raz na sesje i nigdy wiecej po zamknieciu. Zamkniecie zapisuje sie
 *    w localStorage NA STALE. Nakladka, ktora wraca po odmowie, jest gorsza
 *    niz jej brak: kosztuje zaufanie, ktorego przy tym ruchu nie ma z czego
 *    oddawac. Oba wyzwalacze dziela ten sam zamek — zadne "a moze teraz".
 *  - Nie pokazuje sie, dopoki baner cookies jest na ekranie. Dwie nakladki
 *    naraz to sciana, ktora zamyka sie odruchowo, razem z cala strona.
 *  - Escape i klikniecie w tlo zamykaja. Krzyzyk jest pelnowymiarowy, nie
 *    szescioma pikselami w rogu.
 *  - Tresc mowi dokladnie, co przyjdzie: jeden mail dziennie, dwanascie ofert.
 *    Bez "ekskluzywnych okazji" i bez licznika, ktory udaje, ze cos ucieka.
 */

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

/** Decyzja o zapisie juz zapadla — zamknieta albo zapisana — wiec nigdy wiecej. */
function zdecydowano(): boolean {
  return czytaj(localStorage, KLUCZ_DECYZJA) !== null;
}

/**
 * Wspolny zamek obu wyzwalaczy: decyzja o zapisie juz zapadla albo baner
 * cookies WISI TERAZ na ekranie — dwie nakladki naraz to sciana, ktora
 * czlowiek zamyka odruchowo razem z cala strona.
 *
 * DLACZEGO NIE `hasConsentDecision`. Tak bylo do 2.10.2026 i nakladka prawie
 * nie istniala: od kiedy przewiniecie chowa baner BEZ zapisywania decyzji,
 * mało kto cokolwiek w nim klika. Zmierzone na 30 dniach — 161 osob wyszlo do
 * sprzedawcy, nakladke po wyjsciu zobaczylo 15 z nich (9%). Pytamy wiec, czy
 * pasek jest widoczny, a nie, czy ktos go kiedys kliknal.
 */
function wolno(): boolean {
  return !zdecydowano() && !banerWidoczny();
}

type Powod = "oferty" | "wyjscie";

/*
 * Tresc zalezy od tego, SKAD przyszlo wywolanie, a po wyjsciu do sprzedawcy —
 * takze od tego, JAKIE AUTO czlowiek wlasnie oglada.
 *
 * Pierwsza wersja mowila ogolnikami ("dac znac, gdy trafi sie podobne?").
 * Zmierzone: pokazana 5 osobom, zamknieta przez 5, zero zapisow. Za malo, zeby
 * cokolwiek wnioskowac, ale dosc, zeby poprawic to, co widac golym okiem —
 * nakladka nie mowila o aucie, ktore czlowiek ma wlasnie w drugiej karcie.
 *
 * Liczby sa ZMIERZONE, nie szacowane: 16 348 ofert, ktore pojawily sie od
 * 17 sierpnia i zdazyly przezyc siedem dni, z czego 5 583 zniknelo w tym
 * czasie — 34,2%. Mediana zycia oferty, ktora zniknela, to 6,9 dnia. Stad
 * "co trzecia" i "srednio w tydzien". Nie podnosic tych liczb bez ponownego
 * przeliczenia; to jedyne twarde zdania na tej nakladce.
 */
function tresc(powod: Powod, k: KontekstWyjscia) {
  if (powod === "wyjscie" && k.nazwa) {
    return {
      tytul: `Dać znać o kolejnych ${k.nazwa}?`,
      opis:
        `Ta oferta zniknie średnio w tydzień — co trzecia znika w siedem dni, ` +
        `sprzedana albo zdjęta. Gdy w którymkolwiek z 26 źródeł pojawi się ` +
        `następne ${k.nazwa}, dostaniesz maila tego samego dnia.`,
      label: k.nazwa,
      /* Patrz KontekstWyjscia.zdjecie — BMW oddaje zastepnik nie do odroznienia. */
      zdjecie: k.zrodlo === "bmw" ? null : (k.zdjecie ?? null),
      /* Zapis zawezony do TEGO auta — czlowiek nie wybiera niczego drugi raz. */
      filters: {
        ...(k.make ? { make: k.make } : {}),
        ...(k.model ? { model: k.model } : {}),
      },
    };
  }
  if (powod === "wyjscie") {
    return {
      tytul: "Dać znać, gdy trafi się podobne?",
      opis:
        "Ta oferta zniknie średnio w tydzień — co trzecia znika w siedem dni. " +
        "Jeśli Ci ucieknie, dowiesz się o następnej tego samego dnia, w którym się pojawi.",
      label: "Najlepsze nowe okazje",
      zdjecie: null,
      filters: {},
    };
  }
  return {
    tytul: "Przysyłać Ci najlepsze okazje?",
    opis:
      "Co trzecia oferta znika w ciągu tygodnia — sprzedana albo zdjęta. Codziennie " +
      "przeglądamy 26 źródeł i wysyłamy dwanaście ofert najbardziej odstających od ceny " +
      "rynkowej. Jeden mail dziennie, nic poza tym.",
    label: "Najlepsze nowe okazje",
    zdjecie: null,
    filters: {},
  };
}

export function ZapisPopup() {
  const pathname = usePathname();
  const [widoczny, setWidoczny] = useState(false);
  const [wjechal, setWjechal] = useState(false);
  const [powod, setPowod] = useState<Powod>("oferty");
  /* Co czlowiek ogladal, wychodzac — zasila tytul, zdjecie i filtr zapisu. */
  const [kontekst, setKontekst] = useState<KontekstWyjscia>({});
  /* true = nakladka wstrzymala klikniecie "Zobacz w ..." i ma potem przeniesc do oferty. */
  const [doOferty, setDoOferty] = useState(false);

  const schowaj = useCallback((decyzja: "zamkniete" | "zapisano") => {
    zapisz(localStorage, KLUCZ_DECYZJA, decyzja);
    setWjechal(false);
    // Domykamy dopiero po animacji, zeby nakladka nie znikala skokiem.
    setTimeout(() => {
      setWidoczny(false);
      setDoOferty(false);
    }, 150);
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
   * WYZWALACZ 2: klikniecie "Zobacz w ..." — PRZED wyjsciem do sprzedawcy.
   *
   * Do 2.10.2026 nakladka czekala, az czlowiek wroci do naszej karty po
   * obejrzeniu oferty. Wiekszosc nie wracala nigdy. Teraz OfferLink wstrzymuje
   * klikniecie i nakladka pokazuje sie od razu; do sprzedawcy przenosi zapis
   * albo KAZDE zamkniecie (patrz `zamknij`). Gdy nakladka nie jest gotowa,
   * link dziala zwyczajnie — patrz GOTOWOSC w lib/zapis-sygnal.ts.
   */
  const dokadRef = useRef<string | null>(null);

  /*
   * Otwiera oferte w nowej karcie. Wolane wylacznie z obslugi klikniecia albo
   * klawisza — inaczej przegladarka zablokuje to jako wyskakujace okno.
   */
  const przejdz = useCallback(() => {
    const href = dokadRef.current;
    dokadRef.current = null;
    if (!href) return;
    const okno = window.open(href, "_blank");
    if (okno) {
      // Odpowiednik rel="noopener" bez "noreferrer" — sprzedawca ma widziec, skad ruch.
      okno.opener = null;
    } else {
      // Blokada wyskakujacych okien: lepiej wyjsc w tej karcie niz nie wyjsc wcale.
      window.location.href = href;
    }
  }, []);

  const zamknij = useCallback(
    (jak: string) => {
      track("popup_zamkniety", { jak, powod });
      schowaj("zamkniete");
      przejdz();
    },
    [powod, schowaj, przejdz],
  );

  useEffect(() => {
    const naKlik = (e: Event) => {
      const d = (e as CustomEvent<PrzedWyjsciem>).detail;
      if (!d?.href) return;
      dokadRef.current = d.href;
      setDoOferty(true);
      setKontekst(d.kontekst ?? {});
      pokaz("wyjscie", { auto: d.kontekst?.nazwa ?? null, przed: true });
    };
    window.addEventListener(SYGNAL_PRZED_WYJSCIEM, naKlik);
    (window as unknown as Record<string, unknown>)[GOTOWOSC] = true;
    return () => {
      window.removeEventListener(SYGNAL_PRZED_WYJSCIEM, naKlik);
      (window as unknown as Record<string, unknown>)[GOTOWOSC] = false;
    };
  }, [pokaz]);

  useEffect(() => {
    if (!widoczny) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") zamknij("escape");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [widoczny, zamknij]);

  if (!widoczny) return null;

  const t = tresc(powod, kontekst);

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
        onClick={() => zamknij("tlo")}
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
          onClick={() => zamknij("krzyzyk")}
          aria-label="Zamknij"
          className="absolute right-3 top-3 rounded-lg p-2 text-neutral-500 transition-colors hover:bg-[var(--color-ink)] hover:text-neutral-200"
        >
          <X size={16} />
        </button>

        {/*
          Zdjecie auta, ktore czlowiek wlasnie oglada, zamiast ikonki dzwonka.
          Bez niego nakladka mowi o "ofertach" w ogolnosci, a z nim — o tym
          konkretnym aucie, ktore czlowiek ma otwarte w drugiej karcie.
          `onError` chowa je, bo miniatury sa hot-linkowane z cudzych serwerow
          i czasem nie dochodza; pusta ramka wygladalaby na usterke.
        */}
        <div className="flex items-start gap-3 pr-8">
          {t.zdjecie ? (
            // biome-ignore lint/performance/noImgElement: miniatury hot-linkujemy, patrz next.config
            <img
              src={t.zdjecie}
              alt=""
              width={72}
              height={54}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
              className="h-[54px] w-[72px] shrink-0 rounded-lg object-cover"
            />
          ) : (
            <Bell size={16} className="mt-0.5 shrink-0 text-neutral-500" />
          )}
          <p className="text-[15px] font-medium leading-snug text-neutral-100">
            <span id="zapis-popup-tytul">{t.tytul}</span>
          </p>
        </div>

        <p className="mt-2 text-[13px] leading-relaxed text-neutral-400">{t.opis}</p>

        <div className="mt-4">
          <ZapisForm
            typ={`popup-${powod}`}
            label={t.label}
            filters={t.filters}
            autoFocus
            przycisk={doOferty ? "Powiadom i przejdź" : "Powiadom mnie"}
            onSubmitStart={przejdz}
            onDone={() => {
              // Zamykamy z opoznieniem: komunikat o zapisie musi byc przeczytany.
              setTimeout(() => schowaj("zapisano"), 2600);
            }}
          />
        </div>

        {/*
          Wyjscie bez zapisu musi byc rownie widoczne jak zapis — to nie jest
          bramka. Ten sam efekt co krzyzyk, tlo i Escape.
        */}
        {doOferty && (
          <button
            type="button"
            onClick={() => zamknij("pomin")}
            className="mt-3 w-full rounded-lg border border-[var(--color-line)] px-4 py-2 text-[13px] text-neutral-300 transition-colors hover:border-neutral-600 hover:text-neutral-100"
          >
            Przejdź do oferty bez zapisu →
          </button>
        )}
      </div>
    </div>
  );
}
