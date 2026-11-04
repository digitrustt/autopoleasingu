import { db, listings } from "@auta/db";
import { and, desc, eq, gt, isNotNull, sql } from "drizzle-orm";
import { markaOk, modelOk } from "@/lib/smiec";

const BASE = "https://autopoleasingu.pl";

/*
 * Co 6 godzin: zaciag chodzi rano, a mapa i tak trzyma tylko ostatnie 48 h,
 * wiec czesciej nie ma czego zmieniac. Jedno zapytanie na 6 godzin.
 */
export const revalidate = 21_600;

/** Ile ofert zglaszamy naraz. Patrz komentarz nizej — to jest bezpiecznik CPU. */
const LIMIT = 300;

/**
 * PILOT (4.11.2026): mapa SWIEZYCH ofert, osobna od sitemap.xml.
 *
 * Oferty to 55% wejsc z Google (405 z 737 osob w 14 dni, na 519 roznych
 * ofert), ale robot zna tylko te, na ktore trafil przez linki z naszych
 * stron — wiekszosc z 29 tys. aut sprzedaje sie, zanim w ogole je zobaczy.
 * Tu dajemy mu znac o autach dodanych w ostatnich 48 godzinach, poki sa
 * w sprzedazy.
 *
 * Tylko "kup teraz" z cena i zdjeciem, od najwiekszej okazji, max 300.
 * Pelna lista (~1200 na dwie doby, 29 tys. lacznie) to kazdorazowy render
 * strony oferty przy wizycie robota, a 25.10 bylismy na 70% limitu CPU
 * Vercel Hobby — przekroczenie 5.10 wylaczylo serwis. Jesli po 3-4 tygodniach
 * te oferty zaczna sie indeksowac i przyciagac ludzi, to sygnal do planu Pro
 * i zdjecia limitu; jesli nie, mape mozna po prostu usunac.
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
        gt(listings.firstSeenAt, sql`now() - interval '48 hours'`),
      ),
    )
    .orderBy(sql`${listings.dealScore} desc nulls last`, desc(listings.firstSeenAt))
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
