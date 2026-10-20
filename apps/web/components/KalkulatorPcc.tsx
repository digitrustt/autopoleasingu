"use client";

import { track } from "@/components/Analytics";
import { OPLATY, PCC_DNI, PCC_PROG, PCC_STAWKA, REJESTRACJA_DNI } from "@/lib/oplaty";
import { AlertTriangle, CalendarClock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const zl = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", maximumFractionDigits: 2 });
const zl0 = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", maximumFractionDigits: 0 });
const data = new Intl.DateTimeFormat("pl-PL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

type Od = "prywatna" | "firma";
type Tablice = "zachowuje" | "nowe" | "indywidualne";
interface Model {
  slug: string;
  nazwa: string;
}
interface Cena {
  n: number;
  mediana: number;
  p25: number;
  p75: number;
}

const pole =
  "w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-3 py-2 text-sm text-neutral-100 [color-scheme:dark] focus:border-neutral-600 focus:outline-none";
const etykieta = "mb-1 block text-[13px] text-neutral-400";

/** Termin z ustawy; sobota i niedziela przesuwaja go na poniedzialek (swiat nie liczymy). */
function termin(od: string, dni: number): Date | null {
  const d = new Date(`${od}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + dni);
  if (d.getDay() === 6) d.setDate(d.getDate() + 2);
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return d;
}

/**
 * Kalkulator PCC i oplat rejestracyjnych — liczy w przegladarce, z serwera
 * bierze tylko mediane ceny (opcjonalnie, /api/cena-rynkowa).
 *
 * Przewaga nad innymi kalkulatorami PCC: urzad liczy podatek od WARTOSCI
 * RYNKOWEJ, nie od ceny z umowy, i moze zakwestionowac zanizona kwote.
 * Pokazujemy mediane z prawdziwych ofert dla tego modelu i rocznika, zeby
 * czlowiek widzial, czy jego cena odstaje, ZANIM zlozy deklaracje.
 */
export function KalkulatorPcc({ marki }: { marki: string[] }) {
  const [od, setOd] = useState<Od>("prywatna");
  const [cena, setCena] = useState("");
  // Ustawiana po zamontowaniu — data serwera i przegladarki moga sie roznic o dzien.
  const [dzien, setDzien] = useState("");
  useEffect(() => {
    const d = new Date();
    setDzien(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }, []);
  const [tablice, setTablice] = useState<Tablice>("zachowuje");
  const [pozwolenie, setPozwolenie] = useState(true);
  const [pelnomocnik, setPelnomocnik] = useState(false);

  const [marka, setMarka] = useState("");
  const [modele, setModele] = useState<Model[]>([]);
  const [model, setModel] = useState("");
  const [rok, setRok] = useState("");
  const [rynek, setRynek] = useState<Cena | null | "brak">(null);

  useEffect(() => {
    setModele([]);
    setModel("");
    if (!marka) return;
    fetch(`/api/cena-rynkowa?make=${encodeURIComponent(marka)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setModele)
      .catch(() => setModele([]));
  }, [marka]);

  useEffect(() => {
    setRynek(null);
    const y = Number(rok);
    if (!marka || !model || !Number.isInteger(y) || y < 1990) return;
    const q = new URLSearchParams({ make: marka, model, year: String(y) });
    fetch(`/api/cena-rynkowa?${q}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((c: Cena | null) => {
        // Ponizej pieciu ofert mediana to przypadek, nie rynek.
        setRynek(c && c.n >= 5 ? c : "brak");
        track("kalkulator_pcc_mediana", { marka, model, rok: y, n: c?.n ?? 0 });
      })
      .catch(() => setRynek("brak"));
  }, [marka, model, rok]);

  const kwota = Number(cena.replace(/\s/g, "").replace(",", "."));
  const wynik = useMemo(() => {
    const pcc = od === "prywatna" && kwota > PCC_PROG ? Math.round(kwota * PCC_STAWKA) : 0;
    const pozycje: [string, number][] = [["Dowód rejestracyjny", OPLATY.dowod]];
    if (pozwolenie) pozycje.push(["Pozwolenie czasowe", OPLATY.pozwolenieZUrzedu]);
    if (tablice === "nowe") {
      pozycje.push(["Tablice rejestracyjne", OPLATY.tablice]);
      pozycje.push(["Nalepki legalizacyjne", OPLATY.nalepkiLegalizacyjne]);
    }
    if (tablice === "indywidualne") {
      pozycje.push(["Tablice indywidualne", OPLATY.tabliceIndywidualne]);
      pozycje.push(["Nalepki legalizacyjne", OPLATY.nalepkiLegalizacyjne]);
    }
    if (pelnomocnik) pozycje.push(["Pełnomocnictwo (opłata skarbowa)", OPLATY.pelnomocnictwo]);
    const rejestracja = pozycje.reduce((x, [, v]) => x + v, 0);
    return { pcc, pozycje, rejestracja, razem: pcc + rejestracja };
  }, [od, kwota, tablice, pozwolenie, pelnomocnik]);

  const pccDo = od === "prywatna" ? termin(dzien, PCC_DNI) : null;
  const rejDo = termin(dzien, REJESTRACJA_DNI);
  const ponizej =
    rynek && rynek !== "brak" && od === "prywatna" && kwota > 0 && kwota < rynek.p25 ? rynek : null;
  const lata = Array.from({ length: 22 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <form
        className="flex flex-col gap-4 rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4"
        onSubmit={(e) => e.preventDefault()}
      >
        <fieldset>
          <legend className={etykieta}>Od kogo kupujesz?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["prywatna", "Od osoby prywatnej", "umowa kupna-sprzedaży"],
                ["firma", "Od firmy", "faktura VAT, VAT-marża albo firma zwolniona z VAT"],
              ] as const
            ).map(([v, t, opis]) => (
              <label
                key={v}
                className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${
                  od === v ? "border-accent/60 bg-accent/5 text-neutral-100" : "border-[var(--color-line)] text-neutral-300"
                }`}
              >
                <input type="radio" name="od" value={v} checked={od === v} onChange={() => setOd(v)} className="sr-only" />
                {t}
                <span className="block text-[12px] text-neutral-500">{opis}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className={etykieta}>Cena z umowy (zł)</span>
            <input
              inputMode="decimal"
              placeholder="np. 45 000"
              value={cena}
              onChange={(e) => setCena(e.target.value)}
              className={pole}
            />
          </label>
          <label>
            <span className={etykieta}>Data umowy</span>
            <input type="date" value={dzien} onChange={(e) => setDzien(e.target.value)} className={pole} />
          </label>
        </div>

        <fieldset>
          <legend className={etykieta}>
            Auto — opcjonalnie, żeby porównać cenę z rynkiem
          </legend>
          <div className="grid gap-2 sm:grid-cols-3">
            <select value={marka} onChange={(e) => setMarka(e.target.value)} className={pole} aria-label="Marka">
              <option value="">Marka</option>
              {marki.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className={pole}
              disabled={modele.length === 0}
              aria-label="Model"
            >
              <option value="">Model</option>
              {modele.map((m) => (
                <option key={m.slug} value={m.slug}>
                  {m.nazwa}
                </option>
              ))}
            </select>
            <select value={rok} onChange={(e) => setRok(e.target.value)} className={pole} aria-label="Rocznik">
              <option value="">Rocznik</option>
              {lata.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </fieldset>

        <fieldset>
          <legend className={etykieta}>Tablice rejestracyjne</legend>
          <select value={tablice} onChange={(e) => setTablice(e.target.value as Tablice)} className={pole}>
            <option value="zachowuje">Zostawiam dotychczasowe tablice</option>
            <option value="nowe">Nowe tablice</option>
            <option value="indywidualne">Tablice indywidualne</option>
          </select>
        </fieldset>

        <div className="flex flex-col gap-2 text-sm text-neutral-300">
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={pozwolenie} onChange={(e) => setPozwolenie(e.target.checked)} className="mt-1" />
            <span>
              Pozwolenie czasowe{" "}
              <span className="text-neutral-500">— urząd zwykle je wydaje, zanim dowód będzie gotowy</span>
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={pelnomocnik} onChange={(e) => setPelnomocnik(e.target.checked)} className="mt-1" />
            <span>
              Rejestruje pełnomocnik{" "}
              <span className="text-neutral-500">spoza najbliższej rodziny</span>
            </span>
          </label>
        </div>
      </form>

      <aside className="flex flex-col gap-3 lg:sticky lg:top-4 lg:self-start" aria-live="polite">
        <div className="rounded-xl border border-accent/40 bg-accent/5 p-4">
          <p className="text-[13px] text-neutral-400">Podatek PCC</p>
          <p className="text-2xl font-bold text-neutral-100">{zl.format(wynik.pcc)}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-neutral-500">
            {od === "firma"
              ? "Zakup od firmy na fakturę nie podlega PCC — sprzedaż jest objęta VAT (także VAT-marża) albo z niego zwolniona."
              : kwota > 0 && kwota <= PCC_PROG
                ? `Do ${zl0.format(PCC_PROG)} wartości rynkowej PCC nie ma.`
                : "2% wartości rynkowej auta. Deklaracja PCC-3 i zapłata w 14 dni od umowy."}
          </p>

          <div className="mt-4 border-t border-[var(--color-line)] pt-3">
            <p className="text-[13px] text-neutral-400">Opłaty w wydziale komunikacji</p>
            <ul className="mt-1 flex flex-col gap-0.5 text-[13px]">
              {wynik.pozycje.map(([n, v]) => (
                <li key={n} className="flex justify-between text-neutral-300">
                  <span>{n}</span>
                  <span>{zl.format(v)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 flex justify-between text-sm font-medium text-neutral-100">
              <span>Razem z PCC</span>
              <span>{zl.format(wynik.razem)}</span>
            </p>
          </div>
        </div>

        {rynek && rynek !== "brak" && (
          <div
            className={`rounded-xl border p-4 text-[13px] leading-relaxed ${
              ponizej ? "border-amber-500/40 bg-amber-500/5" : "border-[var(--color-line)] bg-[var(--color-panel)]"
            }`}
          >
            {ponizej && (
              <p className="mb-1 flex items-center gap-1.5 font-medium text-amber-300">
                <AlertTriangle size={14} /> Cena wyraźnie poniżej rynku
              </p>
            )}
            <p className="text-neutral-300">
              Mediana ofert tego modelu z tego rocznika: <strong className="text-neutral-100">{zl0.format(rynek.mediana)}</strong>{" "}
              (połowa ofert między {zl0.format(rynek.p25)} a {zl0.format(rynek.p75)}, {rynek.n} aut).
            </p>
            {ponizej && (
              <p className="mt-1 text-neutral-400">
                PCC liczy się od wartości rynkowej, nie od ceny z umowy. Przy kwocie dużo niższej niż typowa
                urząd może wezwać do jej podwyższenia — wtedy podatek od tej mediany wyniósłby{" "}
                {zl0.format(Math.round(rynek.mediana * PCC_STAWKA))}. Jeśli auto jest tańsze z konkretnego powodu
                (uszkodzenia, przebieg), warto mieć to opisane w umowie.
              </p>
            )}
            <p className="mt-1 text-[12px] text-neutral-500">
              To ceny ofert dealerów i leasingodawców, nie ceny transakcyjne — orientacyjnie.
            </p>
          </div>
        )}
        {rynek === "brak" && (
          <p className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-3 text-[12px] text-neutral-500">
            Za mało ofert tego modelu z tego rocznika, żeby podać medianę.
          </p>
        )}

        <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4 text-[13px]">
          <p className="mb-1 flex items-center gap-1.5 font-medium text-neutral-100">
            <CalendarClock size={14} /> Terminy
          </p>
          <ul className="flex flex-col gap-1 text-neutral-300">
            {pccDo && (
              <li>
                PCC-3 i zapłata: do <strong className="text-neutral-100">{data.format(pccDo)}</strong>
              </li>
            )}
            {rejDo && (
              <li>
                Rejestracja auta: do <strong className="text-neutral-100">{data.format(rejDo)}</strong>
              </li>
            )}
          </ul>
          <p className="mt-1 text-[12px] text-neutral-500">Święta przesuwają termin na kolejny dzień roboczy — tego nie liczymy.</p>
        </div>
      </aside>
    </div>
  );
}
