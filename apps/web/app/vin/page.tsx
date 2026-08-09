import { Crumbs } from "@/components/Crumbs";
import { VinSzukaj } from "@/components/VinSzukaj";
import { getStats } from "@/lib/queries";
import { db, listings } from "@auta/db";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { CircleCheck, CircleSlash, Copy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const revalidate = 3600;

const num = new Intl.NumberFormat("pl-PL");

export const metadata: Metadata = {
  title: "Sprawdź VIN — czy to auto stoi gdzieś taniej",
  description:
    "Wklej VIN i sprawdź, czy ten sam egzemplarz nie jest wystawiony w innym miejscu po innej " +
    "cenie. Porównujemy 26 źródeł poleasingowych po numerze nadwozia.",
  alternates: { canonical: "/vin" },
};

/**
 * Wyszukiwarka po VIN.
 *
 * NIE JEST to konkurencja dla historiapojazdu.gov.pl i nie udaje nia byc.
 * Historii wypadkowej ani przebiegu z CEPiK nie mamy i mowimy to wprost na
 * stronie — obiecywanie tego byloby przynęta.
 *
 * Odpowiadamy na jedno pytanie, na ktore nie odpowie nikt inny: czy TA SAMA
 * sztuka stoi rownoczesnie gdzies indziej i po ile. Zaobserwowany rekord to
 * 80 000 zl roznicy na tym samym numerze nadwozia.
 */
export default async function VinLanding() {
  const [stats, [vinStats]] = await Promise.all([
    getStats(),
    db
      .select({
        zVin: sql<number>`count(distinct ${listings.vin})::int`,
        blizniaki: sql<number>`count(*) filter (where true)::int`,
      })
      .from(listings)
      .where(and(eq(listings.status, "active"), isNotNull(listings.vin))),
  ]);

  return (
    <main className="mx-auto max-w-[760px] px-4 py-6">
      <Crumbs items={[{ label: "Sprawdź VIN" }]} />

      <h1 className="text-2xl font-bold tracking-tight text-neutral-100">
        Czy to auto stoi gdzieś taniej?
      </h1>
      <p className="mb-5 mt-1 text-sm leading-relaxed text-neutral-400">
        Wklej numer VIN. Sprawdzimy, czy ten sam egzemplarz nie jest wystawiony równocześnie
        w innym miejscu — i po ile. Mamy {num.format(vinStats?.zVin ?? 0)} numerów nadwozia
        z {num.format(stats.active)} aktualnych ofert.
      </p>

      <div className="mb-6">
        <VinSzukaj autoFocus />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-medium text-neutral-100">
            <CircleCheck size={16} className="shrink-0 text-emerald-400" />
            Co powiemy
          </p>
          <ul className="flex flex-col gap-1.5 text-[13px] leading-relaxed text-neutral-400">
            <li>Czy ta sama sztuka stoi u kilku sprzedawców i jaka jest różnica ceny</li>
            <li>Jak zmieniała się cena, odkąd auto jest w naszej bazie</li>
            <li>Pełną specyfikację zebraną ze wszystkich ofert tego egzemplarza</li>
            <li>Czy cena odstaje od mediany rynkowej dla tego rocznika i przebiegu</li>
          </ul>
        </div>

        <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-medium text-neutral-100">
            <CircleSlash size={16} className="shrink-0 text-amber-400" />
            Czego nie powiemy
          </p>
          {/*
            To musi byc na stronie i to widocznie. Ludzie szukajacy "sprawdz VIN"
            chca historii wypadkowej — jesli tego nie napiszemy wprost, wejda
            i poczuja sie oszukani.
          */}
          <ul className="flex flex-col gap-1.5 text-[13px] leading-relaxed text-neutral-400">
            <li>Historii wypadkowej i szkód</li>
            <li>Przebiegu z odczytów CEPiK</li>
            <li>Liczby właścicieli i zdarzeń rejestracyjnych</li>
          </ul>
          <p className="mt-2 text-[13px] leading-relaxed text-neutral-500">
            Tego szukaj w{" "}
            <a
              href="https://historiapojazdu.gov.pl"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-dotted underline-offset-2 hover:text-accent"
            >
              historiapojazdu.gov.pl
            </a>{" "}
            — oficjalnie i bezpłatnie.
          </p>
        </div>
      </div>

      <p className="mt-6 flex items-start gap-2 text-[13px] leading-relaxed text-neutral-500">
        <Copy size={15} className="mt-0.5 shrink-0 text-neutral-600" />
        <span>
          Ten sam VIN u dwóch sprzedawców to nie pomyłka — auto bywa wystawiane równocześnie
          przez leasingodawcę i dealera, po różnych cenach. Największa różnica, jaką dotąd
          zanotowaliśmy, to 80 000 zł na jednym egzemplarzu.{" "}
          <Link href="/" className="underline decoration-dotted underline-offset-2 hover:text-accent">
            Zobacz wszystkie oferty
          </Link>
          .
        </span>
      </p>
    </main>
  );
}
