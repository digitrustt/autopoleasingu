# Auta — sniper ofert poleasingowych

Monitoring aut poleasingowych z polskich platform leasingowych, CFM i programów
dealerskich. Zbiera oferty, śledzi historię cen, wykrywa nowe i przecenione sztuki.

Plan architektury i rejestr wszystkich 26 źródeł: **[PLAN.md](PLAN.md)**

---

## Stan: Fazy 1–6 gotowe ✅

Działa end-to-end: `źródło → parser → Postgres → Next.js`. **Dwadzieścia sześć źródeł, ~15 000 ofert w bazie.**

**Faza 6 nie potrzebowała puli Playwrighta.** Plan zakładał Chromium dla `master1`, `spotawheel`
i `audi.pl` — po sprawdzeniu okazało się, że żadne z nich tego nie wymaga ani nie da się tym
zdobyć. Szczegóły w [PLAN.md, sekcja 15](PLAN.md).

### Oferty ze stałą ceną (`offerKind: fixed`)

| Źródło | Sposób | Ofert | VIN |
|---|---|---|---|
| `bmw` (BMW Premium Selection) | sitemap + `METADATA.vehicle` | 1779 | 100% |
| `skoda` (Škoda Plus) | JSON API znalezione przez `sniff` | 943 | 100% |
| `toyota` (Toyota Pewne Auto) | listing + mikrodane `itemprop` | ~5 900 | 100% |
| `renault` (Renault Selection) | listing + JSON-LD `@type=Car` | 1292 | rzadko |
| `mauto` (mLeasing / mBank) | `POST /api/Offers/AfterLease` | 615 | brak |
| `mercedes` (MB Certified) | kafelki listingu (SSR) | 440 | brak |
| `carefleet` (Credit Agricole) | listing + tabela "Dane pojazdu" | 149 | 100% |
| `mhc` (MHC Mobility, d. Athlon) | listing ASP.NET + postback `__VIEWSTATE` | 62 | 100% |
| `bravoauto` (Inchcape) | **render listingu** + JSON-LD z detalu | ~430 | 100% |
| `otomoto` (sklepy leasingodawców) | `__NEXT_DATA__` z `/inventory?page=N` | 435 | brak (szyfrowany) |
| `arval` (Arval AutoSelect) | publiczne JSON API | 294 z 635 | 100% |
| `alphabet` (BMW Group) | publiczne JSON API | 223 | 100% |
| `vwfs` (VW Financial Services) | `__NEXT_DATA__` z listingu | 186 z 285 | 100% |
| `automarket` (PKO Leasing) | sitemap + JSON-LD | 9431 (2276 z ceną) | 100% |
| `ayvens` (LeasePlan/ALD) | sitemap + JSON-LD + tabela detalu | ~410 z 739 | 100% |
| `volvo` (Volvo Selekt) | JSON API Codeweavers (token gościa) | 1131 z 1228 | 100% |
| `skyselection` (Mazda) | listing + detal, osobna domena od `mazda.pl` | 340 | częsty |
| `cupra` (CUPRA Approved) | JSON API VTP, partycja dealer→model | 126 | brak |
| `seat` (SEAT Das WeltAuto) | j.w., ten sam kod (`vtp.ts`) | 91 | brak |

### Aukcje (`offerKind: auction`)

| Źródło | Sposób | Ofert | Uwaga |
|---|---|---|---|
| `poleasingowe` (EFL + Pekao + Millennium) | listing + tabela detalu | 480 | ceny netto → brutto ×1,23 |
| `autoprzetarg` (Alior, Velo, Santander, BNP, ING) | karty listingu | 111 | VIN na karcie, detal zbędny |
| `famataukcje` (VEHIS, Impuls, Siemens, Velo…) | listing + tabela "Dane pojazdu" | 71 | **9 sprzedających** |
| `cararena` (Santander/EFL) | kafelki listingu | 229 | ma termin zakończenia aukcji |
| `dawro` | bloki na stronie aukcji | 6 | mały wolumen |
| `pkoaukcje` (PKO Leasing) | listing + okruszki + inline JS `auction{}` | 60 z 62 | brutto i termin licytacji gotowe u źródła |
| `leasygroup` (VB Leasing, d. Idea Getin) | **sitemap** — listing kategorii zabroniony w robots | 36 z 268 | reszta to maszyny i naczepy |

### Odrzucone

| Źródło | Powód |
|---|---|
| `vehis.pl` (bezpośrednio) | jedyna ścieżka do danych to `/api/announcement/`, **zabroniona w robots.txt**. Ich auta zbieramy jednak przez `famataukcje` **oraz `otomoto`** — VEHIS wystawia je sam w obu miejscach, gdzie `robots.txt` zezwala |
| `aukcjabmwfs.pl` | platforma B2B, brak publicznej listy — tylko po zalogowaniu |
| `carmarket.ayvens.com` | j.w. |
| `alphabet-used-cars.pl` | j.w. (platforma BCA) |
| `master1.pl` (Masterlease) | **już mamy** — WAF oddaje 403 też prawdziwej przeglądarce, ale okazało się to bez znaczenia: te same auta stoją na `automarket.pl`, który zbieramy od Fazy 1. Strona oferty mówi wprost „Auto należy do Masterlease" |
| `spotawheel.pl` | technicznie otwarty (zwykły HTTP, aplikacja Inertia oddaje JSON), ale **nie ma czego brać**: `/buy` zwraca 0 aut we wszystkich markach, a `/subscribe` to abonament z ratą miesięczną (`subscription_installment`), nie cena zakupu |
| `audi.pl` (Audi Select :plus) | serwis oddaje 503 „Site currently not available" także prawdziwej przeglądarce — i landing programu, i wyszukiwarka. Audi nie ma też własnego prefiksu w VTP grupy VW (sprawdzone) |
| `volvocars.com/pl` | landing marki bez inwentarza — realne oferty są na `selekt.volvocars.pl`, które **mamy** jako `volvo` |
| `auto.pekaoleasing.com.pl` | sprzedaje auta **nowe** przy finansowaniu Pekao, nie poleasingowe (payload ma `productionYear`, nie ma przebiegu) |
| `99rent.pl`, `panek.eu` | brak publicznej listy aut na sprzedaż (99rent ma stronę poglądową, domena Panka wygasła) |
| `used-cars.kia.eu` | robots.txt ma `Disallow: /` dla całej domeny — Nuxt SPA (shell pusty, `data-ssr="false"`), więc i tak wymagałoby to Playwrighta. Nie obchodzimy zakazu |
| `hyundai.com/pl/pl/samochody-uzywane`, `ford.pl` (Ford Używane) | brak scentralizowanego inwentarza — to landing programu certyfikacji, realne oferty żyją rozproszone na dziesiątkach mikrostron dealerskich (autoplaza.pl, germaz.pl…), bez wspólnego API czy sitemapy |
| `spoticar.pl` (Stellantis) | **odmawia też prawdziwej przeglądarce** — sprawdzone Playwrightem: „Access Denied". Wejście wymagałoby obejścia zabezpieczeń |
| `sixt.pl` (bezpośrednio) | challenge Cloudflare także dla Chromium — ale **auta i tak mamy**: Sixt sprzedaje jako Eurorent na własnym sklepie Otomoto, który jest w pełni publiczny (12 ofert, adapter `otomoto`) |
| `athlon.com/pl/samochody-poleasingowe` | własna strona nie ma inwentarza — kieruje na `athlon.otomoto.pl`, a **ten sklep zbieramy** adapterem `otomoto`. `athlonstock.pl` wygasła i jest domeną parkingową |
| `placpoleasingowy.pl` (Raiffeisen Leasing) | domena przekierowuje na `aukcje.pkoleasing.pl` — platforma została przejęta/scalona, patrz `pkoaukcje` niżej |
| `inglease.pl` (ING Leasing) | **już mamy** — ING sprzedaje wyłącznie przez partnerów: Poleasingowe.pl i Auto-Przetarg, oba w rejestrze. Własny adapter byłby duplikatem |
| `uzywane.lexus-polska.pl` | **już mamy** — to ta sama platforma co Toyota Pewne Auto (assety z `panel.pewneauto.pl`), a `pewneauto.pl` wystawia 979 Lexusów przy 859 na stronie marki. Adapter `toyota` zbiera je od dawna (601 sztuk w bazie) |
| `nissan.pl`, `honda.pl`, `suzuki.pl`, `mitsubishi` | strony programów bez własnego inwentarza: żadnych linków do ofert, iframe'a ani API. Mitsubishi nie ma nawet strony aut używanych (404) |
| `volkswagen.pl` (certyfikowane używane) | konfiguracja wyszukiwarki wskazuje na **niemiecki** VTP (`vtpapi.volkswagen.de`, prefiksy `vwdeb`/`vwdenfz`) — polskiego stocku VW tam nie ma. Auta VW zbieramy przez `vwfs`, a program Das WeltAuto przez `seat`/`cupra`/`skoda` |

### Poddomeny `*.poleasingowe.pl` to ten sam magazyn — sprawdzone, nie zgadywane

Pekao, Millennium i EFL kierują swoje „przedmioty poleasingowe" na własne poddomeny
tej samej platformy. Kusi, żeby dorobić adapter per firma. **Nie ma po co:**
porównanie identyfikatorów aukcji z pełnym crawlem domeny głównej dało
52/52 dla Pekao i 6/6 dla Millennium — wszystko już mamy.

Uwaga na pułapkę: poddomeny `millennium.` i `efl.` (bez pełnej nazwy) **istnieją, ale
zwracają zwykłą stronę główną** z ośmioma pozycjami promocyjnymi — identyczną dla obu.
Wcześniejszy wniosek „Millennium nie da się pobrać" wziął się właśnie z odpytania
takiej atrapy; prawdziwa poddomena to `millenniumleasing.`.

| Element | Stan |
|---|---|
| Baza + historia cen + zdarzenia | ✅ Postgres 16 + Drizzle |
| Front: kafelki, filtry, filtr źródła i rodzaju, paginacja | ✅ Next.js 15, klik → oryginalna oferta |
| Harmonogram | ✅ launchd co 10 min |
| Zestawianie tej samej sztuki po VIN | ✅ pokazuje różnicę cen między kanałami |
| Wycena i deal score | ✅ koszyk kontrolowany, 400 koszyków |
| Strona źródeł — zdrowie adapterów | ✅ `/zrodla` |
| Historia pojazdu (VIN, nr rej., data 1. rejestracji) | ✅ komplet do CEPiK |
| Alerty Telegram | ⏳ świadomie pominięte |

### Oferty bez ceny są widoczne, ale podpisane

Automarket sprzedaje ~7 tys. aut **wyłącznie w leasingu albo pożyczce** — dla nich
`/zakup` zwraca 404 i cena gotówkowa po prostu nie istnieje. Trafiają do bazy
z `priceGross: null` i front je pokazuje, ale z etykietą „cena na zapytanie"
i podpisem „tylko leasing lub najem". Nie „—", bo to wyglądałoby na dziurę
w danych zamiast na cechę oferty.

Dwie konsekwencje w zapytaniach, obie celowe:

- **Sortowanie po cenie ma jawne `NULLS LAST`.** Bez tego Postgres przy `DESC`
  stawia NULL-e na początku i „najdroższe" zaczynałyby się od aut bez ceny.
- **Filtr ceny wycina je sam** — `null <= x` daje w SQL NULL, nie TRUE. Skoro ktoś
  szuka „do 80 tys.", auto bez podanej ceny nie jest odpowiedzią na to pytanie.

Nie da się ich wycenić, więc do deal score z Fazy 3 nie wejdą. Wartość mają przez
zestawianie po VIN (ta sama sztuka bywa gdzie indziej z ceną „kup teraz") i przez
sygnał „zniknęło = sprzedane".

### Wycena: koszyk bez kontroli przebiegu to wykrywacz wysokiego kilometrażu

Mediana liczona po samych `marka + model + rocznik` **nie jest wyceną**. Sprawdzone
na tej bazie: taki koszyk wskazał 838 „okazji", a ich czołówka miała 99, 149 i 222 tys. km.
Auto było tańsze, bo zajeżdżone — nie dlatego, że to okazja.

Koszyk zawiera więc dodatkowo **przedział przebiegu (25 tys. km), paliwo i skrzynię**.
Po tej zmianie z 838 rzekomych okazji zostało **188 prawdziwych**, a czołówka to Ford
Focus 2023 z przebiegiem 32 tys. km za 82 800 zł przy medianie 130 750 zł.

Trzy reguły, bez których wycena kłamie:

- **Aukcje wykluczone.** Cena aukcyjna rośnie w czasie i nie jest ceną transakcyjną.
- **Minimum 8 sztuk w koszyku.** Poniżej mediana jest przypadkiem, nie rynkiem —
  wtedy oferta nie dostaje oceny w ogóle. „Brak danych" i „cena rynkowa" to dwie
  różne rzeczy, a mylenie ich jest gorsze niż milczenie.
- **Ceny ofert sprzedanych mają pierwszeństwo.** Gdy koszyk ma ≥5 sztuk ze statusem
  `gone`, mediana liczy się z nich — cena, po której auto zeszło z rynku, jest bliższa
  transakcyjnej niż cena, która wciąż wisi. Dziś takich koszyków nie ma jeszcze ani
  jednego (295 sprzedanych rozkłada się zbyt rzadko), ale liczba rośnie z każdą dobą.

Wycena jest przeliczana osobnym przebiegiem (`pnpm revalue`), **po** zaciągu — mediana
musi widzieć komplet danych, inaczej skakałaby zależnie od tego, które źródła zdążyły
wpaść. Kosztuje ~0,9 s przy 21 tys. ofert, więc chodzi przy każdym przebiegu.

### Duplikatów nie kasujemy — one są najciekawsze

Ta sama sztuka bywa wystawiona w kilku miejscach naraz i **ceny się różnią**.
Przykład z bazy, VIN `WBA11EG0005297078`: BMW X1 2025 stoi u dealera za
189 800 zł „kup teraz", a równocześnie idzie na aukcji poleasingowe.pl za
166 788 zł. Przy BMW 320d xDrive Touring rozjazd sięga **43 551 zł**.

Dlatego łączenie po VIN nie scala rekordów, tylko pokazuje bliźniaka na kafelku.
Z jednym zastrzeżeniem: **jako oszczędność podpisujemy wyłącznie różnicę między
dwiema cenami „kup teraz"**. Gdy tańszy bliźniak jest aukcją, kafelek mówi
„licytacja trwa" i nie obiecuje kwoty — bo bieżąca oferta jeszcze urośnie.

### Aukcje trzeba trzymać osobno od cen stałych

Kolumna `offer_kind` rozróżnia `fixed` od `auction`. To nie kosmetyka: **cena aukcyjna
rośnie w czasie i nie jest ceną transakcyjną**. Gdyby model wyceny uczył się na niej
tak samo jak na cenach „kup teraz", zaniżałby wartość rynkową — bo aukcja złapana
w połowie licytacji wygląda na okazję, którą nie jest.

### Ayvens i PKO Leasing aukcje — dwa nowe źródła, dwie różne pułapki

**Ayvens** (`usedcars.ayvens.com`, fuzja LeasePlan + ALD) to NIE ten sam adres co
`carmarket.ayvens.com` odrzucony wcześniej — tamten to platforma aukcyjna B2B za
logowaniem, ten to zwykły sklep (Salesforce Commerce Cloud) dostępny bez logowania,
z sitemapą per kraj wskazaną wprost w `robots.txt`. Cena w JSON-LD to brutto
(strona dopisuje „Zawiera 23% VAT" obok), a specyfikacja — łącznie z VIN-em — siedzi
w czytelnych `<div class="detail-container X">` na stronie oferty. Jedna pułapka:
`robots.txt` blokuje `*vehicle-master-catalog*` (zdjęcia) ogólnie, ale jawnie
odblokowuje wariant `sw=400` — miniaturę trzeba wymusić na ten format zamiast brać
adres, który ładuje strona.

**Aukcje PKO Leasing** (`aukcje.pkoleasing.pl`) znalazły się przez martwy trop:
domena Raiffeisen Leasing (`placpoleasingowy.pl`) przekierowuje dziś na ten adres —
platforma została przejęta lub scalona. Okazało się, że to ten sam silnik co
`poleasingowe.pl` (identyczne `/auctions/list/pub/all/vehicles`, te same kody
`ecr_*`), ale inny host i inny inwentarz PKO Leasing, nie duplikat. Różnica:
tu „Aktualna cena" w HTML-u jest pusta — renderuje ją Alpine.js (`x-text`) z
inline `<script>`, w którym obiekt `auction: {...}` niesie już gotowe
`current_price_brutto` i `endDateTimer` (termin końca licytacji), więc adapter nie
musi liczyć VAT-u ręcznie jak `poleasingowe.ts`. Druga pułapka: marka i model NIE
są w tabeli danych pojazdu, tylko w okruszkach nawigacji — a dla rzadkich modeli
(Mercedes-Maybach, Mazda MX-30 w próbce) okruszki kończą się na marce bez poziomu
modelu, więc adapter dokłada `splitMakeModel()` na nagłówku H1 jako zapasową ścieżkę.

### Das WeltAuto: jedna marka, jedno API, dwa różne kody rynku

SEAT i CUPRA korzystają ze wspólnej wyszukiwarki stocku grupy VW (`vtpapi.seat.com`),
więc oba adaptery to jeden plik (`vtp.ts`) różniący się konfiguracją. Dwie pułapki
kosztowały po kilkanaście prób każda:

1. **Filtry idą jako parametry macierzowe, nie query.** `search/car;t_model=X` działa,
   `search/car?t_model=X` jest po cichu ignorowane — API oddaje wtedy pełną listę
   i wygląda to na działający filtr, dopóki nie sprawdzi się `selectedItems` w odpowiedzi.
2. **Nie ma paginacji.** Endpoint zawsze zwraca 10 pierwszych aut i ignoruje każdy znany
   parametr stronicowania. Komplet da się złożyć wyłącznie przez partycjonowanie: pytamy
   per dealer (`t_partner`), a dealerów z więcej niż dziesięcioma sztukami tniemy jeszcze
   po modelu. Odpowiedź sama podaje liczności w `possibleItems`, więc wiadomo z góry,
   które kubełki wymagają podziału.

Wolumen jest mały (91 + 126), ale koszt utrzymania też: ~25 żądań na markę.

### Volvo Selekt wymaga tokenu — i to nie jest obchodzenie zabezpieczeń

Sklep stoi na platformie Codeweavers i każde zapytanie do API potrzebuje nagłówka
`x-cw-customertoken`. Token wydaje `POST /guest/initialise/proposal` na podstawie
**publicznego klucza wpisanego na stałe w bundlu Angulara** — dokładnie tak, jak robi
to przeglądarka każdego odwiedzającego. Losowy GUID dostaje 401, więc tokenu nie da się
zmyślić; adapter bierze go raz na przebieg. Żadnego logowania ani paywalla tu nie ma.

### leasyGROUP: sitemapa zamiast zabronionego listingu

`robots.txt` VB Leasingu zabrania listingów kategorii (`/aukcje/…/widok-lista/*`
i `widok-siatka/*`, przepuszczając tylko `strona-1`), ale sitemapa i strony `/aukcja/`
są dozwolone — więc discovery idzie sitemapą, tak samo jak przy BMW. Serwis sprzedaje
głównie maszyny: z 268 aukcji osobówek jest 36, resztę odsiewamy po okruszku „Osobowe".

Do tego jego host kanoniczny **serwuje niepełny łańcuch TLS** (brakuje pośredniego CA
Certum). Przeglądarka i curl dobierają go same przez AIA, Node tego nie robi i kończy
na `UNABLE_TO_VERIFY_LEAF_SIGNATURE`. Dokładamy więc sam certyfikat pośredni
(`scripts/certs/`, wyciągnięty z `aukcje.vbleasing.pl`, który podaje pełny łańcuch)
przez `NODE_EXTRA_CA_CERTS`. To **nie** jest wyłączenie weryfikacji — podpis nadal musi
się zgadzać aż do zaufanego korzenia.

### Dlaczego Vehis i BMW wyglądają podobnie, a skończyły inaczej

Oba mają wygodne JSON API zabronione przez `robots.txt`. Różnica: BMW udostępnia
**alternatywną, dozwoloną drogę** — sitemapę pojazdów i strony `opis-szczegolowy`
renderowane serwerowo, więc adapter korzysta z nich i nie dotyka `/uzywane/api`.
Vehis takiej drogi nie ma — oferty nie są w sitemapie, a strony marek to pusty shell.
Dlatego BMW weszło, a Vehis nie.

---

## Wszystko działa za darmo

| Warstwa | Rozwiązanie | Koszt |
|---|---|---|
| Baza | Postgres 16 z Homebrew (lokalnie) | 0 zł |
| Baza (produkcja) | Neon free tier — 0,5 GB | 0 zł |
| Harmonogram | launchd na Macu | 0 zł |
| Front | Next.js lokalnie → Vercel Hobby | 0 zł |
| Alerty | Telegram Bot API | 0 zł |
| Zdjęcia | hot-link do źródła, **nic nie hostujemy** | 0 zł |

Trzy decyzje, które utrzymują zerowy koszt:

1. **Nie przechowujemy zdjęć** — tylko URL. Storage to główny generator kosztu
   przy 10 tys. ofert; miniatury serwuje źródło, my linkujemy.
2. **Zwykły `<img>`, nie `next/image`** — optymalizacja obrazów na Vercelu ma
   płatny limit, a zdjęcia i tak są zewnętrzne.
3. **Brak Redisa i płatnych proxy** — kolejka niepotrzebna przy jednym źródle,
   a zamiast proxy stosujemy etykietę: własny User-Agent z kontaktem, limit
   1,2 s na żądanie, backoff na 429/503.

**Dlaczego launchd, a nie GitHub Actions:** cron w Actions ma minimalny odstęp
5 minut i bywa opóźniany o kilkanaście minut przy obciążeniu. Dla snipera, który
ma trafić w ofertę w ~60 s, to dyskwalifikacja. Lokalnie jest za darmo i bez limitu minut.

---

## Uruchomienie

```bash
# 1. Baza (Postgres z Homebrew juz dziala na 5432)
createdb auta
cp .env.example .env          # DATABASE_URL wskazuje na localhost:5432/auta

# 2. Zaleznosci i schema
pnpm install
cd packages/db && pnpm exec drizzle-kit push --force && cd ../..

# 3. Pierwszy zaciag danych
pnpm scrape --source automarket --limit 150

# 4. Front
pnpm web                       # http://localhost:3005
```

### Komendy

```bash
pnpm scrape                            # wszystkie zrodla, limit 300
pnpm scrape --source automarket --limit 50
pnpm scrape --dry-run --limit 3        # bez zapisu do bazy
pnpm inspect --source automarket --n 3 # podglad sparsowanych pol
pnpm web                               # Next.js na :3005

# Rozpoznanie zrodla, ktore renderuje liste dopiero w przegladarce:
pnpm --filter @auta/worker sniff https://mauto.pl/samochody-poleasingowe --match Offers
pnpm --filter @auta/worker sniff <url> --links   # wzorzec adresu oferty
```

### Harmonogram — raz dziennie w GitHub Actions

Zaciąg chodzi w chmurze (`.github/workflows/scrape.yml`), codziennie o 03:00 UTC.
Można go też odpalić ręcznie z zakładki Actions, opcjonalnie na jednym źródle.

```bash
gh workflow run "Zaciag ofert"                      # wszystko
gh workflow run "Zaciag ofert" -f source=volvo      # jedno źródło
```

**Dlaczego raz dziennie, a nie co 10 minut jak zakładał pierwotny plan.**
Cykl dziesięciominutowy rozwiązywał problem, którego nie ma — auta nie kupuje się
w dziesięć minut. Pomiar pokazał zresztą, że *„co 10 minut" i tak było fikcją*:
pełny przelot przez 26 źródeł trwa **23,7 minuty**, więc blokada zamieniała
harmonogram w pętlę ciągłą. Większość tego czasu to celowe 1,2 s odstępu na
żądanie — higiena wobec źródeł, której nie da się skrócić bez bycia niegrzecznym.

Dobowy przebieg to ~710 min miesięcznie przy darmowym limicie 2000, więc repo
zostaje **prywatne** i nie ma żadnej maszyny do utrzymania.

Odrzucone alternatywy:

| Rozwiązanie | Powód odrzucenia |
|---|---|
| launchd na Macu | działa tylko gdy komputer jest wybudzony |
| Vercel Cron (Hobby) | limit: raz dziennie i **60 s** na funkcję; przebieg trwa 24 min |
| Repo publiczne dla darmowych minut | kod 26 adapterów publicznie to zaproszenie, żeby źródła zaczęły się bronić |

Wycena (`pnpm revalue`) leci w tym samym zadaniu, **po** zaciągu — mediana musi
widzieć komplet danych. Krok podsumowania wypisuje tabelę „źródło → aktywne → nowe"
do podsumowania przebiegu i oznacza źródła, które nie mają ani jednej oferty.
Bez tego cichy zgon adaptera przechodzi niezauważony: przebieg kończy się sukcesem,
tylko oferty przestają dochodzić.

---|---|---|---|
| `com.auta.scraper` | co 10 min | 12 na źródło | wykrycie **nowych** i **zniknięć** |
| `com.auta.deep` | 3:15 | bez limitu | odświeżenie **cen** wszystkich ofert |

**Dlaczego dwie, a nie jedna.** Przy 26 źródłach jeden przebieg z limitem 250 to
~6,5 tys. żądań, czyli ~2 h — a launchd próbowałby go odpalać co 10 minut. Szybki
przebieg celuje wyłącznie w `discover`, bo to on wykrywa nowe i sprzedane sztuki;
detale nowych ofert i tak trafiają na początek kolejki, więc 12 wystarcza.

Oba joby dzielą blokadę (`/tmp/auta-scraper.lock`, `mkdir` zamiast `flock`, którego
macOS nie ma), więc głęboki przebieg nigdy nie zejdzie się z szybkim. Zamek po
ubitym procesie jest przejmowany po sprawdzeniu, czy właściciel żyje.

**Mac musi być wybudzony** — launchd sam go nie budzi. Jeśli ma działać w nocy:

```bash
sudo pmset repeat wakeorpoweron MTWRFSU 03:10:00
```

---

## Struktura

```
packages/core      typy + normalizacja (paliwo, skrzynia, VIN, liczby)
packages/db        schema Drizzle: sources, listings, listing_snapshots, events
packages/scrapers  silnik HTTP + adaptery zrodel
apps/worker        pipeline: discover → fetch → parse → persist → diff
apps/web           Next.js: kafelki + filtry
```

### Dodanie nowego źródła

Implementujesz `SourceAdapter` (~120 linii) i dopisujesz do rejestru w
`packages/scrapers/src/index.ts`. Silnik — limity, retry, backoff, upsert,
historia cen, wykrywanie zniknięć — jest wspólny i nic o źródle nie wie.

**Kolejność rozpoznania**, od najtańszego w utrzymaniu:

1. **Publiczne JSON API** (Alphabet, Arval) — poszukaj adresu w bundlu JS:
   `grep -oE 'https?://[^"]*api[^"]*' bundle.js`. Najstabilniejsze, zero parsowania HTML.
   Jeśli strona jest SPA i adresu nie widać, **nie zgaduj — podsłuchaj**:
   `pnpm --filter @auta/worker sniff <url>` otwiera ją w Chromium i wypisuje
   odpowiedzi JSON, o które prosi sama. Tak znaleźliśmy Škodę i mAuto — oba API
   okazały się zwykłymi zapytaniami, więc adaptery chodzą po czystym HTTP.
2. **`__NEXT_DATA__` / `__NUXT_DATA__`** (VW FS) — gotowy stan strony w JSON.
   Uwaga: kolejność atrybutów `<script>` bywa różna, użyj `extractNextPageProps()`.
3. **JSON-LD** (Automarket) — `extractJsonLd()`, ale sprawdź kompletność: u VW FS
   JSON-LD miał `price: 0` i brak VIN-u, mimo że `__NEXT_DATA__` obok miał komplet.
4. **Parsowanie DOM** — ostateczność, najbardziej kruche.

**Zanim napiszesz parser, sprawdź trzy rzeczy:**

- **Czy cena to na pewno cena auta, a nie rata?** Sprawdź rozkład wartości. Jeśli
  widzisz kwoty czterocyfrowe obok sześciocyfrowych — masz zmieszane raty z cenami.
- **Czy `robots.txt` pozwala na ścieżkę, z której bierzesz dane?** Jeśli jedyne API
  jest zabronione (Vehis), źródło odpada — nie obchodzimy tego.
- **Jaki jest publiczny URL oferty?** Kafelek ma prowadzić do źródła. Niektóre API
  podają go wprost (`offerUrl` u Arvala), przy innych trzeba złożyć slug.

Jeśli `discover()` już pobrał komplet danych, przenieś je przez `ListingRef.payload`
do `parse()` zamiast pobierać drugi raz.

---

## Czego nauczyły nas dane

**Pułapka „rata zamiast ceny" jest wszędzie.** Każde źródło miesza ceny gotówkowe
z ratami leasingu/najmu i każde wymaga jawnego filtra — inaczej do bazy trafiłyby
kwoty rzędu 1500 zł obok 150 000 zł i model wyceny z Fazy 3 byłby bezużyteczny:

| Źródło | Filtr |
|---|---|
| Automarket | cenę bierzemy **wyłącznie** z wariantu `/zakup`; auta bez niego wchodzą z `priceGross: null`, nigdy z ratą |
| Arval | `purchaseOption === "sale"` — 341 z 635 to re-leasing |
| VW FS | pomijamy `isSold` i `inPreparation` |
| mAuto | `TotalPrice*`, nigdy `LeasePrice` ani `RentPriceNetto` (to raty miesięczne) |

**Ta sama marka bywa nazywana inaczej w każdym źródle.** BMW podaje `VW`, Alphabet
`Škoda`, Arval `Skoda`, ktoś inny `MERCEDES-BENZ`. Bez ujednolicenia filtr „Volkswagen"
gubiłby część aut, a przyszły dedup po VIN-ie nie połączyłby tych samych egzemplarzy.
`normalizeMake()` dopasowuje aliasy **ignorując diakrytyki**; `normalizeModel()` rusza
tylko zapisy w całości kapitalikami i zostawia w spokoju tokeny z cyfrą (`XC60`),
krótkie akronimy (`EQB`) i liczby rzymskie (`GOLF VIII`) — każdy z nich `titleCase`
by zepsuł.

**Cicha utrata danych to najgroźniejszy rodzaj błędu w scraperze** — przebieg kończy
się komunikatem „0 błędów", a połowy ofert po prostu nie ma. Trafiłem na trzy warianty:

| Objaw | Przyczyna | Skala |
|---|---|---|
| CarArena miała 79 ofert zamiast 229 | stop na pierwszej stronie bez nowości, a oferty renderują się dwukrotnie | −65% |
| Toyota miała 2 791 zamiast 5 976 | `catch { break }` — jeden timeout w połowie ~300 stron ucinał resztę | −53% |
| Renault zaciągnął 0 i zgłosił sukces | `--dry-run` zapisywał `lastDiscoverAt`, więc prawdziwy przebieg pominął discovery przy pustej bazie | −100% |

Stąd trzy reguły w silniku: przerywamy dopiero po **trzech** pustych stronach z rzędu,
po **trzech** błędach pobrania z rzędu, a `--dry-run` nie dotyka bazy **w ogóle**
(łącznie z tabelą `sources`). Do tego dławienie discovery nie działa, gdy źródło jest
puste — pierwszy zaciąg zawsze musi odkrywać.

**Warto porównywać własne liczby z tym, co deklaruje serwis.** Tak wyszły dwa z tych
błędów: strona Toyoty pisze „5976 ofert", Renault „1290 dostępnych samochodów",
a sitemapa BMW ma 1783 wpisy przy 1779 w bazie.

**Paginacja: nie przerywaj na pierwszej stronie bez nowych ofert.** CarArena renderuje
każdą ofertę dwa razy (wariant desktop i mobile) i kroczy offsetem 9, więc pojedyncza
strona potrafi w całości pokryć się z poprzednią w środku listy. Warunek „brak nowości
= koniec" ucinał zaciąg przedwcześnie — **79 ofert zamiast 229**. Teraz wszystkie
adaptery przerywają dopiero po trzech pustych stronach z rzędu.

**Parser to za mało — poprawka musi mieć jak dotrzeć do bazy.** Upsert długo
aktualizował tylko cenę i przebieg, więc naprawa marki nie zmieniała już zapisanych
wierszy: dane zostawały błędne aż do skasowania rekordu. Objawiło się to jako
„BMW T-Roc", które nie znikało mimo poprawnego parsera. `onConflictDoUpdate` zapisuje
teraz **wszystkie** pola z parsera poza `firstSeenAt`.

**U VW FS cena gotówkowa jest wyższa niż eksponowana.** `totalPriceBrutto` zakłada
finansowanie; przy gotówce dochodzi `amountOfIncreaseCashPrice`. Adapter zapisuje
`finalTotalPriceBruttoForCash` — inaczej porównanie z innymi portalami byłoby zaniżone
(w zbadanym przykładzie 96 900 zł vs realne 99 900 zł).

**Sitemap VW FS jest bezużyteczny** — wystawia głównie oferty „w przygotowaniu"
z zerową ceną i bez zdjęć. Adapter chodzi po `/oferty?strona=N`.

**VIN jest przy 100% ofert we wszystkich czterech źródłach**, co uczyni deduplikację
międzyportalową w Fazie 3 trywialną. pHash zdjęć zostaje jako zapas dla źródeł bez VIN-u.

## Higiena scrapowania

Publiczne listingi, do własnego użytku. Respektujemy `robots.txt`, nie omijamy
logowania ani paywalli, nie ruszamy paneli licytacyjnych za autoryzacją.
Limit 1,2 s na żądanie z jitterem, wykładniczy backoff na 429/503, User-Agent
z adresem kontaktowym.
