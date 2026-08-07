import { LegalPage } from "@/components/LegalPage";
import { db, subscriptions } from "@auta/db";
import { eq } from "drizzle-orm";
import { CircleCheck, CircleX } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

/**
 * Potwierdzenie zapisu (drugi krok double opt-in).
 *
 * Dopiero tutaj subskrypcja zaczyna cokolwiek robic — wysylka bierze wylacznie
 * rekordy z `confirmedAt`. Ponowne wejscie w link jest bezpieczne: ustawiamy
 * date tylko wtedy, gdy jest pusta.
 */
export default async function Potwierdz({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  const row = token
    ? (await db.select().from(subscriptions).where(eq(subscriptions.token, token)))[0]
    : undefined;

  if (!row) {
    return (
      <LegalPage title="Nie znaleziono" updated="">
        <p className="flex items-center gap-2 text-neutral-300">
          <CircleX size={18} className="text-rose-400" />
          Ten link jest nieprawidłowy albo powiadomienie zostało już usunięte.
        </p>
        <Link href="/" className="text-sm text-neutral-400 underline hover:text-accent">
          Wróć do listy ofert
        </Link>
      </LegalPage>
    );
  }

  if (!row.confirmedAt) {
    await db
      .update(subscriptions)
      .set({ confirmedAt: new Date(), unsubscribedAt: null })
      .where(eq(subscriptions.id, row.id));
  }

  return (
    <LegalPage title="Powiadomienia włączone" updated="">
      <p className="flex items-center gap-2 text-neutral-200">
        <CircleCheck size={18} className="text-emerald-400" />
        Gotowe{row.label ? `: ${row.label}` : ""}.
      </p>
      <p className="text-neutral-400">
        Będziemy wysyłać maila, gdy pojawią się nowe oferty pasujące do Twoich filtrów.
        Sprawdzamy raz na dobę — nie zasypiemy Cię wiadomościami. W każdym mailu jest link
        do wypisania się.
      </p>
      <Link href="/" className="text-sm text-neutral-400 underline hover:text-accent">
        Wróć do listy ofert
      </Link>
    </LegalPage>
  );
}
