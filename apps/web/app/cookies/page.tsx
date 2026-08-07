import { ConsentToggle } from "@/components/CookieConsent";
import { LegalPage, Section } from "@/components/LegalPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookies i analityka — autopoleasingu.pl",
  description:
    "Jakie dane zbieramy przez analitykę, po co i jak to wyłączyć. Bez zgody nie zapisujemy nic.",
};

export default function Cookies() {
  return (
    <LegalPage title="Cookies i analityka" updated="7 sierpnia 2026">
      <Section title="Zasada">
        <p>
          <strong className="text-neutral-200">Dopóki nie klikniesz „Zgadzam się", nie zapisujemy
          w Twojej przeglądarce niczego</strong> poza samą informacją o tym, jaką decyzję podjąłeś.
          Analityka uruchamia się dopiero po zgodzie — nie działa „na wszelki wypadek"
          z możliwością późniejszego wyłączenia.
        </p>
      </Section>

      <Section title="Twój wybór">
        <ConsentToggle />
      </Section>

      <Section title="Co zbieramy po wyrażeniu zgody">
        <p>Korzystamy z PostHog. Po zgodzie zbieramy:</p>
        <ul className="ml-4 list-disc space-y-1 marker:text-neutral-600">
          <li>odwiedzane podstrony i oglądane oferty,</li>
          <li>użyte filtry i sortowania (marka, źródło, próg okazji),</li>
          <li>kliknięcia w interfejsie,</li>
          <li>skąd trafiłeś na stronę — adres strony odsyłającej i parametry kampanii,</li>
          <li>przybliżoną lokalizację: <strong className="text-neutral-200">kraj i miasto</strong>,
            wyliczone z adresu IP,</li>
          <li>czas spędzony na stronie i długość sesji,</li>
          <li>typ urządzenia, przeglądarkę i rozdzielczość ekranu,</li>
          <li>nagrania sesji — ruch myszy i przewijanie.</li>
        </ul>
        <p>
          Służy to jednemu: zrozumieniu, czego ludzie w tej wyszukiwarce szukają i co im nie
          działa. Nie sprzedajemy tych danych, nie używamy ich do reklam i nie udostępniamy
          nikomu poza dostawcą narzędzia.
        </p>
      </Section>

      <Section title="Czego nie zbieramy">
        <p>
          Nie prosimy o żadne dane osobowe i nie mamy kont użytkowników — nie wiemy, kim jesteś.
          Lokalizacja jest przybliżona do miasta;{" "}
          <strong className="text-neutral-200">nie znamy Twojego adresu</strong>. W nagraniach
          sesji <strong className="text-neutral-200">maskujemy wszystkie pola tekstowe</strong>,
          bo do wyszukiwarki wpisuje się czasem VIN albo numer rejestracyjny.
        </p>
      </Section>

      <Section title="Gdzie trafiają dane">
        <p>
          Na serwery PostHog w Unii Europejskiej (<code className="text-neutral-300">eu.i.posthog.com</code>).
          Dane nie opuszczają Europejskiego Obszaru Gospodarczego. Podstawą przetwarzania jest
          Twoja zgoda (art. 6 ust. 1 lit. a RODO), którą możesz wycofać w każdej chwili
          przełącznikiem wyżej.
        </p>
      </Section>

      <Section title="Ciasteczka">
        <p>
          Po zgodzie PostHog zapisuje ciasteczka i wpisy w pamięci lokalnej, które pozwalają
          rozpoznać, że kolejne kliknięcia pochodzą z tej samej sesji. Są anonimowe —
          nie zawierają Twojego imienia, e-maila ani niczego, co pozwoliłoby Cię wskazać.
        </p>
        <p>
          Sam wybór „zgadzam się / odrzuć" trzymamy w pamięci lokalnej przeglądarki, nie
          w ciasteczku. Dzięki temu przed decyzją nie wysyłamy do siebie ani jednego bajtu.
        </p>
      </Section>

      <Section title="Połączenia do innych serwisów">
        <p>
          Miniatury aut ładują się bezpośrednio z serwerów sprzedających. Te serwisy mogą przy tym
          ustawić własne ciasteczka — to poza naszą kontrolą i podlega ich politykom, niezależnie
          od Twojej decyzji tutaj. Nic im o Tobie nie przekazujemy.
        </p>
      </Section>

      <Section title="Jak to sprawdzić">
        <p>
          Otwórz narzędzia deweloperskie (F12), zakładka <em>Application → Cookies</em>. Przed
          wyrażeniem zgody lista dla domeny autopoleasingu.pl będzie pusta.
        </p>
      </Section>
    </LegalPage>
  );
}
