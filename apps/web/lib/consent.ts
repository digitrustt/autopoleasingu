/**
 * Zgoda na analitykę.
 *
 * Wybór trzymamy w localStorage, NIE w ciasteczku — dzięki temu do momentu
 * kliknięcia „Zgadzam się" przeglądarka nie odsyła do nas ani jednego bajtu,
 * a sama pamięć wyboru mieści się w kategorii „ściśle niezbędne", bo bez niej
 * baner pytałby w kółko.
 *
 * Kolejność ma znaczenie prawne: w EU analityka nieniezbędna wymaga zgody
 * UPRZEDNIEJ. PostHog startuje więc dopiero po decyzji użytkownika, nigdy
 * „na wszelki wypadek" z możliwością późniejszego wyłączenia.
 */
export const CONSENT_KEY = "ap-consent";

export type Consent = "granted" | "denied";

export function readConsent(): Consent | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    // Tryb prywatny potrafi rzucać przy dostępie do localStorage — wtedy
    // traktujemy to jak brak zgody i nie uruchamiamy niczego.
    return null;
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
