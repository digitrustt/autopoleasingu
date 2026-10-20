import { UbezpieczenieBlok } from "@/components/UbezpieczenieBlok";
import { Crumbs } from "@/components/Crumbs";
import { HistoriaBlok } from "@/components/HistoriaBlok";
import { VinSzukaj } from "@/components/VinSzukaj";
import { getStats } from "@/lib/queries";
import { db, listings } from "@auta/db";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { CircleCheck, CircleSlash, Copy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

/*
 * Odswiezanie RAZ NA DOBE, nie co godzine.
 *
 * Zaciag chodzi o 03:37, wiec czesciej nie ma czego przeliczac. Przy 1913
 * stronach i robocie indeksujacym, ktory po nich chodzi, godzinny odswiez
 * oznaczal dwadziescia cztery razy wiecej zapytan, niz wynika ze zmian
 * w danych — i to on przekroczyl limit transferu Neona, zdejmujac caly
 * serwis na trzy dni.
 */
export const revalidate = 86_400;

const num = new Intl.NumberFormat("pl-PL");

export const metadata: Metadata = {
  /*
   * Pod "sprawdz VIN" i "historia pojazdu VIN" (20.10.2026). Wczesniejszy
   * tytul mowil tylko o porownaniu cen, a ludzie wpisuja te frazy po historie.
   * Teraz mozemy ja uczciwie zaoferowac — raport carVertical na stronie.
   */
  title: "Sprawdź VIN — historia pojazdu i ceny tego samego auta",
  description:
    "Wpisz VIN: sprawdzimy, czy ten sam egzemplarz stoi gdzieś taniej w 26 źródłach " +
    "poleasingowych, i pokażemy, gdzie sprawdzić historię — szkody, przebiegi, kradzieże.",
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

/*
 * Render na zadanie, nie przy budowaniu.
 *
 * Przy 235 stronach generowanych rownolegle te agregacje wpadaly w zator
 * i przekraczaly limit 60 s na strone, wywracajac caly build. Same w sobie
 * sa tanie, ale nie ma powodu liczyc ich przy kazdym wdrozeniu — `revalidate`
 * i tak trzyma wynik przez dobe.
 */
export default async function VinLanding() {
  await connection();
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
        Sprawdź VIN: historia i cena auta
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
            Podstawowe dane z CEPiK-u są bezpłatnie w{" "}
            <a
              href="https://historiapojazdu.gov.pl"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-dotted underline-offset-2 hover:text-accent"
            >
              historiapojazdu.gov.pl
            </a>
            , a szkody, przebiegi i kradzieże pokazuje płatny raport carVertical poniżej.
          </p>
        </div>
      </div>

      <HistoriaBlok vin={null} gdzie="vin-strona" wariant="duzy" />

      {/*
        OC pod sekcja "czego nie powiemy", bo to ta sama mysl: mowimy wprost,
        czego u nas nie ma, i pokazujemy, gdzie to jest. Historia pojazdu jest
        za darmo w CEPiK-u i tak tez jest podpisana; porownywarka polis jest
        linkiem partnerskim i tak tez jest podpisana.
      */}
      <UbezpieczenieBlok gdzie="vin-strona" />

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

      {/*
        Pytania pod frazy, z ktorymi ludzie przychodza: "gdzie jest VIN",
        "sprawdz historie auta za darmo", "raport VIN". Odpowiedzi tylko z tego,
        co wiemy na pewno — bez obiecywania danych, ktorych nie mamy.
      */}
      <section className="mt-10 border-t border-[var(--color-line)] pt-6">
        <h2 className="mb-4 text-lg font-semibold text-neutral-100">Pytania o VIN</h2>
        <div className="flex flex-col gap-5 text-[14px] leading-relaxed text-neutral-400">
          <div>
            <h3 className="mb-1 font-medium text-neutral-200">Gdzie znaleźć numer VIN?</h3>
            <p>
              W dowodzie rejestracyjnym (pole E), na tabliczce znamionowej auta i zwykle pod
              przednią szybą po stronie kierowcy. Przy autach poleasingowych VIN często jest też
              wprost w ogłoszeniu — w naszych ofertach pokazujemy go w danych technicznych.
            </p>
          </div>
          <div>
            <h3 className="mb-1 font-medium text-neutral-200">Ile znaków ma VIN?</h3>
            <p>
              Siedemnaście: litery i cyfry, bez liter I, O i Q, żeby nie myliły się z 1 i 0.
              Pierwsze trzy znaki oznaczają producenta.
            </p>
          </div>
          <div>
            <h3 className="mb-1 font-medium text-neutral-200">
              Jak sprawdzić historię auta po VIN za darmo?
            </h3>
            <p>
              W rządowym serwisie historiapojazdu.gov.pl. Oprócz VIN-u potrzebny jest numer
              rejestracyjny i data pierwszej rejestracji, a dane pochodzą z polskiej Centralnej
              Ewidencji Pojazdów.
            </p>
          </div>
          <div>
            <h3 className="mb-1 font-medium text-neutral-200">Co pokazuje płatny raport VIN?</h3>
            <p>
              Raport carVertical po samym numerze VIN pokazuje szkody, przebiegi i kradzieże.
              Usługę sprzedaje carVertical; to link partnerski, a z kodem z przycisku wyżej
              raport jest 20% tańszy.
            </p>
          </div>
          <div>
            <h3 className="mb-1 font-medium text-neutral-200">
              Po co sprawdzać VIN auta poleasingowego?
            </h3>
            <p>
              Ten sam egzemplarz bywa wystawiony równocześnie przez leasingodawcę i dealera,
              po różnych cenach — w wyszukiwarce wyżej zobaczysz wszystkie jego wystawienia.
              A auto kupione na aukcji poleasingowej często wraca do sprzedaży u handlarza:
              jeśli było w naszej bazie, po VIN-ie sprawdzisz, za ile i z jakim przebiegiem
              wystawiano je wcześniej.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
