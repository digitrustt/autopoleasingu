import { LegalPage } from "@/components/LegalPage";
import { db, subscriptions } from "@auta/db";
import { eq } from "drizzle-orm";
import { CircleCheck, CircleX } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

/**
 * Wypisanie z powiadomien.
 *
 * Dziala JEDNYM klikniecięm z maila, bez logowania i bez pytania o potwierdzenie.
 * Utrudnianie rezygnacji jest niezgodne z prawem i tak czy owak konczy sie
 * zgloszeniem spamu, co psuje reputacje domeny nadawcy.
 *
 * Rekord zostaje w bazie z data wypisania zamiast byc kasowany — dzieki temu
 * ponowne wejscie w ten sam link nadal pokazuje sensowny komunikat, a nie blad.
 */
export default async function Wypisz({
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
          Ten link jest nieprawidłowy albo powiadomienie już nie istnieje.
        </p>
        <Link href="/" className="text-sm text-neutral-400 underline hover:text-accent">
          Wróć do listy ofert
        </Link>
      </LegalPage>
    );
  }

  if (!row.unsubscribedAt) {
    await db
      .update(subscriptions)
      .set({ unsubscribedAt: new Date() })
      .where(eq(subscriptions.id, row.id));
  }

  return (
    <LegalPage title="Wypisano" updated="">
      <p className="flex items-center gap-2 text-neutral-200">
        <CircleCheck size={18} className="text-emerald-400" />
        Nie wyślemy Ci już powiadomień{row.label ? ` z „${row.label}"` : ""}.
      </p>
      <p className="text-neutral-400">
        Możesz zapisać się ponownie w każdej chwili — formularz jest na stronie z ofertami.
      </p>
      <Link href="/" className="text-sm text-neutral-400 underline hover:text-accent">
        Wróć do listy ofert
      </Link>
    </LegalPage>
  );
}
