import { AukcjaPoradnik, type AukcjaTresc } from "@/components/AukcjaPoradnik";
import type { Metadata } from "next";
import { connection } from "next/server";

/* Raz na dobe i dopiero na zadanie — patrz komentarz w analizy/utrata-wartosci. */
export const revalidate = 86_400;

export const metadata: Metadata = {
  title: "Aukcje poleasingowe EFL (Poleasingowe.pl) — zasady, wadium, prowizja",
  description:
    "Jak licytować auta po leasingu w EFL na Poleasingowe.pl: rejestracja, wadium, prowizja, " +
    "cena netto i brutto, prawa konsumenta. Zasady z regulaminu plus aktualna lista aut.",
  alternates: { canonical: "/poradnik/aukcje-efl-poleasingowe" },
};

/*
 * FAKTY Z REGULAMINU poleasingowe.pl, odczytane 4.10.2026. Przy kazdej zmianie
 * tresci sprawdzic regulamin ponownie i przestawic `stanNa`.
 */
const TRESC: AukcjaTresc = {
  sourceId: "poleasingowe",
  nazwa: "EFL (Poleasingowe.pl)",
  h1: "Aukcje poleasingowe EFL — jak licytować na Poleasingowe.pl",
  wstep:
    "Poleasingowe.pl to platforma aukcyjna, na której sprzedawane są auta po leasingu w EFL, " +
    "a także w Pekao Leasing, Millennium Leasing i ING Lease. Organizatorem jest " +
    "Poleasingowe.pl Sp. z o.o. Poniżej zasady w ludzkim języku i auta wystawione dzisiaj.",
  zasady: [
    "Trzeba założyć konto. Rejestracja może wymagać potwierdzenia mailem, SMS-em albo przelewem — przelew weryfikacyjny wraca w ciągu 5 dni roboczych.",
    "W aukcjach mogą brać udział także osoby prywatne, ale część z nich jest przeznaczona wyłącznie dla firm — to wynika z opisu aukcji.",
    "Niektóre aukcje wymagają wadium. Jego kwota jest podana na stronie aukcji, a przegranym wraca w ciągu 14 dni.",
    "Minimalne postąpienie to 100 zł, maksymalne — 50% ceny wywoławczej.",
    "Cena bywa podana brutto albo netto — rodzaj ceny jest oznaczony na stronie aukcji.",
    "Do ceny dochodzi prowizja organizatora. Jej wysokość liczy kalkulator na stronie aukcji.",
    "Dla osoby prywatnej wygrana oznacza umowę przedwstępną. Właściwa umowa jest zawierana w ciągu 7 dni, po zapłacie ceny i prowizji.",
    "Konsument może odstąpić od umowy przedwstępnej w ciągu 14 dni, bez podawania przyczyny.",
    "Firmom sprzedający wyłącza rękojmię.",
  ],
  kroki: [
    "Załóż i potwierdź konto na poleasingowe.pl.",
    "Wybierz auto i przeczytaj opis aukcji: rodzaj ceny, wadium, prowizję i to, czy aukcja jest dla osób prywatnych.",
    "Jeśli aukcja tego wymaga, wpłać wadium — dopiero po zaksięgowaniu możesz licytować.",
    "Obejrzyj auto na placu, o ile oględziny są dostępne dla tej aukcji.",
    "Licytuj. Po wygranej dostaniesz mailem cenę, kwotę VAT, prowizję i terminy zapłaty.",
    "Zapłać, podpisz umowę i odbierz auto w miejscu i terminie wskazanym w wiadomości od organizatora.",
  ],
  pulapki: [
    "Prowizja jest płatna niezależnie od ceny auta — dolicz ją do stawki przed licytacją.",
    "Cena netto: osoba prywatna dopłaci 23% VAT.",
    "Firma, która wygra i się wycofa, płaci opłatę karną: 3% zaoferowanej ceny netto (co najmniej 1000 zł) albo traci wadium.",
    "Firma finansująca zakup przez zewnętrzny podmiot płaci opłatę operacyjną 1000 zł netto. Konsumenci są z niej zwolnieni.",
    "Za przechowanie auta nieodebranego w terminie organizator może naliczyć opłatę.",
  ],
  faq: [
    {
      q: "Czy osoba prywatna może kupić auto na Poleasingowe.pl?",
      a: "Tak, o ile dana aukcja nie jest skierowana wyłącznie do przedsiębiorców — informacja o tym jest na stronie aukcji.",
    },
    {
      q: "Czy na aukcjach EFL trzeba wpłacać wadium?",
      a: "Tylko tam, gdzie organizator lub właściciel auta tego wymaga. Kwota wadium jest podana na stronie aukcji; osobom, które nie wygrały, wraca w ciągu 14 dni.",
    },
    {
      q: "Czy można się wycofać po wygranej aukcji?",
      a: "Konsument może odstąpić od umowy przedwstępnej w ciągu 14 dni bez podawania przyczyny. Firma, która nie wywiąże się z oferty, płaci opłatę karną albo traci wadium.",
    },
    {
      q: "Jakie auta są na Poleasingowe.pl?",
      a: "Samochody po leasingu w EFL oraz w Pekao Leasing, Millennium Leasing i ING Lease, a poza autami osobowymi także dostawcze, ciężarowe i maszyny.",
    },
  ],
  regulaminUrl: "https://poleasingowe.pl/pl/pages/regulations",
  stanNa: "4 października 2026",
};

export default async function Page() {
  await connection();
  return <AukcjaPoradnik t={TRESC} />;
}
