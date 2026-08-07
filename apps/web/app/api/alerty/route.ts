import { confirmSubscription } from "@auta/core";
import { db, subscriptions } from "@auta/db";
import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Filtry, ktore wolno zapisac. Whitelist, zeby nie wpuscic dowolnego jsona do bazy. */
const ALLOWED = [
  "q", "make", "model", "source", "priceMin", "priceMax",
  "yearMin", "yearMax", "mileageMax", "powerMin",
  "fuel", "gearbox", "body", "kind", "dealMin",
] as const;

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

  const label = typeof body.label === "string" ? body.label.trim().slice(0, 80) || null : null;

  const raw = (body.filters ?? {}) as Record<string, unknown>;
  const filters: Record<string, string> = {};
  for (const k of ALLOWED) {
    const v = raw[k];
    if (v != null && String(v).trim() !== "") filters[k] = String(v).trim().slice(0, 60);
  }
  if (Object.keys(filters).length === 0) {
    return NextResponse.json(
      { error: "Ustaw przynajmniej jeden filtr, inaczej alert obejmie wszystko" },
      { status: 400 },
    );
  }

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

  const token = randomBytes(24).toString("base64url");
  await db.insert(subscriptions).values({ email, label, filters, token });

  const res = await confirmSubscription(email, token, label);
  if (!res.ok && !res.skipped) {
    return NextResponse.json({ error: "Nie udało się wysłać maila" }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    // `skipped` = brak klucza Resend; mowimy o tym wprost tylko w devie.
    dev: res.skipped ? "RESEND_API_KEY nie ustawiony — mail nie został wysłany" : undefined,
  });
}
