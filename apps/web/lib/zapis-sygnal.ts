/**
 * Sygnal "ktos wlasnie wyszedl do sprzedawcy" — z OfferLink do ZapisPopup.
 *
 * Po co osobny modul zamiast propsa: klikniecie zdarza sie w OfferLink, a
 * reaguje na nie nakladka zamontowana w layoucie, o dwadziescia poziomow wyzej
 * w drzewie. Kontekst Reacta bylby tu armata na wróbla — to jedno zdarzenie
 * bez zadnego stanu, a `window` i tak jest wspolny dla obu.
 *
 * DLACZEGO AKURAT TEN MOMENT. Zmierzone: 38% odwiedzajacych klika przejscie do
 * sprzedawcy, a tylko 7,5% w ogole dochodzilo do progu, ktory pokazywal
 * nakladke. Wyjscie do sprzedawcy to najmocniejszy sygnal zamiaru, jaki ten
 * serwis w ogole widzi — i jedyny moment, w ktorym czlowiek odchodzi na dobre,
 * bo transakcja dzieje sie juz gdzie indziej.
 */
export const SYGNAL_WYJSCIA = "zapis:wyjscie";

export function zglosWyjscie(): void {
  window.dispatchEvent(new Event(SYGNAL_WYJSCIA));
}
