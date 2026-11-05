import { db, listings } from "@auta/db";
import { and, desc, eq, gt, isNotNull, sql } from "drizzle-orm";
import { markaOk, modelOk } from "@/lib/smiec";

const BASE = "https://autopoleasingu.pl";

/*
 * Co 6 godzin: zaciag chodzi rano, wiec czesciej nie ma czego zmieniac.
 * Jedno zapytanie na 6 godzin.
 */
export const revalidate = 21_600;

/**
 * Bezpiecznik, nie cel: przy ~2300 ofertach na tydzien zostaje zapas na
 * dni z wiekszym naplywem, a mapa nie urosnie bez kontroli, gdyby zrodlo
 * nagle zrzucilo kilka tysiecy aut naraz. Patrz komentarz nizej.
 */
const LIMIT = 5_000;

/**
 * Mapa SWIEZYCH ofert, osobna od sitemap.xml — tak jak `sitemap-fresh.xml`
 * w Otomoto (~10 tys. najnowszych ogloszen).
 *
 * Oferty to 55% wejsc z Google (405 z 737 osob w 14 dni, na 519 roznych
 * ofert), ale robot zna tylko te, na ktore trafil przez linki z naszych
 * stron — wiekszosc z 29 tys. aut sprzedaje sie, zanim w ogole je zobaczy.
 * Tu dajemy mu znac o autach dodanych w ostatnich 7 dniach, poki sa
 * w sprzedazy. Tylko "kup teraz" z cena i zdjeciem.
 *
 * Historia limitu: 4.11.2026 pilot na 300 ofertach z 48 h, bo kazda wizyta
 * robota to render strony oferty, a 25.10 bylismy na 70% limitu CPU Vercel
 * Hobby (przekroczenie 5.10 wylaczylo serwis). 5.11 rozszerzone do calego
 * tygodnia (~2300), po wylaczeniu prefetchu linkow (components/Link.tsx),
 * ktory zjadal wiecej renderow niz cala ta mapa. Kolejny krok — wszystkie
 * aktywne oferty — dopiero gdy zuzycie CPU w panelu zostanie ponizej ~50%.
 */
export async function GET() {
  const oferty = await db
    .select({
      id: listings.id,
      make: listings.make,
      model: listings.model,
      firstSeenAt: listings.firstSeenAt,
    })
    .from(listings)
    .where(
      and(
        eq(listings.status, "active"),
        eq(listings.offerKind, "fixed"),
        isNotNull(listings.priceGross),
        isNotNull(listings.thumbnailUrl),
        gt(listings.firstSeenAt, sql`now() - interval '7 days'`),
      ),
    )
    .orderBy(desc(listings.firstSeenAt))
    // Zapas na odsiane smieci (marka "Other", model z cala specyfikacja).
    .limit(LIMIT * 2);

  const wpisy = oferty
    .filter((o) => markaOk(o.make) && modelOk(o.model))
    .slice(0, LIMIT)
    .map(
      (o) =>
        `<url><loc>${BASE}/oferta/${o.id}</loc><lastmod>${o.firstSeenAt.toISOString()}</lastmod></url>`,
    )
    .join("");

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${wpisy}</urlset>`,
    { headers: { "Content-Type": "application/xml; charset=utf-8" } },
  );
}
