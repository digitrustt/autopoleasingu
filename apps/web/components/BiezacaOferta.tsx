"use client";

import { type KontekstWyjscia, ustawBiezacaOferte } from "@/lib/zapis-sygnal";
import { useEffect } from "react";

/**
 * Mowi nakladce zapisu, jakie auto jest teraz otwarte — patrz
 * `ustawBiezacaOferte`. Niczego nie renderuje.
 */
export function BiezacaOferta({
  vin,
  id,
  nazwa,
  kredyt,
}: {
  vin: string | null;
  id: number;
  nazwa: string;
  kredyt: boolean;
}) {
  useEffect(() => {
    const k: KontekstWyjscia = { vin, id, nazwa, kredyt };
    ustawBiezacaOferte(k);
    return () => ustawBiezacaOferte(null);
  }, [vin, id, nazwa, kredyt]);
  return null;
}
