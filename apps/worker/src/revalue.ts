/**
 * Przeliczenie wyceny rynkowej i deal score.
 *
 *   pnpm --filter @auta/worker revalue
 *
 * Robi dwie rzeczy: przebudowuje koszyki porownawcze (tabela `valuations`)
 * i wpisuje wynik na oferty (`market_price`, `deal_score`).
 *
 * Osobny przebieg, a nie czesc scrape'a, bo wycena musi widziec KOMPLET danych.
 * Liczona w trakcie zaciagu operowalaby na polowie zrodel — mediana skakalaby
 * zaleznie od tego, ktore auta akurat zdazyly wpasc.
 *
 * Wszystko idzie dwoma zapytaniami SQL zamiast petla po ofertach: przy 20 tys.
 * rekordow roznica to sekundy kontra minuty, a mediana i tak jest funkcja bazy.
 */
import { client, db } from "@auta/db";
import { sql } from "drizzle-orm";

/** Szerokosc przedzialu przebiegu. 25 tys. km to kompromis z sekcji 5 planu. */
const MILEAGE_BUCKET = 25_000;

/**
 * Minimalna liczebnosc koszyka. Ponizej tego mediana jest przypadkiem, nie
 * rynkiem — lepiej nie pokazac nic niz pokazac zle.
 */
const MIN_SAMPLES = 8;

/**
 * Ile ofert SPRZEDANYCH wystarcza, zeby zaufac im bardziej niz wiszacym.
 * Prog jest nizszy, bo te dane sa jakosciowo lepsze: cena, po ktorej auto
 * zniknelo, jest blizsza transakcyjnej niz cena, ktora wciaz wisi.
 */
const MIN_SOLD_SAMPLES = 5;

async function main() {
  const t0 = Date.now();

  /*
   * Koszyk celowo waski: marka, model, rocznik, przedzial przebiegu, paliwo
   * i skrzynia. Bez kontroli przebiegu "okazja" to po prostu auto z duzym
   * kilometrazem — na tej bazie naiwny koszyk dawal 838 rzekomych okazji,
   * z ktorych czolowka miala 99-222 tys. km.
   *
   * Aukcje sa wykluczone: ich cena to biezaca oferta w licytacji, ktora rosnie
   * w czasie. Wpuszczenie ich zanizyloby mediane i wygenerowalo falszywe okazje.
   */
  await db.execute(sql`
    with
    /*
     * DEDUP PO VIN — bez tego ta sama fizyczna sztuka wchodzi do koszyka tyle
     * razy, w ilu serwisach wisi, i przeciaga mediane w strone aut akurat
     * wystawionych wielokanalowo. Zmierzone na tej bazie: 11 805 ofert z VIN-em
     * to tylko 11 483 rozne auta — 322 wiersze nadmiarowe, a rekordzisci
     * (dwa BMW po ~560 tys. zl) siedzieli w trzech zrodlach naraz.
     *
     * Z duplikatow bierzemy NAJTANSZA oferte: dla tego samego egzemplarza cena
     * rynkowa to ta najnizsza dostepna — nikt racjonalnie nie zaplaci wiecej za
     * identyczne auto. Oferty bez VIN-u zostaja wszystkie, bo nie mamy jak
     * stwierdzic, ze to duplikaty.
     */
    unikalne as (
      select distinct on (coalesce(vin, 'id:' || id))
        make, model, year, mileage_km, fuel, gearbox, price_gross, status
      from listings
      where price_gross is not null
        and offer_kind = 'fixed'
        and mileage_km is not null
        and year is not null
        and status in ('active', 'gone')
      order by coalesce(vin, 'id:' || id), price_gross asc
    ),
    basket as (
      select
        make, model, year,
        (mileage_km / ${MILEAGE_BUCKET})::smallint as mileage_bucket,
        fuel, gearbox,
        percentile_cont(0.5) within group (order by price_gross)
          filter (where status in ('active', 'gone'))                 as median_price,
        count(*) filter (where status in ('active', 'gone'))          as sample_count,
        percentile_cont(0.5) within group (order by price_gross)
          filter (where status = 'gone')                              as sold_median,
        count(*) filter (where status = 'gone')                       as sold_count
      from unikalne
      group by 1, 2, 3, 4, 5, 6
      having count(*) filter (where status in ('active', 'gone')) >= ${MIN_SAMPLES}
    )
    insert into valuations
      (make, model, year, mileage_bucket, fuel, gearbox,
       median_price, sample_count, sold_median_price, sold_sample_count, computed_at)
    select
      make, model, year, mileage_bucket, fuel, gearbox,
      round(median_price)::int, least(sample_count, 32767)::smallint,
      round(sold_median)::int, least(sold_count, 32767)::smallint, now()
    from basket
    on conflict (make, model, year, mileage_bucket, fuel, gearbox) do update set
      median_price      = excluded.median_price,
      sample_count      = excluded.sample_count,
      sold_median_price = excluded.sold_median_price,
      sold_sample_count = excluded.sold_sample_count,
      computed_at       = now()
  `);

  const [{ n: buckets }] = (await db.execute(
    sql`select count(*)::int as n from valuations`,
  )) as unknown as { n: number }[];

  /*
   * Wpisanie wyniku na oferty. Gdy koszyk ma dosc sztuk SPRZEDANYCH, bierzemy
   * ich mediane — cena, po ktorej auto zeszlo z rynku, jest blizsza prawdzie
   * niz cena zyczeniowa, ktora wciaz wisi (patrz sekcja 5 planu).
   *
   * Czyscimy najpierw wszystko: oferta, ktora wypadla z koszyka (bo zmienil sie
   * przebieg albo koszyk schudl ponizej progu), musi stracic ocene, a nie
   * zostac ze starym wynikiem w nieskonczonosc.
   *
   * ALE TYLKO OFERTY AKTYWNE.
   *
   * Wczesniej czyscilo to wszystko bez wyjatku, a ocene dostawaly wylacznie
   * oferty aktywne — wiec kazda znikajaca oferta gubila swoj deal score
   * dokladnie w chwili, w ktorej stawal sie on informacja. Skutek byl taki, ze
   * ze zniknietych ofert ANI JEDNA nie miala oceny: 0 na 5186. Przez to nie
   * dalo sie odpowiedziec na najwazniejsze pytanie w tym projekcie — czy auta
   * oznaczone jako okazje faktycznie schodza szybciej od reszty rynku.
   *
   * Ostatnia ocena zniknietej oferty zostaje wiec zamrozona i sluzy juz tylko
   * do pomiaru trafnosci wyceny, nie do wyswietlania.
   */
  await db.execute(sql`
    update listings
       set market_price = null, deal_score = null,
           deal_samples = null, deal_from_sold = false
     where status = 'active'
       and (deal_score is not null or market_price is not null)
  `);

  const updated = await db.execute(sql`
    with scored as (
      select
        l.id,
        case
          when v.sold_sample_count >= ${MIN_SOLD_SAMPLES} and v.sold_median_price is not null
          then v.sold_median_price else v.median_price
        end as reference,
        case
          when v.sold_sample_count >= ${MIN_SOLD_SAMPLES} and v.sold_median_price is not null
          then true else false
        end as from_sold,
        case
          when v.sold_sample_count >= ${MIN_SOLD_SAMPLES} and v.sold_median_price is not null
          then v.sold_sample_count else v.sample_count
        end as samples
      from listings l
      join valuations v
        on v.make = l.make and v.model = l.model and v.year = l.year
       and v.mileage_bucket = (l.mileage_km / ${MILEAGE_BUCKET})::smallint
       and v.fuel is not distinct from l.fuel
       and v.gearbox is not distinct from l.gearbox
      where l.status = 'active'
        and l.price_gross is not null
        and l.offer_kind = 'fixed'
        and l.mileage_km is not null
        and l.year is not null
    )
    update listings l
       set market_price   = s.reference,
           deal_score     = (s.reference - l.price_gross)::real / nullif(s.reference, 0),
           deal_samples   = s.samples,
           deal_from_sold = s.from_sold
      from scored s
     where l.id = s.id
  `);

  const [stats] = (await db.execute(sql`
    select
      count(*) filter (where deal_score is not null)::int              as ocenionych,
      count(*) filter (where deal_score >= 0.15)::int                  as okazji_15,
      count(*) filter (where deal_score >= 0.25)::int                  as okazji_25,
      count(*) filter (where deal_from_sold)::int                      as z_cen_sprzedanych
    from listings where status = 'active'
  `)) as unknown as {
    ocenionych: number;
    okazji_15: number;
    okazji_25: number;
    z_cen_sprzedanych: number;
  }[];

  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(
    `✓ wycena: ${buckets} koszykow, ocenionych ${stats.ocenionych} ofert ` +
      `(${stats.z_cen_sprzedanych} z cen sprzedanych), ` +
      `okazji ≥15%: ${stats.okazji_15}, ≥25%: ${stats.okazji_25} (${secs}s)`,
  );

  void updated;
  await client.end();
}

main().catch(async (err) => {
  console.error("✗ wycena:", err instanceof Error ? err.message : String(err));
  await client.end();
  process.exit(1);
});
