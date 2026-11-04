import Link from "@/components/Link";

export interface PytanieFaq {
  q: string;
  /** Tresc odpowiedzi — ta sama idzie na ekran i do danych strukturalnych. */
  a: string;
  /** Opcjonalny link doklejony po odpowiedzi (nie trafia do danych strukturalnych). */
  link?: { href: string; tekst: string };
}

/**
 * Pytania i odpowiedzi liczone z danych strony (marka, model). Widoczny tekst
 * i FAQPage w danych strukturalnych biora te same zdania, wiec nie moga sie
 * rozjechac. Kazda odpowiedz wynika z liczb, ktore strona i tak pokazuje —
 * nie dopisujemy nic, czego nie wiemy.
 */
export function FaqBlok({ tytul, pytania }: { tytul: string; pytania: PytanieFaq[] }) {
  if (pytania.length === 0) return null;
  const ld = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: pytania.map((p) => ({
      "@type": "Question",
      name: p.q,
      acceptedAnswer: { "@type": "Answer", text: p.a },
    })),
  };
  return (
    <section className="mb-8 max-w-[80ch]">
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: dane strukturalne, tresc wlasna
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
      />
      <h2 className="mb-3 text-lg font-semibold text-neutral-100">{tytul}</h2>
      <dl className="space-y-4 text-[14px] leading-relaxed">
        {pytania.map((p) => (
          <div key={p.q}>
            <dt className="font-medium text-neutral-200">{p.q}</dt>
            <dd className="mt-1 text-neutral-400">
              {p.a}
              {p.link && (
                <>
                  {" "}
                  <Link href={p.link.href} className="text-accent hover:underline">
                    {p.link.tekst}
                  </Link>
                </>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
