"use client";

import { ImageOff } from "lucide-react";
import { useState } from "react";

/**
 * Zdjecie auta hot-linkowane ze zrodla.
 *
 * Trzy rzeczy, ktorych nie zalatwia samo <img>:
 *
 * 1. ADRESY WYGASAJA. Czesc zrodel (Bravoauto) serwuje zdjecia przez podpisane
 *    adresy ActiveStorage, ktore po jakims czasie zwracaja 404. Bez obslugi
 *    bledu przegladarka zostawia w kafelku ikone zepsutego obrazka i tekst
 *    alternatywny — czyli napis "BMW X1" na czarnym tle, ktory wyglada
 *    dokladnie jak zepsuta strona. Po bledzie podmieniamy na placeholder.
 *
 * 2. LAZY LOADING WIDAC. Przy czterdziestu osmiu kafelkach `loading="lazy"`
 *    startuje dopiero, gdy kafelek zbliza sie do widoku, wiec przy szybkim
 *    przewijaniu przez chwile widac same czarne prostokaty. Pierwsze kilka
 *    zdjec ladujemy wiec normalnie (`priority`), a reszta dostaje szare tlo
 *    zamiast czerni, zeby puste miejsce czytalo sie jak "laduje sie", a nie
 *    jak "nie ma".
 *
 * 3. next/image jest tu wylaczone swiadomie — optymalizacja obrazow na
 *    Vercelu to platny limit, a zdjecia i tak serwuje zrodlo (patrz
 *    next.config.ts).
 */
export function CarImage({
  src,
  alt,
  className = "",
  priority = false,
}: {
  src: string | null;
  alt: string;
  className?: string;
  /** Nad linia zalamania — laduj od razu, bez czekania na przewiniecie. */
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span className="flex h-full w-full flex-col items-center justify-center gap-1 bg-[var(--color-panel)] text-neutral-700">
        <ImageOff size={18} />
        <span className="text-[10px]">brak zdjęcia</span>
      </span>
    );
  }

  return (
    // Hot-link do zrodla — swiadomie zwykly <img>, patrz next.config.ts
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      /*
       * Bez referera. Czesc serwerow ze zdjeciami odrzuca zapytania z obcym
       * naglowkiem Referer, a przy hot-linku i tak nie mamy powodu mowic im,
       * skad przychodzimy.
       */
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
