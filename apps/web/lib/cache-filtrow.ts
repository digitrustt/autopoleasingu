import { getMakes, getModelsForFilter, getSources, getStats } from "@/lib/queries";
import { unstable_cache } from "next/cache";

/**
 * Bufor danych, ktore NIE ZALEZA od filtrow w adresie.
 *
 * DLACZEGO POWSTAL: 21.09.2026 Vercel odcial caly serwis (HTTP 402) za
 * przekroczenie limitu darmowego planu. Zmierzone w panelu: autopoleasingu
 * zuzylo 10 h 14 min czasu CPU, czyli 84,7% limitu calego zespolu. Skok
 * zaczyna sie dokladnie 15-18 wrzesnia — wtedy, gdy Google podniosl indeks
 * z 2 tys. do 11 628 stron i zaczal je mielic robotem.
 *
 * Strona glowna ma `force-dynamic`, bo czyta filtry z adresu. To jest
 * poprawne i musi zostac. Ale cztery zapytania na jej wejsciu — marki,
 * modele, zrodla, statystyki naglowka — od filtrow NIE ZALEZA (poza lista
 * modeli, ktora zalezy tylko od wybranej marki). Bez bufora kazde wejscie
 * na serwis, takze kazde wejscie robota, odpalalo cztery agregacje po calej
 * tabeli ofert.
 *
 * To ten sam wzorzec i ten sam blad, ktory wczesniej wyczerpal limit
 * transferu bazy i zdjal serwis na trzy dni — patrz lib/menu.ts, gdzie
 * megamenu dostalo bufor z tego samego powodu.
 *
 * GODZINA, NIE DOBA. Zaciag chodzi raz dziennie o 3:37, wiec doba by
 * wystarczyla dla samych danych. Ale liczniki w naglowku ("21 018 ofert")
 * i lista marek to jedyne miejsce, gdzie widac, ze scraper cokolwiek dowiozl.
 * Godzina to kompromis: zdejmuje 95%+ obciazenia, a najswiezsze dane pojawiaja
 * sie najpozniej godzine po przebiegu.
 */
const GODZINA = 3600;

export const filtryMarek = unstable_cache(async () => getMakes(), ["filtry-marki"], {
  revalidate: GODZINA,
  tags: ["oferty"],
});

export const filtryZrodel = unstable_cache(async () => getSources(), ["filtry-zrodla"], {
  revalidate: GODZINA,
  tags: ["oferty"],
});

export const statystykiNaglowka = unstable_cache(async () => getStats(), ["statystyki"], {
  revalidate: GODZINA,
  tags: ["oferty"],
});

/**
 * Modele do listy rozwijanej — jedyne z tych zapytan, ktore zalezy od wyboru.
 *
 * Marka wchodzi do KLUCZA bufora, wiec kazda ma wlasny wpis. Bez tego
 * wszystkie marki dzielilyby jeden bufor i lista modeli pokazywalaby cudze
 * pozycje — blad gorszy niz brak bufora.
 */
export const filtryModeli = (make?: string) =>
  unstable_cache(async () => getModelsForFilter(make), ["filtry-modele", make ?? "wszystkie"], {
    revalidate: GODZINA,
    tags: ["oferty"],
  })();
