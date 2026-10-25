"use client";

import { track } from "@/components/Analytics";
import { ArrowUpRight, Briefcase, Landmark } from "lucide-react";
import { otworzPartnera } from "@/lib/wyjscie";

/**
 * Link partnerski do kredytu samochodowego, pod przyciskiem wyjscia do sprzedawcy.
 *
 * MIEJSCE JEST ZMIERZONE, nie wybrane na wyczucie: 38% odwiedzajacych klika
 * przejscie do sprzedawcy (239 klikniec miesiecznie od 159 osob). To sekunda,
 * w ktorej czlowiek zdecydowal sie na konkretne auto — a nie moment przegladania
 * listy. Dlatego blok stoi TUZ POD tym przyciskiem, a nie na dole strony.
 *
 * Dlaczego akurat kredyt, a nie ubezpieczenie: rozliczenie to procent od kwoty
 * kredytu, a mediana ceny w bazie wynosi 119 900 zl. Jedna udzielona umowa jest
 * warta okolo trzech tysiecy zlotych — kilkanascie razy wiecej niz caly miesiac
 * leadow ubezpieczeniowych przy tym ruchu.
 *
 * CZEGO TU CELOWO NIE MA — RAT, OPROCENTOWANIA I RRSO.
 *
 * Reklama kredytu konsumenckiego zawierajaca jakakolwiek liczbe (rate, koszt,
 * oprocentowanie) wymaga podania RRSO i reprezentatywnego przykladu, a UOKiK to
 * egzekwuje. Nie podajemy wiec zadnych warunkow finansowych — te sa na stronie
 * kredytodawcy, gdzie obowiazek lezy po jego stronie. Tekst zostaje opisowy.
 *
 * Nie przypisujemy tez bankowi obietnic, ktorych nie sprawdzilismy (np. czasu
 * decyzji) — to warunki innej kampanii i przeniesienie ich tutaj byloby
 * wprowadzaniem w blad.
 */
/**
 * Link partnera kredytu z etykieta, ktora wraca w raporcie sieci (`etykieta_`).
 * Etykieta mowi, KTORE miejsce i KTORE auto dalo konwersje — "oferta-123"
 * z bloku przy ofercie, "popup-oferta-123" z nakladki przed wyjsciem.
 * null = link nieskonfigurowany.
 */
export function linkKredytu(etykieta: string): string | null {
  return zEtykieta(process.env.NEXT_PUBLIC_AFILIACJA_KREDYT, etykieta);
}

/**
 * Leasing dla firm (MyLease przez Comperialead, CPL 25 zl za wniosek — panel
 * sieci, 21.10.2026). Auta poleasingowe sprzedaje sie glownie na fakture VAT,
 * wiec spora czesc kupujacych to firmy, ktore nie wezma kredytu konsumenckiego.
 * Ta sama siec co kredyt, ten sam parametr etykiety.
 */
export function linkLeasingu(etykieta: string): string | null {
  return zEtykieta(process.env.NEXT_PUBLIC_AFILIACJA_LEASING, etykieta);
}

function zEtykieta(bazowy: string | undefined, etykieta: string): string | null {
  if (!bazowy) return null;
  return `${bazowy}${bazowy.includes("?") ? "&" : "?"}etykieta_=${encodeURIComponent(etykieta)}`;
}

export function FinansowanieBlok({
  ofertaId,
  cena,
  nazwa,
}: {
  ofertaId: number;
  cena: number | null;
  /** "BMW Seria 3" — nazwa TEGO auta, nie ogolnik. Patrz komentarz nizej. */
  nazwa: string;
}) {
  /*
   * Identyfikator oferty w etykiecie: po konwersji wiadomo, KTORE auto ja
   * wygenerowalo — czy kredyty biora ogladajacy auta za 250 tys., czy za 60 tys.
   */
  const href = linkKredytu(`oferta-${ofertaId}`);
  const leasing = linkLeasingu(`oferta-${ofertaId}`);
  // Bez skonfigurowanego linku nie renderujemy nic — lepiej brak sekcji niz martwy odnosnik.
  if (!href && !leasing) return null;

  return (
    <div className="mt-3 flex flex-col gap-3">
      {href && (
      <button
        type="button"
        /*
         * PRZYCISK, NIE ODNOSNIK. Do 7.10.2026 stal tu <a href> z adresem
         * partnera i roboty chodzace po linkach wchodzily w niego z kazdej
         * strony oferty: panel partnera pokazal ponad 10 tys. "klikniec"
         * z jednej chmury (47.79.x.x), co kilka sekund, kazde na inna oferte.
         * Taki ruch wyglada u partnera jak naciaganie klikniec i grozi
         * zamknieciem konta. Adres otwieramy dopiero po prawdziwym kliknieciu,
         * wiec w kodzie strony nie ma czego odwiedzic.
         */
        onClick={() => {
          track("finansowanie_klik", { oferta: ofertaId, cena, gdzie: "oferta" });
          otworzPartnera(href);
        }}
        /*
         * Wyrazny przycisk z akcentem (25.10.2026). Szary wiersz dawal ~2%
         * klikniec od odwiedzajacych, a kredyt (2% kwoty) jest warty
         * kilkadziesiat razy wiecej niz kazde inne klikniecie na stronie.
         */
        className="group flex w-full items-center justify-between gap-3 rounded-lg border border-accent/50 bg-accent/10 px-3 py-2.5 text-left transition-colors hover:border-accent hover:bg-accent/15"
      >
        <span className="min-w-0">
          {/*
            "Rata" bez ZADNEJ liczby. Obowiazek podania RRSO i reprezentatywnego
            przykladu uruchamiaja dane o KOSZCIE kredytu — sama zachęta do
            sprawdzenia go ich nie zawiera. Zadnej kwoty tu nigdy nie wstawiac.
          */}
          <span className="flex items-center gap-2 text-[14px] font-semibold text-neutral-100">
            <Landmark size={16} className="shrink-0 text-accent" />
            <span className="truncate">Kup na raty — sprawdź ratę</span>
          </span>
          <span className="mt-0.5 block truncate text-[12px] text-neutral-400">
            Kredyt na {nazwa} online · <span className="text-neutral-600">link partnerski</span>
          </span>
        </span>
        <ArrowUpRight
          size={17}
          className="shrink-0 text-accent transition-transform group-hover:translate-x-0.5"
        />
      </button>
      )}

      {/*
        Leasing dla firm — druga sciezka obok kredytu. Bez obietnic partnera
        (czas decyzji, limity): to warunki ich kampanii, nie sprawdzone przez nas.
      */}
      {leasing && (
        <button
          type="button"
          onClick={() => {
            track("leasing_klik", { oferta: ofertaId, cena, gdzie: "oferta" });
            otworzPartnera(leasing);
          }}
          className="group flex w-full items-center justify-between gap-3 px-1 text-left"
        >
          <span className="min-w-0">
            <span className="flex items-center gap-2 text-[13px] font-medium text-neutral-100">
              <Briefcase size={15} className="shrink-0 text-neutral-400" />
              <span className="truncate">Kupujesz na firmę? Sprawdź leasing</span>
            </span>
            <span className="mt-0.5 block text-[12px] text-neutral-500">
              Wniosek online · <span className="text-neutral-600">link partnerski</span>
            </span>
          </span>
          <ArrowUpRight
            size={16}
            className="shrink-0 text-neutral-500 transition-colors group-hover:text-accent"
          />
        </button>
      )}
    </div>
  );
}

/**
 * Link "albo na raty" tuz pod cena — tam patrzy kazdy, kto otworzyl oferte,
 * takze ten, kto nie dojdzie do przycisku sprzedawcy. Osobna etykieta
 * (`cena-oferta-ID`), zeby w panelu sieci bylo widac, ktore miejsce dziala.
 */
export function RataPrzyCenie({ ofertaId, cena }: { ofertaId: number; cena: number }) {
  const href = linkKredytu(`cena-oferta-${ofertaId}`);
  if (!href) return null;
  return (
    <button
      type="button"
      onClick={() => {
        track("finansowanie_klik", { oferta: ofertaId, cena, gdzie: "przy-cenie" });
        otworzPartnera(href);
      }}
      className="mt-1.5 flex items-center gap-1.5 text-[13px] font-medium text-accent underline-offset-2 hover:underline"
    >
      <Landmark size={13} />
      albo na raty — sprawdź ratę
      <ArrowUpRight size={13} />
    </button>
  );
}
