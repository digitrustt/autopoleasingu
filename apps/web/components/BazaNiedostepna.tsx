import { Logo } from "@/components/Logo";
import { DatabaseZap } from "lucide-react";

/**
 * Ekran na wypadek niedostepnej bazy.
 *
 * Powstal po tym, jak Neon odcial transfer za przekroczenie limitu i CALY
 * serwis zaczal zwracac blad 500 — lacznie ze strona glowna, ktora nie ma
 * cache'a, bo zalezy od parametrow wyszukiwania. Strony z `revalidate` przezyly,
 * bo Next serwuje wtedy ostatnia dobra wersje; strona glowna nie miala czego
 * serwowac.
 *
 * Awaria bazy nie powinna wygladac jak awaria calego serwisu. Mowimy wprost,
 * co sie stalo, zamiast pokazywac zrzut bledu — a odnosniki nizej prowadza do
 * stron, ktore w tym czasie dzialaja z cache'a.
 */
export function BazaNiedostepna() {
  return (
    <main className="mx-auto flex max-w-[560px] flex-col items-center gap-4 px-4 py-24 text-center">
      <DatabaseZap size={30} className="text-amber-400" />
      <h1 className="text-xl font-semibold text-neutral-100">
        Chwilowo nie mamy dostępu do danych
      </h1>
      <p className="text-sm leading-relaxed text-neutral-400">
        Wyszukiwarka <Logo className="text-sm" /> nie może teraz odczytać bazy ofert. To awaria
        po naszej stronie, nie po Twojej — oferty nie zniknęły. Spróbuj za kilka minut.
      </p>
      <p className="text-[13px] leading-relaxed text-neutral-500">
        W tym czasie działają strony marek i modeli, na przykład{" "}
        <a href="/bmw" className="underline decoration-dotted underline-offset-2 hover:text-accent">
          BMW
        </a>
        ,{" "}
        <a
          href="/poleasingowe"
          className="underline decoration-dotted underline-offset-2 hover:text-accent"
        >
          spis miast
        </a>{" "}
        albo{" "}
        <a
          href="/poleasingowe/okazje"
          className="underline decoration-dotted underline-offset-2 hover:text-accent"
        >
          okazje poniżej rynku
        </a>
        .
      </p>
    </main>
  );
}
