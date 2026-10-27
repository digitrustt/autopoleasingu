/**
 * Od jakiej ceny pokazujemy kredyt przy ofercie.
 *
 * PostHog (27.10.2026), 52 klikniecia w kredyt z cena oferty: 49 przy autach od
 * 60 tys. zl, 2 przy 30–60 tys., 1 ponizej 30 tys. Po auto za kilkanascie
 * tysiecy nikt nie bierze kredytu, a przycisk konkuruje tam o uwage z wyjsciem
 * do sprzedawcy. Prowizja to 2% kwoty, wiec tez i tak jest tam symboliczna.
 */
export const MIN_CENA_KREDYT = 30_000;

export const kredytDlaCeny = (cena: number | null | undefined): boolean =>
  cena != null && cena >= MIN_CENA_KREDYT;
