import { CarImage } from "@/components/CarImage";
import Link from "next/link";

const pln = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("pl-PL");

/**
 * Kafelek kategorii ze zdjeciem prawdziwego auta z tej kategorii.
 *
 * Spis kategorii byl wczesniej scianą jednakowych ciemnych pigulek — czterdziesci
 * pozycji roznicych sie wylacznie napisem. Nic nie podpowiadalo, ze "SUV" ma
 * 7409 ofert, a "Van" 513, ani jak te auta wygladaja.
 *
 * Zdjecie jest NAJNOWSZA oferta w kategorii, nie losowa: adresy hot-linkowanych
 * miniatur wygasaja (patrz CarImage), wiec swieze psuja sie rzadziej.
 */
export function KategoriaKafelek({
  href,
  nazwa,
  total,
  minPrice,
  thumb,
  priority = false,
}: {
  href: string;
  nazwa: string;
  total: number;
  minPrice?: number | null;
  thumb?: string | null;
  priority?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] transition-colors hover:border-neutral-600"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-[var(--color-ink)]">
        <CarImage
          src={thumb ?? null}
          alt={nazwa}
          priority={priority}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
        />
        {/*
          Przyciemnienie od dolu, zeby napis byl czytelny niezaleznie od tego,
          jak jasne okazalo sie zdjecie — a przychodza z 26 roznych zrodel
          i nie mamy nad nimi zadnej kontroli.
        */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-3">
          <p className="text-[15px] font-semibold text-white drop-shadow">{nazwa}</p>
          <p className="text-[12px] tabular-nums text-neutral-300">
            {num.format(total)} ofert
            {minPrice != null && ` · od ${pln.format(minPrice)}`}
          </p>
        </div>
      </div>
    </Link>
  );
}
