# Sniper aut poleasingowych — plan architektury

Cel: system, który co kilka minut przeczesuje portale z autami poleasingowymi/pokontraktowymi,
normalizuje oferty do wspólnego formatu, wycenia je względem rynku i **pushuje alert w < 60 s**
od pojawienia się okazji. Front w Next.js jako panel przeglądowy + konfigurator alertów.

---

## 0. Stan źródeł — wynik rekonesansu (2026-08-05) ✅ ZAMKNIĘTE

Przeskanowałem wszystkie domeny z listy, a dla martwych adresów ustaliłem aktualne.
**Faza 0 jest wykonana — poniższa tabela to gotowy rejestr źródeł do zaimplementowania.**

### ✅ Działa, łatwe (HTTP + parser, bez przeglądarki)

| Źródło | Stack | Punkt wejścia | Uwagi |
|---|---|---|---|
| `automarket.pl` (PKO Leasing) | Nuxt | `media/sitemap/sitemap_usedcars.xml` | **Zacznij tutaj.** Sitemap aktualny, największy wolumen, zero obrony. |
| `store.vwfs.pl` (VW FS) | Next.js | `/sitemap.xml` | `__NEXT_DATA__` w HTML → gotowy JSON oferty, bez parsowania DOM. |
| `vehis.pl` | Nuxt | `/sitemap_index.xml` | robots blokuje `/api/announcement/` — chodzimy po stronach, nie po tym API. |
| `autoselect.arval.pl` | SSR | paginacja listingu | robots **blokuje wszystkie URL-e z filtrami** (`?makes=`, `?priceMin=`…). Tylko czysta paginacja. |
| **`poleasingowe-api.alphabet.pl`** (Alphabet/BMW) | **JSON API** | REST | 🎯 **Najlepsze źródło.** Front `poleasingowe.alphabet.pl` to Angular SPA (shell 3,8 kB), ale backend to czyste JSON API wyciągnięte z bundla. Zero parsowania HTML. |
| **`certified.mercedes-benz.pl`** (MB Certified) | SSR, 835 kB | `/vehiclesearch`, `/vehicles` | robots **jawnie zezwala** na `/vehiclesearch` i `/vehicles`. Zielone światło. |
| **`najlepszeoferty.bmw.pl`** (BMW Premium Selection) | SSR | `/uzywane/bmw-premium-selection` | Oficjalna giełda BMW (`bmwcs-boerse.cloudpowered.services`). |
| **`aukcjabmwfs.pl`** (BMW Financial Services) | ASP.NET | `/BMW_PremiumSelection.aspx` | Bonus, nie było na Twojej liście — aukcje BMW FS. |
| `cararena.pl` (EFL/Santander) | SSR | `/sitemap/sitemap-listings.xml` | `lastmod` z 2020 — sitemap może być zapleśniały, zweryfikować pokrycie. |
| **`dawro.pl`** | SSR | listing | Bonus — druga platforma aukcyjna Santandera obok CarArena. |

### ~~🎯 Kluczowe odkrycie: `poleasingowe.pl` jest multi-tenant~~ ❗ BŁĄD, SPROSTOWANY

**Ta teza była nieprawdziwa — patrz sekcja 12.** Opierała się na zliczeniu surowych
wystąpień `auctions/details` w HTML (30/8/8), a te liczby obejmowały linki promocyjne
z homepage, nie filtrowany listing.

Weryfikacja przy budowie adaptera pokazała, że `millennium.` i `efl.` nie mają
filtrowanej listy — zwracają stronę w stylu homepage. Adapter chodzi po domenie głównej
(`/pl/auctions/list/pub/all/vehicles?page=N`, ~850 aukcji). Millennium jako osobne
źródło pozostaje nieobsłużone.

Panel licytacyjny (`/bidder-panel/*`) jest za loginem i w robots disallow → poza automatem.

### ~~⚠️ Działa, ale broni się (wymaga Playwright / stealth)~~ ❗ ZWERYFIKOWANE W FAZIE 6

**Ta tabela okazała się w dwóch trzecich myląca — patrz sekcja 15.** Powstała na podstawie
odpowiedzi dla `curl`, a te nie mówią, czy źródło w ogóle ma dane warte zabrania.

| Źródło | Pierwotna diagnoza | Co pokazał test prawdziwą przeglądarką |
|---|---|---|
| `master1.pl` (Masterlease) | WAF blokuje po nagłówkach | 403 potwierdzone, ale **nieistotne**: te same auta są na `automarket.pl`, który zbieramy od Fazy 1 |
| `spotawheel.pl` | Cloudflare challenge | **Błąd.** Żadnego challenge'u — to była domena apex przekierowująca na `www`. Serwis oddaje JSON zwykłym HTTP, tylko ma **0 aut** na sprzedaż |
| `www.audi.pl` (Audi select:plus) | 503 przez Akamai | 503 potwierdzone również dla Chromium, na landingu i w wyszukiwarce |
| `carmarket.ayvens.com` | platforma B2B za loginem | bez zmian — ale detaliczny odpowiednik `usedcars.ayvens.com` **mamy** jako `ayvens` |

### 🔒 Za loginem B2B — poza zakresem automatu

| Źródło | Uwaga |
|---|---|
| `alphabet-used-cars.pl` | CNAME → `appl-peep.bca.com` — platforma aukcyjna BCA, wyłącznie dla firm handlujących autami. Retailowy odpowiednik to `poleasingowe.alphabet.pl` (już mamy, tabela wyżej). |
| `scmultirent.pl/aukcje-poleasingowe/` (Car&More) | Marka Car&More wygaszona — `carandmore.pl` nie ma DNS. Santander Consumer Multirent kieruje ruch na **CarArena i Dawro**, które już pokrywamy. |

### ❌ Nieistniejące hosty z pierwotnej listy — zastąpione

Brak rekordu A w Google DNS **i** Cloudflare DNS (lokalny resolver zweryfikowany jako sprawny):

| Martwy adres | Zastąpiony przez |
|---|---|
| `uzywane.alphabet.pl` | `poleasingowe-api.alphabet.pl` (JSON API) |
| `uzywane.bmw.pl` | `najlepszeoferty.bmw.pl` + `aukcjabmwfs.pl` |
| `uzywane.mercedes-benz.pl` | `certified.mercedes-benz.pl` |
| `carandmore.pl` | CarArena + Dawro (Santander) |
| `aukcje.millennium-leasing.pl` | `millennium.poleasingowe.pl` |
| `sc.audi.pl` | `www.audi.pl/pl/samochody-uzywane-audi/` (za Akamai → Playwright) |
| `uzywane.carefleet.pl` | brak następcy — żyje tylko `carefleet.pl/pl/`, **wymaga ręcznego sprawdzenia**, czy w ogóle prowadzą sprzedaż online |

**Bilans:** z 16 źródeł 10 wchodzi ścieżką HTTP (w tym jedno jako gotowe JSON API),
4 wymagają Playwrighta, 2 są za loginem B2B. Jedno źródło (Carefleet) pozostaje do ustalenia.

---

## 1. Architektura

Monorepo pnpm — front i worker dzielą typy oraz warstwę bazy.

```
auta/
├── apps/
│   ├── web/            # Next.js 15 App Router — panel + alerty
│   └── worker/         # Node/TS — scheduler, scrapery, pipeline
├── packages/
│   ├── db/             # Drizzle ORM: schema + migracje + klient
│   ├── core/           # normalizacja, dedup, wycena, scoring, typy
│   └── scrapers/       # adaptery per źródło
└── docker-compose.yml  # Postgres 17 (+ opcjonalnie Redis)
```

**Dlaczego worker osobno, a nie route handlery w Next?**
Scrapowanie to długie taski z retry, pulą przeglądarek i limitami per-domenę. W serverless
route handlerze to się rozjedzie przy pierwszym timeoucie. Next zostaje czystym UI + API do odczytu.

### Kolejka: `pg-boss`, nie BullMQ

`pg-boss` trzyma kolejkę w Postgresie, który i tak masz. Zero Redisa, zero drugiego kontenera,
cron wbudowany. BullMQ ma sens dopiero przy tysiącach jobów/s — tu masz kilkaset na godzinę.

---

## 2. Pipeline — 6 etapów

```
discover → fetch → parse → normalize → persist+diff → score+alert
```

1. **Discover** — z sitemapy / API listingu / paginacji HTML wyciągamy `ListingRef { sourceId, externalId, url }`
2. **Fetch** — HTTP-first (undici). Playwright tylko gdy adapter deklaruje `strategy: 'browser'`
3. **Parse** — HTML/JSON → `RawListing` (surowe stringi, bez interpretacji)
4. **Normalize** — mapowanie marek/modeli, paliwo, skrzynia, cena netto vs brutto, VAT 23/marża, przebieg, VIN
5. **Persist + Diff** — upsert oferty, snapshot ceny, wykrycie zdarzenia: `NEW` / `PRICE_DROP` / `GONE`
6. **Score + Alert** — deal score → dopasowanie do `watches` → push na Telegram

### Kontrakt adaptera

Cały silnik (retry, rate-limit, proxy, cache) jest wspólny. Per źródło piszesz ~100 linii.

```ts
export interface SourceAdapter {
  id: string;                          // 'automarket'
  strategy: 'http' | 'browser';
  rateLimit: { rps: number; concurrency: number };
  discover(ctx: Ctx): AsyncGenerator<ListingRef>;
  fetchDetail(ref: ListingRef, ctx: Ctx): Promise<RawListing>;
  parse(raw: RawListing): NormalizedListing;
}
```

Regresje pokrywamy **snapshot testami**: zapisany HTML oferty w `fixtures/` + oczekiwany
`NormalizedListing`. Gdy portal zmieni layout, test pada od razu — a nie po tygodniu ciszy w alertach.

---

## 3. Model danych (Postgres + Drizzle)

```
sources             id, name, base_url, strategy, enabled, last_run_at, health
listings            id, source_id, external_id, url, status(active|sold|gone),
                    first_seen_at, last_seen_at, vehicle_id
listing_snapshots   listing_id, price_gross, price_net, mileage, captured_at   ← historia cen
vehicles            id, vin, fingerprint, make, model, trim, year, fuel,
                    gearbox, power_hp, engine_cc, body, first_reg
vehicle_photos      vehicle_id, url, phash                                     ← do dedupu
valuations          model_key, year, mileage_bucket, median_price, n_samples
watches             id, name, filters(jsonb), min_deal_score, channel
alerts              watch_id, listing_id, event, sent_at                       ← dedup powiadomień
```

Indeksy: `pg_trgm` na tytule, GIN na `equipment jsonb`, btree na `(make, model, year, price_gross)`,
oraz `unique (source_id, external_id)` — to jest klucz idempotencji całego pipeline'u.

---

## 4. Deduplikacja — ten sam egzemplarz na 3 portalach

Masterlease trafia na Cararena, EFL na poleasingowe, dealerzy dublują na własne serwisy.
Bez dedupu dashboard będzie w połowie duplikatami. Kaskada, od najpewniejszego:

1. **VIN** — jeśli podany, sprawa zamknięta
2. **Perceptual hash zdjęć** — portale reużywają te same fotki od sprzedawcy.
   pHash pierwszych 3 zdjęć, dystans Hamminga ≤ 6 → ten sam egzemplarz. **To działa najlepiej.**
3. **Fingerprint** — `hash(make, model, year, engine_cc, power, gearbox, first_reg_month)`
   + przebieg w granicach ±2% + cena ±5%

Duplikaty łączymy pod jednym `vehicle_id`, ale trzymamy wszystkie `listings` — różnica cen
między portalami za ten sam egzemplarz to sama w sobie okazja negocjacyjna.

---

## 5. Sniper — jak liczymy okazję

```
deal_score = (predicted_market_price − asking_price) / predicted_market_price
```

**Wycena — dwa etapy, nie od razu ML:**

- **Start (Faza 3):** mediana z koszyka porównywalnych (min. 8 sztuk: ta sama marka/model/rocznik ±1,
  przebieg w tym samym koszyku 25 tys. km, to samo paliwo i skrzynia). Prosto, wystarczy.
- **Później:** regresja `log(price) ~ f(model, year, mileage, fuel, gearbox, power, body)`,
  gradient boosting, gdy uzbierasz ~10 tys. rekordów.

**Krytyczne:** bazę porównawczą buduj z **cen ofert, które zniknęły** (≈ sprzedane), nie z aktualnie
wiszących. Aktualne oferty to ceny życzeniowe — uczenie się na nich zawyża wycenę i wygeneruje
fałszywe okazje.

**Sygnały do alertu:**

| Zdarzenie | Warunek |
|---|---|
| `NEW_DEAL` | nowa oferta + `deal_score > próg` → push natychmiast |
| `PRICE_DROP` | spadek > 3% względem ostatniego snapshotu |
| `STALE` | wisi > 45 dni → dźwignia negocjacyjna, nie pilne |
| `AUCTION_ENDING` | aukcja < 2 h do końca, cena poniżej wyceny |

---

## 6. Higiena scrapowania (żeby nie dostać bana w tydzień)

- **HTTP-first.** Playwright jest 30× droższy w RAM — tylko `master1`, `spotawheel`, ewentualnie `ayvens`
- **Concurrency 1–2 per domena**, 1–3 s jitter między requestami, exponential backoff na 429/403
- **Conditional fetch:** ETag / `Last-Modified` + hash treści → nie parsuj niezmienionego
- **Dwie kadencje:** listingi co 10–15 min (wykrywanie nowych), detale co 24 h (odświeżenie cen)
- **Respektuj robots.txt** — Arval jawnie blokuje URL-e z filtrami, więc chodzimy po czystej paginacji
- **Własny User-Agent z kontaktem** — realnie obniża szansę bana; admin, który wie kim jesteś,
  raczej rate-limituje niż blokuje
- Proxy rezydencjalne dopiero gdy naprawdę zabraknie opcji — dodatkowy koszt i komplikacja

Zakres: publiczne listingi do własnego użytku. Nie obchodzimy logowania ani paywalli, nie tykamy
paneli licytacyjnych za autoryzacją (Ayvens, `poleasingowe.pl/bidder-panel`), nie redystrybuujemy zdjęć.

---

## 7. Front — Next.js

**Stack:** Next 15 App Router, TypeScript, Tailwind + shadcn/ui, TanStack Table.
Server Components czytają Postgres **bezpośrednio przez Drizzle** — żadnej warstwy REST między
własnym frontem a własną bazą.

**Strony:**

| Ścieżka | Zawartość |
|---|---|
| `/` | Dashboard: nowe dzisiaj, największe spadki cen, top deal score, health scraperów |
| `/oferty` | Tabela + filtry (facety liczone w SQL), domyślne sortowanie po `deal_score` |
| `/oferta/[id]` | Galeria, **wykres historii ceny**, lista porównywalnych sztuk, wszystkie źródła tego egzemplarza, link do oryginału |
| `/watche` | Kreator alertu: marka/model/rocznik/przebieg/cena/min. score → kanał powiadomień |
| `/zrodla` | Ostatni run, % błędów, liczba ofert, log ostatnich niepowodzeń parsera |

**Realtime:** SSE na `/api/stream` albo zwykły polling co 30 s. Nie warto tu kombinować z WebSocketami.

**Auth:** jeden użytkownik → basic auth w middleware. Clerk dopiero jeśli dojdą inne osoby.

**Alerty:** Telegram Bot API — najszybszy push na telefon, darmowy, dosłownie trzy linie kodu.
Mail (Resend) jako dzienny digest, nie jako kanał sniperski.

---

## 8. Fazy

| Faza | Zakres | Czas |
|---|---|---|
| ~~**0**~~ | ~~Ustalenie żywych URL-i~~ — **wykonane**, rejestr źródeł w sekcji 0 | ✅ |
| ~~**1**~~ | ~~Szkielet + adapter `automarket` end-to-end + front~~ — **wykonane**, patrz [README.md](README.md) | ✅ |
| ~~**2**~~ | ~~+`alphabet`, +`vwfs`, +`arval` + filtr źródeł~~ — **wykonane**. `vehis` odpadł: robots.txt zabrania jedynej ścieżki do danych (patrz sekcja 11) | ✅ |
| **3** | Dedup (pHash) + wycena z komparatywów + deal score + **Telegram** | 2–3 dni |
| ~~**4**~~ | ~~`poleasingowe` + `cararena` + `dawro`~~ — **wykonane** (553 aukcje). Multi-tenant okazał się mitem, patrz sekcja 12 | ✅ |
| ~~**5**~~ | ~~Dealerzy premium~~ — **wykonane**: `mercedes` (440) i `bmw` (1772). `aukcjabmwfs` odrzucone: login B2B | ✅ |
| **6** | Pula Playwright: `master1`, `spotawheel`, `audi.pl` | 2 dni |
| **7** | Aukcje: alert „kończy się < 2 h", licytacja ręczna. Ustalenie statusu Carefleet | 1 dzień |
| ~~**8**~~ | ~~+`ayvens` (LeasePlan/ALD, sklep detaliczny) +`pkoaukcje` (aukcje PKO Leasing)~~ — **wykonane**, patrz sekcja 13 | ✅ |
| ~~**9**~~ | ~~Przeglad programow CPO producentow i pozostalych firm leasingowych~~ — **wykonane**: +`volvo` (1131), +`skyselection` (340), +`cupra` (126), +`seat` (91), +`leasygroup` (36). Patrz sekcja 14 | ✅ |

Po Fazie 3 masz działającego snipera. Fazy 4–7 to poszerzanie pokrycia.

Kolejność jest celowa: Playwright zszedł na sam koniec, bo 10 z 16 źródeł obsłużysz czystym
HTTP — nie ma sensu stawiać puli przeglądarek, zanim tanie źródła nie zaczną dowozić danych.

---

## 9. Hosting — wszystko na warstwach darmowych

Wymóg: zero kosztów. VPS odpada, więc architektura jest lokalna z darmową ścieżką na produkcję.

| Warstwa | Rozwiązanie | Limit |
|---|---|---|
| Baza (dev) | Postgres 16 z Homebrew | bez limitu |
| Baza (prod) | Neon free tier | 0,5 GB — starczy na ~200 tys. ofert bez zdjęć |
| Harmonogram | launchd na Macu | bez limitu |
| Front | Next.js → Vercel Hobby | free, niekomercyjnie |
| Alerty | Telegram Bot API | free |
| Playwright (Faza 6) | lokalnie | free |

**Trzy decyzje, które trzymają koszt na zerze:**

1. **Nie hostujemy zdjęć.** Trzymamy sam URL miniatury i (w Fazie 3) 64-bitowy pHash.
   Storage jest głównym generatorem kosztu przy 10 tys. ofert — a zdjęcia i tak serwuje źródło.
2. **Zwykły `<img>` zamiast `next/image`.** Optymalizacja obrazów na Vercelu ma płatny limit,
   a te obrazy są zewnętrzne i już zoptymalizowane.
3. **Bez Redisa i bez płatnych proxy.** Kolejka jest zbędna przy jednym źródle (`pg-boss`
   dołoży się dopiero, gdy adapterów będzie kilkanaście). Zamiast proxy — etykieta:
   własny User-Agent z kontaktem, 1,2 s odstępu z jitterem, backoff na 429/503.

**GitHub Actions odrzucone jako główny harmonogram.** Cron w Actions ma minimalny odstęp
5 minut i bywa opóźniany o kilkanaście minut przy obciążeniu; do tego na repo prywatnym
budżet to 2000 min/mc, a przebieg co 10 min zjadłby go w całości. Dla snipera celującego
w ~60 s od pojawienia się oferty to dyskwalifikacja. Zostaje jako awaryjny backup.

---

## 10. Co dane Automarketu zmieniły w założeniach

Rekonesans na żywych danych obalił dwa założenia z pierwotnego planu:

- **Wolumen jest 4× mniejszy, niż wynikało z sitemapy.** Z 9406 aut tylko **2261 ma cenę
  gotówkową** — reszta jest wyłącznie w leasingu/najmie, a strona `/zakup` zwraca dla nich 404.
  Dobra wiadomość: pełny przelot to ~45 min, a nie 3 h, więc odświeżanie może być częstsze.
- **Wariant URL-a decyduje o znaczeniu pola `price`.** Pod `/leasing` i `/wynajem-*`
  w `offers.price` siedzi **rata miesięczna**. Gdyby adapter brał pierwszy lepszy wariant,
  do bazy trafiłyby ceny rzędu 1500 zł obok 150 000 zł i model wyceny z Fazy 3 byłby bezużyteczny.
  Adapter czyta wyłącznie `/zakup` i dodatkowo weryfikuje `offers.category`.
- **VIN jest przy 100% ofert**, wprost w JSON-LD. Deduplikacja między portalami (Faza 3)
  będzie w tym źródle trywialna — pHash zdjęć zostaje dla źródeł bez VIN-u.

---

## 11. Faza 2 — cztery źródła i jedno odrzucone

### Pułapka „rata zamiast ceny" powtarza się wszędzie

To nie była specyfika Automarketu. **Każde źródło miesza ceny gotówkowe z ratami**
i każde wymaga jawnego filtra:

| Źródło | Wszystkich | Gotówkowych | Filtr w adapterze |
|---|---|---|---|
| Automarket | 9406 | 2261 | wariant URL-a `/zakup` |
| Arval | 635 | **294** | `purchaseOption === "sale"` |
| VW FS | 285 | 186 | pomijamy `isSold` i `inPreparation` |
| Alphabet | 223 | 223 | endpoint `/CarsRetail` jest już tylko detaliczny |

Bez tych filtrów do bazy trafiłyby zera i raty rzędu 1500 zł obok cen 150 000 zł.

### VW FS: cena gotówkowa jest wyższa niż eksponowana

`totalPriceBrutto` (96 900 zł) zakłada finansowanie. Przy zapłacie gotówką VWFS dolicza
`amountOfIncreaseCashPrice`, więc realna cena to `finalTotalPriceBruttoForCash` (99 900 zł).
Adapter zapisuje tę drugą — inaczej porównanie z Automarketem czy Arvalem byłoby zaniżone
o kilka tysięcy na każdym aucie.

### Alphabet i Arval mają publiczne API — nie trzeba parsować HTML-a

- **Alphabet**: `poleasingowe-api.alphabet.pl`, endpoint `POST /CarsRetail` z payloadem
  `{FilterData:[], SortingData:[], Skip:0, Take:N}`. Jedno żądanie zwraca komplet ofert
  z przebiegiem, mocą i zdjęciem. VIN dobiera `GET /Car?id={carId}`.
- **Arval**: `arval-prod-euw-appservice-portalapi.azurewebsites.net/api/Announcements/17`
  (17 = portal PL), paginacja `PageSize`/`PageIndex`. Rekord zawiera gotowy `offerUrl`,
  więc nie zgadujemy slugów. VIN i moc z `GET .../17/{id}`.

Żeby to obsłużyć, `ListingRef` dostał opcjonalne pole `payload` — adapter może przenieść
dane zdobyte w `discover()` do `parse()`, zamiast pobierać je drugi raz.

### ❌ Vehis odrzucony — robots.txt

Vehis nie wystawia ofert w sitemapie (`moto.xml` to wyłącznie artykuły), a strony marek
to shell SPA bez linków do ofert. Jedyna ścieżka do danych to `/api/announcement/`,
którą **robots.txt jawnie blokuje**. Zgodnie z zasadą z sekcji 6 nie obchodzimy tego —
źródło wypada z zakresu. Do rozważenia wyłącznie kontakt z Vehis o zgodę/feed.

### Uwaga o VW FS: sitemap jest bezużyteczny

`store.vwfs.pl/sitemap.xml` wystawia 285 ofert, ale próbka 8 kolejnych miała
`inPreparation: true`, zerowe ceny i zero zdjęć. Adapter chodzi po `/oferty?strona=N`
(parametry po polsku, `elementowNaStronie=100`), gdzie dane są kompletne.

---

## 12. Faza 3 — pięć źródeł, dwa odrzucone, jedna korekta

### ❗ Korekta: `poleasingowe.pl` NIE jest multi-tenant

W sekcji 0 zapisałem jako „kluczowe odkrycie", że subdomeny `santander.`, `millennium.`
i `efl.` zwracają różne zestawy ofert i że jeden adapter obsłuży trzech leasingodawców.
**To było błędne.** Wniosek opierał się na zliczeniu surowych wystąpień `auctions/details`
w HTML (30/8/8), a te liczby obejmowały linki promocyjne z homepage, nie filtrowany listing.

Weryfikacja przy budowie adaptera:

| Host | Co faktycznie zwraca |
|---|---|
| `poleasingowe.pl` | prawdziwy listing, ~850 aukcji, paginacja `?page=N` |
| `santander.poleasingowe.pl` | prawdziwy listing, częściowo pokrywa się z głównym |
| `millennium.` / `efl.` | strona w stylu homepage z linkami `?source=homepage` — **brak filtrowanej listy** |

Adapter chodzi więc po domenie głównej.

### ❗ Korekta korekty: poddomeny istnieją, ale testowałem złe nazwy

Powyższa tabela też była niepełna. Nazwy `millennium.` i `efl.` **zgadywałem**, a one
odpowiadają atrapą — zwykłą stroną główną. Prawdziwe poddomeny najemców podają same
firmy na swoich stronach: Pekao linkuje do `pekaoleasing.poleasingowe.pl`,
Millennium do `millenniumleasing.poleasingowe.pl`. Obie zwracają realne listingi.

Nie zmienia to jednak decyzji, tylko jej uzasadnienie. Porównanie identyfikatorów
z pełnym crawlem domeny głównej (786 aukcji, wszystkie kategorie):

| Najemca | Aukcji u siebie | Brakuje na domenie głównej |
|---|---|---|
| `pekaoleasing.` | 52 | **0** |
| `millenniumleasing.` (osobowe) | 6 | **0** |
| `millennium.` / `efl.` (atrapy) | 8, identyczne dla obu | 3 pozycje promocyjne spoza `/vehicles` |

Czyli: **Pekao i Millennium są już w bazie** przez adapter `poleasingowe` — osobne
adaptery byłyby czystym duplikatem. Wpis „Millennium nieobsłużone" jest nieaktualny.

Przy okazji poddomena Millennium zdradziła parametry filtra, których nie było widać
w UI: `procsubcat=ecr_cartypess` (tylko osobowe) i `list_pagesize` (maks. 20, domyślnie
10). Adapter korzysta teraz z obu — 480 pozycji z 25 stron zamiast 786 z 80, czyli
o ~45% mniej ruchu u nich, bo znikły pobrania stron ciężarówek odrzucanych w `parse()`.

### Aukcje wymagały zmiany schematu

Doszły kolumny `offer_kind` (`fixed` | `auction`) i `auction_ends_at`. Powód jest
merytoryczny, nie porządkowy: cena aukcyjna to **aktualna oferta w licytacji**, rosnąca
w czasie. Wrzucona do jednego worka z cenami „kup teraz" systematycznie zaniżałaby
wycenę rynkową i generowała fałszywe okazje.

`poleasingowe` podaje ceny **netto** („Forma sprzedaży: faktura VAT"), więc adapter
przelicza je na brutto ×1,23 — bez tego auta z tego źródła wyglądałyby na 23% tańsze
od reszty bazy.

### Filtrowanie to nie awaria

Pierwszy przebieg `poleasingowe` zaraportował „298 błędów". W rzeczywistości to były
ciężarówki, naczepy i maszyny odfiltrowane przez adapter (kategoria `/vehicles` miesza
je z osobówkami). Pipeline dostał osobny licznik `skipped` — inaczej normalne filtrowanie
maskowałoby moment, w którym parser naprawdę się psuje.

### BMW: dozwolona droga zamiast wygodnej

`najlepszeoferty.bmw.pl` ma świetne JSON API (`/uzywane/api/v1/ems/bmw-used-pl_PL/search`,
1772 pojazdy z VIN-em jednym żądaniem), ale **`robots.txt` jawnie zabrania `/uzywane/api`**.
Adapter go nie używa. Zamiast tego bierze sitemapę pojazdów i strony `opis-szczegolowy`,
gdzie BMW renderuje serwerowo obiekt `METADATA.vehicle` plus tabelę techniczną i VIN.
Kosztuje to 1772 żądania zamiast jednego, ale mieści się w regułach serwisu.

Świadomy wyjątek: adres miniatury wskazuje na `/uzywane/api`. Scraper go nie pobiera —
zapisujemy sam URL, który ładuje przeglądarka użytkownika, tak samo jak na stronie BMW.

### ❌ Odrzucone w tej fazie

- **`aukcjabmwfs.pl`** — „Platforma sprzedaży samochodów używanych BMW Group Polska"
  z przyciskiem Zaloguj i bez publicznej listy pojazdów. To samo co Ayvens (`carmarket.`,
  patrz sekcja 13 — inny adres tej samej firmy wszedł jako `ayvens`) i BCA.
- **`dawro.pl`** — zbudowane, ale wolumen to zaledwie 6 aukcji pojazdów; serwis miesza
  je z nieruchomościami i dzierżawami firm (adapter bierze tylko `/aukcja/`, nigdy
  `/ogloszenie/`). Utrzymywać tylko dopóki jest darmowe w utrzymaniu.

---

## 13. Faza 8 — dwa źródła znalezione poza pierwotną listą 16

Rekonesans z sekcji 0 zamknął się na konkretnej liście 16 domen. Szukając dalej —
producenci aut z certyfikowanymi programami uzywanych, inne firmy leasingowe —
trafiono dwa nowe, prawdziwe źródła i kilka ślepych zaułków opisanych w README
(sekcja „Odrzucone”: `used-cars.kia.eu` ma `robots.txt: Disallow: /` na cala domene;
Hyundai/Ford nie maja scentralizowanego inwentarza; Sixt zwraca 403; Athlon
przekierowuje klientow indywidualnych na Otomoto — agregator, nie wlasna platforma).

### `ayvens` — inny produkt tej samej firmy niz odrzucony `carmarket.ayvens.com`

Ayvens (fuzja LeasePlan + ALD) ma dwie zupelnie osobne platformy: `carmarket.ayvens.com`
(aukcje B2B za logowaniem, odrzucone juz w sekcji 0/„Odrzucone” w README) i
`usedcars.ayvens.com` — zwykly sklep detaliczny (Salesforce Commerce Cloud), SSR,
bez logowania, z sitemapa per kraj wskazana wprost w `robots.txt` (739 ofert dla
`pl-pl` w chwili rekonesansu). Cena w JSON-LD jest brutto (strona dopisuje „Zawiera
23% VAT”), a specyfikacja z VIN-em wlacznie siedzi w czytelnych
`<div class="detail-container X">`. Jedyna pulapka: `robots.txt` blokuje
`*vehicle-master-catalog*` (obrazy) ogolnie, ale explicite odblokowuje wariant
`sw=400` — adapter wymusza ten parametr zamiast brac adres pelnowymiarowy, ktory
laduje przegladarka.

### `pkoaukcje` — trafione przez martwy trop Raiffeisen Leasing

`placpoleasingowy.pl` (platforma aukcyjna Raiffeisen Leasing z sekcji „Odrzucone” w
starszych notatkach) dzis przekierowuje pod `https://aukcje.pkoleasing.pl/` — domena
zostala przejeta lub platforma scalona pod PKO Leasing. Okazalo sie to tym samym
silnikiem co `poleasingowe.pl` (identyczna struktura `/auctions/list/pub/all/vehicles`,
`/auctions/details/{slug}/{kod}`, te same kody `ecr_*`), ale innym hostem i innym
inwentarzem PKO Leasing — nie duplikatem tego, co juz mamy przez `poleasingowe`.

Dwie roznice wobec `poleasingowe.ts`:

1. **„Aktualna cena” jest pusta w surowym HTML-u** — DOM ma tylko binding Alpine.js
   (`x-text="auction.current_price"`). Prawdziwa wartosc jest jednak tuz obok, w
   inline `<script>`, jako obiekt JS `auction: { current_price, current_price_brutto,
   endDateTimer, ... }`. To NIE jest poprawny JSON (cudzyslowy pojedyncze, klucze bez
   cudzyslowu), wiec adapter nie probuje `JSON.parse` — bierze trzy potrzebne pola
   regexem wprost z HTML-a. Zaleta: `current_price_brutto` i `endDateTimer` (koniec
   licytacji) sa juz policzone u zrodla — nie trzeba, jak w `poleasingowe.ts`, mnozyc
   recznie przez 1,23 ani zostawiac `auctionEndsAt: null`.
2. **Marka i model nie sa w tabeli danych pojazdu**, tylko w okruszkach nawigacji
   (`Strona glowna > Pojazdy > Samochody osobowe > Marka > Model`). Dla rzadkich modeli
   w probce (Mercedes-Maybach S 580, Mazda MX-30) okruszki koncza sie na marce — serwis
   nie generuje dla nich osobnego poziomu modelu. Adapter dokłada wtedy `splitMakeModel()`
   (helper z `@auta/core`, ten sam co przy CarArenie) na naglowku `<h1>` jako sciezke
   zapasowa. Bez tego dwie oferty na 62 (3%) ginelyby po cichu — dokladnie ten rodzaj
   bledu, przed ktorym ostrzega README.

Kategoria `/vehicles` miesza tu osobowki z dostawczymi (Sprinter, Ducato) tak samo jak
w `poleasingowe.pl` — okruszek „Samochody osobowe” zostaje jako filtr, `procsubcat` w
zapytaniu tego nie gwarantuje. Ford Ranger (pickup) przechodzi filtr, bo sam serwis
klasyfikuje go jako osobowy.

---

## 14. Faza 9 — przegląd programów CPO producentów i firm leasingowych

Systematyczny przelot przez marki z certyfikowanymi programami aut używanych oraz
przez firmy leasingowe spoza pierwotnej listy 16. Pięć nowych źródeł, a reszta
zamknięta werdyktem — w tym trzy przypadki „już to mamy", które bez sprawdzenia
wyglądałyby na brakujące pokrycie.

### Weszło

| Źródło | Wolumen | Droga |
|---|---|---|
| `volvo` (Volvo Selekt) | 1131 z 1228 | JSON API Codeweavers, token gościa |
| `skyselection` (Mazda) | 340 | listing + detal na osobnej domenie |
| `cupra` (CUPRA Approved) | 126 | JSON API VTP grupy VW |
| `seat` (SEAT Das WeltAuto) | 91 | j.w., wspólny kod `vtp.ts` |
| `leasygroup` (VB Leasing) | 36 z 268 | sitemapa (listing kategorii zabroniony) |

### Trzy źródła, które okazały się duplikatami — sprawdzone, nie założone

To najcenniejszy wynik tej fazy, bo każde z nich wyglądało na lukę w pokryciu:

- **ING Leasing** nie sprzedaje sam. Strona „Przedmioty poleasingowe" mówi wprost:
  „Współpraca z naszymi partnerami Poleasingowe.pl oraz firmą Auto-Przetarg" — oba
  są w rejestrze od Fazy 4. Osobny adapter byłby czystym duplikatem.
- **Lexus** (`uzywane.lexus-polska.pl`) to ta sama platforma co Toyota Pewne Auto:
  strona ciągnie assety z `panel.pewneauto.pl`, a `pewneauto.pl/oferty/brand/lexus`
  pokazuje 979 sztuk przy 859 na witrynie marki — czyli witryna marki jest podzbiorem.
  Adapter `toyota` ma tych Lexusów 601 w bazie od dawna.
- **Raiffeisen Leasing** (`placpoleasingowy.pl`) przekierowuje na `aukcje.pkoleasing.pl`,
  dodane w Fazie 8 jako `pkoaukcje`.

### Odrzucone i dlaczego

- **`used-cars.kia.eu`** — `robots.txt: Disallow: /` na całą domenę. Do tego Nuxt SPA
  z pustym shellem (`data-ssr="false"`), więc i tak trzeba by Playwrighta.
- **Hyundai, Ford** — landing programu certyfikacji bez własnego inwentarza; realne
  oferty są rozproszone po mikrostronach dealerskich, bez wspólnego API ani sitemapy.
- **Nissan, Honda, Suzuki, Mitsubishi** — to samo: strona programu, zero linków do ofert,
  brak iframe'a i API. Mitsubishi nie ma nawet strony aut używanych (404).
- **Volkswagen** — konfiguracja wyszukiwarki na `volkswagen.pl` wskazuje niemiecki VTP
  (`vtpapi.volkswagen.de`, prefiksy `vwdeb`/`vwdenfz`); polskiego stocku VW tam nie ma.
  Auta VW zbiera `vwfs`, a program Das WeltAuto — `seat`, `cupra` i `skoda`.
- **Athlon** — klientów indywidualnych kieruje na Otomoto (agregator, nie własna
  platforma). `athlonstock.pl` wygasła i jest domeną parkingową.
- **Sixt, Spoticar (Stellantis)** — sprawdzone Playwrightem, czyli **prawdziwą
  przeglądarką**, nie samym curlem: Sixt oddaje challenge Cloudflare („Just a moment…"),
  Spoticar „Access Denied". To aktywna obrona, a nie kwestia nagłówków — wejście tam
  wymagałoby obejścia zabezpieczeń, czego zgodnie z sekcją 6 nie robimy.

### Czego nauczyło API grupy VW

Wyszukiwarka stocku SEAT-a i CUPRY (`vtpapi.seat.com`) ma dwie cechy, które łatwo
wziąć za działający kod:

1. **Filtry to parametry macierzowe** (`search/car;t_model=X`), nie query. Wersja z `?`
   nie zgłasza błędu — po prostu oddaje pełną listę, więc filtr wygląda na działający,
   dopóki nie sprawdzi się `selectedItems` w odpowiedzi.
2. **Paginacji nie ma w ogóle.** Endpoint zawsze zwraca 10 pierwszych pozycji i ignoruje
   `start`, `offset`, `page`, `rows`, `limit`, `size` oraz warianty macierzowe. Komplet
   składamy partycjonowaniem: per dealer (`t_partner`), a dealerów z ponad dziesięcioma
   sztukami tniemy dodatkowo po modelu. Liczności są w `possibleItems`, więc wiadomo
   z góry, które kubełki wymagają podziału.

### Volvo: token gościa to nie paywall

Każde zapytanie do Codeweavers wymaga `x-cw-customertoken`, a token wydaje
`POST /guest/initialise/proposal` na podstawie publicznego klucza wpisanego na stałe
w bundlu Angulara — dokładnie tą samą drogą, którą idzie przeglądarka każdego
odwiedzającego. Losowy GUID dostaje 401, więc tokenu nie da się zmyślić. Nie ma tu
logowania ani treści płatnej; adapter pobiera token raz na przebieg.

### leasyGROUP: niepełny łańcuch TLS

Host kanoniczny `aukcje.leasygroup.pl` serwuje certyfikat bez pośredniego CA Certum.
Przeglądarka i curl dobierają go same przez AIA, Node nie — i wywala się na
`UNABLE_TO_VERIFY_LEAF_SIGNATURE`. `--use-system-ca` nie pomaga, bo pośredniego nie ma
też w magazynie systemowym. Rozwiązanie: dokładamy sam certyfikat pośredni
(`scripts/certs/certum-dv-tls-g2-r39.pem`, wyciągnięty z `aukcje.vbleasing.pl`, który
podaje pełny łańcuch) przez `NODE_EXTRA_CA_CERTS` w skryptach workera. Weryfikacja
zostaje włączona — podpis nadal musi prowadzić do zaufanego korzenia.

---

## 15. Faza 6 — Playwright okazał się niepotrzebny

Plan zakładał postawienie puli Chromium dla trzech źródeł, które „bronią się" przed
czystym HTTP: `master1`, `spotawheel` i `audi.pl`. **Żadne z nich nie skończyło się
adapterem przeglądarkowym** — a mimo to faza dowiozła nowe źródło.

Kluczowa lekcja: zanim postawisz pulę przeglądarek, sprawdź, czy w ogóle jest po co.
Dwa z trzech źródeł nie miały żadnych danych do zabrania, a trzecie miało je gdzie indziej.

### Werdykty, wszystkie sprawdzone prawdziwą przeglądarką

| Źródło | Co pokazał test | Wniosek |
|---|---|---|
| `master1.pl` | 403 również dla Chromium | **nieistotne — już mamy.** Masterlease sprzedaje przez `automarket.pl`; strona oferty mówi wprost „Auto należy do Masterlease". WAF przestał być problemem, bo nie ma potrzeby tam wchodzić |
| `spotawheel.pl` | **200, żadnego Cloudflare** | Wcześniejszy wpis „Cloudflare challenge" był **błędny** — dotyczył domeny apex, która przekierowuje na `www`. Serwis stoi na Inertia.js i oddaje czysty JSON zwykłym `fetch`em z nagłówkiem `X-Inertia`. Tylko nie ma czego brać: `/buy` ma **0 aut** we wszystkich markach, a `/subscribe` to rata abonamentu |
| `audi.pl` | 503 „Site currently not available" | Dotyczy i landingu programu, i wyszukiwarki `/wyszukiwarka-samochodow-uzywanych/`. Audi nie ma też własnego prefiksu w VTP grupy VW — sprawdzone `vtpapi.audi.com` i wzorce `auplgwb`/`adplgwb` na `vtpapi.seat.com` |

### Spotawheel: pułapka „rata zamiast ceny" w czystej postaci

Strona główna reklamuje „1000 aut", ale to marketing. Realnie `classifiedsActiveTotalCount`
dla `/buy` wynosi **0**, a jedyne aktywne pozycje (15 sztuk) są pod `/subscribe`, gdzie
rekord ma `subscription_installment: 869` — 869 zł to rata miesięczna, nie cena auta.
Wpisanie tego do bazy jako ceny zatrułoby wycenę dokładnie tak, jak opisuje sekcja 11.

Adapter więc nie powstał, ale rozpoznanie zostaje: gdyby Spotawheel wrócił do sprzedaży,
wejście jest gotowe i **nie wymaga Playwrighta** — wystarczy `GET /buy` z nagłówkiem
`X-Inertia: true`, a odpowiedź to gotowy JSON z paginacją w `meta`.

### Nagroda pocieszenia okazała się najlepszym wynikiem fazy

Szukanie, gdzie właściwie sprzedaje Masterlease, wyprowadziło na **MHC Mobility Polska**
(dawniej Athlon Car Lease) — serwisu nie było na pierwotnej liście szesnastu źródeł.
62 auta, komplet VIN-ów, ceny brutto **i** netto podane wprost przez sprzedającego.

To ASP.NET WebForms, więc paginacja nie jest adresowalna GET-em — kolejne strony chodzą
przez `__doPostBack` z `__VIEWSTATE`. Adapter odtwarza ten POST i wymagało to dwóch
poprawek w warstwie HTTP, obie ogólne:

1. **POST formularzowy** (`fetchText({ form })`) — wcześniej silnik umiał tylko GET i JSON.
2. **Ciasteczka per host** — ASP.NET bez sesji odrzuca postback błędem 500. Node `fetch`
   nie przechowuje ciasteczek sam, więc `http.ts` trzyma teraz to, co serwis sam odeśle.

Trzecia pułapka była już znana z CarAreny: **każda oferta jest w HTML dwa razy** (widok
listy i kafelków przełączane po stronie klienta), więc deduplikacja po `data-id` jest
obowiązkowa — bez niej licznik pokazuje 124 zamiast 62.

Do kompletu trzeba odsyłać **wszystkie** pola ukryte, nie sam `__VIEWSTATE`: strona
wystawia jeszcze `__CSRFTOKEN` i po dwa pola na każdy wiersz siatki. Przy niepełnym
zestawie ASP.NET odpowiada pięćsetką zamiast kolejną stroną.

---

## 16. Faza 7 — Bravoauto i Otomoto, czyli koniec łatwych źródeł

Po pytaniu „czy mamy 100% rynku" zrobiłem przegląd tego, czego brakuje. Odpowiedź
brzmi **nie i nie da się** — ale dwa realne braki dało się domknąć.

### Dlaczego 100% jest nieosiągalne, niezależnie od liczby adapterów

Trzy luki są strukturalne, nie techniczne:

1. **Hurt B2B poprzedza detal.** Auta idą najpierw na zamknięte platformy
   (Ayvens Carmarket, BCA, aukcjabmwfs) — do handlarzy. Publicznie pojawiają się
   dopiero z marżą. Moment, w którym są najtańsze, jest niewidoczny z definicji.
2. **Duża część nigdy nie trafia do ogłoszeń.** Leasingodawca proponuje wykup
   najpierw użytkownikowi, potem pracownikom i dealerom. Publicznie ląduje reszta.
3. **CPO rozproszone po dealerach** (Hyundai, Ford, Nissan, Honda, Suzuki, Kia) —
   brak centralnego stocku, oferty żyją na dziesiątkach mikrostron.

### Otomoto: dlaczego NIE bierzemy całego serwisu

Otomoto ma **234 341 ofert osobowych**; filtr „sprzedawca: firma" zawęża to do
**188 328**, czyli nadal całego handlu używkami. Przy zmierzonych ~1,4 kB na ofertę
(19 MB na 14 tys. rekordów) komplet to ~330 MB — z 500 MB darmowego Neona, zanim
dołoży się historia cen. **Zerowy koszt z sekcji 9 przestałby się spinać.**

Do tego „poleasingowy" nie jest na Otomoto polem, tylko heurystyką — nie ma flagi,
trzeba by zgadywać po typie sprzedawcy i opisie.

Dlatego adapter bierze **imiennie poddomeny sklepów firmowych** leasingodawców.
To dało trzy źródła niedostępne inaczej:

| Firma | Dlaczego inaczej się nie dało | Ofert |
|---|---|---|
| **Athlon** | własna strona nie ma inwentarza, kieruje na Otomoto | 92 (komplet) |
| **Sixt** (Eurorent) | `sixt.pl` oddaje challenge Cloudflare | 12 (komplet) |
| **VEHIS** | `vehis.pl` blokuje w robots jedyną ścieżkę do danych | 1 |

Łącznie 435 ofert z ośmiu czynnych sklepów.

Reszta poddomen (Arval, Alphabet, Carefleet, PKO, EFL) to firmy, które mamy już
z ich własnych serwisów. Trzymamy je mimo to — różnica ceny tego samego auta
między kanałami jest sama w sobie sygnałem, zgodnie z sekcją 4.

**Pułapka:** nieistniejąca poddomena NIE daje 404. Otomoto oddaje wtedy stronę
główną z licznikiem 2,3 mln ofert. Bez kontroli obecności `businessName` adapter
zaciągnąłby losowe oferty z całego serwisu jako „oferty leasingodawcy" — testowane
poddomeny `masterlease.`, `ayvens.`, `santander.`, `grenke.` zachowują się właśnie tak.

**Pułapka ścieżki — kosztowała najwięcej:** listingiem sklepu jest `/inventory`,
nie `/osobowe`. Obie oddają te same 30 pierwszych ofert, ale tylko `/inventory`
honoruje `?page=N`. Na `/osobowe` paginacja, filtry marki i przewijanie są **po cichu
ignorowane** — strona w kółko zwraca tę samą trzydziestkę, co wygląda na komplet,
dopóki nie porówna się jej z polem `total`. Właściwy adres podaje samo Otomoto
w `sellerUrl` na stronie oferty. Po poprawce: 435 ofert zamiast 171, Athlon 92/92.

### Bravoauto — jedyne źródło, które naprawdę wymaga przeglądarki

Sieć Inchcape, ~430 aut, JSON-LD `OfferForPurchase` z VIN-em, ceną i pełną specyfikacją.

Listing `/samochody` dociąga kafelki po stronie klienta — w surowym HTML-u nie ma
ani jednego linku do oferty. Strony ofert są już serwerowe, więc **przeglądarka
służy wyłącznie do discovery**: ~18 renderów na przebieg zamiast ~450. To właściwy
przypadek na `strategy: "browser"` z Fazy 6, w odróżnieniu od trzech źródeł z sekcji
15: serwis nas nie blokuje (robots.txt to sama sitemapa, zero `Disallow`), po prostu
renderuje listę JS-em.

Sitemapa jest bezużyteczna — trzy wpisy, żadnej oferty.

---

## 17. Automarket w całości — ale bez zmyślania cen

Do Fazy 7 adapter brał wyłącznie wariant `/zakup`, czyli 2276 z 9431 aut w sitemapie.
Pozostałe 7155 leżało poza bazą. Teraz wchodzą wszystkie — z jednym zastrzeżeniem,
które jest sednem tej zmiany.

### Dlaczego reszta nie miała ceny i nadal jej nie ma

Automarket wystawia każde auto w kilku wariantach finansowania (`zakup`, `pozyczka`,
`leasing`, `wynajem-dlugoterminowy`) i **w każdym używa tego samego pola
`offers.price`** — ale znaczy ono co innego. Test rozstrzygający na aucie, które ma
oba warianty (Hyundai i30, id 306380):

| Wariant | `offers.price` | Co to naprawdę jest |
|---|---|---|
| `/zakup` | **62 850** | cena auta |
| `/pozyczka` | **1 482** | rata miesięczna |

Dla aut bez wariantu gotówkowego `/zakup` zwraca **404** — sprawdzone. Automarket ich
po prostu nie sprzedaje za gotówkę, więc **nie ma tam ceny do pobrania**. Nie ma jej
też nigdzie w HTML-u strony ani w stanie Nuxta.

### Rozwiązanie: brak ceny to `null`, nie rata

Auta bez wariantu gotówkowego trafiają do bazy z `priceGross: null`. Kuszące było
wpisać tam ratę — i to byłby najgorszy możliwy błąd tego projektu: 1 482 zł obok
62 850 zł systematycznie zaniżałoby medianę w koszyku porównawczym i generowało
fałszywe okazje w całej Fazie 3.

Weryfikacja na próbce 40 ofert: 13 z ceną, 27 bez, **zero kwot poniżej 5000 zł** —
czyli żadna rata nie przeciekła jako cena.

### Po co trzymać auta bez ceny

Trzy powody, dla których to nie jest martwy balast:

1. **Zestawianie po VIN.** Ta sama sztuka bywa u innego sprzedawcy z ceną „kup teraz".
   Auto bez ceny w Automarkecie plus jego bliźniak z ceną gdzie indziej to komplet
   informacji, którego wcześniej nie było.
2. **Wykrywanie zniknięć.** Auto, które znika z Automarketu, zostało sprzedane —
   a ceny sprzedanych sztuk są zgodnie z sekcją 5 lepszą bazą wyceny niż ceny wiszące.
3. **Pokrycie wyszukiwarki.** Front renderuje brak ceny jako „—" (`OfferCard.tsx`),
   więc nic się nie psuje; 75 ofert z innych źródeł ma tak od dawna.

Koszt: pełny przelot to ~9,4 tys. żądań zamiast 2,3 tys.

---

## 18. Faza 3 — wycena i deal score (bez alertów)

Zbudowane: wycena z koszyka porównawczego, deal score na ofertach, strona zdrowia
źródeł. Telegram świadomie pominięty na życzenie.

### Odkrycie, które przesądziło o kształcie koszyka

Pierwsza wersja liczyła medianę po `marka + model + rocznik` i wskazała **838 ofert
ponad 15% poniżej rynku**. Wyglądało to na sukces, dopóki nie sprawdziłem czołówki:

| Auto | Przebieg | „Taniej" |
|---|---|---|
| Renault Megane 2023 | 99 426 km | 43% |
| Opel Astra 2022 | 149 221 km | 42% |
| Dacia Duster 2020 | 222 238 km | 38% |

To nie były okazje, tylko auta z ogromnym przebiegiem. **Naiwny koszyk jest
wykrywaczem kilometrażu, nie wyceną.**

Po dołożeniu przedziału przebiegu (25 tys. km), paliwa i skrzyni: **188 okazji zamiast
838**, a czołówka to Ford Focus 2023 z 32 tys. km za 82 800 zł przy medianie 130 750 zł.
Odsiew 4,5× szumu przy zachowaniu prawdziwych trafień.

Rozkład ocen wyszedł dzwonowy i skupiony wokół zera — połowa ofert mieści się w ±10%
od mediany, bo tak wygląda normalny rynek. Dlatego plakietka zapala się dopiero od 10%,
a wyróżnia od 25% (45 sztuk na 5325 ocenionych). Przy progu 5% byłaby dekoracją
na każdym kafelku.

### Trzy reguły, bez których wycena kłamie

1. **Aukcje wykluczone z koszyka.** Cena aukcyjna to bieżąca oferta w licytacji, rosnąca
   w czasie — wpuszczenie jej zaniżałoby medianę i generowało fałszywe okazje.
2. **Minimum 8 sztuk.** Poniżej mediana jest przypadkiem. Oferta bez dość porównywalnych
   sztuk nie dostaje oceny **w ogóle** — UI nie pokazuje wtedy nic zamiast zgadywać.
   Pokrycie to 5325 z 21 tys. ofert; wolę mniej ocen wiarygodnych niż komplet zgadywanek.
3. **Ceny sprzedanych mają pierwszeństwo** (próg 5 sztuk `gone` w koszyku). Cena, po
   której auto zeszło z rynku, jest bliższa transakcyjnej niż cena wisząca. Dziś żaden
   koszyk tego progu nie osiąga — 362 sprzedane rozkładają się zbyt rzadko — ale
   mechanizm czeka gotowy i włączy się sam, gdy dane dojrzeją. Kolumna `deal_from_sold`
   mówi wprost, z czego liczona jest dana ocena.

### Dlaczego osobny przebieg, a nie część scrape'a

Mediana musi widzieć **komplet** danych. Liczona w trakcie zaciągu operowałaby na
połowie źródeł i skakałaby zależnie od tego, które auta akurat zdążyły wpaść.
`pnpm revalue` chodzi więc PO zaciągu, w tym samym skrypcie harmonogramu. Kosztuje
~0,9 s przy 21 tys. ofert, więc stać nas na to przy każdym przebiegu — świeżo dodana
oferta dostaje ocenę od razu, a nie dopiero w nocy.

Wynik trafia na `listings` (`market_price`, `deal_score`, `deal_samples`,
`deal_from_sold`), a nie jest liczony w locie: po tym polu sortujemy i filtrujemy,
a liczenie median per zapytanie zabiłoby listę.

Czyszczenie przed wpisem jest celowe — oferta, która wypadła z koszyka (bo zmienił się
przebieg albo koszyk schudł poniżej progu), musi **stracić** ocenę, a nie zostać ze
starym wynikiem w nieskończoność.

### Strona źródeł — bo cicha awaria jest najgroźniejsza

`/zrodla` pokazuje per adapter: stan, liczbę aktywnych, nowych dziś, zniknięć, udział
ofert z ceną i z VIN-em oraz czas ostatniej widzianej oferty. Powstała, bo żeby
sprawdzić, czy któryś adapter nie umarł, trzeba było pisać SQL ręcznie — a scraper,
który przestaje cokolwiek znajdować, raportuje „0 znalezionych, 0 błędów", czyli ciszę
wyglądającą na sukces.

Udziały liczone są względem **aktywnych**, nie wszystkich ofert — inaczej źródło z dużą
liczbą zniknięć wyglądałoby na dziurawe. Pod tabelą jest wprost napisane, że „z ceną"
poniżej 100% nie musi znaczyć awarii: Automarket sprzedaje część aut wyłącznie
w leasingu. Niepokoić powinna dopiero *zmiana* tych udziałów.

### Pułapka złapana przy okazji

`max(last_seen_at)` w surowym `sql` NIE przechodzi przez mapowanie typów Drizzle —
Postgres oddaje string, nie `Date`. Zadeklarowanie `sql<Date | null>` przeszło
typecheck i wywaliło stronę w runtime na `.getTime is not a function`. Konwersja jest
teraz jawna. Wniosek ogólny: `sql<T>` to obietnica wobec kompilatora, nie gwarancja —
przy surowych zapytaniach typ trzeba sprawdzić, a nie zadeklarować.
