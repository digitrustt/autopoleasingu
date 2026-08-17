import { ogImage, OG_SIZE, OG_TYPE } from "@/lib/og";
import { getMakesWithCounts, getSegmentStats } from "@/lib/queries";
import { resolveSlug } from "@/lib/slug";

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = "Oferty poleasingowe";
// Raz na dobe — obrazek powstaje z danych, ktore zmieniaja sie raz na dobe.
export const revalidate = 86_400;

const pln = new Intl.NumberFormat("pl-PL", {
  style: "currency", currency: "PLN", maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("pl-PL");

export default async function Image({ params }: { params: { make: string } }) {
  const makes = await getMakesWithCounts();
  const make = resolveSlug(makes.map((m) => m.make), params.make);
  if (!make) return ogImage({ title: "autopoleasingu.pl" });

  const s = await getSegmentStats(make);
  return ogImage({
    eyebrow: "PO LEASINGU",
    title: make,
    subtitle: `${num.format(s.total)} aktywnych ofert z ${s.sources} źródeł, aktualizowane codziennie`,
    stats: [
      { label: "Ofert", value: num.format(s.total) },
      ...(s.medianPrice ? [{ label: "Mediana", value: pln.format(s.medianPrice) }] : []),
      ...(s.minPrice ? [{ label: "Od", value: pln.format(s.minPrice) }] : []),
      { label: "Poniżej rynku", value: num.format(s.deals) },
    ],
  });
}
