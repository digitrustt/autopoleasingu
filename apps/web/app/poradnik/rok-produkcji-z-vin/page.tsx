import { Crumbs } from "@/components/Crumbs";
import { HistoriaBlok } from "@/components/HistoriaBlok";
import { Faq, Lista, Sekcja, Uwaga, type Pytanie } from "@/components/Poradnik";
import { VinSzukaj } from "@/components/VinSzukaj";
import { wmiStaty } from "@/lib/cache-filtrow";
import { KODY_ROKU, type Marka, OPIS_WERDYKTU as OPIS, wgMarek } from "@/lib/vin";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

/* Raz na dobe i dopiero na zadanie — patrz komentarz w analizy/utrata-wartosci. */
export const revalidate = 86_400;

const num = new Intl.NumberFormat("pl-PL");
const proc = (x: number) => `${Math.round(x * 100)}%`;
const a = "underline decoration-dotted underline-offset-2 hover:text-accent";

export const metadata: Metadata = {
  title: "Rok produkcji z VIN — jak odczytać i u których marek to nie działa",
  description:
    "Który znak VIN oznacza rok, tabela kodów 2001–2030 i wynik sprawdzenia na dziesiątkach " +
    "tysięcy numerów: u Skody czy Volvo działa, u BMW, Toyoty i Renault — nie.",
  alternates: { canonical: "/poradnik/rok-produkcji-z-vin" },
};

/**
 * "Rok produkcji z VIN" / "jak odczytac rok z VIN" — najwieksza fraza
 * informacyjna wokol VIN-u.
 *
 * Wszystkie teksty konkurencji przepisuja te sama tabelke kodow i obiecuja,
 * ze 10. znak to rok. Nasze dane mowia, ze dla duzej czesci aut z polskiego
 * rynku poleasingowego to nieprawda — i to jest os tekstu. Liczby ida
 * z `getWmiStaty` na zywo, nie wpisywac ich do tresci recznie.
 */
export default async function RokZVin() {
  await connection();
  const staty = await wmiStaty();
  const marki = wgMarek(staty);
  const razem = staty.reduce((x, s) => x + s.n, 0);
  const znajdz = (make: string) => marki.find((m) => m.make === make);
  const dziala = marki.filter((m) => m.werdykt === "zapisuje").map((m) => m.make);
  const niedziala = marki.filter((m) => m.werdykt === "nie-zapisuje").map((m) => m.make);
  const volvo = znajdz("Volvo");

  const pytania: Pytanie[] = [
    {
      q: "Który znak w numerze VIN oznacza rok produkcji?",
      a:
        "Dziesiąty. Formalnie to rok modelowy, a nie data produkcji, i nie każdy producent go " +
        "w ogóle stosuje — w Europie nie jest to obowiązkowe.",
    },
    {
      q: "Dlaczego rok z VIN nie zgadza się z dowodem rejestracyjnym?",
      a:
        "Z dwóch powodów. Rok modelowy bywa o rok późniejszy niż rocznik — auto zrobione jesienią " +
        "jest często modelem na kolejny rok. A część producentów w ogóle nie zapisuje roku " +
        "w 10. znaku, więc odczyt z tabelki daje przypadkowy wynik.",
    },
    ...(["BMW", "Toyota", "Renault"] as const)
      .map((make) => znajdz(make))
      .filter((m): m is Marka => !!m)
      .map((m) => ({
        q: `Czy ${m.make} zapisuje rok w numerze VIN?`,
        a:
          m.werdykt === "zapisuje"
            ? `Tak. Na ${num.format(m.n)} numerach ${m.make} z naszej bazy 10. znak zgadza się z rocznikiem w ${proc(m.zgodnosc)} przypadków.`
            : `Nie w sposób, na którym można polegać. Na ${num.format(m.n)} numerach ${m.make} z naszej bazy odczyt z 10. znaku zgadza się z rocznikiem tylko w ${proc(m.zgodnosc)} przypadków. Rocznik sprawdź w dowodzie rejestracyjnym.`,
      })),
    {
      q: "Jaki rok oznacza litera R, S albo T w VIN?",
      a: "R to 2024, S to 2025, T to 2026 — o ile producent stosuje ten zapis.",
    },
  ];

  return (
    <main className="mx-auto max-w-[860px] px-4 py-6">
      <Crumbs items={[{ label: "Poradniki", href: "/poradnik" }, { label: "Rok produkcji z VIN" }]} />

      <h1 className="mb-2 text-2xl font-bold tracking-tight text-neutral-100">
        Jak odczytać rok produkcji z numeru VIN
      </h1>
      <p className="mb-6 max-w-[72ch] text-[15px] leading-relaxed text-neutral-400">
        Rok zapisuje 10. znak numeru VIN — tak mówi każda tabelka w internecie. Sprawdziliśmy to na{" "}
        {num.format(razem)} numerach aut z naszej bazy ofert poleasingowych, porównując odczyt
        z rocznikiem z ogłoszenia. U części marek działa niemal zawsze, u innych prawie nigdy.
      </p>

      <div className="mb-8">
        <p className="mb-2 text-sm text-neutral-400">
          Wpisz VIN — pokażemy, co z niego wynika i czy rokowi z tego numeru można wierzyć:
        </p>
        <VinSzukaj />
      </div>

      <Sekcja tytul="Który znak VIN oznacza rok">
        <p>
          Numer VIN ma 17 znaków. Pierwsze trzy to kod producenta (WMI), znaki 4–9 opisują pojazd,
          10. to rok modelowy, 11. fabryka, a ostatnie sześć to numer seryjny. Kody roku powtarzają
          się co 30 lat i pomijają litery I, O, Q, U, Z oraz cyfrę 0:
        </p>
        <div className="grid grid-cols-4 gap-1.5 font-mono text-[13px] sm:grid-cols-6">
          {KODY_ROKU.map(([k, rok]) => (
            <div
              key={k}
              className="flex justify-between rounded-md border border-[var(--color-line)] bg-[var(--color-panel)] px-2 py-1"
            >
              <span className="text-accent">{k}</span>
              <span className="text-neutral-300">{rok}</span>
            </div>
          ))}
        </div>
      </Sekcja>

      <Sekcja tytul={`U których marek to działa — sprawdzone na ${num.format(razem)} numerach`}>
        <p>
          Dla każdej marki: ile numerów sprawdziliśmy i w jakiej części z nich rok z 10. znaku
          zgadza się z rocznikiem z ogłoszenia (albo jest o rok późniejszy, co jest normalne —
          niżej dlaczego).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-[13px]">
            <thead className="text-neutral-500">
              <tr className="border-b border-[var(--color-line)]">
                <th className="py-2 pr-3 font-medium">Marka</th>
                <th className="py-2 pr-3 font-medium">Kody producenta</th>
                <th className="py-2 pr-3 text-right font-medium">Numerów</th>
                <th className="py-2 pr-3 text-right font-medium">Zgodność</th>
                <th className="py-2 font-medium">Rok z VIN</th>
              </tr>
            </thead>
            <tbody>
              {marki.map((m) => (
                <tr key={m.make} className="border-b border-[var(--color-line)]/60">
                  <td className="py-2 pr-3 text-neutral-200">{m.make}</td>
                  <td className="py-2 pr-3 font-mono text-[12px] text-neutral-400">
                    {m.kody.map((k) => k.wmi).join(", ")}
                  </td>
                  <td className="py-2 pr-3 text-right text-neutral-400">{num.format(m.n)}</td>
                  <td className="py-2 pr-3 text-right text-neutral-300">{proc(m.zgodnosc)}</td>
                  <td className={`py-2 ${OPIS[m.werdykt].kolor}`}>{OPIS[m.werdykt].tekst}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {niedziala.length > 0 && (
          <p>
            Rok z VIN-u <strong className="text-neutral-100">nie działa</strong> u:{" "}
            {niedziala.join(", ")}. Ci producenci zapisują w 10. znaku coś innego albo stały znak,
            więc tabelka daje przypadkowy wynik.
          </p>
        )}
        {dziala.length > 0 && (
          <p>
            <strong className="text-neutral-100">Działa</strong> u: {dziala.join(", ")}.
          </p>
        )}
      </Sekcja>

      <Sekcja tytul="Rok modelowy to nie rocznik">
        <p>
          Nawet tam, gdzie zapis działa, 10. znak podaje rok modelowy. Auto zjeżdżające z taśmy
          jesienią jest zwykle modelem na kolejny rok, więc VIN pokaże rok późniejszy niż
          dowód rejestracyjny.
          {volvo && volvo.werdykt === "zapisuje" && (
            <>
              {" "}
              U Volvo dotyczy to {proc(volvo.rokPozniej)} trafień w naszych danych.
            </>
          )}
        </p>
        <p>
          Różnica o jeden rok nie jest więc oszustwem ani błędem. Podejrzana jest dopiero większa
          rozbieżność albo rok z VIN-u <em>wcześniejszy</em> niż rocznik w ogłoszeniu — u producenta,
          który zapis stosuje.
        </p>
      </Sekcja>

      <Sekcja tytul="Jak sprawdzić rocznik, gdy VIN go nie zdradza">
        <Lista>
          <li>
            <strong className="text-neutral-100">Dowód rejestracyjny</strong> — ma osobne pole
            z rokiem produkcji i datę pierwszej rejestracji.
          </li>
          <li>
            <strong className="text-neutral-100">historiapojazdu.gov.pl</strong> — bezpłatnie, dane
            z polskiej Centralnej Ewidencji Pojazdów; potrzebny VIN, numer rejestracyjny i data
            pierwszej rejestracji.
          </li>
          <li>
            <strong className="text-neutral-100">Raport historii po VIN</strong> — szkody,
            przebiegi i kradzieże po samym numerze, bez dokumentów:
          </li>
        </Lista>
        <HistoriaBlok vin={null} gdzie="poradnik-rok-vin" wariant="duzy" />
      </Sekcja>

      <Uwaga>
        Liczby w tabeli są liczone na bieżąco z ofert w naszej bazie i odświeżane raz na dobę.
        Pokazujemy tylko kody producenta, dla których mamy co najmniej 30 numerów, i marki z co
        najmniej 100 numerami. Rocznik bierzemy z ogłoszenia, więc pojedyncze pomyłki sprzedawców
        są w tych liczbach — dlatego oceniamy marki po proporcjach, a nie po pojedynczych autach.
      </Uwaga>

      <Faq pytania={pytania} />

      <p className="text-[14px] text-neutral-400">
        Zobacz też:{" "}
        <Link href="/vin" className={a}>
          sprawdź VIN auta poleasingowego
        </Link>{" "}
        — czy ten sam egzemplarz stoi gdzieś taniej i jak zmieniała się jego cena.
      </p>
    </main>
  );
}
