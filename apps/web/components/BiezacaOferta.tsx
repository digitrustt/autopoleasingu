"use client";

import { type KontekstWyjscia, ustawBiezacaOferte } from "@/lib/zapis-sygnal";
import { useEffect } from "react";

/**
 * Mowi nakladce zapisu, jakie auto jest teraz otwarte — patrz
 * `ustawBiezacaOferte`. Niczego nie renderuje.
 */
export function BiezacaOferta({ vin }: { vin: string | null }) {
  useEffect(() => {
    const k: KontekstWyjscia = { vin };
    ustawBiezacaOferte(k);
    return () => ustawBiezacaOferte(null);
  }, [vin]);
  return null;
}
