/**
 * Adres wyjscia do sprzedawcy, z oznaczeniem zrodla ruchu.
 *
 * PO CO: bez tego sprzedawcy nie maja POJECIA, ze ten serwis istnieje.
 * Wychodzace linki mialy `rel="noreferrer"`, ktore wycina naglowek Referer,
 * i zadnych parametrow — czyli w analityce PKO Leasing czy Otomoto nasz ruch
 * ladowal w worku "bezposrednie wejscia", nie do odroznienia od wpisania
 * adresu z palca.
 *
 * Zmierzone: jedno klikniecie wyjsciowe na sesje (239 na 235 sesji). Przy
 * pieciu tysiacach wizyt miesiecznie to ponad piec tysiecy klikniec, ktore
 * dzis oddajemy anonimowo. Gdy kiedys przyjdzie rozmowa o rozliczaniu tego
 * ruchu, jedynym argumentem beda liczby po ICH stronie — a tych nie da sie
 * dorobic wstecz.
 *
 * `noopener` zostaje (bezpieczenstwo: strona docelowa nie dostaje dostepu do
 * window.opener). `noreferrer` ZNIKA, bo to on ukrywal zrodlo.
 */

/*
 * Zrodla, ktore nie znosza ZADNEGO parametru w adresie.
 *
 * Zmierzone na produkcji, po jednym zywym adresie z kazdego z 26 zrodel:
 * autoprzetarg zwraca 404 nawet na "?x=1" — to ich routing, nie kwestia UTM.
 * Doklejanie parametrow zepsuloby tam kazde wyjscie, wiec ich adresy zostaja
 * nietkniete. Reszta (25 zrodel) przyjmuje parametry i oddaje 200.
 */
const BEZ_PARAMETROW = new Set(["autoprzetarg"]);

export function adresWyjscia(url: string, sourceId: string | null): string {
  if (!url) return url;
  if (sourceId && BEZ_PARAMETROW.has(sourceId)) return url;

  try {
    const u = new URL(url);
    // Nie nadpisujemy oznaczen, ktore sprzedawca juz ma we wlasnym adresie.
    if (!u.searchParams.has("utm_source")) {
      u.searchParams.set("utm_source", "autopoleasingu.pl");
      u.searchParams.set("utm_medium", "referral");
    }
    return u.toString();
  } catch {
    // Adres nie do sparsowania — lepiej wyslac oryginal niz nic.
    return url;
  }
}

/**
 * Otwiera strone partnera (kredyt, leasing, raport, OC) w nowej karcie, a gdy
 * przegladarka ja zablokuje — w tej samej.
 *
 * DLACZEGO (22.10.2026): przyciski partnerow wolaly window.open z cechami
 * "noopener,noreferrer". Z `noopener` window.open ZAWSZE zwraca null, wiec nie
 * dalo sie poznac, ze karta sie nie otworzyla. PostHog: Chrome na Androidzie
 * z wejsciem z Google, 10 klikniec w leasing w 11 sekund na jednej ofercie —
 * przycisk nic nie robil, czlowiek klikal w kolko. Przycisk do sprzedawcy
 * (ZapisPopup.przejdz) mial juz ten zapas; teraz maja go wszystkie.
 *
 * Bez cech okna dostajemy uchwyt, a `opener = null` daje to samo
 * bezpieczenstwo co `noopener`.
 */
export function otworzPartnera(href: string): void {
  const okno = window.open(href, "_blank");
  if (okno) okno.opener = null;
  else window.location.href = href;
}
