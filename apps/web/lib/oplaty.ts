/**
 * Stawki do kalkulatora PCC i opłat rejestracyjnych — JEDNO miejsce.
 *
 * Opłaty: rozporządzenie Ministra Infrastruktury z 4.08.2022 w sprawie
 * wysokości opłat za wydanie dowodu rejestracyjnego, pozwolenia czasowego
 * i zalegalizowanych tablic (tekst jednolity Dz.U. 2025 poz. 553), odczytane
 * u źródła 20.10.2026. Od 10.06.2026 przy zachowaniu tablic nie trzeba ich
 * ponownie legalizować, więc nalepki odpadają.
 *
 * UWAGA: MI ma projekt podwyżki (dowód 62,50 zł, tablice 92,50 zł, pozwolenie
 * 16 zł, tablice indywidualne 3000 zł) — na 20.10.2026 NIE ogłoszony. Po
 * publikacji w Dzienniku Ustaw zmienić kwoty tutaj i `STAN_NA`.
 */
export const STAN_NA = "20 października 2026";

export const OPLATY = {
  dowod: 54,
  pozwolenieZUrzedu: 13.5,
  pozwolenieNaWniosek: 18.5,
  tablice: 80,
  tabliceIndywidualne: 1000,
  nalepkiLegalizacyjne: 12.5,
  /** Opłata skarbowa za pełnomocnictwo — nie dotyczy najbliższej rodziny. */
  pelnomocnictwo: 17,
} as const;

/** PCC od umowy kupna auta: 2% wartości rynkowej, nie powstaje do 1000 zł. */
export const PCC_STAWKA = 0.02;
export const PCC_PROG = 1000;
/** Dni na złożenie PCC-3 i zapłatę od podpisania umowy. */
export const PCC_DNI = 14;
/** Dni na rejestrację auta przez kupującego (i zgłoszenie zbycia przez sprzedającego). */
export const REJESTRACJA_DNI = 30;
