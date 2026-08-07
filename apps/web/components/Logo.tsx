/**
 * Logotyp — jedno zrodlo prawdy dla naglowka i stopki.
 *
 * Wczesniej byly to dwa osobne kawalki JSX o lekko roznych kolorach i pierwsza
 * zmiana w jednym rozjechala je wizualnie. Marka ma wygladac tak samo wszedzie,
 * wiec rozmiar jest parametrem, a kolory nie.
 */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`font-bold tracking-tight ${className}`}>
      auto<span className="text-accent">poleasingu</span>
      <span className="text-neutral-600">.pl</span>
    </span>
  );
}
