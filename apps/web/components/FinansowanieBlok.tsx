"use client";

import { track } from "@/components/Analytics";
import { ArrowUpRight, Landmark } from "lucide-react";

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
  const bazowy = process.env.NEXT_PUBLIC_AFILIACJA_KREDYT;
  // Bez skonfigurowanego linku nie renderujemy nic — lepiej brak sekcji niz martwy odnosnik.
  if (!bazowy) return null;

  /*
   * `etykieta_` wraca w raporcie sieci, wiec wysylamy w niej identyfikator oferty.
   * Dzieki temu po konwersji wiadomo, KTORE auto ja wygenerowalo — czy kredyty
   * biora ogladajacy auta za 250 tys., czy za 60 tys. Bez tego mielibysmy sama
   * liczbe umow bez informacji, gdzie je postawic.
   */
  const href = `${bazowy}${bazowy.includes("?") ? "&" : "?"}etykieta_=oferta-${ofertaId}`;

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
        onClick={() => track("finansowanie_klik", { oferta: ofertaId, cena })}
        className="group flex items-center justify-between gap-3"
      >
        <span className="min-w-0">
          {/*
            Nazwa TEGO auta, nie "kredyt samochodowy". Czlowiek patrzy wlasnie na
            ten egzemplarz i zdecydowal sie na niego — komunikat o "finansowaniu
            samochodu" w ogolnosci mija sie z tym, o czym mysli.
          */}
          <span className="flex items-center gap-2 text-[13px] font-medium text-neutral-100">
            <Landmark size={15} className="shrink-0 text-neutral-400" />
            <span className="truncate">Sfinansuj to {nazwa}</span>
          </span>
          {/*
            "Rata" bez ZADNEJ liczby. Obowiazek podania RRSO i reprezentatywnego
            przykladu uruchamiaja dane o KOSZCIE kredytu — sama zachęta do
            sprawdzenia go ich nie zawiera. Zadnej kwoty tu nigdy nie wstawiac.
          */}
          <span className="mt-0.5 block text-[12px] text-neutral-500">
            Sprawdź swoją ratę online · <span className="text-neutral-600">link partnerski</span>
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
