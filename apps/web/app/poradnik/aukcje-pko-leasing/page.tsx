import { AukcjaPoradnik, type AukcjaTresc } from "@/components/AukcjaPoradnik";
import type { Metadata } from "next";
import { connection } from "next/server";

/* Raz na dobe i dopiero na zadanie — patrz komentarz w analizy/utrata-wartosci. */
export const revalidate = 86_400;

export const metadata: Metadata = {
  title: "Aukcje PKO Leasing — jak licytować auta poleasingowe krok po kroku",
  description:
    "Kto może licytować na aukcjach PKO Leasing, ile jest czasu na zapłatę i odbiór, co z " +
    "prowizją i ceną netto. Zasady z regulaminu plus aktualna lista aut na aukcjach.",
  alternates: { canonical: "/poradnik/aukcje-pko-leasing" },
};

/*
 * FAKTY Z REGULAMINU aukcje.pkoleasing.pl, odczytane 4.10.2026. Przy kazdej
 * zmianie tresci sprawdzic regulamin ponownie i przestawic `stanNa`.
 */
const TRESC: AukcjaTresc = {
  sourceId: "pkoaukcje",
  nazwa: "PKO Leasing",
  h1: "Aukcje PKO Leasing — jak kupić auto poleasingowe",
  wstep:
    "Na aukcje.pkoleasing.pl trafiają samochody po zakończonych umowach leasingu i umowach " +
    "flotowych PKO Leasing. Serwis prowadzi PKO Leasing Finanse sp. z o.o. Poniżej zasady " +
    "w ludzkim języku i auta, które są tam wystawione dzisiaj.",
  zasady: [
    "Kupować mogą zarówno firmy, jak i osoby prywatne — wystarczy założyć konto w serwisie.",
    "Są trzy formy sprzedaży: zwykła licytacja, sprzedaż ofertowa (składasz własną propozycję ceny, a sprzedający wybiera najlepszą) oraz „Kup Teraz”.",
    "Minimalne postąpienie w licytacji to 100 zł albo wielokrotność tej kwoty.",
    "Cena bywa podana brutto albo netto — rodzaj ceny jest oznaczony przy każdej aukcji.",
    "Część aukcji ma prowizję dla kupującego. Jej wysokość można wyliczyć kalkulatorem na stronie aukcji jeszcze przed złożeniem oferty.",
    "Na zapłatę jest 7 dni kalendarzowych od wygranej, a na odbiór auta — 7 dni od informacji, że jest gotowe do odbioru.",
    "Osoba prywatna po wygranej podpisuje pisemną umowę sprzedaży w ciągu 7 dni, w lokalu sprzedającego wskazanym w aukcji.",
    "Sprzedający co do zasady nie udziela gwarancji, a firmom wyłącza rękojmię.",
  ],
  kroki: [
    "Załóż konto na aukcje.pkoleasing.pl.",
    "Wybierz auto i przeczytaj opis aukcji: rodzaj ceny (netto czy brutto), prowizję i miejsce oględzin.",
    "Obejrzyj samochód, jeśli to możliwe — koszty dojazdu ponosisz sam.",
    "Złóż ofertę albo skorzystaj z „Kup Teraz”.",
    "Po wygranej zapłać w ciągu 7 dni; jako osoba prywatna podpisz w tym czasie umowę sprzedaży.",
    "Odbierz auto w ciągu 7 dni od zawiadomienia o gotowości do odbioru.",
  ],
  pulapki: [
    "Cena netto: osoba prywatna dopłaci do niej 23% VAT. Zawsze sprawdź, jak oznaczona jest cena.",
    "Prowizja: dolicz ją do stawki, zanim zalicytujesz — kalkulator jest na stronie aukcji.",
    "Terminy: 7 dni na zapłatę i 7 dni na odbiór. Serwis ma osobny cennik przechowywania pojazdów, więc zwłoka z odbiorem może kosztować.",
    "Stan auta: kupujesz bez gwarancji, dlatego oględziny i dokumenty z aukcji są ważniejsze niż przy zakupie u dealera.",
  ],
  faq: [
    {
      q: "Czy osoba prywatna może licytować na aukcjach PKO Leasing?",
      a: "Tak. Regulamin serwisu przewiduje udział konsumentów. Po wygranej osoba prywatna zawiera ze sprzedającym pisemną umowę sprzedaży w ciągu 7 dni.",
    },
    {
      q: "Ile jest czasu na zapłatę za wylicytowane auto?",
      a: "7 dni kalendarzowych od rozstrzygnięcia aukcji. Auto trzeba odebrać w ciągu 7 dni od zawiadomienia o gotowości do odbioru.",
    },
    {
      q: "Czy na aukcjach PKO Leasing jest prowizja?",
      a: "Na części aukcji tak. Jej wysokość można sprawdzić przed złożeniem oferty w kalkulatorze na stronie danej aukcji.",
    },
    {
      q: "Czy wylicytowane auto można wziąć w leasing?",
      a: "Regulamin pozwala złożyć wniosek o finansowanie w PKO Leasing w ciągu 2 dni od wygranej. Decyzja zależy od oceny wniosku.",
    },
  ],
  regulaminUrl: "https://aukcje.pkoleasing.pl/pl/pages/regulations",
  stanNa: "4 października 2026",
};

export default async function Page() {
  await connection();
  return <AukcjaPoradnik t={TRESC} />;
}
