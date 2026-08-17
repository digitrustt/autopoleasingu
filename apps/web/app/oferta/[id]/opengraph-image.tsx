import { shortSource } from "@/lib/format";
import { ogImage, OG_SIZE, OG_TYPE } from "@/lib/og";
import { getListing } from "@/lib/queries";

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = "Oferta poleasingowa";
// Raz na dobe — obrazek powstaje z danych, ktore zmieniaja sie raz na dobe.
export const revalidate = 86_400;

const pln = new Intl.NumberFormat("pl-PL", {
  style: "currency", currency: "PLN", maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("pl-PL");

const FUEL_PL: Record<string, string> = {
  petrol: "Benzyna", diesel: "Diesel", hybrid: "Hybryda", phev: "PHEV",
  electric: "Elektryk", lpg: "LPG", cng: "CNG", other: "Inne",
};

export default async function Image({ params }: { params: { id: string } }) {
  const o = await getListing(Number(params.id));
  if (!o) return ogImage({ title: "autopoleasingu.pl" });

  return ogImage({
    eyebrow: `${shortSource(o.sourceName)} · po leasingu`,
    title: `${o.make} ${o.model}${o.year ? ` ${o.year}` : ""}`,
    subtitle: o.trim ?? undefined,
    stats: [
      {
        label: o.offerKind === "auction" ? "Aukcja" : "Cena",
        value: o.priceGross != null ? pln.format(o.priceGross) : "na zapytanie",
      },
      ...(o.mileageKm != null
        ? [{ label: "Przebieg", value: `${num.format(o.mileageKm)} km` }]
        : []),
      ...(o.fuel ? [{ label: "Paliwo", value: FUEL_PL[o.fuel] ?? o.fuel }] : []),
      ...(o.marketPrice ? [{ label: "Rynek", value: pln.format(o.marketPrice) }] : []),
    ],
  });
}
