"use client";

import { track } from "@/components/Analytics";

/**
 * Kafelek oferty jako link z pomiarem.
 *
 * Klikniecie w oferte to JEDYNE zdarzenie, ktore mowi, czy ta wyszukiwarka
 * naprawde dziala — reszta (odslony, filtry) opisuje szukanie, a nie znalezienie.
 * Dlatego wysylamy je jawnie, z cena i deal score, zamiast polegac na
 * autocapture, ktory zapisalby sam fakt kliknięcia bez kontekstu.
 *
 * `track` nic nie robi bez zgody, wiec wolamy je bezwarunkowo.
 */
export function OfferLink({
  href,
  offer,
  className,
  style,
  children,
}: {
  href: string;
  offer: Record<string, unknown>;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      style={style}
      onClick={() => track("oferta_klik", offer)}
    >
      {children}
    </a>
  );
}
