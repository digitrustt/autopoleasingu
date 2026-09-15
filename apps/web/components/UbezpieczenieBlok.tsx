"use client";

import { track } from "@/components/Analytics";
import { ArrowUpRight, ShieldCheck } from "lucide-react";

/**
 * Link partnerski do porownywarki OC/AC.
 *
 * GDZIE STOI I DLACZEGO NIE OBOK KREDYTU. Blok kredytowy (patrz
 * FinansowanieBlok) rozlicza sie procentem od kwoty kredytu, wiec przy medianie
 * 119 900 zl jedno klikniecie jest warte okolo 36 zl oczekiwanych. Kalkulacja
 * OC to 9 zl za wykonana kalkulacje, czyli okolo 0,90 zl na klikniecie — czterdziesci
 * razy mniej. Postawienie ich obok siebie nie dodaje przychodu, tylko dzieli
 * uwage w jedynym miejscu, gdzie ta uwaga jest cokolwiek warta.
 *
 * Dlatego OC dostaje wylacznie miejsca, w ktorych kredytu NIE MA:
 *
 *  - oferty sprzedane i te bez ceny — blok kredytowy tam nie powstaje, wiec
 *    slot i tak stoi pusty;
 *  - strony VIN-u — czlowiek sprawdza konkretny egzemplarz przed zakupem, a
 *    polisa jest nastepnym krokiem po zakupie, nie konkurencja dla niego.
 *
 * CZEGO TU NIE MA I BYC NIE MOZE (warunki kampanii Rankomatu):
 *
 *  - ZADNEGO FORMULARZA I ZADNYCH DANYCH AUTA. Regulamin zabrania wykonywania
 *    kalkulacji w imieniu klienta. Marka, rocznik i pojemnosc zostaja po naszej
 *    stronie — czlowiek wpisuje je sam, u nich.
 *  - ZADNEJ ZACHETY typu "kliknij i odbierz". Ruch motywowany jest zabroniony
 *    wprost i konczy sie uniewaznieniem calej kampanii, nie jednej konwersji.
 *  - ZADNEJ KWOTY SKLADKI. Nie znamy jej i nie mamy jak sprawdzic; obietnica
 *    "od X zl" byla by zmyslona.
 *
 * PIKSELA ODSLONOWEGO Z KREACJI CELOWO NIE WKLEJAMY. Kod od Rankomatu zawiera
 * `<img>` liczacy wyswietlenia — czyli marketingowy trakcer strony trzeciej,
 * ktory odpalalby sie przy kazdym wejsciu, takze przed zgoda na cookies. Za
 * klikniecia i tak placi sam link, wiec piksel kosztowalby nas zgodnosc z RODO
 * i nie dawal nic w zamian.
 */
export function UbezpieczenieBlok({
  /** Skad przyszlo klikniecie — jedyny sposob, zeby wiedziec, ktore miejsce dziala. */
  gdzie,
  /** "BMW Seria 3" albo null na stronach ogolnych. Patrz komentarz nizej. */
  nazwa = null,
}: {
  gdzie: string;
  nazwa?: string | null;
}) {
  const href = process.env.NEXT_PUBLIC_AFILIACJA_OC;
  // Bez skonfigurowanego linku nie renderujemy nic — lepiej brak sekcji niz martwy odnosnik.
  if (!href) return null;

  return (
    <div className="mt-3 rounded-lg border border-neutral-700 bg-[var(--color-ink)] p-3">
      <a
        href={href}
        target="_blank"
        /*
         * `sponsored` jest OBOWIAZKOWE: Google wymaga oznaczania linkow, za ktore
         * dostajemy wynagrodzenie, a kara reczna spadlaby na cala domene — czyli
         * na jedyny kanal, ktorym ten serwis rosnie.
         */
        rel="sponsored noopener noreferrer"
        onClick={() => track("oc_klik", { gdzie })}
        className="group flex items-center justify-between gap-3"
      >
        <span className="min-w-0">
          <span className="flex items-center gap-2 text-[13px] font-medium text-neutral-100">
            <ShieldCheck size={15} className="shrink-0 text-neutral-400" />
            {/*
              Przy konkretnym aucie mowimy o nim, bo czlowiek wlasnie na nie
              patrzy. Na stronach ogolnych nie udajemy, ze wiemy, o co chodzi.
            */}
            <span className="truncate">
              {nazwa ? `Policz OC i AC dla ${nazwa}` : "Policz OC i AC przed zakupem"}
            </span>
          </span>
          <span className="mt-0.5 block text-[12px] text-neutral-500">
            Porównywarka Rankomat · <span className="text-neutral-600">link partnerski</span>
          </span>
        </span>
        <ArrowUpRight
          size={16}
          className="shrink-0 text-neutral-500 transition-colors group-hover:text-accent"
        />
      </a>
    </div>
  );
}
