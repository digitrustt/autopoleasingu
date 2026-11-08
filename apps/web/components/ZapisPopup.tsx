"use client";

import { track } from "@/components/Analytics";
import { linkKredytu, linkLeasingu } from "@/components/FinansowanieBlok";
import { KOD_HISTORII, linkHistorii } from "@/components/HistoriaBlok";
import { ZapisForm } from "@/components/ZapisForm";
import { banerWidoczny } from "@/lib/consent";
import {
  GOTOWOSC,
  KLUCZ_DECYZJA,
  KLUCZ_SESJA,
  type KontekstWyjscia,
  type PrzedWyjsciem,
  SYGNAL_PRZED_WYJSCIEM,
  biezacaOferta,
  zapisZdecydowany,
} from "@/lib/zapis-sygnal";
import { ArrowUpRight, Bell, Briefcase, Landmark, ShieldCheck, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { otworzPartnera } from "@/lib/wyjscie";

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
 *  - Raz na sesje. Zamkniecie obowiazuje do konca sesji (sessionStorage),
 *    zapis — na stale (localStorage). Do 8.11.2026 zamkniecie dzialalo na
 *    stale i z ~500 pokazan wychodzilo 2 zapisy; na wyrazne polecenie
 *    wlasciciela kazda nowa sesja dostaje nakladke raz. Zadne "a moze teraz"
 *    w obrebie sesji. Oba wyzwalacze dziela ten sam zamek.
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

/**
 * Zapisany — nigdy wiecej; zamknal w tej sesji — do konca sesji
 * (od 8.11.2026, wczesniej zamkniecie dzialalo na stale).
 */
function zdecydowano(): boolean {
  return zapisZdecydowany();
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
/*
 * WERSJA 2 TRESCI (8.10.2026). Poprzednia — trzy zdania o tym, ze oferty
 * znikaja w tydzien — dala 1 zapis na 45 pokazan przed wyjsciem do sprzedawcy.
 * Czlowiek, ktory wlasnie kliknal "Zobacz w ...", chce isc dalej i nie czyta
 * akapitu. Teraz jest jedno pytanie i jedna obietnica, zaczepiona o CENE auta,
 * ktore oglada: "dac znac, gdy pojawi sie tansze?".
 *
 * Obietnica jest prawdziwa, bo zapis dostaje filtr `priceMax` tuz ponizej tej
 * ceny — worker wysle wylacznie tansze egzemplarze tego modelu. Nie obiecujemy
 * powiadomien o obnizce TEGO auta, bo alerty sa o nowych ofertach.
 */
const WERSJA_TRESCI = 2;

const zl = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 });

function tresc(powod: Powod, k: KontekstWyjscia) {
  const marka = {
    ...(k.make ? { make: k.make } : {}),
    ...(k.model ? { model: k.model } : {}),
  };
  if (powod === "wyjscie" && k.nazwa && k.cena) {
    return {
      tytul: `Dać znać, gdy pojawi się tańsze ${k.nazwa}?`,
      opis:
        `To kosztuje ${zl.format(k.cena)} zł. Sprawdzamy 26 źródeł codziennie — ` +
        "napiszemy tylko wtedy, gdy trafi się tańsze.",
      label: `${k.nazwa} taniej niż ${zl.format(k.cena)} zł`,
      /* Patrz KontekstWyjscia.zdjecie — BMW oddaje zastepnik nie do odroznienia. */
      zdjecie: k.zrodlo === "bmw" ? null : (k.zdjecie ?? null),
      filters: { ...marka, priceMax: String(k.cena - 1) },
    };
  }
  if (powod === "wyjscie" && k.nazwa) {
    return {
      tytul: `Dać znać o kolejnych ${k.nazwa}?`,
      opis: "Sprawdzamy 26 źródeł codziennie — napiszemy, gdy pojawi się następne.",
      label: k.nazwa,
      zdjecie: k.zrodlo === "bmw" ? null : (k.zdjecie ?? null),
      /* Zapis zawezony do TEGO auta — czlowiek nie wybiera niczego drugi raz. */
      filters: marka,
    };
  }
  if (powod === "wyjscie") {
    return {
      tytul: "Dać znać, gdy trafi się podobne?",
      opis: "Sprawdzamy 26 źródeł codziennie — napiszemy, gdy pojawi się coś nowego.",
      label: "Najlepsze nowe okazje",
      zdjecie: null,
      filters: {},
    };
  }
  return {
    tytul: "Przysyłać Ci najlepsze okazje?",
    opis: "Raz dziennie dwanaście ofert najbardziej poniżej ceny rynkowej, z 26 źródeł.",
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
    // Zapis = na stale (localStorage); zamkniecie = do konca sesji.
    if (decyzja === "zapisano") zapisz(localStorage, KLUCZ_DECYZJA, decyzja);
    zapisz(sessionStorage, KLUCZ_SESJA, decyzja);
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
    // `wersja` pozwala porownac skutecznosc tresci — patrz WERSJA_TRESCI.
    track("popup_pokazany", { powod: p, wersja: WERSJA_TRESCI, ...dane });
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
    const t = setTimeout(() => {
      // VIN otwartego auta — zeby nakladka mogla zaproponowac raport historii.
      setKontekst(biezacaOferta() ?? {});
      pokaz("oferty", { obejrzane: obejrzane.size });
    }, 1000);
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

  /*
   * Raport historii carVertical (20.10.2026). Wyjscie do sprzedawcy to moment,
   * w ktorym czlowiek za chwile dzwoni i jedzie ogladac auto — wtedy pytanie
   * "czy bylo rozbite" jest najbardziej na miejscu. Tylko z VIN-em, bo wtedy
   * link od razu wypelnia ich formularz. Pokazujemy tez po drugiej obejrzanej
   * ofercie — wtedy VIN przychodzi z BiezacaOferta.
   *
   * Klikniecie otwiera carVertical w nowej karcie i NIE zamyka nakladki: do
   * sprzedawcy dalej prowadzi zapis, krzyzyk albo "przejdz bez zapisu".
   * Dwa okna z jednego klikniecia zablokowalaby przegladarka.
   *
   * Tresc przepisana z bloku przy ofercie (HistoriaBlok) — umowa wymaga
   * uzgadniania tresci o carVertical z nimi przed publikacja (pkt 1.1).
   */
  const historia = kontekst.vin ? linkHistorii(kontekst.vin) : null;

  /*
   * Kredyt (21.10.2026) — NAD raportem, bo jedno klikniecie jest warte
   * kilkadziesiat razy wiecej (prowizja od kwoty kredytu przy medianie
   * ~120 tys. zl, kontra 4 EUR za raport). PostHog, 30 dni: 1374 wyjscia do
   * sprzedawcy i tylko 19 klikniec w kredyt z bocznej kolumny oferty — czyli
   * moment decyzji byl, a propozycji w nim nie bylo.
   *
   * Te same warunki co FinansowanieBlok (oferta aktywna, cena "kup teraz")
   * i ta sama zasada: ZADNEJ kwoty raty — liczba uruchamia obowiazek RRSO
   * i przykladu reprezentatywnego. Etykieta "popup-oferta-ID" rozdziela
   * konwersje z nakladki od tych z bloku przy ofercie w raporcie sieci.
   */
  const kredyt =
    kontekst.kredyt && kontekst.id != null ? linkKredytu(`popup-oferta-${kontekst.id}`) : null;
  // Leasing dla firm (patrz linkLeasingu) — w tej samej karcie, jako druga sciezka.
  const leasing =
    kontekst.kredyt && kontekst.id != null ? linkLeasingu(`popup-oferta-${kontekst.id}`) : null;

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
        /*
          max-h + przewijanie: z rata, raportem i zapisem okno bywa wyzsze niz
          ekran malego telefonu — bez tego "przejdz bez zapisu" wypadal poza ekran.
        */
        className={`relative max-h-[calc(100dvh-2rem)] w-full max-w-[460px] overflow-y-auto rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-2xl transition-transform duration-150 ${
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

        {(kredyt || leasing) && (
          <div className="mb-3 mr-8 overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-ink)]">
          {kredyt && (
          <button
            type="button"
            onClick={() => {
              track("finansowanie_klik", { gdzie: "popup", powod, oferta: kontekst.id ?? null });
              otworzPartnera(kredyt);
            }}
            className="group flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-[var(--color-panel)]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-panel)] text-neutral-200">
              <Landmark size={17} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-neutral-100">
                {kontekst.nazwa ? `Sfinansuj to ${kontekst.nazwa}` : "Sfinansuj to auto"}
              </span>
              <span className="mt-0.5 block text-[13px] text-neutral-400">
                Sprawdź swoją ratę online · <span className="text-neutral-600">link partnerski</span>
              </span>
            </span>
            <ArrowUpRight size={17} className="shrink-0 text-neutral-500 transition-colors group-hover:text-accent" />
          </button>
          )}
          {leasing && (
            <button
              type="button"
              onClick={() => {
                track("leasing_klik", { gdzie: "popup", powod, oferta: kontekst.id ?? null });
                otworzPartnera(leasing);
              }}
              className={`group flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-[13px] transition-colors hover:bg-[var(--color-panel)] ${
                kredyt ? "border-t border-[var(--color-line)]" : ""
              }`}
            >
              <span className="flex items-center gap-2 text-neutral-300">
                <Briefcase size={15} className="shrink-0 text-neutral-500" />
                Kupujesz na firmę? Sprawdź leasing
              </span>
              <ArrowUpRight size={15} className="shrink-0 text-neutral-500 transition-colors group-hover:text-accent" />
            </button>
          )}
          </div>
        )}

        {historia && (
          <section
            className={`mb-5 rounded-xl border border-accent/40 bg-accent/5 p-4 ${kredyt || leasing ? "" : "mr-8"}`}
          >
            <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-neutral-100">
              <ShieldCheck size={16} className="shrink-0 text-accent" />
              Sprawdź historię tego auta przed zakupem
              {KOD_HISTORII && (
                <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-black">
                  20% taniej
                </span>
              )}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-neutral-400">
              Raport historii pojazdu carVertical po numerze VIN: szkody, przebiegi, kradzieże
              {KOD_HISTORII
                ? `. Z kodem ${KOD_HISTORII} 20% taniej (dolicza się sam po kliknięciu)`
                : ""}
              .{" "}
              <span className="text-neutral-600">
                Usługę sprzedaje carVertical; to link partnerski.
              </span>
            </p>
            <button
              type="button"
              onClick={() => {
                track("historia_klik", {
                  gdzie: "popup",
                  vin: kontekst.vin ?? null,
                  zrodlo: kontekst.zrodlo ?? null,
                  wariant: "popup",
                  powod,
                });
                otworzPartnera(historia);
              }}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-black transition-colors hover:bg-white"
            >
              Sprawdź historię
              <ArrowUpRight size={15} />
            </button>
          </section>
        )}

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
            /* Klawiatura na telefonie zaslonilaby blok raportu historii. */
            autoFocus={!historia && !kredyt && !leasing}
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
