import { Analytics } from "@/components/Analytics";
import { CookieConsent } from "@/components/CookieConsent";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ZapisPopup } from "@/components/ZapisPopup";
import type { Metadata } from "next";
import "./globals.css";

/*
 * Twardy limit czasu dla KAZDEJ trasy, nie tylko strony glownej.
 *
 * Bez niego zawieszony render (zerwane polaczenie z baza w uspionej instancji)
 * trzymal funkcje do domyslnych 300 s: czlowiek patrzyl piec minut w pusty
 * ekran i dostawal 502, a instancja z martwym polaczeniem wieszala kolejne
 * wejscia. Zmierzone 5.10.2026: strony na zmiane odpowiadaly w 0,3 s albo
 * wcale. Dwadziescia sekund to wielokrotny zapas na najciezsza strone,
 * a zabita funkcja wstaje z nowymi polaczeniami.
 */
export const maxDuration = 20;

export const metadata: Metadata = {
  title: "Auto po leasingu — sniper ofert poleasingowych",
  description:
    "Monitoring aut poleasingowych z 26 polskich platform leasingowych, CFM i programów " +
    "dealerskich. Historia cen, wykrywanie przecen i ten sam egzemplarz w kilku kanałach.",
  metadataBase: new URL("https://autopoleasingu.pl"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      {/*
        flex + mt-auto na stopce: przy krotkiej stronie (pusty wynik, 404)
        stopka ma siedziec na dole okna, a nie tuz pod trzema linijkami tekstu.
      */}
      <body className="flex min-h-screen flex-col antialiased">
        <Header />
        <div className="flex-1">{children}</div>
        <Footer />
        {/* Oba nic nie robia bez zgody — patrz lib/consent.ts. */}
        <CookieConsent />
        {/* Nie pokazuje sie, dopoki wisi baner zgody — patrz ZapisPopup. */}
        <ZapisPopup />
        <Analytics />
      </body>
    </html>
  );
}
