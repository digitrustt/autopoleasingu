import { ogImage, OG_SIZE, OG_TYPE } from "@/lib/og";
import { getStats } from "@/lib/queries";

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = "autopoleasingu.pl — oferty poleasingowe z 26 źródeł";
// Raz na dobe — obrazek powstaje z danych, ktore zmieniaja sie raz na dobe.
export const revalidate = 86_400;

const pln = new Intl.NumberFormat("pl-PL", {
  style: "currency", currency: "PLN", maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("pl-PL");

export default async function Image() {
  const s = await getStats();
  return ogImage({
    title: "Auta poleasingowe z 26 źródeł naraz",
    subtitle:
      "Firmy leasingowe, CFM i programy dealerskie w jednej wyszukiwarce. " +
      "Ceny porównane z medianą rynkową.",
    stats: [
      { label: "Ofert", value: num.format(s.active) },
      { label: "Nowych dziś", value: num.format(s.newToday) },
      { label: "Mediana", value: pln.format(s.medianPrice) },
    ],
  });
}
