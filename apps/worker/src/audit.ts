/**
 * Kontrola jakosci danych w bazie.
 *
 *   pnpm --filter @auta/worker check
 *
 * Powstala po trzech bledach, ktore NIE dawaly zadnego komunikatu, a psuly dane:
 *  - Dawro przypisywalo pieciu roznym autom dane tego samego Peugeota,
 *  - CarArena i Toyota gubily po polowie ofert na urwanej paginacji,
 *  - Automarket zapisywal marke "Mini [bmw]".
 *
 * Scraper konczyl sie wtedy komunikatem "0 bledow". Te zapytania sprawdzaja
 * dane po zapisie, a nie przebieg — i dlatego lapia takie przypadki.
 */
import { client, db } from "@auta/db";
import { sql } from "drizzle-orm";

let problems = 0;

function report(title: string, rows: Record<string, unknown>[], hint: string): void {
  if (rows.length === 0) {
    console.log(`✓ ${title}`);
    return;
  }
  problems += rows.length;
  console.log(`\n✗ ${title} — ${rows.length}`);
  console.log(`  ${hint}`);
  for (const r of rows.slice(0, 8)) console.log("   ", JSON.stringify(r));
  if (rows.length > 8) console.log(`    …i ${rows.length - 8} wiecej`);
}

/*
 * Ten sam VIN pod dwoma modelami w jednym zrodle = parser wzial dane nie z tego
 * bloku co trzeba.
 *
 * Sam powtorzony VIN to za slaby sygnal: Toyota wystawia to samo auto pod dwoma
 * numerami oferty, a Škoda pod dwoma dealerami ("POL20880_233726" kontra
 * "POL22400_233726") — jedno i drugie jest zgodne z prawda. Dopiero rozjazd
 * marki lub modelu przy tym samym VIN-ie oznacza blad po naszej stronie.
 */
const vinDupes = await db.execute(sql`
  select vin, source_id,
         string_agg(distinct make || ' ' || model, ' | ') as warianty
  from listings
  where status = 'active' and vin is not null
  group by 1, 2
  having count(distinct make || ' ' || model) > 1
  limit 20
`);

/*
 * Marka nie wystepuje w adresie oferty. Tak wysypalo sie Dawro (pieciu autom
 * przypisany Peugeot) i tak wyszlo "Mini [bmw]". Porownujemy po uproszczeniu
 * obu stron, bo w URL-u marki dwuczlonowe maja myslnik, a diakrytyki znikaja.
 */
const urlMismatch = await db.execute(sql`
  with n as (
    select source_id, make, model, url,
           regexp_replace(
             lower(translate(make, 'ąćęłńóśźżäöüëÄÖÜË', 'acelnoszzaoueAOUE')),
             '[^a-z0-9]+', '-', 'g') as make_slug
    from listings
    where status = 'active' and url ~ '/[a-z]+-?[a-z]*/'
  )
  select source_id, make, model, url
  from n
  where position(make_slug in lower(url)) = 0
  limit 20
`);

/* Zrodlo bez ofert = adapter przestal dzialac, a przebieg tego nie zglosil. */
const emptySources = await db.execute(sql`
  select s.id, s.last_run_at
  from sources s
  left join listings l on l.source_id = s.id and l.status = 'active'
  group by s.id, s.last_run_at having count(l.id) = 0
`);

/* Ceny "kup teraz" ponizej 5 tys. to niemal na pewno rata albo blad parsowania. */
const oddPrices = await db.execute(sql`
  select source_id, make, model, price_gross, url
  from listings
  where status = 'active' and offer_kind = 'fixed'
    and (price_gross < 5000 or price_gross > 2000000)
  order by price_gross limit 20
`);

/* Marka ze smieciem: nawias, ukosnik albo cyfra. */
const badMakes = await db.execute(sql`
  select make, count(*)::int as n
  from listings
  where status = 'active' and (make ~ '[\\[\\]/0-9]' or length(make) < 2)
  group by 1 order by n desc limit 20
`);

report("Ten sam VIN = ten sam model", vinDupes as Record<string, unknown>[],
  "Jeden VIN pod dwoma modelami w jednym zrodle = parser myli bloki ofert.");
report("Marka zgadza sie z adresem oferty", urlMismatch as Record<string, unknown>[],
  "Marki nie ma w URL-u — parser mogl przypisac dane innego auta.");
report("Kazde zrodlo ma oferty", emptySources as Record<string, unknown>[],
  "Zrodlo bez aktywnych ofert — sprawdz, czy adapter nadal dziala.");
report("Ceny w rozsadnym zakresie", oddPrices as Record<string, unknown>[],
  "Cena ponizej 5 tys. przy 'kup teraz' to zwykle rata miesieczna.");
report("Marki bez smieci", badMakes as Record<string, unknown>[],
  "Marka z nawiasem/ukosnikiem/cyfra — do obsluzenia w normalizeMake().");

console.log(problems === 0 ? "\nBez zastrzezen." : `\nDo sprawdzenia: ${problems}`);

await client.end();
process.exit(problems === 0 ? 0 : 1);
