import { revalidatePath, revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Uniewaznienie cache'u po zaciagu.
 *
 * Strony marek, modeli, miast, leasingodawcow i kategorii maja `revalidate`
 * ustawiony na DOBE — bo to godzinny odswiez wyczerpal limit transferu bazy
 * i zdjal serwis na trzy dni. Sam dobowy odswiez ma jednak wade: liczy sie od
 * PIERWSZEGO WEJSCIA na strone, nie od zaciagu. Strona odwiedzona o 20:00
 * pokazuje dane z 20:00 dnia poprzedniego, mimo ze scraper chodzil o 03:37.
 *
 * Ten endpoint rozwiazuje jedno i drugie: cache trzyma sie doba, ale worker
 * kasuje go zaraz po zaciagu, wiec pierwszy odwiedzajacy dostaje juz swieze
 * dane. Liczba przeliczen zostaje ta sama — raz na dobe — tylko wypada
 * w momencie, w ktorym faktycznie sa nowe oferty.
 *
 * Chroniony sekretem, bo bez niego kazdy moglby kasowac cache w petli
 * i wywolac dokladnie ten problem, przed ktorym sie bronimy.
 */
export async function POST(req: NextRequest) {
  const sekret = process.env.REVALIDATE_SECRET;
  if (!sekret) {
    return NextResponse.json({ error: "REVALIDATE_SECRET nie ustawiony" }, { status: 503 });
  }

  const podany = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (podany !== sekret) {
    return NextResponse.json({ error: "Brak dostępu" }, { status: 401 });
  }

  /*
   * Jedno wywolanie zamiast listy sciezek. Stron jest 1913 i ich adresy
   * zaleza od zawartosci bazy — wyliczanie ich tutaj oznaczaloby powtorzenie
   * logiki slugow i mape strony, ktore i tak rozjechalyby sie przy pierwszej
   * zmianie. `layout` uniewaznia cale drzewo pod korzeniem.
   */
  revalidatePath("/", "layout");
  // Wyniki listy siedza w osobnym cache'u danych — patrz components/Results.tsx.
  revalidateTag("oferty");

  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
