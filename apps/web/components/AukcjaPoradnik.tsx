import { Crumbs } from "@/components/Crumbs";
import { OfferCard } from "@/components/OfferCard";
import { Faq, Lista, type Pytanie, Sekcja, Uwaga } from "@/components/Poradnik";
import { StatStrip } from "@/components/StatStrip";
import { ZapisPasek } from "@/components/ZapisPasek";
import { getFilterStats, getListings } from "@/lib/queries";
import { Gavel } from "lucide-react";
import Link from "next/link";

const num = new Intl.NumberFormat("pl-PL");

export interface AukcjaTresc {
  /** Identyfikator zrodla w bazie — z niego ida liczby i lista aut. */
  sourceId: string;
  /** "PKO Leasing" — do zdan. */
  nazwa: string;
  h1: string;
  /** Kto organizuje i gdzie — jedno, dwa zdania. */
  wstep: string;
  /** Zasady wyczytane z regulaminu. */
  zasady: string[];
  /** Kroki od rejestracji do odbioru. */
  kroki: string[];
  /** Na co uwazac — rzeczy, ktore kosztuja pieniadze. */
  pulapki: string[];
  faq: Pytanie[];
  regulaminUrl: string;
  /** Kiedy czytalismy regulamin — pokazywane na stronie. */
  stanNa: string;
}

/**
 * Poradnik do jednej platformy aukcyjnej: zasady z regulaminu + zywe dane.
 *
 * Wspolny widok dla PKO Leasing i EFL, bo odpowiadaja na to samo pytanie
 * ("jak licytowac na aukcjach X") i roznia sie wylacznie trescia.
 */
export async function AukcjaPoradnik({ t }: { t: AukcjaTresc }) {
  const [stats, auta] = await Promise.all([
    getFilterStats({ source: t.sourceId }),
    getListings({ source: t.sourceId, sort: "new" }, 1, 12),
  ]);

  return (
    <main className="mx-auto max-w-[1100px] px-4 py-6">
      <Crumbs items={[{ label: "Poradniki", href: "/poradnik" }, { label: t.nazwa }]} />

      <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight text-neutral-100">
        <Gavel size={22} className="text-neutral-600" />
        {t.h1}
      </h1>
      <p className="mb-5 mt-1 max-w-[72ch] text-sm leading-relaxed text-neutral-400">{t.wstep}</p>

      {stats.total > 0 && (
        <StatStrip
          items={[
            { label: "Aut na aukcjach dziś", value: num.format(stats.total), hint: "osobowe" },
            { label: "Marek", value: num.format(stats.makes) },
            {
              label: "Przebieg",
              value: stats.medianMileage != null ? `${num.format(stats.medianMileage)} km` : "—",
              hint: "mediana",
            },
            { label: "Nowych dziś", value: num.format(stats.newToday) },
          ]}
        />
      )}

      <Sekcja tytul="Zasady w skrócie">
        <Lista>
          {t.zasady.map((z) => (
            <li key={z}>{z}</li>
          ))}
        </Lista>
      </Sekcja>

      <Sekcja tytul="Jak wygląda zakup krok po kroku">
        <ol className="flex list-decimal flex-col gap-1.5 pl-5">
          {t.kroki.map((k) => (
            <li key={k}>{k}</li>
          ))}
        </ol>
      </Sekcja>

      <Sekcja tytul="Na co uważać">
        <Lista>
          {t.pulapki.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </Lista>
      </Sekcja>

      <Uwaga>
        Zasady opisujemy na podstawie regulaminu platformy w brzmieniu z {t.stanNa}. Regulamin może
        się zmienić, a o warunkach konkretnej aukcji decyduje jej opis — przed licytacją przeczytaj{" "}
        <a
          href={t.regulaminUrl}
          target="_blank"
          rel="noopener nofollow"
          className="underline decoration-dotted underline-offset-2 hover:text-accent"
        >
          aktualny regulamin
        </a>
        . To nie jest porada prawna.
      </Uwaga>

      {auta.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-neutral-100">
              Najnowsze auta na aukcjach {t.nazwa}
            </h2>
            <Link
              href={`/leasingodawca/${t.sourceId}`}
              className="rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-[13px] text-neutral-400 transition-colors hover:border-accent/70 hover:text-accent"
            >
              Wszystkie {num.format(stats.total)}
            </Link>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
            {auta.map((o, i) => (
              <OfferCard key={o.id} o={o} index={i} />
            ))}
          </div>
          <p className="mt-2 text-[12px] text-neutral-600">
            Ceny na kartach to bieżące stawki licytacji przeliczone na brutto — do końca aukcji
            mogą wzrosnąć.
          </p>
        </section>
      )}

      <Faq pytania={t.faq} />

      <ZapisPasek
        typ="poradnik-aukcja"
        tytul={`Powiadomić o nowych autach na aukcjach ${t.nazwa}?`}
        opis="Jeden mail dziennie, tylko gdy na tej platformie pojawią się nowe auta."
        label={`Aukcje ${t.nazwa}`}
        filters={{ source: t.sourceId }}
      />

      <p className="mt-6 text-[13px] text-neutral-500">
        Zobacz też:{" "}
        <Link
          href="/poleasingowe/dla-osoby-prywatnej"
          className="underline decoration-dotted underline-offset-2 hover:text-accent"
        >
          auta poleasingowe dla osoby prywatnej
        </Link>{" "}
        i{" "}
        <Link
          href="/analizy/raport-rynku-poleasingowego"
          className="underline decoration-dotted underline-offset-2 hover:text-accent"
        >
          raport rynku poleasingowego
        </Link>
        .
      </p>
    </main>
  );
}
