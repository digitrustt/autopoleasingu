import { track } from "@/components/Analytics";

/**
 * Wspolna obsluga bledow po stronie przegladarki — dla app/error.tsx
 * i app/global-error.tsx.
 *
 * DLACZEGO TO POWSTALO. Do tej pory serwis nie mial ZADNEJ granicy bledow.
 * Kazdy wyjatek w przegladarce konczyl sie domyslnym ekranem Next.js: biala
 * strona z napisem "Application error: a client-side exception has occurred"
 * i niczym wiecej — bez naglowka, bez linku, bez przycisku. Czlowiek nie mial
 * z niej jak wyjsc inaczej niz zamykajac karte.
 *
 * NAJCZESTSZA PRZYCZYNA TO NIE BLAD W KODZIE, TYLKO DEPLOY. Karta otwarta
 * przed wdrozeniem trzyma odwolania do plikow JS poprzedniej wersji, a te po
 * wdrozeniu znikaja z domeny. Pierwsze klikniecie w takiej karcie probuje je
 * doczytac, dostaje 404 i wywraca strone. Telefony trzymaja karty dniami, wiec
 * przy kazdym deployu dotyka to czesci powracajacych ludzi — czyli dokladnie
 * tych, na ktorych serwisowi zalezy najbardziej.
 *
 * Na ten przypadek jedynym lekarstwem jest przeladowanie: nowa strona pobiera
 * nowe pliki. Robimy je wiec AUTOMATYCZNIE, raz. Czlowiek widzi mrugniecie
 * zamiast martwego ekranu.
 */

const KLUCZ_PRZELADOWANIA = "blad_przeladowanie";
/** Drugie przeladowanie w tym oknie znaczy, ze to nie jest stara wersja, tylko prawdziwy blad. */
const OKNO_MS = 30_000;

/*
 * Komunikaty, jakimi rozne przegladarki zglaszaja nieudane doczytanie pliku JS.
 * Safari mowi co innego niz Chrome, a Firefox jeszcze co innego — bez kompletu
 * automatyczne przeladowanie dzialaloby tylko na czesci telefonow.
 */
const BLEDY_WCZYTANIA = [
  /ChunkLoadError/i,
  /Loading chunk [\w-]+ failed/i,
  /Loading CSS chunk/i,
  /Failed to fetch dynamically imported module/i, // Chrome
  /Importing a module script failed/i, // Safari
  /error loading dynamically imported module/i, // Firefox
];

export function toBladWczytania(error: Error): boolean {
  const tekst = `${error.name} ${error.message}`;
  return BLEDY_WCZYTANIA.some((r) => r.test(tekst));
}

/**
 * Przeladowuje strone, jesli to blad starej wersji i nie przeladowywalismy
 * przed chwila. Zwraca true, gdy przeladowanie ruszylo — wtedy nie ma sensu
 * pokazywac ekranu bledu, bo za moment zniknie.
 *
 * Straznik w sessionStorage chroni przed petla: gdyby plik brakowal z innego
 * powodu niz deploy, strona przeladowywalaby sie w nieskonczonosc.
 */
export function sprobujPrzeladowac(error: Error): boolean {
  if (!toBladWczytania(error)) return false;
  try {
    const ostatnio = Number(sessionStorage.getItem(KLUCZ_PRZELADOWANIA) ?? 0);
    if (Date.now() - ostatnio < OKNO_MS) return false;
    sessionStorage.setItem(KLUCZ_PRZELADOWANIA, String(Date.now()));
  } catch {
    // Bez sessionStorage nie mamy straznika petli — lepiej pokazac ekran niz ryzykowac.
    return false;
  }
  window.location.reload();
  return true;
}

/**
 * Zgloszenie do PostHoga. Bez tego bledy w przegladarce sa dla nas NIEWIDOCZNE —
 * Vercel loguje tylko serwer, a o tym, ze strona wywala sie ludziom, dowiadujemy
 * sie dopiero, gdy ktos napisze. `track` nic nie robi bez zgody na analityke.
 */
export function zglosBlad(error: Error & { digest?: string }, gdzie: "segment" | "global"): void {
  try {
    track("blad_klienta", {
      gdzie,
      nazwa: error.name,
      komunikat: error.message?.slice(0, 300),
      digest: error.digest,
      wczytanie: toBladWczytania(error),
      sciezka: window.location.pathname + window.location.search,
    });
  } catch {
    /* zglaszanie bledu nie moze samo wywrocic strony */
  }
}
