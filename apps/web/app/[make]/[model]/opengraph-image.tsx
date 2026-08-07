import { ogImage, OG_SIZE, OG_TYPE } from "@/lib/og";
import { getMakesWithCounts, getModelsWithCounts, getSegmentStats } from "@/lib/queries";
import { resolveSlug } from "@/lib/slug";

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = "Oferty poleasingowe";
export const revalidate = 3600;

const pln = new Intl.NumberFormat("pl-PL", {
  style: "currency", currency: "PLN", maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("pl-PL");

export default async function Image({ params }: { params: { make: string; model: string } }) {
  const makes = await getMakesWithCounts();
  const make = resolveSlug(makes.map((m) => m.make), params.make);
  if (!make) return ogImage({ title: "autopoleasingu.pl" });

  const models = await getModelsWithCounts(make);
  const model = resolveSlug(models.map((m) => m.model), params.model);
  if (!model) return ogImage({ title: make });

  const s = await getSegmentStats(make, model);
  return ogImage({
    eyebrow: "PO LEASINGU",
    title: `${make} ${model}`,
    subtitle:
      `${num.format(s.total)} ofert z ${s.sources} źródeł` +
      (s.minYear && s.maxYear ? ` · roczniki ${s.minYear}–${s.maxYear}` : ""),
    stats: [
      ...(s.minPrice ? [{ label: "Od", value: pln.format(s.minPrice) }] : []),
      ...(s.medianPrice ? [{ label: "Mediana", value: pln.format(s.medianPrice) }] : []),
      ...(s.medianMileage != null
        ? [{ label: "Przebieg", value: `${num.format(s.medianMileage)} km` }]
        : []),
      { label: "Poniżej rynku", value: num.format(s.deals) },
    ],
  });
}
