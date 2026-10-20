import { getCenaRynkowa, getListings, getScatter, getYearBreakdown } from "@/lib/queries";
import {
  CACHE_DOBA,
  PALIWA,
  kmZAdresu,
  markaZAdresu,
  modeleMarki,
  rokZAdresu,
} from "@/lib/rynek";
import { NextResponse } from "next/server";

/**
 * Wszystko do wyniku wyceny jednym zapytaniem (/wycena-samochodu):
 *
 *   ?make=BMW&model=x3&year=2021&km=85000[&fuel=diesel]
 *
 * - `cena`    — mediana i kwartyle dla tego rocznika i przebiegu +-25 tys. km,
 * - `rocznik` — to samo bez przebiegu (zapas, gdy przy przebiegu za malo aut),
 * - `lata`    — mediana po rocznikach (spadek wartosci rok do roku),
 * - `wykres`  — chmura cena/przebieg dla tego rocznika,
 * - `podobne` — kilka aktualnych ofert o podobnym przebiegu.
 *
 * Cache na CDN na dobe; przebieg zaokraglony do 10 tys., patrz lib/rynek.ts.
 */
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const make = await markaZAdresu(p.get("make"));
  const grupa = make ? (await modeleMarki(make)).find((g) => g.slug === p.get("model")) : null;
  const year = rokZAdresu(p.get("year"));
  const km = kmZAdresu(p.get("km"));
  const fuelRaw = p.get("fuel");
  const fuel = PALIWA.find((f) => f === fuelRaw);
  if (!make || !grupa || !year || km == null) {
    return NextResponse.json({ error: "parametry" }, { status: 400 });
  }

  const [cena, rocznik, lata, wykres, oferty] = await Promise.all([
    getCenaRynkowa(make, grupa.aliasy, year, km, fuel),
    getCenaRynkowa(make, grupa.aliasy, year, undefined, fuel),
    getYearBreakdown(make, grupa.aliasy),
    getScatter(make, grupa.aliasy, 300, year),
    getListings(
      {
        make,
        model: grupa.aliasy,
        yearMin: year,
        yearMax: year,
        mileageMax: km + 25_000,
        ...(fuel ? { fuel } : {}),
        sort: "deal_desc",
        withPrice: "1",
      },
      1,
      6,
    ),
  ]);

  return NextResponse.json(
    {
      make,
      model: grupa.nazwa,
      year,
      km,
      cena,
      rocznik,
      lata: lata.map(({ year, total, medianPrice }) => ({ year, n: total, mediana: medianPrice })),
      wykres,
      // Tylko pola potrzebne do listy — bez dat, ktore JSON i tak zamienia w napisy.
      podobne: oferty.map((o) => ({
        id: o.id,
        nazwa: [o.make, o.model].filter(Boolean).join(" "),
        year: o.year,
        km: o.mileageKm,
        cena: o.priceGross,
        miasto: o.city,
      })),
    },
    { headers: CACHE_DOBA },
  );
}
