import { welcomeSubscription } from "@auta/core";
import { db, subscriptions } from "@auta/db";
import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { resolve4, resolveMx } from "node:dns/promises";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Filtry, ktore wolno zapisac. Whitelist, zeby nie wpuscic dowolnego jsona do bazy. */
const ALLOWED = [
  "q", "make", "model", "source", "priceMin", "priceMax",
  "yearMin", "yearMax", "mileageMax", "powerMin",
  "fuel", "gearbox", "body", "kind", "dealMin",
  /*
   * `city` i `bodyGroup` doszly razem z paskami zapisu na stronach miast
   * i kategorii. Bez nich zapis "powiadom o ofertach w Krakowie" przechodzil
   * walidacje, ale zapisywal sie BEZ filtra — czyli jako ogolny newsletter,
   * mimo obietnicy zlozonej na stronie. Obie kolumny obsluguje whereFor
   * z lib/queries, wiec worker dopasowuje je tak samo jak wyszukiwarka.
   */
  "city", "bodyGroup",
] as const;

/**
 * Czy domena adresu w ogole przyjmuje poczte.
 *
 * Bez potwierdzenia linkiem (patrz welcomeSubscription w @auta/core) literowka
 * w domenie nie konczy sie juz cicho w niepotwierdzonym rekordzie, tylko
 * codziennym mailem odbijanym przez serwer. Odbicia to najszybszy sposob, zeby
 * Onet i WP uznaly domene nadawcy za spamera — a wtedy maile przestaja dochodzic
 * WSZYSTKIM, nie tylko pomylonemu adresowi.
 *
 * Odrzucamy wylacznie domene, ktora na pewno nie istnieje albo nie ma ani MX,
 * ani adresu. Kazda inna sytuacja — wolny DNS, blad sieci — przepuszcza zapis:
 * lepiej jeden odbity mail niz odprawiony czlowiek z poprawnym adresem.
 */
async function domenaPrzyjmujePoczte(domena: string): Promise<boolean> {
  const brak = (e: unknown) => {
    const kod = (e as { code?: string }).code;
    return kod === "ENOTFOUND" || kod === "ENODATA";
  };
  const zLimitem = <T>(p: Promise<T>) =>
    Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej({ code: "TIMEOUT" }), 3000))]);

  try {
    const mx = await zLimitem(resolveMx(domena));
    if (mx.length > 0) return true;
  } catch (e) {
    if (!brak(e)) return true;
  }
  // Bez rekordu MX poczta idzie na adres samej domeny (RFC 5321) — rzadkie, ale poprawne.
  try {
    await zLimitem(resolve4(domena));
    return true;
  } catch (e) {
    return !brak(e);
  }
}

/**
 * Zapis na powiadomienia.
 *
 * Zwraca ten sam komunikat niezaleznie od tego, czy adres juz istnieje —
 * inaczej formularz stalby sie narzedziem do sprawdzania, kto jest zapisany.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe żądanie" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  // Walidacja celowo luzna: rygorystyczne regexy na maile odrzucaja poprawne adresy.
  if (!/^[^@\s]+@[^@\s.]+\.[^@\s]{2,}$/.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Podaj poprawny adres e-mail" }, { status: 400 });
  }

  /*
   * Pulapka na boty. Pole `website` jest w formularzu, ale czlowiek go nie widzi
   * i nie wypelni; automat wypelniajacy wszystkie pola — tak. Odpowiadamy
   * sukcesem, zeby bot nie mial sygnalu, ze cos go zatrzymalo.
   *
   * Bez potwierdzenia linkiem to jest pierwsza linia obrony przed zapisami
   * cudzych adresow hurtem.
   */
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const domena = email.split("@")[1];
  if (!(await domenaPrzyjmujePoczte(domena))) {
    return NextResponse.json(
      { error: `Domena „${domena}" nie przyjmuje poczty — sprawdź, czy nie ma literówki` },
      { status: 400 },
    );
  }

  const labelRaw = typeof body.label === "string" ? body.label.trim().slice(0, 80) || null : null;

  const raw = (body.filters ?? {}) as Record<string, unknown>;
  const filters: Record<string, string> = {};
  for (const k of ALLOWED) {
    const v = raw[k];
    if (v != null && String(v).trim() !== "") filters[k] = String(v).trim().slice(0, 60);
  }
  /*
   * Zapis BEZ filtrow jest dozwolony i daje dzienny przeglad najlepszych okazji.
   *
   * Poczatkowo bylo tu twarde odrzucenie — z obawy przed "setkami maili".
   * Obawa byla nieuzasadniona: alerty chodza RAZ NA DOBE z limitem 12 ofert
   * na wiadomosc, a worker sortuje po deal score. Zapis bez filtrow to wiec
   * jeden mail dziennie z dwunastoma najlepszymi okazjami z ~3,5 tys. nowych
   * ofert, czyli zwykly newsletter, a nie zalew.
   */
  const label =
    labelRaw ?? (Object.keys(filters).length === 0 ? "Najlepsze nowe okazje" : null);

  /*
   * Prosty limit: pieciu zapisow na adres. Bez tego jeden formularz pozwala
   * zalozyc dowolnie duzo subskrypcji i zamienic wysylke w narzedzie do
   * zasypywania czyjejs skrzynki.
   */
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(subscriptions)
    .where(and(eq(subscriptions.email, email), isNull(subscriptions.unsubscribedAt)));
  if (n >= 5) {
    return NextResponse.json(
      { error: "Ten adres ma już maksymalną liczbę powiadomień (5)" },
      { status: 429 },
    );
  }

  /*
   * Ten sam adres z tym samym zestawem filtrow = jeden zapis, nie dwa.
   *
   * Zdarzone naprawde: jedna osoba zapisala sie 6.09 o 11:24 z nakladki i o 17:08
   * ze stopki, oba razy bez filtrow. Powstaly dwa identyczne wiersze, a worker
   * iteruje po wierszach — nazajutrz poszlyby DWA identyczne maile. Limit pieciu
   * zapisow tego nie lapal, bo pilnuje liczby, nie powtorzen.
   *
   * Odpowiadamy tak samo jak przy nowym zapisie: cisza o tym, ze adres juz
   * istnieje, jest tu celowa (patrz komentarz na gorze) — inaczej formularz
   * staje sie narzedziem do sprawdzania, kto jest zapisany.
   */
  const [istniejacy] = await db
    .select({ id: subscriptions.id, token: subscriptions.token, confirmedAt: subscriptions.confirmedAt })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.email, email),
        isNull(subscriptions.unsubscribedAt),
        // jsonb porownuje sie wprost i nie zalezy od kolejnosci kluczy.
        sql`${subscriptions.filters} = ${JSON.stringify(filters)}::jsonb`,
      ),
    )
    .limit(1);

  if (istniejacy?.confirmedAt) {
    return NextResponse.json({ ok: true, duplikat: true });
  }

  /*
   * `confirmedAt` znaczy teraz "od kiedy aktywne", a nie "kiedy kliknal w link".
   * Ustawiamy je od razu — wysylka w workerze bierze wylacznie rekordy z ta data.
   *
   * NIEPOTWIERDZONY ZAPIS SPRZED ZMIANY WLACZAMY PRZY PONOWNYM ZAPISIE. Wczesniej
   * ta sama sciezka zwracala "duplikat" i konczyla sie niczym: czlowiek, ktory
   * nie znalazl maila potwierdzajacego i zapisal sie drugi raz, zostawal
   * nieaktywny NA ZAWSZE, bez zadnego komunikatu. Drugi zapis tym samym adresem
   * na te same filtry to najmocniejszy mozliwy sygnal, ze chce powiadomien.
   */
  let token: string;
  if (istniejacy) {
    token = istniejacy.token;
    await db
      .update(subscriptions)
      .set({ confirmedAt: new Date(), label })
      .where(eq(subscriptions.id, istniejacy.id));
  } else {
    token = randomBytes(24).toString("base64url");
    await db.insert(subscriptions).values({ email, label, filters, token, confirmedAt: new Date() });
  }

  /*
   * Nieudany mail powitalny NIE psuje zapisu. Subskrypcja jest juz aktywna
   * i jutrzejsza wysylka pojdzie normalnie — odmowa w tym miejscu kazalaby
   * czlowiekowi zapisywac sie drugi raz na cos, co juz dziala.
   */
  const res = await welcomeSubscription(email, token, label);
  if (!res.ok && !res.skipped) {
    console.error("mail powitalny nie wyszedl:", res.error);
  }

  return NextResponse.json({
    ok: true,
    // `skipped` = brak klucza Resend; mowimy o tym wprost tylko w devie.
    dev: res.skipped ? "RESEND_API_KEY nie ustawiony — mail nie został wysłany" : undefined,
  });
}
