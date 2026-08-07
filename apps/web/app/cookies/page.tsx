import { LegalPage, Section } from "@/components/LegalPage";
import { CookieIcon } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookies — autopoleasingu.pl",
  description: "Nie używamy ciasteczek. Dlatego nie ma tu okienka ze zgodą.",
};

export default function Cookies() {
  return (
    <LegalPage title="Cookies" updated="7 sierpnia 2026">
      <div className="flex items-start gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
        <CookieIcon size={18} className="mt-0.5 shrink-0 text-neutral-500" />
        <p className="text-neutral-200">
          <strong>Ten serwis nie używa żadnych ciasteczek.</strong> Ani własnych, ani cudzych, ani
          „niezbędnych", ani analitycznych.
        </p>
      </div>

      <Section title="Dlaczego nie ma okienka ze zgodą">
        <p>
          Zgody wymagają ciasteczka i podobne technologie, które nie są niezbędne do działania
          strony — analityka, reklama, śledzenie. <strong className="text-neutral-200">Nie mamy
          żadnej z tych rzeczy</strong>, więc nie ma na co wyrażać zgody.
        </p>
        <p>
          Okienko „akceptuję" na stronie, która nie ustawia ciasteczek, byłoby pustym rytuałem —
          uczy klikać zgody bez czytania i niczego nie chroni. Dlatego go nie ma.
        </p>
      </Section>

      <Section title="Co zamiast tego">
        <p>
          Filtry i sortowanie zapisują się <strong className="text-neutral-200">w adresie strony</strong>,
          nie w Twojej przeglądarce. Dzięki temu wynik wyszukiwania da się wysłać linkiem, a serwis
          nie musi niczego o Tobie pamiętać między wizytami. Nie korzystamy też z pamięci lokalnej
          przeglądarki (localStorage ani sessionStorage).
        </p>
      </Section>

      <Section title="Połączenia do innych serwisów">
        <p>
          Miniatury aut ładują się bezpośrednio z serwerów sprzedających. Te serwisy{" "}
          <strong className="text-neutral-200">mogą próbować ustawić własne ciasteczka</strong> przy
          pobieraniu obrazka — to poza naszą kontrolą i podlega ich politykom. Nic im o Tobie nie
          przekazujemy.
        </p>
      </Section>

      <Section title="Jak to sprawdzić">
        <p>
          Nie musisz nam wierzyć na słowo. Otwórz narzędzia deweloperskie przeglądarki (F12),
          zakładka <em>Application → Cookies</em> — dla domeny autopoleasingu.pl lista będzie pusta.
        </p>
      </Section>

      <Section title="Jeśli to się zmieni">
        <p>
          Gdyby kiedyś doszła analityka albo logowanie, ta strona zostanie zaktualizowana, a zgoda —
          jeśli będzie wymagana — pojawi się <em>zanim</em> cokolwiek zostanie zapisane w Twojej
          przeglądarce.
        </p>
      </Section>
    </LegalPage>
  );
}
