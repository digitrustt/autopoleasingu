# Plan — agregator elektroniki z outletów, poleasingu i refurbished

Data: 2026-10-05. Podstawa: rekonesans (`docs/research/elektronika-rekonesans.md`),
instrukcja startu od sesji prowadzącej autopoleasingu.pl i kod tego repo.

Nazwa robocza do czasu decyzji: **`elektro`** — jedna stała `SITE` w `packages/core`,
pakiety `@elektro/*`. Zmiana nazwy = zmiana jednego pliku i zmiennych środowiskowych.

---

## 0. Cel i definicja „gotowe”

**Etap 1:** jedno źródło typu — feedy Shopera z siedmiu sklepów poleasingowych —
przeprowadzone przez cały przekrój: pobranie → baza z historią cen → lista z filtrami
→ strona oferty → wycena względem mediany → zapis na powiadomienia i analityka.

**Gotowe, gdy:**
- zaciąg przechodzi dla wszystkich siedmiu sklepów, a liczba znalezionych pozycji
  zgadza się z liczbą zapisanych (różnica wyjaśniona w logu),
- lokalnie działa lista i strona oferty na prawdziwych danych,
- znamy i podajemy odsetek ofert z nadanym kluczem produktu (osobno: sama linia,
  linia + model, pełna konfiguracja),
- powstał raport dla Kuby (wzór w sekcji 14).

Kontekst zarabiania z autopoleasingu: po dwóch miesiącach 21 tys. ofert, 12 tys. stron
w indeksie i ok. 50 osób dziennie. Wąskim gardłem jest zaufanie Google do nowej domeny,
nie kod. Dlatego pomiar i zbieranie maili są w etapie 1, a nie „na później”.

---

## 1. Decyzje Kuby — przed startem

| # | Decyzja | Blokuje? | Rekomendacja |
|---|---|---|---|
| 1 | **Nazwa i domena** | kanoniczne adresy, nadawca maili, wdrożenie. Kod można zacząć bez niej | krótka, polska, bez „poleasing” w nazwie (zakres szerszy niż poleasing) |
| 2 | **Osobne repo** | tak — od tego zaczyna się praca | osobne repo, osobny projekt Vercel, osobna baza. Kod **kopiujemy**, nie współdzielimy — autopoleasingu jest na produkcji |
| 3 | **Baza** | tak (do zaciągu) | nowy projekt Supabase, plan darmowy; do testów wystarczy lokalny Postgres z `docker-compose.yml` |
| 4 | **Zgoda sklepów na feedy** | nie blokuje kodu, blokuje publiczne uruchomienie | mail do 7 sklepów (szkic w sekcji 13), wysyła Kuba |
| 5 | **Programy partnerskie** | nie | zgłosić po starcie strony: x-kom SalesMasters, Komputronik, Awin (Back Market, refurbed), BUY.BOX (RTV Euro AGD) |

---

## 2. Architektura — co kopiujemy, co zmieniamy

Układ jak w autopoleasingu (pnpm monorepo):

```
apps/web        Next.js — lista, oferta, strony modeli, zapis, sitemap
apps/worker     zaciąg, wycena, audyt, alerty
packages/core   typy, normalizacja (TU jest nowa praca: klucz produktu i stany)
packages/db     Drizzle + schemat + połączenie z Supabase
packages/scrapers  http.ts, adaptery
.github/workflows/scrape.yml   harmonogram
```

| Element | Ruch | Uwagi |
|---|---|---|
| `packages/scrapers/src/http.ts` | kopia 1:1 | limit, cofanie przy 429, przedstawianie się. Dodać pobieranie strumieniowe dużych plików (feed sprzetowo ma ~46 MB) |
| `packages/scrapers/src/types.ts` | kopia | interfejs `discover → fetchDetail → parse` bez zmian |
| `sources/mauto.ts` | wzór | adapter z kompletem danych w liście (`needsDiscoveryPayload: true`) |
| `browser.ts`, `bravoauto.ts` | kopia na etap 3 | RTV Euro AGD, Swappie |
| `apps/worker/src/pipeline.ts` | kopia + 3 zmiany | sekcja 6 |
| `revalue.ts` | przepisanie klucza koszyka | sekcja 7 |
| `audit.ts` | kopia + reguły elektroniki | sekcja 6 |
| `alerts.ts` | kopia | filtry z nowej wyszukiwarki |
| `packages/db/src/index.ts` | kopia 1:1, **bez zmian w puli** | pooler Supabase nie znosi instrukcji przygotowanych |
| `packages/db/src/schema.ts` | przebudowa `listings`, nowe tabele | sekcja 3 |
| `normalize.ts`, `rodziny.ts` | zastąpione przez `produkt.ts`, `stan.ts`, `linie.ts` | sekcje 4–5 |
| `apps/web/lib/queries.ts` | przepisanie filtrów | sekcja 8 |
| `lib/filtry.ts` | przepisanie słownika stron kategorii | tylko frazy z podpowiedzi Google i z pokryciem w bazie |
| `ZapisForm`, `ZapisPopup`, `OfferLink`, `zapis-sygnal.ts`, `wyjscie.ts` | kopia | `wyjscie.ts` dostaje miejsce na parametry partnerskie |
| `consent.ts`, `CookieConsent.tsx`, `sitemap.ts`, `robots.ts` | kopia + korekty | robots od razu blokuje `/opengraph-image` |

Styl: komentarze po polsku, tłumaczące *dlaczego*, z pomiarem tam, gdzie był.

---

## 3. Model danych

### `sources` — bez zmian.

### `products` — NOWA. Jeden wiersz na model z konfiguracją (to jest odpowiednik „marka+model+rocznik”)

| Kolumna | Opis |
|---|---|
| `id` | serial |
| `key` | klucz kanoniczny, np. `laptop:dell:latitude:5420:i5-1145g7:16:512` — unikalny |
| `category` | `laptop` · `desktop` · `monitor` · `tablet` · `phone` · `other` (etap 1: laptop + desktop + monitor) |
| `brand`, `line`, `model` | `dell` / `latitude` / `5420` |
| `cpu`, `cpuGen` | `i5-1145g7`, `11` (generacja do filtrów i koszyków zastępczych) |
| `ramGb`, `storageGb`, `storageType` | 16 / 512 / `ssd` |
| `screenIn`, `resolution` | 14.0 / `1920x1080` |
| `ean` | gdy znany (outlety sieci) |
| `modelSlug` | `dell-latitude-5420` — strona modelu (bez konfiguracji) |

Dwa poziomy stron: **model** (`/laptopy/dell-latitude-5420`) zbiera wszystkie konfiguracje
i jest jednostką SEO. **Konfiguracja** służy wycenie, nie dostaje osobnej strony w mapie.

### `listings` — przebudowa

Usuwamy pola aut (vin, przebieg, paliwo, skrzynia, nadwozie…). Dochodzi:

| Kolumna | Po co |
|---|---|
| `productId` (nullable) | null = nie udało się nadać klucza — oferta jest na liście, ale nie w wycenie |
| `title` | oryginalna nazwa ze sklepu (do ponownego parsowania po poprawkach parsera) |
| `category`, `brand` | do listy, nawet bez klucza produktu |
| `condition` | znormalizowana klasa stanu (sekcja 5) |
| `conditionRaw` | to, co napisał sklep |
| `stockQty` | feed Ceneo podaje `stock` — oferta to pozycja asortymentu, nie egzemplarz |
| `availability` | `in_stock` · `out_of_stock` — z feedu, niezależnie od `status` |
| `warrantyMonths` | jeśli da się wyczytać (sklepy poleasingowe chwalą się 12–36 mies.) |
| `ean`, `mpn` | surowe kody ze źródła |
| `marketPrice`, `dealScore`, `dealSamples`, `dealFromSold` | jak w autach |
| `newPrice`, `newPriceSource` | **pusty w etapie 1** — tylko gdy cena nowego jest ustalona po EAN |

### `valuations` — klucz koszyka

`(productId, conditionGroup)` plus koszyki zastępcze (`modelSlug + cpuGen + ramGb`,
oznaczone flagą `approximate`) — patrz sekcja 7. Reszta kolumn jak w autach
(mediana, liczba sztuk, mediana sprzedanych).

### `listing_snapshots`, `events`, `subscriptions`, `alerts_sent` — kopia

`listing_snapshots` dostaje `availability` (zmiana dostępności to też zdarzenie).
`events.kind` dostaje `back_in_stock` (powrót pozycji pod tym samym ID).

---

## 4. Klucz produktu — parser nazw (`packages/core/src/produkt.ts`)

**Pomiar wyjściowy** (naiwne regexy na feedach z 4.10, 5 491 pozycji laptopowych z 7 sklepów):

| Rozpoznane | Pozycji | Odsetek |
|---|---|---|
| linia (Latitude, ThinkPad, EliteBook…) | 3 882 | 71% |
| linia + procesor | 2 820 | 51% |
| linia + procesor + RAM + dysk | 2 221 | 40% |

Duże różnice między sklepami: pro4it 86% pełnej konfiguracji, kompre i cebit ~10%.
Przyczyny widać w danych — parser musi je znosić:

- spacje w modelu CPU: `i5 - 8365U` (kompre),
- sama generacja zamiast modelu: `i7 3GEN`, `i5/16gb/256gb` (cebit),
- separatory `|`, `/`, przecinki; RAM i dysk w jednym tokenie (`256SSD`, `NVME256`),
- klasa stanu w tytule: `[A-]`, `[A]`,
- w feedzie są też części do laptopów (klapa matrycy, zasilacz) — filtr kategorii.

**Cel etapu 1:** ≥85% linia + model, ≥65% pełna konfiguracja (lub konfiguracja
z poziomem „generacja CPU” zamiast dokładnego modelu — osobno raportowane).

**Budowa:**
1. `linie.ts` — słownik: producent → linie → wzorzec numeru modelu
   (`Latitude 5420`, `E7440`, `ThinkPad T480s`, `EliteBook 840 G6`, `OptiPlex 7070 Micro`…).
   Start od listy linii biznesowych Dell/Lenovo/HP/Fujitsu/Panasonic/Apple/Microsoft.
2. Tokenizer tytułu → ekstraktory: CPU (Intel Core i/Ultra, Ryzen, Apple M, Celeron),
   RAM, dysk, ekran, rozdzielczość, system, klasa stanu.
3. Fallback na opis i atrybuty feedu, gdy w tytule brak CPU.
4. **Testy na prawdziwych tytułach:** zrzut ~300 tytułów z feedów do pliku testowego,
   ręcznie opisane oczekiwane klucze. Każda poprawka parsera musi przejść całość.
5. Komenda `reparse` — przelicza `productId` dla wszystkich ofert z `title`,
   bo poprawki parsera muszą docierać do już zapisanych wierszy (lekcja z aut).

---

## 5. Słownik stanów (`packages/core/src/stan.ts`)

| Klasa | Znaczenie | Przykładowe zapisy w sklepach |
|---|---|---|
| `as_new` | jak nowy / otwarte opakowanie | „A+”, „outlet doskonały”, „jak nowy” |
| `very_good` | drobne ślady | „A”, „A-”, „bardzo dobry” |
| `good` | widoczne ślady | „B”, „B+”, „dobry”, „outlet dobry” |
| `fair` | wyraźne ślady, uszkodzenia kosmetyczne | „C”, „B-” |
| `unknown` | sklep nie podaje | — |

Zasada: mediana nigdy nie miesza `as_new/very_good` z `good/fair`. `unknown` liczymy
osobno i raportujemy jego udział — jeśli duży, poprawiamy ekstrakcję z opisów.

---

## 6. Adapter Shopera i zmiany w silniku

### Adapter `shoper` (jeden, sparametryzowany listą sklepów)

```
shops = [sprzetowo, cebit, kompre, precio, pro4it, pclider, pofirmowe]
źródło w bazie = jeden sklep (sourceId = "shoper:kompre"), wspólny kod
```

- **Plik główny:** `GoogleProductSearch` — ma `availability`, `condition`, `gtin`, `mpn`,
  `product_type`. Uzupełnienie: `CeneoV2` dla `stock` i atrybutów (tam, gdzie niepusty —
  u pclider i pofirmowe jest pusty).
- **Raz na przebieg, cały plik**, nie strona po stronie. `needsDiscoveryPayload: true`,
  `fetchDetail` nie robi zapytań.
- Parsowanie strumieniowe (sprzetowo: ~46 MB, 16 tys. pozycji).
- Filtr: tylko kategorie sprzętu głównego (laptop/desktop/monitor). Akcesoria i części
  → `parse() = null` i licznik `skipped` (jak w autach — nie mylić z awarią).
- Przedstawiamy się w User-Agencie z adresem strony i kontaktem.

### Zmiany w `pipeline.ts`

1. **Niedostępne ≠ zniknięte.** Feed zawiera pozycje `out of stock` (17,8 tys. na
   23 tys. w sumie). Pozycja niedostępna → `availability = out_of_stock`, cena
   zachowana, oferta dalej istnieje. `status = gone` tylko gdy zniknie z pliku.
2. **Powrót pod tym samym ID** → zdarzenie `back_in_stock`, nie nowa oferta.
   Obecny kod już przywraca `status = active`; brakuje zdarzenia.
3. **Pierwszy zaciąg niedostępnych:** zapisujemy je od razu jako niedostępne —
   to gotowa historia „ile kosztował model X” i strony sprzedanych od dnia 1.
   Do mediany „sprzedanej” wchodzą dopiero po realnym przejściu ze stanu dostępny →
   niedostępny (inaczej wiek ceny jest nieznany).

### Kontrola po każdym zaciągu (`audit.ts`)

- znalezione w pliku vs zapisane vs pominięte — różnica > 5% bez wyjaśnienia = alarm,
- spadek liczby pozycji sklepu > 30% dzień do dnia = alarm (ciche zepsucie feedu),
- odsetek kluczy produktu per sklep — spadek = parser się psuje,
- ceny poza widełkami kategorii (laptop < 150 zł albo > 30 tys. zł).

---

## 7. Wycena

- **Koszyk:** ten sam produkt (`key`) + ta sama grupa stanu (`as_new+very_good` /
  `good+fair` / `unknown`). Minimum 4 oferty z co najmniej 2 sklepów — inaczej
  mediana mówi o jednym sklepie, nie o rynku.
- **Koszyk zastępczy**, gdy za mało sztuk: linia + model + generacja CPU + RAM ±
  (oznaczany w UI jako przybliżony). Bez zastępczego — brak oceny, nie zgadujemy.
- `dealScore = (mediana − cena) / mediana`, jak w autach.
- **„Taniej niż nowy” — w etapie 1 nie pokazujemy.** Shoper nie podaje ceny nowego,
  a sprzęt poleasingowy często nie jest już sprzedawany jako nowy. Ten wskaźnik
  wejdzie z outletami sieci (Morele podaje cenę nowego po EAN na tej samej karcie).
- Wycena osobnym przebiegiem, wynik zapisany na ofercie (jak w autach — liczenie
  median w zapytaniu zabiłoby listę).

---

## 8. Strona (apps/web)

| Strona | Zawartość | W mapie strony? |
|---|---|---|
| `/` | najnowsze okazje, kategorie, zapis | tak |
| `/laptopy`, `/komputery`, `/monitory` | lista z filtrami | tak |
| `/laptopy/dell-latitude-5420` **(strona modelu)** | wszystkie konfiguracje i sklepy, zakres cen, historia cen modelu, sprzedane sztuki, zapis „powiadom o tym modelu” | **tak — jednostka SEO**, tylko modele z pokryciem (np. ≥3 oferty w historii) |
| `/oferta/[id]` | dane, wycena z liczbą sztuk w koszyku, historia ceny, link do sklepu | **nie** (jak w autach) |
| wyprzedana oferta | zostaje pod adresem: „wyprzedane”, podobne, zapis | nie |
| strony kategorii z `filtry.ts` | np. „laptopy poleasingowe do 1000 zł”, „ThinkPad poleasingowy” | tylko frazy z podpowiedzi Google z pokryciem |
| `/sklepy` | lista źródeł ze stanem zaciągu (jak strona źródeł w autach) | tak |

**Filtry:** kategoria, producent, linia, model, procesor/generacja, RAM, dysk, ekran,
stan, gwarancja, cena, sklep, tylko okazje.

**Wydajność (lekcje z aut):**
- żadnych agregacji po całej tabeli przy budowaniu ani przy każdym wejściu —
  `await connection()` + `export const revalidate` (wzór: `app/analizy/utrata-wartosci/page.tsx`),
- `revalidate` nie częściej niż zaciąg (dobowy zaciąg → 24 h, strony modeli 12–24 h),
- miniatury linkowane ze sklepu, nie hostowane,
- `/opengraph-image` w `Disallow` od pierwszego wdrożenia.

---

## 9. Pomiar, maile, zarabianie — od dnia 1

- **Analityka** z banerem zgody (kopia z aut) + zdarzenia: wyjście do sklepu
  (z id sklepu i oferty), zapis na powiadomienia, użycie filtrów.
- **Zapis na powiadomienia:** na liście (zapisz filtry), na stronie modelu
  („daj znać, gdy ThinkPad T480 spadnie poniżej X”), okienko przed wyjściem do sklepu.
- **Alerty** raz dziennie, limit ofert w mailu, bez powtórek (kopia `alerts.ts`).
- **Link wyjściowy** przez jeden komponent (`wyjscie.ts`): UTM `utm_source=<nazwa>`
  od razu — sklepy zobaczą w swojej analityce, że wysyłamy ruch, co jest argumentem
  w rozmowie o płatnych wyróżnieniach. Miejsce na parametry partnerskie per sklep.
- **Formularz B2B** („potrzebuję kilku–kilkudziesięciu laptopów dla firmy”) —
  etap 2, ale pole w modelu danych i miejsce w layoucie już w etapie 1.

---

## 10. Etap 1 — kolejność prac

| Krok | Zakres | Sprawdzenie |
|---|---|---|
| 1 | Nowe repo: kopia monorepo, usunięcie kodu aut, nazwa robocza, CI | build i typecheck przechodzą |
| 2 | Schemat (sekcja 3), migracja, lokalny Postgres | migracja na czystej bazie |
| 3 | Adapter `shoper` + test na zapisanych feedach (bez sieci) | liczby pozycji = liczby z rekonesansu |
| 4 | Słownik stanów + parser nazw + ~300 opisanych tytułów jako testy | odsetek kluczy per sklep vs pomiar wyjściowy |
| 5 | Zmiany w `pipeline.ts` + audyt, pierwszy prawdziwy zaciąg 7 sklepów | znalezione = zapisane + pominięte |
| 6 | Wycena (koszyki, minimum sztuk, zastępczy) | ręczny przegląd 20 ofert z najwyższym `dealScore` |
| 7 | Web: lista, filtry, oferta, strona modelu, wyprzedane | lokalnie na prawdziwych danych |
| 8 | Zapis, alerty, analityka, `wyjscie.ts` z UTM | testowy mail na własny adres |
| 9 | Sitemap, robots, kanoniczne (po decyzji o domenie) | sitemap zawiera tylko modele z pokryciem |
| 10 | Raport dla Kuby (sekcja 14) | — |

Wdrożenie na produkcję **dopiero po** decyzji o domenie i odpowiedziach sklepów
(albo świadomej decyzji Kuby, że startujemy bez nich). Pamiętać: `git push` nie wdraża —
`npx vercel --prod --yes`, stan przez `npx vercel inspect <deployment>`.

---

## 11. Kolejne etapy (wg rekonesansu)

| Etap | Źródła | Co nowego technicznie |
|---|---|---|
| 2 | Komputronik outlet, Morele outlet, MediaMarkt odnowione, Apple Refurbished + pozostałe sklepy poleasingowe (freshcomp, taniekomputery, rnew, laptopypoznan) | dopasowanie po EAN/MPN, **cena nowego** (Morele) i wskaźnik „taniej niż nowy”; kategorie AGD/RTV z outletów — osobna decyzja, czy w ogóle |
| 3 | RTV Euro AGD outlet, Swappie | przeglądarka (`browser.ts`, wzór `bravoauto`) |
| 4 | x-kom, Media Expert, Back Market, refurbed, Amazon | feedy z programów partnerskich — po akceptacji |
| 5 | smartfony i tablety jako pełne kategorie, formularz B2B, płatne wyróżnienia sklepów | klucz produktu dla telefonów (model + pamięć + kolor), panel dla sklepów |

---

## 12. Pułapki — lista kontrolna przed każdym wdrożeniem

- [ ] żadna strona nie liczy agregacji po całej tabeli przy wejściu ani przy buildzie
- [ ] `revalidate` ≥ częstotliwość zaciągu
- [ ] nie ruszaliśmy puli połączeń w `packages/db/src/index.ts`
- [ ] w mapie strony tylko modele i kategorie z pokryciem, bez pojedynczych ofert i krzyżówek
- [ ] wyprzedane oferty zostają pod adresem
- [ ] zdjęcia linkowane, nie hostowane
- [ ] audyt porównuje znalezione z zapisanymi; brak cichych zer
- [ ] `/opengraph-image` w `Disallow`
- [ ] żadnych niezmierzonych liczb, sztucznej presji („zostały 2 sztuki”), rat bez RRSO
- [ ] wdrożenie przez `vercel --prod`, stan sprawdzony `vercel inspect`

---

## 13. Szkic maila do sklepów (wysyła Kuba)

> Temat: [nazwa] — darmowa prezentacja Państwa oferty laptopów poleasingowych
>
> Dzień dobry,
>
> buduję [nazwa] — porównywarkę sprzętu poleasingowego i outletowego. Pokazujemy
> oferty kilku sklepów w jednym miejscu, z historią cen, i kierujemy kupujących
> bezpośrednio do sklepu (bez prowizji, bez pośrednictwa w sprzedaży).
>
> Chcielibyśmy korzystać z Państwa publicznego pliku produktowego (tego samego,
> który Shoper udostępnia dla Ceneo i Google), pobieranego raz dziennie.
> Ruch, który do Państwa wyślemy, będzie oznaczony `utm_source=[nazwa]`.
>
> Czy mogą Państwo potwierdzić zgodę? Jeśli wolą Państwo inny plik albo chcą
> wyłączyć część asortymentu — dostosujemy się.
>
> Prowadzę też autopoleasingu.pl — podobny serwis dla aut poleasingowych.
>
> Pozdrawiam, Kuba

---

## 14. Raport po etapie 1 — wzór

1. **Ile ofert weszło** z każdego sklepu (dostępne / niedostępne / pominięte akcesoria)
   i ile dostało klucz produktu (linia+model / pełna konfiguracja).
2. **Co pominąłem i dlaczego.**
3. **Trzy przykłady ofert z wyceną:** cena, mediana, liczba sztuk w koszyku, ze ilu sklepów.
4. **Decyzje czekające na Kubę:** domena, zgody sklepów, programy partnerskie.
5. **Sprawdzone na prawdziwych danych** vs **niesprawdzone** — wyraźnie oddzielone.

---

## 15. Ryzyka

| Ryzyko | Skutek | Co robimy |
|---|---|---|
| Sklep wyłączy publiczny feed albo odmówi | ubywa źródło | mail z prośbą o zgodę przed startem; fallback: mapa strony + JSON-LD |
| Parser nie dobije do celu dla kompre/cebit | mniej ofert w wycenie | fallback na opis i atrybuty; konfiguracja na poziomie generacji CPU |
| Za mało sztuk na koszyk (rynek rozdrobniony) | mało ocen okazji | koszyk zastępczy oznaczony jako przybliżony; z czasem baza sprzedanych |
| Google wolno ufa nowej domenie | mały ruch przez miesiące | linki z autopoleasingu, okazje na Pepper/Wykop, newsletter od dnia 1 |
| Niskie prowizje w elektronice | mały przychód z afiliacji | UTM od startu → płatne wyróżnienia sklepów, formularz B2B w etapie 2 |
| Duże sieci blokują boty | brak x-kom / Media Expert | tylko feedy partnerskie (etap 4), nie obchodzimy zabezpieczeń |
