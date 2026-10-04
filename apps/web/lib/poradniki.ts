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
