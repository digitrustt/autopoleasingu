import { LegalPage, Section, ToFill } from "@/components/LegalPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Regulamin — autopoleasingu.pl",
  description: "Zasady korzystania z porównywarki ofert aut poleasingowych.",
};

export default function Regulamin() {
  return (
    <LegalPage title="Regulamin" updated="7 sierpnia 2026">
      <Section title="1. Czym jest ten serwis">
        <p>
          autopoleasingu.pl to <strong className="text-neutral-200">porównywarka</strong> publicznie
          dostępnych ofert samochodów poleasingowych. Zbieramy oferty z serwisów firm leasingowych,
          CFM i programów dealerskich, sprowadzamy je do wspólnego formatu i pokazujemy w jednym
          miejscu wraz z historią cen.
        </p>
        <p>
          <strong className="text-neutral-200">Nie sprzedajemy samochodów, nie pośredniczymy
          w sprzedaży i nie jesteśmy stroną żadnej transakcji.</strong> Każda oferta prowadzi do
          serwisu sprzedającego i to tam zawierasz ewentualną umowę.
        </p>
      </Section>

      <Section title="2. Skąd pochodzą dane">
        <p>
          Dane pochodzą z publicznie dostępnych stron sprzedających. Aktualizujemy je raz na dobę,
          co oznacza, że <strong className="text-neutral-200">oferta widoczna w serwisie mogła już
          zostać sprzedana, zmienić cenę albo zostać wycofana</strong>. Wiążąca jest zawsze treść
          u sprzedającego, nie u nas.
        </p>
        <p>
          Zdjęcia i opisy są własnością sprzedających — wyświetlamy je bezpośrednio z ich serwerów
          i nie przechowujemy ich kopii. Listę wszystkich źródeł wraz z ich bieżącym stanem
          znajdziesz na stronie <a className="underline hover:text-accent" href="/zrodla">Źródła</a>.
        </p>
      </Section>

      <Section title="3. Wycena i ocena okazji">
        <p>
          Wycena („X% poniżej rynku") to <strong className="text-neutral-200">mediana cen
          porównywalnych ofert</strong> o tym samym modelu, roczniku, przedziale przebiegu, paliwie
          i skrzyni biegów. Wyliczamy ją wyłącznie wtedy, gdy w koszyku jest co najmniej osiem
          porównywalnych sztuk; poniżej tego progu nie pokazujemy oceny wcale.
        </p>
        <p>
          To <strong className="text-neutral-200">szacunek statystyczny, nie wycena rzeczoznawcy
          ani porada inwestycyjna</strong>. Nie uwzględnia stanu technicznego, historii szkód,
          wyposażenia ani żadnej cechy konkretnego egzemplarza. Przed zakupem sprawdź auto
          samodzielnie.
        </p>
        <p>
          Przy aukcjach cena to <strong className="text-neutral-200">bieżąca oferta w licytacji,
          która wzrośnie</strong> — dlatego aukcje są wyłączone z wyceny i oznaczone osobną
          plakietką.
        </p>
      </Section>

      <Section title="4. Odpowiedzialność">
        <p>
          Serwis udostępniany jest w formie, w jakiej jest. Dokładamy starań, żeby dane były
          poprawne, ale nie gwarantujemy ich kompletności ani aktualności i nie odpowiadamy za
          decyzje podjęte na ich podstawie ani za treści w serwisach sprzedających.
        </p>
        <p>
          Jeśli jesteś właścicielem serwisu, z którego zbieramy oferty, i chcesz, żebyśmy przestali
          — napisz na <ToFill>kontakt@autopoleasingu.pl</ToFill>, usuniemy źródło.
        </p>
      </Section>

      <Section title="5. Korzystanie z serwisu">
        <p>
          Korzystanie jest bezpłatne i nie wymaga zakładania konta. Prosimy o niepobieranie danych
          w sposób automatyczny i masowy — te same oferty są dostępne bezpośrednio u źródeł.
        </p>
      </Section>

      <Section title="6. Operator i zmiany">
        <p>
          Operatorem serwisu jest <ToFill>[nazwa / imię i nazwisko]</ToFill>,{" "}
          <ToFill>[adres]</ToFill>, <ToFill>[NIP, jeśli działalność gospodarcza]</ToFill>. Kontakt:{" "}
          <ToFill>kontakt@autopoleasingu.pl</ToFill>.
        </p>
        <p>
          Regulamin może ulec zmianie; aktualna wersja jest zawsze pod tym adresem, wraz z datą
          ostatniej aktualizacji.
        </p>
      </Section>

      <Section title="Uwaga">
        <p className="text-sm">
          Ten dokument został przygotowany jako punkt wyjścia i opisuje zgodnie z prawdą to, co
          serwis faktycznie robi. <strong className="text-neutral-200">Nie jest poradą prawną.</strong>{" "}
          Przed publicznym udostępnieniem serwisu warto dać go do przejrzenia prawnikowi — zwłaszcza
          w części dotyczącej ponownego udostępniania treści pochodzących z cudzych serwisów.
        </p>
      </Section>
    </LegalPage>
  );
}
