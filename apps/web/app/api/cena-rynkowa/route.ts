import { filtryMarek } from "@/lib/cache-filtrow";
import { getCenaRynkowa, getModelsForFilter } from "@/lib/queries";
import { groupBySlug, resolveSlug, slugify } from "@/lib/slug";
import { NextResponse } from "next/server";

/**
 * Ceny rynkowe dla kalkulatorow (PCC, wycena) liczonych w przegladarce.
 *
 *   ?make=BMW                       -> modele marki: [{ slug, nazwa, n }]
 *   ?make=BMW&model=x3&year=2021    -> { n, mediana, p25, p75 } albo null
 *   ...&km=85000                    -> to samo, zawezone do przebiegu +-25 tys.
 *
 * DLACZEGO CACHE NA CDN: kazde wywolanie to agregacja po tabeli ofert, a dane
 * zmieniaja sie raz na dobe (zaciag 03:37). Przebieg zaokraglamy do 10 tys.,
 * zeby zapytania sie powtarzaly i trafialy w cache, zamiast liczyc kazdy
 * kilometr osobno. Patrz tez limity w notatce o Vercelu (Hobby, 5.10.2026).
 */
const CACHE = {
  "Vercel-CDN-Cache-Control": "s-maxage=86400, stale-while-revalidate=86400",
  "Cache-Control": "public, max-age=3600",
};

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const makes = await filtryMarek();
  const make = resolveSlug(makes, slugify(p.get("make") ?? ""));
  if (!make) return NextResponse.json({ error: "marka" }, { status: 404 });

  /*
   * Modele zebrane po slugu: "XC60", "Xc60" i "XC 60" to jeden wybor.
   * Nazwa z najczestszej pisowni, ogon ponizej 3 ofert odpada — to literowki.
   */
  const wiersze = await getModelsForFilter(make);
  const grupy = [...groupBySlug(wiersze, (w) => w.model)].map(([slug, ws]) => ({
    slug,
    nazwa: ws[0].model,
    n: ws.reduce((x, w) => x + w.total, 0),
    aliasy: ws.map((w) => w.model),
  }));

  const model = p.get("model");
  if (!model) {
    return NextResponse.json(
      grupy.filter((g) => g.n >= 3).map(({ slug, nazwa, n }) => ({ slug, nazwa, n })),
      { headers: CACHE },
    );
  }

  const grupa = grupy.find((g) => g.slug === model);
  const year = Number(p.get("year"));
  if (!grupa || !Number.isInteger(year) || year < 1990 || year > 2100) {
    return NextResponse.json({ error: "parametry" }, { status: 400 });
  }
  const kmRaw = p.get("km");
  const km = kmRaw ? Math.round(Number(kmRaw) / 10_000) * 10_000 : undefined;

  const cena = await getCenaRynkowa(make, grupa.aliasy, year, Number.isFinite(km) ? km : undefined);
  return NextResponse.json(cena, { headers: CACHE });
}
