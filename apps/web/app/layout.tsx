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
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
