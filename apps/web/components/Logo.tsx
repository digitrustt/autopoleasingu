/**
 * Logotyp — jedno zrodlo prawdy dla naglowka i stopki.
 *
 * KAZDY czlon ma WLASNY kolor, zaden nie dziedziczy po rodzicu. To nie jest
 * nadgorliwosc: wczesniej "auto" bylo bez klasy, wiec w naglowku wychodzilo
 * jasne, a w stopce (text-neutral-500) przygaszone — te same znaki, dwa rozne
 * logotypy. Rozmiar zostaje parametrem, kolory nie.
 */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`font-bold tracking-tight ${className}`}>
      <span className="text-neutral-100">auto</span>
      <span className="text-accent">poleasingu</span>
      <span className="text-neutral-600">.pl</span>
    </span>
  );
}
