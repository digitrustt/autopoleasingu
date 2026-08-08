"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Powrot ze strony oferty.
 *
 * Wraca do POPRZEDNIEJ strony, a nie do stalego adresu — bo to jest realna
 * roznica dla kogos, kto doszedl tu z listy po ustawieniu piatki filtrow
 * i trzech stronach przewijania. Link do `/` skasowalby to wszystko i
 * odeslal na poczatek, co jest gorsze niz brak przycisku.
 *
 * Gdy historii nie ma (wejscie prosto z Google albo z wklejonego linku),
 * `router.back()` wyprowadzilby czlowieka poza serwis. W takim wypadku
 * pokazujemy zwykly link do strony modelu — tam jest kontekst tego auta.
 */
export function BackButton({ fallbackHref, fallbackLabel }: {
  fallbackHref: string;
  fallbackLabel: string;
}) {
  const router = useRouter();
  /*
   * Ustalamy to dopiero po zamontowaniu. Na serwerze nie ma `window.history`,
   * a wynik i tak rozni sie miedzy uzytkownikami, wiec renderowanie tego
   * w HTML-u dawaloby niezgodnosc z hydracja.
   */
  const [hasHistory, setHasHistory] = useState(false);
  useEffect(() => setHasHistory(window.history.length > 1), []);

  const className =
    "mb-4 inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-[13px] text-neutral-400 transition-colors hover:border-accent/70 hover:text-accent";

  if (!hasHistory) {
    return (
      <a href={fallbackHref} className={className}>
        <ArrowLeft size={15} />
        {fallbackLabel}
      </a>
    );
  }

  return (
    <button type="button" onClick={() => router.back()} className={className}>
      <ArrowLeft size={15} />
      Wróć do wyników
    </button>
  );
}
