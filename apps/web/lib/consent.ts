/**
 * Zgoda na analitykę.
 *
 * Wybór trzymamy w localStorage, NIE w ciasteczku — pamięć wyboru mieści się
 * wtedy w kategorii „ściśle niezbędne", bo bez niej baner pytałby w kółko.
 *
 * ZGODA JEST DOMYŚLNIE UDZIELONA — DECYZJA WŁAŚCICIELA SERWISU Z 17.09.2026.
 *
 * Analityka startuje od wejścia; baner informuje, ale niczego nie blokuje.
 * Powód decyzji: pomiar był bezużyteczny. Porównanie z Search Console za
 * poniedziałek 14.09 dało 19 osób z Google w PostHogu wobec 51 kliknięć
 * w GSC — widzieliśmy 37% ruchu, a wszystkie prognozy i wnioski o zachowaniu
 * ludzi na stronie były liczone z tej jednej trzeciej.
 *
 * UWAGA DLA PRZYSZŁEGO CZYTELNIKA — TO JEST ŚWIADOME WYJŚCIE POZA RODO.
 * W EU analityka nieniezbędna wymaga zgody UPRZEDNIEJ (art. 6 RODO
 * i art. 173 PKE); uruchamianie jej przed decyzją jest dokładnie tym,
 * za co UODO nakłada kary, a baner, który niczego nie blokuje, dowodzi
 * świadomości. Przywrócenie stanu zgodnego z prawem to jedna linia:
 * `DOMYSLNA_ZGODA = null` poniżej.
 *
 * ODRZUCENIE DZIAŁA NAPRAWDĘ i musi tak zostać. Kto kliknie „Odrzuć",
 * ten nie jest mierzony — baner udający wybór przed kimś, kto świadomie
 * odmawia, to już nie ryzyko regulacyjne, tylko okłamywanie użytkownika.
 */

/**
 * Co zwracamy, gdy użytkownik jeszcze nic nie kliknął.
 *
 * `"granted"` = analityka od wejścia (stan obecny).
 * `null`      = analityka dopiero po kliknięciu (stan zgodny z RODO).
 */
const DOMYSLNA_ZGODA: Consent | null = "granted";
export const CONSENT_KEY = "ap-consent";

export type Consent = "granted" | "denied";

export function readConsent(): Consent | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(CONSENT_KEY);
    if (v === "granted" || v === "denied") return v;
    return DOMYSLNA_ZGODA;
  } catch {
    // Tryb prywatny potrafi rzucać przy dostępie do localStorage. Traktujemy
    // to jak brak zapisanej decyzji, czyli tak samo jak pierwsze wejście.
    return DOMYSLNA_ZGODA;
  }
}

/**
 * Czy użytkownik podjął WŁASNĄ decyzję — tym różni się od `readConsent`,
 * które przy braku wyboru zwraca wartość domyślną.
 *
 * Tego pyta baner (ma się pokazać, dopóki człowiek nie kliknie) oraz nakładka
 * z zapisem (nie wchodzi, dopóki baner wisi — dwie nakładki naraz to ściana).
 */
export function hasConsentDecision(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = window.localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied";
  } catch {
    return false;
  }
}

export function writeConsent(v: Consent): void {
  try {
    window.localStorage.setItem(CONSENT_KEY, v);
  } catch {
    // Bez zapisu baner pojawi się ponownie — to gorsze UX, ale nie awaria.
  }
  window.dispatchEvent(new CustomEvent("ap-consent-change", { detail: v }));
}
