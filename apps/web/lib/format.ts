/**
 * Nazwa zrodla skrocona do UI. Pelne nazwy z bazy miewaja 43 znaki
 * ("VW FS Store (Volkswagen Financial Services)") i rozpychaly kafelek poza
 * siatke — ucinamy dopisek w nawiasie oraz wszystko po myslniku
 * ("Otomoto — sklepy leasingodawcow" -> "Otomoto").
 *
 * Pelna nazwa zostaje w atrybucie title tam, gdzie tekst jest przyciety.
 */
export function shortSource(name: string): string {
  return name
    .replace(/\s*\(.*\)$/, "")
    .split(/\s+[—–-]\s+/)[0]
    .trim();
}
