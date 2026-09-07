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
}: {
  ofertaId: number;
  cena: number | null;
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
    <div className="mt-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] p-3">
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
        className="flex items-center justify-between gap-2 text-[13px] font-medium text-neutral-200 transition-colors hover:text-accent"
      >
        <span className="flex items-center gap-2">
          <Landmark size={15} className="shrink-0 text-neutral-500" />
          Kredyt na samochód — sprawdź warunki
        </span>
        <ArrowUpRight size={14} className="shrink-0 text-neutral-500" />
      </a>
      {/*
        Oznaczenie musi byc czytelne, a nie szara szostka w rogu. Zdanie o braku
        wplywu na wyniki jest zobowiazaniem: zaden partner nie moze zmieniac
        kolejnosci ofert ani wyceny. Bezstronnosc jest tu jedynym realnym aktywem.
      */}
      <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-600">
        Link partnerski — dostajemy prowizję, dla Ciebie bez zmiany ceny. Nie wpływa na to,
        które oferty pokazujemy ani jak liczymy ceny rynkowe.
      </p>
    </div>
  );
}
