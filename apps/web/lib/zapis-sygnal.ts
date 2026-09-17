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

/**
 * Co czlowiek ogladal, wychodzac. Nakladka pokazuje TO auto zamiast ogolnika —
 * "dac znac o kolejnych BMW Seria 3?" dziala inaczej niz "przysylac okazje?",
 * bo odpowiada na mysl, ktora czlowiek wlasnie ma w glowie.
 *
 * Wszystko opcjonalne: sygnal leci tez z kafelka na liscie, gdzie czesci
 * danych nie ma, a nakladka musi dzialac takze bez nich.
 */
export interface KontekstWyjscia {
  /** "BMW Seria 3" — do tytulu i do filtra subskrypcji. */
  nazwa?: string | null;
  make?: string | null;
  model?: string | null;
  /**
   * Miniatura auta — jedyny obrazek na nakladce.
   *
   * MOZE BYC GRAFIKA "BRAK ZDJECIA". najlepszeoferty.bmw.pl oddaje na oferty
   * bez zdjecia wlasna grafike zastepcza, z kodem 200 i w proporcji 16:9 —
   * czyli nie do odroznienia ani przez `onError`, ani po ksztalcie
   * (sprawdzone: 1920x1080), ani po adresie (sa unikalne). Dlatego nakladka
   * pomija zdjecia z tego zrodla, patrz `zrodlo` nizej.
   */
  zdjecie?: string | null;
  /** Identyfikator zrodla — sluzy wylacznie do odsiania zastepnikow BMW. */
  zrodlo?: string | null;
  cena?: number | null;
}

export function zglosWyjscie(kontekst: KontekstWyjscia = {}): void {
  window.dispatchEvent(new CustomEvent(SYGNAL_WYJSCIA, { detail: kontekst }));
}
