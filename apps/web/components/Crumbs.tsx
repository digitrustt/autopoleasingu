import { Logo } from "@/components/Logo";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

export interface Crumb {
  label: string;
  /** Brak href = biezaca strona, ostatni element sciezki. */
  href?: string;
}

/**
 * Sciezka nawigacji na stronach marka / model / oferta.
 *
 * Ma dwa zadania naraz. Dla czytelnika: powrot o jeden poziom zamiast do listy
 * z zerowymi filtrami. Dla robota indeksujacego: staly link z kazdej strony
 * oferty do strony modelu i marki — bez tego 22 tys. stron ofert to 22 tys.
 * slepych zaulkow, do ktorych nic nie prowadzi.
 *
 * Dane strukturalne (BreadcrumbList) sa tu, bo to jedyne miejsce, ktore zna
 * pelna sciezke — a Google rysuje z nich okruszki w wynikach wyszukiwania
 * zamiast golego adresu URL.
 */
export function Crumbs({ items }: { items: Crumb[] }) {
  const ld = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ label: "Oferty", href: "/" }, ...items].map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.label,
      ...(c.href ? { item: `https://autopoleasingu.pl${c.href}` } : {}),
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD nie ma innej drogi
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
      />
      <nav className="mb-5 flex flex-wrap items-center gap-1.5 text-[13px] text-neutral-500">
        <Link href="/" className="transition-colors hover:text-accent">
          <Logo className="text-[13px]" />
        </Link>
        {items.map((c) => (
          <span key={c.label} className="flex items-center gap-1.5">
            <ChevronRight size={13} className="text-neutral-700" />
            {c.href ? (
              <Link href={c.href} className="transition-colors hover:text-accent">
                {c.label}
              </Link>
            ) : (
              <span className="text-neutral-300">{c.label}</span>
            )}
          </span>
        ))}
      </nav>
    </>
  );
}
