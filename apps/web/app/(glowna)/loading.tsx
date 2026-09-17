import { Radar } from "@/components/Radar";

/**
 * Granica Suspense — WYLACZNIE dla strony glownej, stad grupa tras `(glowna)`.
 *
 * Zapytania z filtrami potrafia trwac ulamek sekundy, a przy `force-dynamic`
 * Next nie ma co pokazac — bez tego pliku uzytkownik widzi zamrozona poprzednia
 * liste i nie wie, czy klikniecie w ogole zadzialalo.
 *
 * DLACZEGO NIE W `app/` — TEN PLIK ZEPSUL 404 W CALYM SERWISIE.
 *
 * `loading.tsx` w katalogu glownym owija w Suspense KAZDA strone, a odpowiedz
 * strumieniowana ma status wyslany, zanim kod dojdzie do `notFound()`. Efekt:
 * kazdy nieistniejacy adres oddawal HTTP 200 z trescia "nie ma takiej strony" —
 * podrecznikowy soft 404. Zmierzone na produkcji: nieistniejaca oferta, zmyslona
 * marka, zmyslony model i zmyslony VIN, wszystkie 200.
 *
 * Zaczelo to byc pilne, gdy Google zaindeksowal 11,6 tys. stron zamiast 2 tys.
 * Wiekszosc nadwyzki to pojedyncze oferty, a 34% ofert znika w ciagu tygodnia
 * (mediana zycia 6,9 dnia). Bez poprawnego 404 tysiace martwych adresow
 * odpowiadalyby "200 OK", co jest gotowym przepisem na ocene niskiej jakosci
 * calej domeny.
 *
 * Grupa tras `(glowna)` nie wchodzi do adresu — strona nadal stoi pod `/`.
 * NIE PRZENOSIC tego pliku poziom wyzej.
 */
export default function Loading() {
  return <Radar />;
}
