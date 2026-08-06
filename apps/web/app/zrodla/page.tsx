import { shortSource } from "@/lib/format";
import { getSourceHealth } from "@/lib/queries";
import { ArrowLeft, CircleAlert, CircleCheck, CircleSlash, ExternalLink } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

const num = new Intl.NumberFormat("pl-PL");
const when = new Intl.DateTimeFormat("pl-PL", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Zdrowie adapterow.
 *
 * Powod istnienia tej strony jest konkretny: zeby sprawdzic, czy ktores zrodlo
 * nie umarlo, trzeba bylo pisac SQL recznie. Scraper, ktory przestaje cokolwiek
 * znajdowac, raportuje "0 znaleziono, 0 bledow" — czyli cisze wygladajaca
 * na sukces. To najgrozniejszy rodzaj awarii w tym projekcie i README poswieca
 * mu osobny rozdzial.
 */

/** Zrodlo uznajemy za ciche, gdy nie widzialo zadnej oferty od doby. */
const STALE_HOURS = 24;

function health(s: { active: number; lastSeenAt: Date | null }) {
  if (s.active === 0) {
    return { label: "brak ofert", tone: "bad" as const, icon: <CircleSlash size={14} /> };
  }
  const hours = s.lastSeenAt ? (Date.now() - s.lastSeenAt.getTime()) / 3_600_000 : Number.POSITIVE_INFINITY;
  if (hours > STALE_HOURS) {
    return { label: "cisza od doby", tone: "warn" as const, icon: <CircleAlert size={14} /> };
  }
  return { label: "działa", tone: "ok" as const, icon: <CircleCheck size={14} /> };
}

const TONE = {
  ok: "text-emerald-400",
  warn: "text-amber-400",
  bad: "text-rose-400",
} as const;

export default async function SourcesPage() {
  const sources = await getSourceHealth();

  const totals = sources.reduce(
    (a, s) => ({
      active: a.active + s.active,
      gone: a.gone + s.gone,
      newToday: a.newToday + s.newToday,
    }),
    { active: 0, gone: 0, newToday: 0 },
  );

  const problems = sources.filter((s) => health(s).tone !== "ok").length;

  return (
    <main className="mx-auto max-w-[1100px] px-4 py-6">
      <Link
        href="/"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-neutral-400 transition-colors hover:text-accent"
      >
        <ArrowLeft size={15} />
        Wróć do listy
      </Link>

      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Źródła</h1>
        <p className="text-sm text-neutral-400">
          {sources.length} adapterów · {num.format(totals.active)} aktywnych ofert ·{" "}
          {num.format(totals.newToday)} nowych dziś · {num.format(totals.gone)} zniknęło
          {problems > 0 && (
            <span className="text-amber-400"> · {problems} wymaga uwagi</span>
          )}
        </p>
      </header>

      <div className="overflow-x-auto rounded-xl border border-[var(--color-line)]">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-[var(--color-line)] bg-black/20 text-left text-[11px] uppercase tracking-wide text-neutral-500">
              <th className="px-4 py-2.5 font-medium">Źródło</th>
              <th className="px-4 py-2.5 font-medium">Stan</th>
              <th className="px-4 py-2.5 text-right font-medium">Aktywne</th>
              <th className="px-4 py-2.5 text-right font-medium">Nowe dziś</th>
              <th className="px-4 py-2.5 text-right font-medium">Zniknęło</th>
              <th className="px-4 py-2.5 text-right font-medium">Z ceną</th>
              <th className="px-4 py-2.5 text-right font-medium">Z VIN</th>
              <th className="px-4 py-2.5 text-right font-medium">Ostatnia oferta</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => {
              const h = health(s);
              // Udzialy licza sie wzgledem AKTYWNYCH, nie wszystkich — inaczej
              // zrodlo z duza liczba zniknietych wygladaloby na dziurawe.
              const pricePct = s.active ? Math.round((s.withPrice / s.active) * 100) : 0;
              const vinPct = s.active ? Math.round((s.withVin / s.active) * 100) : 0;

              return (
                <tr
                  key={s.id}
                  className="border-b border-[var(--color-line)] last:border-0 transition-colors hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-2.5">
                    <a
                      href={s.baseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium transition-colors hover:text-accent"
                      title={s.name}
                    >
                      {shortSource(s.name)}
                      <ExternalLink size={12} className="text-neutral-600" />
                    </a>
                    <p className="text-[11px] text-neutral-600">{s.id}</p>
                  </td>
                  <td className={`px-4 py-2.5 ${TONE[h.tone]}`}>
                    <span className="flex items-center gap-1.5">
                      {h.icon}
                      {h.label}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                    {num.format(s.active)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {s.newToday > 0 ? (
                      <span className="text-emerald-400">+{num.format(s.newToday)}</span>
                    ) : (
                      <span className="text-neutral-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-neutral-500">
                    {num.format(s.gone)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-neutral-400">
                    {pricePct}%
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-neutral-400">
                    {vinPct}%
                  </td>
                  <td className="px-4 py-2.5 text-right text-[11px] tabular-nums text-neutral-500">
                    {s.lastSeenAt ? when.format(s.lastSeenAt) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-neutral-600">
        „Z ceną" poniżej 100% nie musi znaczyć awarii — Automarket sprzedaje część aut wyłącznie
        w leasingu, więc cena gotówkowa dla nich nie istnieje. Podobnie brak VIN-u: kilka źródeł
        po prostu go nie publikuje. Niepokoić powinna dopiero <em>zmiana</em> tych udziałów.
      </p>
    </main>
  );
}
