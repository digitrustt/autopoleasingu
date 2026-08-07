import { Footer } from "@/components/Footer";
import type { Metadata } from "next";
import "./globals.css";

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
        <div className="flex-1">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
