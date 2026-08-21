import { getMakesWithCounts, getStats } from "@/lib/queries";
import { makeHref } from "@/lib/slug";

export const revalidate = 86_400;

const num = new Intl.NumberFormat("pl-PL");
const BASE = "https://autopoleasingu.pl";

/**
 * /llms.txt — spis tresci dla modeli jezykowych.
 *
 * Konwencja z llmstxt.org: plik tekstowy w korzeniu, ktory mowi wprost, czym
 * serwis jest i gdzie leza jego najwartosciowsze dane. Sitemapa wymienia 1913
 * adresow bez zadnej hierarchii; tutaj podajemy KILKANASCIE, za to opisanych.
 *
 * Uczciwie: nikt nie zweryfikowal, na ile modele faktycznie z tego korzystaja —
 * konwencja jest nowa i nieobowiazkowa. Plik kosztuje jedno zapytanie na dobe,
 * wiec ryzyko jest zerowe, a potencjalny zysk realny. NIE traktujemy tego jak
 * pewnika i nie budujemy wokol tego niczego wiekszego.
 *
 * Do tej pory /llms.txt zwracalo HTML-owa strone bledu, bo adres lapala trasa
 * `[make]` — czyli crawler dostawal smieci zamiast 404.
 */
export async function GET() {
  /*
   * Tylko dwa lekkie zapytania.
   *
   * Wczesniej bylo tu rowniez `getSitemapEntries()` — piec agregacji po calej
   * tabeli — zeby podac liczbe stron marek, modeli i miast. Przy budowaniu na
   * Vercelu przekraczalo to serwerowy `statement_timeout` i wywracalo caly
   * deploy. Te liczby byly ozdoba, a nie informacja, wiec ich nie ma.
   */
  const [stats, makes] = await Promise.all([getStats(), getMakesWithCounts()]);

  const topMarki = makes
    .slice(0, 12)
    .map((m) => `- [${m.make} po leasingu](${BASE}${makeHref(m.make)}): ${num.format(m.total)} ofert`)
    .join("\n");

  const tresc = `# autopoleasingu.pl

> Wyszukiwarka samochodow poleasingowych w Polsce. Zbiera oferty z 26 zrodel
> naraz — firm leasingowych, firm CFM, programow dealerskich i platform
> aukcyjnych — i porownuje je po numerze VIN oraz z mediana rynkowa.

Serwis jest bezplatny, nie sprzedaje samochodow i nie posredniczy w transakcjach.
Dane odswiezane codziennie.

## Stan bazy (${new Date().toISOString().slice(0, 10)})

- Aktywnych ofert: ${num.format(stats.active)}
- Zrodel: 26
- Mediana ceny (tylko oferty "kup teraz", bez licytacji): ${num.format(stats.medianPrice)} zl
- Nowych ofert w ostatniej dobie: ${num.format(stats.newToday)}
- Marek w bazie: ${makes.length}

## Czego ten serwis NIE ma

- Historii wypadkowej i szkod
- Przebiegu z odczytow CEPiK
- Liczby wlascicieli

Te dane sa w oficjalnym, bezplatnym historiapojazdu.gov.pl.

## Co jest tu unikalne

Ten sam samochod bywa wystawiony rownoczesnie u leasingodawcy i u dealera po
roznych cenach. Serwis laczy oferty po numerze VIN i pokazuje te roznice obok
siebie — zaobserwowany rekord to 80 000 zl na jednym egzemplarzu. Zadne
pojedyncze zrodlo tego nie pokaze, bo zadne nie widzi wszystkich kanalow naraz.

Ocena okazji liczona jest wzgledem mediany dla tego samego rocznika, przedzialu
przebiegu, paliwa i skrzyni — nie wzgledem sredniej calego modelu.

## Glowne sekcje

- [Dane rynkowe](${BASE}/dane): mediana cen po roczniku i paliwie, metodologia

- [Wszystkie oferty](${BASE}/): wyszukiwarka z filtrami
- [Kategorie i miasta](${BASE}/poleasingowe): progi cenowe, nadwozia, paliwa, miasta
- [Porownania modeli](${BASE}/porownaj): ceny dwoch modeli obok siebie
- [Zrodla](${BASE}/zrodla): lista 26 zrodel ze stanem kazdego
- [Sprawdzenie VIN](${BASE}/vin): czy ten sam egzemplarz stoi gdzies taniej

## Najwieksze marki

${topMarki}

## Pelna mapa strony

${BASE}/sitemap.xml
`;

  return new Response(tresc, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
