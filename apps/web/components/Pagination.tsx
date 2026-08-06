import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

const cls =
  "flex items-center gap-1 rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] " +
  "px-3 py-2 text-sm transition-colors hover:border-accent/70 hover:text-accent";

/** Zachowuje aktywne filtry przy zmianie strony — podmienia tylko `page`. */
function hrefFor(params: Record<string, string | undefined>, page: number): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v && k !== "page") sp.set(k, v);
  }
  if (page > 1) sp.set("page", String(page));
  const qs = sp.toString();
  return qs ? `/?${qs}` : "/";
}

export function Pagination({
  page,
  pageCount,
  params,
}: {
  page: number;
  pageCount: number;
  params: Record<string, string | undefined>;
}) {
  if (pageCount <= 1) return null;

  return (
    <nav className="mt-6 flex items-center justify-center gap-3">
      {/*
        next/link, nie <a> — zwykly odnosnik przeladowuje cala strone i granica
        Suspense z radarem nigdy sie nie uruchamia. Przy nawigacji klienckiej
        podmienia sie sama lista, a naglowek i filtry zostaja na ekranie.
      */}
      {page > 1 ? (
        <Link href={hrefFor(params, page - 1)} className={cls}>
          <ChevronLeft size={15} />
          Poprzednia
        </Link>
      ) : (
        <span className={`${cls} pointer-events-none opacity-40`}>
          <ChevronLeft size={15} />
          Poprzednia
        </span>
      )}

      <span className="text-sm text-neutral-400 tabular-nums">
        {page} / {pageCount}
      </span>

      {page < pageCount ? (
        <Link href={hrefFor(params, page + 1)} className={cls}>
          Następna
          <ChevronRight size={15} />
        </Link>
      ) : (
        <span className={`${cls} pointer-events-none opacity-40`}>
          Następna
          <ChevronRight size={15} />
        </span>
      )}
    </nav>
  );
}
