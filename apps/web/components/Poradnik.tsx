import type { ReactNode } from "react";

/**
 * Klocki poradnikow (/poradnik/…): naglowek sekcji, akapit, lista, ramka
 * z zastrzezeniem i FAQ z danymi strukturalnymi.
 *
 * Poradniki sa pisane RECZNIE i opieraja sie na dwoch rzeczach, ktorych nie ma
 * w tekstach konkurencji: na liczbach z naszej bazy i na regulaminach
 * przeczytanych u zrodla. Kazdy fakt z regulaminu ma date odczytu na stronie —
 * regulaminy sie zmieniaja, a nieaktualna rada o pieniadzach jest gorsza niz
 * jej brak.
 */
export function Sekcja({ tytul, children }: { tytul: string; children: ReactNode }) {
  return (
    <section className="mb-7">
      <h2 className="mb-2 text-lg font-semibold text-neutral-100">{tytul}</h2>
      <div className="flex max-w-[72ch] flex-col gap-3 text-[15px] leading-relaxed text-neutral-300">
        {children}
      </div>
    </section>
  );
}

export function Lista({ children }: { children: ReactNode }) {
  return <ul className="flex list-disc flex-col gap-1.5 pl-5">{children}</ul>;
}

export function Uwaga({ children }: { children: ReactNode }) {
  return (
    <p className="mb-7 max-w-[72ch] rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-[13px] leading-relaxed text-neutral-300">
      {children}
    </p>
  );
}

export interface Pytanie {
  q: string;
  a: string;
}

export function Faq({ pytania }: { pytania: Pytanie[] }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: pytania.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
  return (
    <section className="mb-7">
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: dane strukturalne, tresc wlasna
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <h2 className="mb-3 text-lg font-semibold text-neutral-100">Najczęstsze pytania</h2>
      <dl className="max-w-[80ch] space-y-3">
        {pytania.map((f) => (
          <div
            key={f.q}
            className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-3"
          >
            <dt className="text-[15px] font-medium text-neutral-100">{f.q}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-neutral-400">{f.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
