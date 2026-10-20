import { wmiStaty } from "@/lib/cache-filtrow";
import { krajZVin, rokZKodu, werdykt } from "@/lib/vin";
import { ScanLine } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

const num = new Intl.NumberFormat("pl-PL");
const proc = (x: number) => `${Math.round(x * 100)}%`;

/**
 * "Co mowi ten numer" — odczyt VIN-u na stronie VIN-u, takze dla numerow,
 * ktorych nie mamy w bazie.
 *
 * Po co: fraza "dekoder VIN" ma duzy ruch, a strony VIN-ow byly sama tabela
 * ofert. Przewaga nad zwyklymi dekoderami jest jedna i ZMIERZONA: kazdy
 * z nich podaje rok z 10. znaku, a u BMW, Toyoty czy Renault to nie dziala
 * (zgodnosc 0–15% na tysiacach numerow). My mowimy, czy temu kodowi
 * producenta mozna wierzyc — i na ilu numerach to sprawdzilismy.
 */
export async function VinDekoder({ vin }: { vin: string }) {
  const numer = vin.toUpperCase();
  const staty = await wmiStaty();
  const wmi = numer.slice(0, 3);
  const stat = staty.find((s) => s.wmi === wmi) ?? null;
  const kraj = krajZVin(numer);
  const znak = numer[9] ?? "";
  const rok = rokZKodu(znak);

  let rokWartosc: ReactNode;
  let rokOpis: ReactNode;
  if (stat) {
    const w = werdykt(stat.zgodnosc);
    const dowod = `${proc(stat.zgodnosc)} z ${num.format(stat.n)} numerów z kodem ${wmi}`;
    if (w === "zapisuje" && rok) {
      rokWartosc = rok;
      rokOpis = `U tego producenta zapis się zgadza: ${dowod}. Rok modelowy bywa o rok późniejszy niż rocznik.`;
    } else if (w === "nie-zawsze" && rok) {
      rokWartosc = `prawdopodobnie ${rok}`;
      rokOpis = `Zgadza się tylko w ${dowod} — część modeli tej marki nie stosuje zapisu.`;
    } else {
      rokWartosc = "nie do odczytania";
      rokOpis = `Ten producent nie zapisuje roku w 10. znaku — standardowy odczyt trafia w ${dowod}. Rocznik jest w dowodzie rejestracyjnym.`;
    }
  } else if (rok) {
    rokWartosc = `${rok} według standardu`;
    rokOpis = `Mamy za mało numerów z kodem ${wmi}, żeby sprawdzić, czy ten producent stosuje zapis.`;
  } else {
    rokWartosc = "nie do odczytania";
    rokOpis = `Znak „${znak}” nie jest kodem roku — producent zapisuje tu coś innego.`;
  }

  return (
    <section className="mb-6 rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-100">
        <ScanLine size={16} className="shrink-0 text-neutral-400" />
        Co mówi ten numer VIN
      </h2>

      {/* Numer pociety na czesci, ktore opisujemy nizej. */}
      <p className="mb-4 flex flex-wrap gap-1 font-mono text-[15px] tracking-wider">
        <Kawalek opis="producent">{numer.slice(0, 3)}</Kawalek>
        <Kawalek opis="opis pojazdu">{numer.slice(3, 9)}</Kawalek>
        <Kawalek opis="rok" akcent>
          {numer.slice(9, 10)}
        </Kawalek>
        <Kawalek opis="fabryka">{numer.slice(10, 11)}</Kawalek>
        <Kawalek opis="nr seryjny">{numer.slice(11)}</Kawalek>
      </p>

      <dl className="grid gap-3 text-[13px] sm:grid-cols-[180px_1fr]">
        <dt className="text-neutral-500">Producent ({wmi})</dt>
        <dd className="text-neutral-200">
          {stat ? (
            <>
              {stat.make}{" "}
              <span className="text-neutral-500">
                — rozpoznane na {num.format(stat.n)} numerach z naszej bazy
              </span>
            </>
          ) : (
            <span className="text-neutral-400">tego kodu nie mamy w bazie</span>
          )}
        </dd>

        {kraj && (
          <>
            <dt className="text-neutral-500">Kraj kodu producenta</dt>
            <dd className="text-neutral-200">
              {kraj} <span className="text-neutral-500">— zwykle kraj fabryki</span>
            </dd>
          </>
        )}

        <dt className="text-neutral-500">Rok modelowy (10. znak „{znak}”)</dt>
        <dd>
          <span className="text-neutral-200">{rokWartosc}</span>
          <span className="mt-0.5 block text-neutral-500">{rokOpis}</span>
        </dd>
      </dl>

      <Link
        href="/poradnik/rok-produkcji-z-vin"
        className="mt-4 inline-block text-[13px] text-neutral-400 underline decoration-dotted underline-offset-2 hover:text-accent"
      >
        Jak odczytać rok z VIN — i u których marek to nie działa →
      </Link>
    </section>
  );
}

function Kawalek({
  children,
  opis,
  akcent,
}: {
  children: ReactNode;
  opis: string;
  akcent?: boolean;
}) {
  return (
    <span className="flex flex-col items-center">
      <span
        className={`rounded-md border px-1.5 py-0.5 ${
          akcent
            ? "border-accent/50 bg-accent/10 text-accent"
            : "border-[var(--color-line)] bg-[var(--color-ink)] text-neutral-200"
        }`}
      >
        {children}
      </span>
      <span className="mt-1 font-sans text-[10px] tracking-normal text-neutral-500">{opis}</span>
    </span>
  );
}
