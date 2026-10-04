# Instrukcja startu — agregator elektroniki z outletów, poleasingu i refurbished

Data: 2026-10-04. Dla sesji, która zrobiła rekonesans
(`docs/research/elektronika-rekonesans.md`) i ma teraz zacząć budowę.
Napisane przez sesję, która od dwóch miesięcy prowadzi autopoleasingu.pl —
poniżej jest to, co z tego projektu warto przenieść, i to, co nas kosztowało.

## Cel

Zbudować działający szkielet agregatora na wzór autopoleasingu: dane z kilku
źródeł w jednej bazie, lista z filtrami, strona oferty, wycena „o ile taniej
niż…”, powiadomienia mailowe. Na pierwszy etap wystarczy **jedno źródło typu
(feedy Shopera) przeprowadzone od pobrania do strony oferty**. Szerokość
przyjdzie później; najpierw ma działać cały przekrój.

Kuba pyta o zarabianie. Uczciwy kontekst z autopoleasingu: po dwóch miesiącach
mamy 21 tys. ofert, 12 tys. stron w indeksie Google i ok. 50 osób dziennie.
Wąskim gardłem nie jest kod ani liczba stron, tylko zaufanie Google do nowej
domeny. Buduj więc tak, żeby od pierwszego dnia dało się mierzyć i zbierać
maile, a nie tak, jakby ruch miał przyjść sam.

## Decyzje, które należą do Kuby — zapytaj, zanim zaczniesz

1. **Nazwa i domena.** Bez niej nie ustawisz adresów kanonicznych ani nadawcy
   maili. Do czasu decyzji pracuj pod nazwą roboczą w jednej stałej.
2. **Osobne repo czy to samo.** Rekomendacja: osobne repo, osobny projekt na
   Vercelu, osobna baza. Wspólny kod skopiuj, nie współdziel — autopoleasingu
   jest na produkcji i nie może się wywrócić przez zmianę pod elektronikę.
3. **Baza.** Nowy projekt Supabase (plan darmowy wystarczy na start).
4. **Zgoda sklepów na feedy.** Feedy Shopera są publiczne, ale zrobione dla
   porównywarek. Przygotuj krótki mail do siedmiu sklepów; wysyła Kuba.

## Co przenieść z autopoleasingu

Przeczytaj te pliki, zanim cokolwiek napiszesz. Komentarze w nich opisują
powody decyzji, często z liczbami — to jest właściwa dokumentacja projektu.

| Potrzebujesz | Wzór w tym repo |
|---|---|
| Układ monorepo (pnpm): `apps/web`, `apps/worker`, `packages/{core,db,scrapers}` | całe repo, `README.md`, `PLAN.md` |
| Interfejs adaptera: `discover` → `fetchDetail` → `parse` | `packages/scrapers/src/types.ts` |
| Klient HTTP z limitem, cofaniem przy 429 i przedstawianiem się | `packages/scrapers/src/http.ts` |
| Adapter na gotowe API/plik, gdzie lista niesie komplet danych | `packages/scrapers/src/sources/mauto.ts` (`needsDiscoveryPayload`) |
| Adapter przez przeglądarkę | `packages/scrapers/src/sources/bravoauto.ts`, `browser.ts` |
| Silnik zaciągu: nowe, zmiana ceny, zniknięcie | `apps/worker/src/pipeline.ts` |
| Wycena względem mediany | `apps/worker/src/revalue.ts` |
| Kontrola jakości danych | `apps/worker/src/audit.ts` |
| Alerty mailowe (raz dziennie, limit ofert, bez powtórek) | `apps/worker/src/alerts.ts` |
| Schemat: źródła, oferty, migawki cen, zdarzenia, subskrypcje | `packages/db/src/schema.ts` |
| Połączenie z bazą na Vercelu + Supabase | `packages/db/src/index.ts` |
| Filtry i zapytania listy | `apps/web/lib/queries.ts` |
| Strony kategorii pod frazy z Google | `apps/web/lib/filtry.ts` |
| Zapis na powiadomienia, okienko przed wyjściem do sprzedawcy | `components/ZapisForm.tsx`, `ZapisPopup.tsx`, `OfferLink.tsx`, `lib/zapis-sygnal.ts` |
| Link wyjściowy (tu wejdą linki partnerskie) | `apps/web/lib/wyjscie.ts` |
| Zgoda na analitykę | `apps/web/lib/consent.ts`, `components/CookieConsent.tsx` |
| Mapa strony i robots | `apps/web/app/sitemap.ts`, `app/robots.ts` |
| Harmonogram zaciągu | `.github/workflows/scrape.yml` |

Styl kodu: komentarze po polsku, tłumaczące *dlaczego*, z pomiarem tam, gdzie
był. Trzymaj ten sam.

## Co jest inne niż w autach

To jest właściwa praca projektowa; reszta to przenoszenie.

- **Tożsamość produktu.** W autach kluczem jest VIN albo marka+model+rocznik.
  Tu potrzebujesz klucza produktu: EAN, gdy jest, a dla poleasingu — model
  i konfiguracja wyczytane z nazwy („Dell Latitude E5570 i5-6200U 8GB 256SSD”
  → producent, linia, model, procesor, RAM, dysk). Odpowiednikiem jest
  `packages/core/src/normalize.ts` i `rodziny.ts`. Zacznij od laptopów;
  nie próbuj od razu wszystkich kategorii.
- **Stan.** Auta mają przebieg i rocznik, tu jest klasa stanu (A/B, „outlet
  doskonały”, „odnowiony”). Każde źródło nazywa ją inaczej — potrzebny słownik
  i pole w ofercie, bo bez niego mediana miesza sprzęt jak nowy z porysowanym.
- **Dwa punkty odniesienia ceny.** Mediana tej samej konfiguracji między
  sklepami (jak w autach) oraz cena nowego, tam gdzie da się ją uczciwie
  ustalić po EAN (Morele podaje ją na tej samej karcie). Trzymaj je osobno
  i nie pokazuj „taniej o X% od nowego”, jeśli cena nowego jest zgadywana.
- **Oferta to często wiele sztuk.** Feed sklepu opisuje pozycję asortymentu,
  nie egzemplarz. „Zniknęła” znaczy „wyprzedana”, a wróci pod tym samym
  identyfikatorem — sprawdź, czy silnik zaciągu to znosi.

## Etap 1 — zakres

1. Szkielet repo z przeniesionymi pakietami, baza, migracja schematu.
2. **Jeden adapter na feedy Shopera**, sparametryzowany listą sklepów
   (sprzetowo, cebit, kompre, precio, pro4it, pclider, pofirmowe). Pobieraj
   plik raz na przebieg, nie stronę po stronie.
3. Parser nazw laptopów do klucza produktu + słownik stanów.
4. Zaciąg do bazy z historią cen (migawki i zdarzenia jak w `pipeline.ts`).
5. Lista z filtrami i strona oferty, z linkiem wyjściowym przez jeden wspólny
   komponent.
6. Wycena względem mediany dla tej samej konfiguracji.
7. Analityka i zapis na powiadomienia od pierwszego dnia.

Kolejne etapy według rekonesansu: Komputronik, Morele, MediaMarkt, Apple
(zwykłe HTTP), potem RTV Euro AGD i Swappie (przeglądarka), na końcu feedy
z programów partnerskich.

**Gotowe, gdy:** zaciąg przechodzi dla wszystkich siedmiu sklepów, lokalnie
działa lista i strona oferty na prawdziwych danych, a Ty znasz i podajesz
odsetek ofert, którym udało się nadać klucz produktu.

## Czego nie robić — każdy punkt nas coś kosztował

- **Nie obchodź robots.txt ani zabezpieczeń.** Źródła zablokowane w rekonesansie
  (x-kom, Media Expert, Back Market, Amazon) zostają na feedy partnerskie.
  Próba pisania adaptera wbrew zakazowi i tak zostanie zatrzymana przez
  zabezpieczenia Claude Code — w tej sesji tak się stało przy portalu
  aukcyjnym mLeasingu. Odrzucone źródła wpisuj do README z powodem.
- **Nie licz agregacji przy budowaniu ani przy każdym wejściu.** Strony liczące
  po całej tabeli wywracały nam deploy (limit czasu prerenderu), a liczone przy
  każdym wejściu wyczerpały limit CPU na Vercelu i zdjęły serwis (HTTP 402).
  Wzorzec: `await connection()` + `export const revalidate` — patrz
  `apps/web/app/analizy/utrata-wartosci/page.tsx`.
- **Nie odświeżaj stron częściej, niż zmieniają się dane.** Godzinny `revalidate`
  przy dobowym zaciągu przekroczył limit transferu bazy i wyłączył serwis na
  trzy dni.
- **Nie zmieniaj ustawień puli połączeń bez czytania komentarzy** w
  `packages/db/src/index.ts`. Pooler Supabase w trybie transakcyjnym nie znosi
  instrukcji przygotowanych, a jedno zepsute połączenie potrafi zawiesić całą
  instancję funkcji.
- **Nie wrzucaj pojedynczych ofert do mapy strony** i nie generuj krzyżówek
  typu marka × kategoria × próg ceny. Strony z kilkoma ofertami Google traktuje
  jak przelotowe. Kategorie twórz tylko pod frazy, które Google realnie
  podpowiada, i tylko z pokryciem w bazie (opis w `lib/filtry.ts`).
- **Nie usuwaj strony wyprzedanej oferty.** Zostaje pod adresem, mówi, co się
  stało, pokazuje podobne i formularz zapisu. U nas 42% odsłon stron ofert to
  oferty już nieaktualne.
- **Nie hostuj zdjęć.** Miniatury linkujemy ze źródła.
- **Nie ufaj przebiegowi, który „nie miał błędów”.** Parser oddający `null` to
  normalna ścieżka, więc cicha utrata wszystkich ofert źródła wygląda jak
  sukces. Po każdym zaciągu porównuj liczbę znalezionych z liczbą zapisanych.
- **Nie blokuj obrazków podglądu dopiero po fakcie.** `/opengraph-image`
  generowane dla każdej oferty robot mielił tysiącami; od razu dodaj je do
  `Disallow` w robots.
- **Nie pisz liczb, których nie zmierzyłeś**, i nie dodawaj sztucznej presji
  („zostały 2 sztuki”). Przy finansowaniu nie podawaj rat — to wymaga RRSO.
- **`git push` nie wdraża.** Wdrożenie to `npx vercel --prod --yes`. Klient
  potrafi zerwać połączenie w trakcie budowania; stan sprawdzaj przez
  `npx vercel inspect <deployment>`.

## Co chcę dostać z powrotem po etapie 1

Krótki raport dla Kuby, bez żargonu:

- ile ofert weszło z każdego sklepu i ile z nich dostało klucz produktu,
- co pominąłeś i dlaczego,
- przykład trzech ofert z wyceną, żeby było widać, czy liczby mają sens,
- lista decyzji, które czekają na Kubę (domena, zgody sklepów, programy
  partnerskie do zgłoszenia),
- wyraźnie oddzielone: co sprawdziłeś na prawdziwych danych, a czego nie.
