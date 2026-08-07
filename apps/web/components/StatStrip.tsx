/**
 * Pasek liczb pod naglowkiem strony marki albo modelu.
 *
 * Te liczby sa jedynym powodem, dla ktorego ta strona ma istniec zamiast
 * przekierowywac na liste z filtrem: mediana i rozpietosc cen policzone
 * z 26 zrodel naraz to informacja, ktorej nie ma zaden pojedynczy serwis.
 */
export function StatStrip({ items }: { items: { label: string; value: string; hint?: string }[] }) {
  return (
    <dl className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-3 lg:grid-cols-5">
      {items.map((s) => (
        <div key={s.label} className="bg-[var(--color-panel)] px-4 py-3">
          <dt className="text-[11px] uppercase tracking-wide text-neutral-600">{s.label}</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-neutral-100">{s.value}</dd>
          {s.hint && <p className="text-[11px] leading-tight text-neutral-600">{s.hint}</p>}
        </div>
      ))}
    </dl>
  );
}
