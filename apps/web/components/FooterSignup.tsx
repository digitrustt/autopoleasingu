"use client";

import { ZapisForm } from "@/components/ZapisForm";

/**
 * Zapis na dzienny przeglad najlepszych okazji — w stopce, bez filtrow.
 *
 * Cala logika siedzi w ZapisForm, wspolnym dla stopki, paskow kontekstowych
 * i nakladki. Wczesniej byla tu jej wlasna kopia; przy trzecim miejscu zapisu
 * oznaczaloby to trzy kopie tego samego zapytania i trzy miejsca do poprawienia
 * przy kazdej zmianie w api/alerty.
 */
export function FooterSignup() {
  return (
    <div className="md:w-[400px]">
      <ZapisForm typ="stopka" />
    </div>
  );
}
