/**
 * Spis poradnikow — jedno zrodlo dla strony /poradnik, stopki i mapy strony.
 * Sama tresc mieszka w app/poradnik/<slug>/page.tsx.
 */
export const PORADNIKI: { slug: string; tytul: string; opis: string }[] = [
  {
    slug: "czy-warto-kupic-auto-poleasingowe",
    tytul: "Czy warto kupić auto poleasingowe?",
    opis: "Zalety i wady policzone na realnych ofertach: przebiegi, ceny i obniżki.",
  },
  {
    slug: "rok-produkcji-z-vin",
    tytul: "Jak odczytać rok produkcji z VIN",
    opis: "Tabela kodów i sprawdzenie na tysiącach numerów: u których marek to nie działa.",
  },
  {
    slug: "gdzie-jest-numer-vin",
    tytul: "Gdzie jest numer VIN w samochodzie",
    opis: "Dowód rejestracyjny, szyba, tabliczka, nadwozie — i jak sprawdzić, czy się zgadzają.",
  },
  {
    slug: "kody-producentow-vin",
    tytul: "Kody producentów w VIN (WMI)",
    opis: "Tabela kodów z naszej bazy: marka, kraj i czy 10. znak to u nich rok.",
  },
  {
    slug: "aukcje-pko-leasing",
    tytul: "Aukcje PKO Leasing — jak licytować",
    opis: "Kto może kupować, terminy zapłaty i odbioru, prowizja, cena netto i brutto.",
  },
  {
    slug: "aukcje-efl-poleasingowe",
    tytul: "Aukcje EFL na Poleasingowe.pl",
    opis: "Rejestracja, wadium, prowizja i prawa konsumenta po wygranej aukcji.",
  },
];
