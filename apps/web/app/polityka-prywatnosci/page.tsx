import { LegalPage, Section, ToFill } from "@/components/LegalPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Polityka prywatności — autopoleasingu.pl",
  description: "Jakie dane zbieramy: praktycznie żadnych. Bez konta, bez ciasteczek, bez analityki.",
};

export default function Prywatnosc() {
  return (
    <LegalPage title="Polityka prywatności" updated="7 sierpnia 2026">
      <Section title="Krótko">
        <p>
          <strong className="text-neutral-200">Nie zbieramy o Tobie żadnych danych osobowych.</strong>{" "}
          Serwis nie ma kont, formularzy, newslettera, ciasteczek ani analityki. Możesz z niego
          korzystać, nie zostawiając nam niczego.
        </p>
      </Section>

      <Section title="Co jednak powstaje technicznie">
        <p>
          Strona jest hostowana na Vercel. Jak każdy serwer, infrastruktura hostingowa zapisuje
          techniczne logi żądań — mogą one zawierać adres IP, typ przeglądarki i adres odwiedzanej
          podstrony. Służą wyłącznie utrzymaniu serwisu i bezpieczeństwu, nie łączymy ich z żadną
          tożsamością i nie mamy do nich dostępu w formie pozwalającej Cię zidentyfikować.
        </p>
        <p>
          Administratorem tych logów w rozumieniu RODO jest operator serwisu (patrz niżej),
          a podmiotem przetwarzającym — Vercel Inc. Podstawą jest uzasadniony interes polegający
          na utrzymaniu działania strony (art. 6 ust. 1 lit. f RODO).
        </p>
      </Section>

      <Section title="Zdjęcia z innych serwisów">
        <p>
          Miniatury aut wyświetlamy bezpośrednio z serwerów sprzedających, bez kopiowania ich do
          siebie. Oznacza to, że{" "}
          <strong className="text-neutral-200">Twoja przeglądarka nawiązuje połączenie z tymi
          serwisami</strong> i mogą one odnotować Twój adres IP — tak samo, jak gdybyś wszedł na
          ich stronę. Nie przekazujemy im żadnych dodatkowych informacji o Tobie.
        </p>
      </Section>

      <Section title="Dane w bazie">
        <p>
          Baza serwisu zawiera wyłącznie dane o samochodach — marka, model, cena, przebieg, VIN,
          numer rejestracyjny, zdjęcia — pobrane z publicznych ogłoszeń. Nie zawiera danych
          o osobach fizycznych. Jeśli w jakimś ogłoszeniu trafi do nas informacja, która stanowi
          dane osobowe, usuniemy ją na zgłoszenie.
        </p>
      </Section>

      <Section title="Twoje prawa">
        <p>
          Ponieważ nie prowadzimy żadnej identyfikowalnej dokumentacji o użytkownikach, w praktyce
          nie mamy czego udostępnić ani usunąć. Jeśli mimo to chcesz skorzystać z praw wynikających
          z RODO — dostępu, sprostowania, usunięcia, sprzeciwu — napisz na{" "}
          <ToFill>kontakt@autopoleasingu.pl</ToFill>. Masz też prawo wnieść skargę do Prezesa
          Urzędu Ochrony Danych Osobowych.
        </p>
      </Section>

      <Section title="Operator">
        <p>
          <ToFill>[nazwa / imię i nazwisko]</ToFill>, <ToFill>[adres]</ToFill>. Kontakt:{" "}
          <ToFill>kontakt@autopoleasingu.pl</ToFill>.
        </p>
      </Section>

      <Section title="Uwaga">
        <p className="text-sm">
          Dokument opisuje zgodnie z prawdą stan na dzień aktualizacji —{" "}
          <strong className="text-neutral-200">brak ciasteczek i analityki został zweryfikowany
          w kodzie i w odpowiedziach serwera.</strong> Jeśli kiedyś dojdzie analityka albo
          logowanie, ta strona musi zostać zmieniona <em>zanim</em> to nastąpi. Nie jest to porada
          prawna.
        </p>
      </Section>
    </LegalPage>
  );
}
