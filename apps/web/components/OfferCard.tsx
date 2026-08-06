import { DealBadge } from "@/components/DealBadge";
import { TwinLink } from "@/components/TwinLink";
import { shortSource } from "@/lib/format";
import type { OfferRow } from "@/lib/queries";
import {
  ArrowRight,
  Calendar,
  Copy,
  Fuel,
  Gauge,
  Gavel,
  ImageOff,
  MapPin,
  Settings2,
  Timer,
  TrendingDown,
  Zap,
} from "lucide-react";

const pln = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("pl-PL");

const FUEL_PL: Record<string, string> = {
  petrol: "Benzyna", diesel: "Diesel", hybrid: "Hybryda", phev: "PHEV",
  electric: "Elektryk", lpg: "LPG", cng: "CNG", other: "Inne",
};
const GEARBOX_PL: Record<string, string> = {
  manual: "Manual", automatic: "Automat", other: "—",
};

function isFresh(d: Date): boolean {
  return Date.now() - d.getTime() < 24 * 3600 * 1000;
}

/** "za 3 dni", "za 5 godz.", "koniec" — ile zostalo do konca licytacji. */
function endsIn(d: Date): string {
  const mins = Math.round((d.getTime() - Date.now()) / 60_000);
  if (mins <= 0) return "koniec";
  if (mins < 60) return `za ${mins} min`;
  if (mins < 24 * 60) return `za ${Math.round(mins / 60)} godz.`;
  return `za ${Math.round(mins / (24 * 60))} dni`;
}

/** Jedna pozycja specyfikacji: ikona + wartosc. */
function Spec({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1 whitespace-nowrap text-neutral-400">
      <span className="text-neutral-600">{icon}</span>
      {children}
    </span>
  );
}


export function OfferCard({ o, index = 0 }: { o: OfferRow; index?: number }) {
  const dropPct =
    o.drop?.oldPrice && o.drop.newPrice
      ? Math.round(((o.drop.oldPrice - o.drop.newPrice) / o.drop.oldPrice) * 100)
      : null;

  const isAuction = o.offerKind === "auction";

  // Zielona "oszczednosc" nalezy sie tylko wtedy, gdy obie ceny sa porownywalne.
  const twinIsCheaperFixed =
    o.twin != null && o.twin.offerKind !== "auction" && o.twin.diff != null && o.twin.diff < 0;

  return (
    <a
      href={o.url}
      target="_blank"
      rel="noopener noreferrer"
      /*
       * Opoznienie rosnie z pozycja w siatce, ale jest przyciete na 12 kafelkach —
       * przy 60 ofertach ostatnia wjezdzalaby z sekunda opoznienia, co czytaloby
       * sie jak zacinanie, a nie jak animacja.
       */
      style={{ animationDelay: `${Math.min(index, 12) * 25}ms` }}
      className="card-in group flex flex-col overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] transition duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-lg hover:shadow-white/5"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-black/40">
        {o.thumbnailUrl ? (
          // Hot-link do zrodla — swiadomie zwykly <img>, patrz next.config.ts
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={o.thumbnailUrl}
            alt={`${o.make} ${o.model}`}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-neutral-700">
            <ImageOff size={20} />
            <span className="text-xs">brak zdjęcia</span>
          </div>
        )}

        <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
          {isFresh(o.firstSeenAt) && (
            <span className="rounded-md bg-emerald-500 px-1.5 py-0.5 text-[11px] font-semibold text-black">
              NOWA
            </span>
          )}
          {dropPct != null && dropPct > 0 && (
            <span className="flex items-center gap-0.5 rounded-md bg-amber-400 px-1.5 py-0.5 text-[11px] font-semibold text-black">
              <TrendingDown size={11} />
              {dropPct}%
            </span>
          )}
          {isAuction && (
            <span className="flex items-center gap-0.5 rounded-md bg-violet-500 px-1.5 py-0.5 text-[11px] font-semibold text-white">
              <Gavel size={11} />
              AUKCJA
            </span>
          )}
          {o.dealScore != null && <DealBadge score={o.dealScore} compact />}
        </div>

        {/* Strzalka pojawia sie pod kursorem — sygnal, ze kafelek wychodzi na zewnatrz. */}
        <span className="absolute bottom-2 right-2 flex h-7 w-7 translate-y-1 items-center justify-center rounded-full bg-accent text-black opacity-0 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100">
          <ArrowRight size={15} />
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div>
          <h3 className="truncate font-semibold leading-tight transition-colors group-hover:text-accent">
            {o.make} {o.model}
          </h3>
          {o.trim && (
            <p className="truncate text-xs text-neutral-500" title={o.trim}>
              {o.trim}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-x-2.5 gap-y-1 text-xs">
          {o.year && <Spec icon={<Calendar size={12} />}>{o.year}</Spec>}
          {o.mileageKm != null && (
            <Spec icon={<Gauge size={12} />}>{num.format(o.mileageKm)} km</Spec>
          )}
          {o.fuel && <Spec icon={<Fuel size={12} />}>{FUEL_PL[o.fuel] ?? o.fuel}</Spec>}
          {o.gearbox && (
            <Spec icon={<Settings2 size={12} />}>{GEARBOX_PL[o.gearbox] ?? o.gearbox}</Spec>
          )}
          {o.powerHp && <Spec icon={<Zap size={12} />}>{o.powerHp} KM</Spec>}
        </div>

        {/*
          Ta sama sztuka (ten sam VIN) wystawiona gdzie indziej. Nie scalamy takich
          ofert, bo roznica ceny miedzy kanalami bywa kilkudziesieciotysieczna —
          i to wlasnie ona jest tu najciekawsza.
        */}
        {o.twin && o.vin && (
          /*
           * Osobny <a> w srodku kafelka, ktory sam jest linkiem — zagniezdzanie
           * <a> w <a> jest niepoprawne, wiec przechwytujemy klikniecie i
           * przechodzimy recznie. Bez tego klik na blizniaka otwieralby oferte
           * zewnetrzna zamiast historii VIN-u.
           */
          <TwinLink
            vin={o.vin}
            className={`flex items-start gap-1 text-[11px] leading-tight transition-colors ${
              twinIsCheaperFixed
                ? "text-emerald-400 hover:text-emerald-300"
                : "text-neutral-500 hover:text-accent"
            }`}
          >
            <Copy size={11} className="mt-px shrink-0" />
            <span>
              ta sama sztuka w {shortSource(o.twin.sourceName)}
              {o.twin.priceGross != null && `: ${pln.format(o.twin.priceGross)}`}
              {/*
                Roznice pokazujemy jako oszczednosc TYLKO miedzy cenami "kup teraz".
                Gdy taniej jest na aukcji, to biezaca oferta w licytacji, ktora
                jeszcze urosnie — podpisanie jej "−43 551 zl" byloby obietnica
                bez pokrycia.
              */}
              {twinIsCheaperFixed && ` (−${pln.format(-(o.twin.diff ?? 0))})`}
              {o.twin.offerKind === "auction" && " — licytacja trwa"}
              <span className="ml-1 underline decoration-dotted underline-offset-2">
                historia VIN
              </span>
            </span>
          </TwinLink>
        )}

        {/*
          min-w-0 na obu kolumnach jest konieczne: domyslnie element flex nie
          zwezy sie ponizej swojej tresci, wiec dluga nazwa sprzedawcy albo
          zrodla rozpychala kafelek poza siatke zamiast sie przyciac.
        */}
        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <div className="min-w-0">
            {/*
              Brak ceny nie znaczy "nie wiemy" — znaczy, ze sprzedawca nie
              wystawia auta za gotowke (Automarket ma tak ~7 tys. sztuk
              dostepnych wylacznie w leasingu albo pozyczce). Podpisujemy to
              wprost, bo "—" wygladaloby na dziure w danych.
            */}
            <p className="text-lg font-bold tabular-nums">
              {o.priceGross != null ? (
                pln.format(o.priceGross)
              ) : (
                <span className="text-base font-semibold text-zinc-400">cena na zapytanie</span>
              )}
            </p>
            {/*
              Przy aukcji cena to biezaca oferta w licytacji, nie kwota zakupu —
              bez tego podpisu auto za 1 zl wyglada jak okazja stulecia.
            */}
            {o.priceGross == null ? (
              <p className="text-[11px] leading-tight text-zinc-500">tylko leasing lub najem</p>
            ) : isAuction ? (
              <p className="flex items-center gap-1 text-[11px] leading-tight text-violet-300">
                aktualna oferta
                {o.auctionEndsAt && (
                  <>
                    <Timer size={11} />
                    {endsIn(o.auctionEndsAt)}
                  </>
                )}
              </p>
            ) : o.dealScore != null && o.marketPrice != null && o.dealScore >= 0.1 ? (
              /*
                Sama plakietka mowi "ile taniej", ale nie "taniej od czego".
                Bez podanej mediany procent jest nieweryfikowalny, a liczba
                probek pokazuje, na ilu autach ta ocena stoi.
              */
              <p className="text-[11px] leading-tight text-emerald-400/80">
                rynek {pln.format(o.marketPrice)}
                <span className="text-neutral-600"> · {o.dealSamples} porównań</span>
              </p>
            ) : (
              dropPct != null &&
              o.drop?.oldPrice && (
                <p className="text-xs text-neutral-500 line-through tabular-nums">
                  {pln.format(o.drop.oldPrice)}
                </p>
              )
            )}
          </div>
          <span className="min-w-0 max-w-[52%] text-right text-[11px] leading-tight text-neutral-500">
            {o.city && (
              <span className="flex items-center justify-end gap-0.5 truncate">
                <MapPin size={10} className="shrink-0" />
                <span className="truncate">{o.city}</span>
              </span>
            )}
            {/* Na platformach wielofirmowych liczy sie, czyje jest auto, a nie gdzie wisi. */}
            {o.seller && (
              <span className="block truncate text-neutral-400" title={o.seller}>
                {o.seller}
              </span>
            )}
            <span className="block truncate" title={o.sourceName}>
              {shortSource(o.sourceName)}
            </span>
          </span>
        </div>
      </div>
    </a>
  );
}
