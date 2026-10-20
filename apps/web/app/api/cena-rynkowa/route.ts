import { getCenaRynkowa } from "@/lib/queries";
import { CACHE_DOBA, kmZAdresu, markaZAdresu, modeleMarki, rokZAdresu } from "@/lib/rynek";
import { NextResponse } from "next/server";

/**
 * Ceny rynkowe dla kalkulatorow liczonych w przegladarce (PCC, wycena).
 *
 *   ?make=BMW                       -> modele marki: [{ slug, nazwa, n }]
 *   ?make=BMW&model=x3&year=2021    -> { n, mediana, p25, p75 } albo null
 *   ...&km=85000                    -> to samo, zawezone do przebiegu +-25 tys.
 *
 * DLACZEGO CACHE NA CDN: kazde wywolanie to agregacja po tabeli ofert, a dane
 * zmieniaja sie raz na dobe (zaciag 03:37). Patrz lib/rynek.ts i notatka
 * o limitach Vercela (Hobby, 5.10.2026).
 */
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const make = await markaZAdresu(p.get("make"));
  if (!make) return NextResponse.json({ error: "marka" }, { status: 404 });

  const grupy = await modeleMarki(make);
  const model = p.get("model");
  if (!model) {
    // Ogon ponizej 3 ofert odpada — to literowki w zrodlach.
    return NextResponse.json(
      grupy.filter((g) => g.n >= 3).map(({ slug, nazwa, n }) => ({ slug, nazwa, n })),
      { headers: CACHE_DOBA },
    );
  }

  const grupa = grupy.find((g) => g.slug === model);
  const year = rokZAdresu(p.get("year"));
  if (!grupa || !year) return NextResponse.json({ error: "parametry" }, { status: 400 });

  const cena = await getCenaRynkowa(make, grupa.aliasy, year, kmZAdresu(p.get("km")));
  return NextResponse.json(cena, { headers: CACHE_DOBA });
}
