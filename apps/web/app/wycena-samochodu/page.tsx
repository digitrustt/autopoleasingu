import { Crumbs } from "@/components/Crumbs";
import { Faq, type Pytanie } from "@/components/Poradnik";
import { type SzybkiWybor, WycenaAuta } from "@/components/WycenaAuta";
import { cenyPopularnych, filtryMarek, statystykiNaglowka } from "@/lib/cache-filtrow";
import { modelHref, slugify } from "@/lib/slug";
import { BadgeCheck, Database, Fingerprint } from "lucide-react";
import type { Metadata } from "next";
import Link from "@/components/Link";
import { connection } from "next/server";

/* Raz na dobe i dopiero na zadanie — patrz komentarz w analizy/utrata-wartosci. */
export const revalidate = 86_400;

const zl = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("pl-PL");
const a = "underline decoration-dotted underline-offset-2 hover:text-accent";

export const metadata: Metadata = {
  title: "Wycena samochodu online — ile warte jest twoje auto",
  description:
    "Darmowa wycena auta na prawdziwych cenach ofert: mediana i przedział cen dla modelu, rocznika " +
    "i przebiegu, wykres cena/przebieg i ceny każdego rocznika. Bez podawania danych kontaktowych.",
  alternates: { canonical: "/wycena-samochodu" },
};

const pytania: Pytanie[] = [
  {
    q: "Jak działa wycena samochodu?",
    a:
      "Zbieramy oferty aut poleasingowych z kilkudziesięciu źródeł — leasingodawców, dealerów i aukcji. Dla wybranego " +
      "modelu, rocznika i przebiegu (±25 tys. km) liczymy medianę cen ofert „kup teraz”, aktualnych i już sprzedanych. " +
      "Ten sam egzemplarz wystawiony w kilku miejscach liczymy raz.",
  },
  {
    q: "Czy dostanę za auto tyle, ile pokazuje wycena?",
    a:
      "Zwykle nie wprost. To ceny ofert dealerów i leasingodawców, którzy dają fakturę i często gwarancję. Sprzedając " +
      "prywatnie, realnie dostaje się mniej, a skup płaci jeszcze mniej, bo musi auto odsprzedać z zyskiem.",
  },
  {
    q: "Czy wycena jest darmowa i czy trzeba zostawić telefon?",
    a: "Jest darmowa i nie wymaga żadnych danych kontaktowych. Nie przekazujemy nikomu tego, co wpiszesz.",
  },
  {
    q: "Dlaczego nie ma wyceny dla mojego auta?",
    a:
      "Gdy podobnych ofert jest mniej niż pięć, mediana byłaby przypadkiem, a nie ceną rynkową, więc jej nie pokazujemy. " +
      "Najlepiej działa dla popularnych aut z ostatnich kilku lat — takich najwięcej wraca z leasingu.",
  },
];

const METODA: [string, string][] = [
  ["Prawdziwe oferty", "Kilkadziesiąt źródeł poleasingowych zbieranych codziennie — leasingodawcy, dealerzy, aukcje."],
  ["Tylko „kup teraz”", "Licytacje pomijamy — ich cena to bieżąca stawka, która jeszcze urośnie."],
  ["Jedno auto, jeden głos", "Ten sam VIN wystawiony w kilku miejscach liczymy raz, po najniższej cenie."],
  ["Mediana, nie średnia", "Jedna przeszacowana oferta nie przesuwa wyniku. Poniżej 5 aut nie zgadujemy."],
];

/**
 * "Wycena samochodu", "ile warte jest moje auto".
 *
 * Konkurencja (skupy, portale) zbiera tu numery telefonow albo liczy z ogolnych
 * tabel. My mamy prawdziwe ceny dziesiatek tysiecy ofert i nic nie chcemy
 * w zamian — to jest cala przewaga i tekst ma ja mowic wprost.
 *
 * H1 i opis renderuja sie tu, na serwerze, i ida do WycenaAuta jako `children`
 * — uklad (naglowek obok formularza) trzyma komponent kliencki. Tabela
 * popularnych modeli tez jest z serwera, zeby strona miala tresc z liczbami
 * dla robota, ktory nie wypelni formularza.
 */
export default async function WycenaStrona() {
  await connection();
  const [marki, stats, popularne] = await Promise.all([
    filtryMarek(),
    statystykiNaglowka(),
    cenyPopularnych(),
  ]);

  // Przyklady do jednego klikniecia: typowe auto z leasingu — cztery lata, ok. 90 tys. km.
  const rokPrzykladu = popularne.lata[Math.min(4, popularne.lata.length - 1)];
  const iRok = popularne.lata.indexOf(rokPrzykladu);
  const szybkie: SzybkiWybor[] = popularne.modele
    .filter((m) => m.ceny[iRok] != null)
    .slice(0, 4)
    .map((m) => ({
      etykieta: `${m.make} ${m.model} ${rokPrzykladu}`,
      marka: m.make,
      model: slugify(m.model),
      rok: rokPrzykladu,
      km: 90_000,
    }));

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-6">
      <Crumbs items={[{ label: "Wycena samochodu" }]} />

      <WycenaAuta marki={marki} szybkie={szybkie}>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-100 sm:text-4xl">
          Ile warte jest twoje auto?
        </h1>
        <p className="mt-3 max-w-[56ch] text-[15px] leading-relaxed text-neutral-400">
          Wycena samochodu na prawdziwych cenach, nie z tabelki: porównujemy twoje auto z ofertami tego samego
          modelu, rocznika i przebiegu. Wynik w sekundę.
        </p>
        <ul className="mt-6 flex flex-col gap-3 text-[14px] text-neutral-300">
          <li className="flex items-center gap-3">
            <Database size={18} className="shrink-0 text-[var(--chart-1)]" />
            <span>
              <strong className="font-semibold text-neutral-100">{num.format(stats.active)}</strong> aktualnych ofert
              i dziesiątki tysięcy sprzedanych
            </span>
          </li>
          <li className="flex items-center gap-3">
            <Fingerprint size={18} className="shrink-0 text-[var(--chart-1)]" />
            <span>To samo auto w kilku serwisach liczymy raz — po numerze VIN</span>
          </li>
          <li className="flex items-center gap-3">
            <BadgeCheck size={18} className="shrink-0 text-[var(--chart-1)]" />
            <span>Bez telefonu, maila i rejestracji</span>
          </li>
        </ul>
      </WycenaAuta>

      <section className="mt-16">
        <h2 className="text-xl font-semibold text-neutral-100">Ile kosztują popularne modele</h2>
        <p className="mb-4 mt-1 text-[13px] text-neutral-500">
          Mediana cen ofert „kup teraz” według rocznika, z ofert aktualnych i sprzedanych. Puste pole — mniej niż
          pięć aut. Odświeżane raz na dobę.
        </p>
        <div className="overflow-x-auto rounded-xl border border-[var(--color-line)]">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line)] bg-[var(--color-panel)] text-left text-[11px] uppercase tracking-wide text-neutral-600">
                <th className="sticky left-0 bg-[var(--color-panel)] px-4 py-2.5 font-medium">Model</th>
                {popularne.lata.map((y) => (
                  <th key={y} className="px-4 py-2.5 text-right font-medium">
                    {y}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {popularne.modele.map((m) => (
                <tr
                  key={`${m.make}|${m.model}`}
                  className="border-b border-[var(--color-line)] last:border-0 hover:bg-[var(--color-panel)]"
                >
                  <td className="sticky left-0 bg-[var(--color-ink)] px-4 py-2.5 font-medium">
                    <Link href={modelHref(m.make, m.model)} className="text-neutral-200 hover:text-accent">
                      {m.make} {m.model}
                    </Link>
                  </td>
                  {m.ceny.map((c, i) => (
                    <td key={popularne.lata[i]} className="px-4 py-2.5 text-right tabular-nums text-neutral-300">
                      {c != null ? zl.format(c) : <span className="text-neutral-700">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-14">
        <h2 className="mb-4 text-xl font-semibold text-neutral-100">Skąd biorą się te liczby</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {METODA.map(([t, o]) => (
            <div key={t} className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
              <p className="font-medium text-neutral-100">{t}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-neutral-400">{o}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 max-w-[80ch] text-[13px] leading-relaxed text-neutral-500">
          Wycena nie widzi stanu twojego egzemplarza — historii serwisowej, uszkodzeń, wyposażenia. Pełna lista
          źródeł:{" "}
          <Link href="/zrodla" className={a}>
            skąd bierzemy oferty
          </Link>
          .
        </p>
      </section>

      <div className="mt-14">
        <Faq pytania={pytania} />
      </div>

      <p className="text-[14px] text-neutral-400">
        Zobacz też:{" "}
        <Link href="/analizy/utrata-wartosci" className={a}>
          utrata wartości aut po roczniku
        </Link>{" "}
        ·{" "}
        <Link href="/kalkulator-pcc-samochodu" className={a}>
          kalkulator PCC i opłat rejestracyjnych
        </Link>{" "}
        ·{" "}
        <Link href="/vin" className={a}>
          sprawdź VIN
        </Link>
      </p>
    </main>
  );
}
