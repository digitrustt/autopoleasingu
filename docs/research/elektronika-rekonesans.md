# Rekonesans źródeł — agregator elektroniki z outletów, poleasingu i refurbished

Data: 2026-10-04. Sprawdzone zwykłym HTTP (curl) i prawdziwą przeglądarką (Chromium/Playwright)
z IP serwerowego. Zasada jak w PLAN.md: nie obchodzimy zabezpieczeń ani zakazów robots.txt.

## Werdykt w jednym zdaniu

Projekt jest wykonalny: **sklepy poleasingowe i część sieci są otwarte, a kilka ma gotowe publiczne feedy
XML**. Ale dwie największe sieci (x-kom, Media Expert) oraz Back Market i Amazon blokują boty nawet
w przeglądarce — ich oferty da się mieć tylko przez feedy z programów partnerskich.

## Sieci i ich outlety

| Źródło | HTTP | Przeglądarka | robots.txt | Dane | Afiliacja | Werdykt |
|---|---|---|---|---|---|---|
| **Komputronik** outlet (`/promocje/outlet`) | ✅ 200 | — | ✅ OK | osobne karty „[oferta Outlet]”, JSON-LD `Product`, `itemCondition: DamagedCondition`, MPN (EAN wewnętrzny `200…`) | ✅ własny program + Admitad | **Łatwe** |
| **Morele** outlet (`/outlet/`) | ✅ 200 | — | ✅ OK | listing z `data-product-price`; karta produktu = cena nowego + EAN (`gtin13`) + MPN w JSON-LD, sekcja „Outlet (n)” | ⚠️ historycznie Convertiser, do potwierdzenia | **Łatwe** — od razu cena outletu **i** nowego |
| **MediaMarkt** odnowione (`/pl/campaign/produkty-odnowione`) | ✅ 200 | — | ✅ OK (blokuje tylko boty AI) | EAN w danych strony | do sprawdzenia | **Łatwe** |
| **Apple** Certified Refurbished (`apple.com/pl/shop/refurbished`) | ✅ 200 | — | ✅ OK | 61 bloków JSON-LD, ceny na listingu | brak programu w PL | **Łatwe**, świetny punkt odniesienia dla Maców/iPadów |
| **al.to** outlet (`promocje.al.to/outlet`) | ✅ 200 | — | ✅ OK | strona promocyjna bez listingu — trzeba znaleźć właściwy | ✅ x-kom SalesMasters (obejmuje al.to) | Do dokopania |
| **RTV Euro AGD** outlet (filtr `stan-outlet-doskonaly:outlet-dobry` w kategoriach) | ❌ Akamai 403 | ✅ 200 | ✅ kategorie dozwolone, `/search/` zakazane | JSON-LD, ceny | ✅ BUY.BOX (AGD małe ~4%, audio ~2,3%) | **Tylko przeglądarką** (jak Bravoauto) |
| **Neonet** | ❌ Cloudflare | ✅ 200 | ✅ OK dla `*` | ceny na stronie | — (należy do grupy x-kom) | Tylko przeglądarką, outlet do znalezienia |
| **x-kom** reStart | ❌ Cloudflare | ❌ „Cierpliwości…” | nieczytelny (403) | — | ✅ SalesMasters 1–6% | **Tylko feed partnerski** |
| **Media Expert** outlet | ❌ | ❌ Cloudflare/captcha | ✅ OK | — | ✅ własny program + Admitad | **Tylko feed partnerski** |
| **Amazon.pl** (Second Chance / Warehouse) | ❌ 202 | ❌ | blokuje boty AI | — | ✅ Amazon Associates | **Tylko API partnerskie** (PA-API) |
| **OleOle** | ❌ Akamai | nie testowane | — | — | — | jak Euro (ta sama grupa) |

## Refurbished

| Źródło | HTTP | Przeglądarka | Dane | Afiliacja | Werdykt |
|---|---|---|---|---|---|
| **refurbed.pl** | ✅ 200 | — | strony modeli `/p/iphone-13/`, JSON-LD bez cen (ceny wariantów w JS) | ✅ Awin | Feed z Awin zamiast scrapowania |
| **Back Market** | ❌ | ❌ Cloudflare | — | ✅ Awin (~5%) | **Tylko feed Awin** |
| **Swappie** | ❌ Cloudflare | ✅ 200 | JSON-LD, ceny | do sprawdzenia | Tylko przeglądarką |

## Sklepy poleasingowe — tu jest najlepiej

Kilka sklepów stoi na **Shoperze**, który wystawia **publiczne feedy XML dla Ceneo i Google**
(`/console/integration/execute/name/CeneoV2` i `.../GoogleProductSearch`). Ścieżka nie jest
zakazana w robots.txt. Jeden plik = cały asortyment z ceną, stanem, kategorią i linkiem.

| Sklep | Platforma | Feed | Ofert w feedzie | EAN | Uwagi |
|---|---|---|---|---|---|
| **sprzetowo.pl** | Shoper | ✅ Ceneo + Google | 1 037 / 16 311 | rzadko | nazwy typu „Dell Latitude E5570 i5-6200U 8GB 256SSD” — parsowalne |
| **cebit.pl** | Shoper | ✅ Ceneo + Google | 2 835 / 4 048 | ✅ często | |
| **kompre.pl** | Shoper | ✅ Ceneo + Google | 762 / 798 (~350 laptopów) | brak | lider niszy (~15 tys. wizyt/mies.) |
| **sklep.precio.pl** | Shoper | ✅ Ceneo + Google | 128 / 801 | częściowo | |
| **pro4it.pl** | Shoper | ✅ Ceneo + Google | 30 / 563 | brak | |
| **pclider.pl** | Shoper | ✅ Google (Ceneo pusty) | 303 | rzadko | |
| **pofirmowe.pl** | Shoper | ✅ Google (Ceneo pusty) | 249 | brak | |
| **freshcomp.pl** | WooCommerce | sitemap | ~30+ | ✅ (własne kody) | JSON-LD z ceną; `NewCondition` błędnie |
| **taniekomputery.pl** | własna | sitemap (1 798 URL) | — | — | brak JSON-LD — parser HTML |
| **rnew.pl** | IdoSell | sitemap (3 620 URL) | — | — | strony serii, ma własny program partnerski |
| **laptopypoznan.pl** | własna | sitemap (424 URL, kategorie) | — | — | parser HTML |
| **mega-outlet.pl** | WooCommerce | sitemap | — | — | blokuje boty AI, `*` OK |
| **simbad-outlet.pl** | — | ❌ Cloudflare także w przeglądarce | — | — | odpada |

**Uwaga:** feedy są publiczne, ale przeznaczone dla porównywarek. Uczciwie byłoby napisać do sklepów
i poprosić o zgodę / wpięcie — małe sklepy zwykle chętnie się zgadzają, bo to dla nich darmowy ruch
(i otwiera drogę do płatnych wyróżnień).

## Dopasowanie produktów (najtrudniejsza część)

- **Outlety sieci:** EAN lub MPN niemal zawsze — dopasowanie do modelu i ceny nowego proste.
  Komputronik daje wewnętrzny EAN (`200…`), więc tam po MPN.
- **Poleasing:** EAN prawie nigdy. Model + konfiguracja z nazwy (`Latitude E5570`, `i5-6200U`, `8GB`,
  `256SSD`) — regexy + słownik modeli. Analogia do wersji aut.
- **Cena nowego jako punkt odniesienia:** Morele podaje ją na tej samej karcie; dla reszty — cena
  z karty nowego produktu tej samej sieci (po EAN) albo z feedu partnerskiego.

## Programy partnerskie — podsumowanie

| Sklep | Program | Prowizja |
|---|---|---|
| x-kom / al.to | SalesMasters (własny), Admitad | 1–6% |
| Media Expert | własny, Admitad | wg kategorii |
| RTV Euro AGD | BUY.BOX | AGD małe ~4%, audio ~2,3% |
| Komputronik | własny, Admitad | wg kategorii, akcesoria do 10% |
| Back Market | Awin | ~5% |
| refurbed | Awin | do sprawdzenia |
| Amazon.pl | Associates | wg kategorii |
| rnew.pl | własny | do sprawdzenia |

## Proponowany zakres MVP

1. **Feedy Shopera** (7 sklepów poleasingowych) — jeden adapter, kilka tysięcy ofert.
2. **Komputronik, Morele, MediaMarkt, Apple** — zwykłe HTTP + JSON-LD.
3. **RTV Euro AGD, Swappie** — przeglądarka (jak `bravoauto`).
4. **x-kom, Media Expert, Back Market, refurbed, Amazon** — dopiero po akceptacji w programach
   partnerskich (feedy produktowe). Do akceptacji zwykle potrzebna działająca strona z ruchem.

## Ograniczenia tego rekonesansu

- Blokady testowane z IP serwerowego; z IP domowego / tanich VPS wynik może być inny.
- Nie liczyłem dokładnie liczby ofert w outletach sieci.
- Stawki prowizji z publicznych opisów programów — aktualne trzeba zobaczyć w panelach.
