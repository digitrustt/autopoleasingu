"use client";

import { useRouter } from "next/navigation";

/**
 * Odnosnik do historii VIN-u umieszczony WEWNATRZ kafelka, ktory sam jest
 * odnosnikiem do oferty zewnetrznej.
 *
 * Zagniezdzanie <a> w <a> jest niepoprawne w HTML — przegladarka rozbija taki
 * markup i klikniecie trafia w losowy z dwoch. Dlatego to jest <span> z wlasna
 * obsluga: zatrzymujemy propagacje, zeby nie odpalil sie link kafelka, i
 * nawigujemy routerem.
 */
export function TwinLink({
  vin,
  className,
  children,
}: {
  vin: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <span
      role="link"
      tabIndex={0}
      className={`cursor-pointer ${className ?? ""}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        router.push(`/vin/${encodeURIComponent(vin)}`);
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        e.stopPropagation();
        router.push(`/vin/${encodeURIComponent(vin)}`);
      }}
    >
      {children}
    </span>
  );
}
