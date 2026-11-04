import { Crumbs } from "@/components/Crumbs";
import { Faq, Sekcja, Uwaga, type Pytanie } from "@/components/Poradnik";
import { VinSzukaj } from "@/components/VinSzukaj";
import { wmiStaty } from "@/lib/cache-filtrow";
import { OPIS_WERDYKTU, krajZVin, vinMarkiHref, wgMarek, werdykt } from "@/lib/vin";
import type { Metadata } from "next";
import Link from "@/components/Link";
import { connection } from "next/server";

/* Raz na dobe i dopiero na zadanie — patrz komentarz w analizy/utrata-wartosci. */
export const revalidate = 86_400;

const num = new Intl.NumberFormat("pl-PL");
const proc = (x: number) => `${Math.round(x * 100)}%`;
const a = "underline decoration-dotted underline-offset-2 hover:text-accent";

export const metadata: Metadata = {
  title: "Kody producentów w VIN (WMI) — tabela: WBA, TMB, YV1, VF1 i inne",
  description:
    "Jaka marka kryje się za pierwszymi trzema znakami VIN-u: tabela kodów WMI z kraju " +
    "i liczbą numerów sprawdzonych w ofertach poleasingowych, plus czy dany kod zapisuje rok.",
  alternates: { canonical: "/poradnik/kody-producentow-vin" },
};

/**
 * "WMI", "kod producenta VIN", "WBA VIN co to". Tabela z NASZEJ bazy, nie
 * przepisana z Wikipedii: tylko kody, ktore realnie widac na polskim rynku
 * poleasingowym, z liczba numerow i zmierzonym zapisem roku.
 */
export default async function KodyWmi() {
  await connection();
  const staty = await wmiStaty();
  const marki = new Set(wgMarek(staty).map((m) => m.make));
  const razem = staty.reduce((x, s) => x + s.n, 0);
  const przyklad = (wmi: string) => staty.find((s) => s.wmi === wmi)?.make;

  const pytania: Pytanie[] = [
    {
      q: "Co to jest WMI w numerze VIN?",
      a:
        "World Manufacturer Identifier — pierwsze trzy znaki VIN-u, które wskazują producenta. " +
        "Pierwszy znak oznacza region albo kraj, kolejne dwa konkretnego producenta lub fabrykę.",
    },
    ...(["WBA", "TMB", "VF1"] as const)
      .filter((k) => przyklad(k))
      .map((k) => ({
        q: `Jaka marka ma VIN zaczynający się od ${k}?`,
        a: `${przyklad(k)}. Kod ${k} jest zarejestrowany w kraju: ${krajZVin(k) ?? "brak danych"}.`,
      })),
    {
      q: "Dlaczego jedna marka ma kilka kodów?",
      a:
        "Bo kod przypisuje się producentowi w danym kraju albo fabryce. Toyota z Europy, Japonii " +
        "i USA ma różne pierwsze znaki, a Mercedes osobne kody dla osobówek i dostawczaków.",
    },
  ];

  return (
    <main className="mx-auto max-w-[860px] px-4 py-6">
      <Crumbs
        items={[{ label: "Poradniki", href: "/poradnik" }, { label: "Kody producentów w VIN" }]}
      />

      <h1 className="mb-2 text-2xl font-bold tracking-tight text-neutral-100">
        Kody producentów w numerze VIN (WMI)
      </h1>
      <p className="mb-6 max-w-[72ch] text-[15px] leading-relaxed text-neutral-400">
        Pierwsze trzy znaki VIN-u mówią, kto zrobił auto. Poniżej {staty.length} kodów, które
        widzimy w ofertach poleasingowych, policzonych na {num.format(razem)} numerach — z marką,
        krajem kodu i tym, czy 10. znak naprawdę oznacza u nich rok.
      </p>

      <div className="mb-8">
        <VinSzukaj />
      </div>

      <Sekcja tytul="Tabela kodów WMI">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[13px]">
            <thead className="text-neutral-500">
              <tr className="border-b border-[var(--color-line)]">
                <th className="py-2 pr-3 font-medium">Kod</th>
                <th className="py-2 pr-3 font-medium">Marka</th>
                <th className="py-2 pr-3 font-medium">Kraj kodu</th>
                <th className="py-2 pr-3 text-right font-medium">Numerów</th>
                <th className="py-2 font-medium">Rok z 10. znaku</th>
              </tr>
            </thead>
            <tbody>
              {staty.map((s) => {
                const w = OPIS_WERDYKTU[werdykt(s.zgodnosc)];
                return (
                  <tr key={s.wmi} className="border-b border-[var(--color-line)]/60">
                    <td className="py-2 pr-3 font-mono text-neutral-200">{s.wmi}</td>
                    <td className="py-2 pr-3">
                      {marki.has(s.make) ? (
                        <Link href={vinMarkiHref(s.make)} className={a}>
                          {s.make}
                        </Link>
                      ) : (
                        <span className="text-neutral-300">{s.make}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-neutral-400">{krajZVin(s.wmi) ?? "—"}</td>
                    <td className="py-2 pr-3 text-right text-neutral-400">{num.format(s.n)}</td>
                    <td className={`py-2 ${w.kolor}`}>
                      {w.tekst} <span className="text-neutral-500">({proc(s.zgodnosc)})</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Sekcja>

      <Uwaga>
        Kraj kodu to kraj, w którym producent zarejestrował dany kod — zwykle kraj fabryki, ale nie
        zawsze (koncerny potrafią używać jednego kodu dla kilku zakładów). Pokazujemy tylko kody
        z co najmniej 30 numerami w naszej bazie, przypisane w 95% do jednej marki. Dane
        odświeżają się raz na dobę.
      </Uwaga>

      <Faq pytania={pytania} />

      <p className="text-[14px] text-neutral-400">
        Zobacz też:{" "}
        <Link href="/poradnik/rok-produkcji-z-vin" className={a}>
          jak odczytać rok produkcji z VIN
        </Link>{" "}
        ·{" "}
        <Link href="/poradnik/gdzie-jest-numer-vin" className={a}>
          gdzie jest numer VIN
        </Link>
      </p>
    </main>
  );
}
