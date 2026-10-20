import { Crumbs } from "@/components/Crumbs";
import { Faq, Lista, Sekcja, Uwaga, type Pytanie } from "@/components/Poradnik";
import { WycenaAuta } from "@/components/WycenaAuta";
import { cenyPopularnych, filtryMarek, statystykiNaglowka } from "@/lib/cache-filtrow";
import { modelHref } from "@/lib/slug";
import type { Metadata } from "next";
import Link from "next/link";
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

/**
 * "Wycena samochodu", "ile warte jest moje auto".
 *
 * Konkurencja (skupy, portale) zbiera tu numery telefonow albo liczy z ogolnych
 * tabel. My mamy prawdziwe ceny dziesiatek tysiecy ofert i nic nie chcemy
 * w zamian — to jest cala przewaga i tekst ma ja mowic wprost.
 *
 * Tabela popularnych modeli jest renderowana na serwerze, zeby strona miala
 * tresc z liczbami takze dla robota, ktory nie wypelni formularza.
 */
export default async function WycenaStrona() {
  await connection();
  const [marki, stats, popularne] = await Promise.all([
    filtryMarek(),
    statystykiNaglowka(),
    cenyPopularnych(),
  ]);

  return (
    <main className="mx-auto max-w-[1000px] px-4 py-6">
      <Crumbs items={[{ label: "Wycena samochodu" }]} />

      <h1 className="mb-2 text-2xl font-bold tracking-tight text-neutral-100">
        Wycena samochodu — ile warte jest twoje auto
      </h1>
      <p className="mb-6 max-w-[72ch] text-[15px] leading-relaxed text-neutral-400">
        Wycena na prawdziwych cenach, nie z tabelki: porównujemy twoje auto z ofertami tego samego modelu,
        rocznika i przebiegu z naszej bazy — dziś {num.format(stats.active)} aktualnych ofert, plus te
        już sprzedane. Bez telefonu i maila.
      </p>

      <WycenaAuta marki={marki} />

      <div className="mt-12">
        <Sekcja tytul="Ile kosztują popularne modele — mediana cen ofert">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead className="text-neutral-500">
                <tr className="border-b border-[var(--color-line)]">
                  <th className="py-2 pr-3 font-medium">Model</th>
                  {popularne.lata.map((y) => (
                    <th key={y} className="py-2 pr-3 text-right font-medium">
                      {y}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {popularne.modele.map((m) => (
                  <tr key={`${m.make}|${m.model}`} className="border-b border-[var(--color-line)]/60">
                    <td className="py-2 pr-3">
                      <Link href={modelHref(m.make, m.model)} className="text-neutral-200 hover:text-accent">
                        {m.make} {m.model}
                      </Link>
                    </td>
                    {m.ceny.map((c, i) => (
                      <td key={popularne.lata[i]} className="py-2 pr-3 text-right text-neutral-300">
                        {c != null ? zl.format(c) : <span className="text-neutral-600">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[13px] text-neutral-500">
            Mediana cen ofert „kup teraz” według rocznika, z ofert aktualnych i sprzedanych; puste pole — mniej
            niż pięć aut. Odświeżane raz na dobę.
          </p>
        </Sekcja>

        <Sekcja tytul="Skąd biorą się te liczby">
          <Lista>
            <li>
              Oferty aut poleasingowych z{" "}
              <Link href="/zrodla" className={a}>
                kilkudziesięciu źródeł
              </Link>{" "}
              zbierane codziennie — leasingodawcy, dealerzy, platformy aukcyjne.
            </li>
            <li>Tylko ceny „kup teraz” — licytacje pomijamy, bo ich cena jeszcze rośnie.</li>
            <li>Ten sam egzemplarz (ten sam VIN) wystawiony w kilku miejscach liczymy raz, po najniższej cenie.</li>
            <li>Auta podobne do twojego: ten sam model i rocznik, przebieg ±25 tys. km, opcjonalnie to samo paliwo.</li>
            <li>Mediana zamiast średniej — jedna przeszacowana oferta nie przesuwa wyniku.</li>
          </Lista>
        </Sekcja>

        <Uwaga>
          Wycena pokazuje, za ile podobne auta są wystawiane przez firmy. Nie widzi stanu twojego egzemplarza:
          historii serwisowej, uszkodzeń, wyposażenia. Sprzedając prywatnie, licz się z ceną niższą od mediany,
          a w skupie — wyraźnie niższą.
        </Uwaga>

        <Faq pytania={pytania} />

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
      </div>
    </main>
  );
}
