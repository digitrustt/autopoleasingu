import { Crumbs } from "@/components/Crumbs";
import { OfferCard } from "@/components/OfferCard";
import { PriceHistory } from "@/components/PriceHistory";
import { UbezpieczenieBlok } from "@/components/UbezpieczenieBlok";
import { HistoriaBlok } from "@/components/HistoriaBlok";
import { Valuation } from "@/components/Valuation";
import { VehicleHistory } from "@/components/VehicleHistory";
import { shortSource } from "@/lib/format";
import { VinDekoder } from "@/components/VinDekoder";
import { daneStrukturalnePojazdu } from "@/lib/dane-strukturalne";
import { VinSzukaj } from "@/components/VinSzukaj";
import { paryMarkaMiastoZeStrona } from "@/lib/cache-filtrow";
import { makaMiastoHref } from "@/lib/marka-miasto";
import { slugMiasta } from "@/lib/miasta";
import { paryModelu } from "@/lib/pary";
import { getListings, getVinHistory, getWmiMake } from "@/lib/queries";
import { makeHref, modelHref } from "@/lib/slug";
import { poprawnyVin } from "@/lib/vin";
import type { Metadata } from "next";
import {
  ArrowLeft,
  ArrowUpRight,
  Banknote,
  Calendar,
  CircleSlash,
  Fuel,
  Gauge,
  Gavel,
  ImageOff,
  MapPin,
  Settings2,
  Zap,
} from "lucide-react";
import Link from "@/components/Link";
import { PoradnikiVin } from "@/components/PoradnikiVin";
import { notFound } from "next/navigation";

/*
 * Dynamiczna, ale BUFOROWANA przez godzine.
 *
 * VIN-ow jest w bazie 32 tys., wiec `generateStaticParams` odpada — nie
 * zbudujemy tylu stron. Ale `force-dynamic` znaczylo pelne przeliczenie przy
 * kazdym wejsciu, a to wlasnie te strony robot mieli najchetniej: jeden adres
 * na kazdy numer nadwozia. Wspolnie ze strona glowna doprowadzilo to
 * 21.09.2026 do odciecia serwisu przez Vercela (HTTP 402, 10 h 14 min CPU).
 *
 * `revalidate` zostawia adresy dynamiczne — kazdy numer dziala od reki — ale
 * drugie wejscie na ten sam VIN w ciagu godziny nie kosztuje juz nic.
 */
export const revalidate = 3600;

const pln = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("pl-PL");
const day = new Intl.DateTimeFormat("pl-PL", { day: "2-digit", month: "short", year: "numeric" });

const FUEL_PL: Record<string, string> = {
  petrol: "Benzyna", diesel: "Diesel", hybrid: "Hybryda", phev: "PHEV",
  electric: "Elektryk", lpg: "LPG", cng: "CNG", other: "Inne",
};
const GEARBOX_PL: Record<string, string> = { manual: "Manual", automatic: "Automat", other: "—" };
const DRIVE_PL: Record<string, string> = {
  fwd: "Przód", rwd: "Tył", awd: "4×4", other: "—",
};

/** Ile dni oferta jest w obrocie — im dluzej stoi, tym wieksza dzwignia negocjacyjna. */
function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000));
}

/** Polska odmiana: 1 dzien, 2-4 dni, 5+ dni, ale 12-14 dni i 22 dni. */
function daysPl(n: number): string {
  if (n === 1) return "1 dzień";
  const last = n % 10;
  const lastTwo = n % 100;
  const few = last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14);
  return `${n} ${few ? "dni" : "dni"}`;
}

/** 1 wystawienie, 2-4 wystawienia, 5+ wystawień (ale 12-14 wystawień). */
function wystawienia(n: number): string {
  if (n === 1) return "1 wystawienie";
  const last = n % 10;
  const lastTwo = n % 100;
  const few = last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14);
  return `${n} ${few ? "wystawienia" : "wystawień"}`;
}

/** Wynik dla VIN-u, ktorego nie mamy — z tym, co mimo wszystko da sie powiedziec. */
async function BrakVin({ numer }: { numer: string }) {
  const marka = await getWmiMake(numer);

  return (
    <main className="mx-auto max-w-[760px] px-4 py-6">
      <Link
        href="/vin"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-neutral-400 transition-colors hover:text-accent"
      >
        <ArrowLeft size={15} />
        Sprawdź inny VIN
      </Link>

      <h1 className="font-mono text-xl font-bold tracking-tight text-neutral-100">{numer}</h1>
      <p className="mb-5 mt-2 text-sm leading-relaxed text-neutral-400">
        Tego auta nie ma w naszej bazie — nie jest w tej chwili wystawione w żadnym
        z 26 śledzonych źródeł poleasingowych.
        {marka && (
          <>
            {" "}
            Z numeru wynika, że to <span className="text-neutral-200">{marka}</span>; producenta
            rozpoznajemy po trzech pierwszych znakach, zestawiając je z blisko dwudziestoma
            tysiącami numerów, które już mamy.
          </>
        )}
      </p>

      {/*
        Raport historii z TYM numerem (20.10.2026). Czlowiek wlasnie wpisal VIN,
        ktorego nie mamy — najczesciej z ogloszenia, ktore oglada gdzie indziej.
        To najbardziej konkretna potrzeba, jaka ta strona widzi.
      */}
      {poprawnyVin(numer) && <VinDekoder vin={numer} />}

      <div className="mb-4">
        <HistoriaBlok vin={numer} gdzie="vin-brak" wariant="duzy" />
      </div>

      <div className="mb-6 rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
        <p className="text-[13px] leading-relaxed text-neutral-400">
          Historii wypadkowej, przebiegu z odczytów i liczby właścicieli sami nie mamy.
          Podstawowe dane z polskiego CEPiK-u są bezpłatnie w{" "}
          <a
            href="https://historiapojazdu.gov.pl"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-dotted underline-offset-2 hover:text-accent"
          >
            historiapojazdu.gov.pl
          </a>{" "}
          — potrzebny jest VIN, numer rejestracyjny i data pierwszej rejestracji. Szkody,
          przebiegi i kradzieże po samym VIN-ie pokazuje płatny raport carVertical powyżej.
        </p>
      </div>

      <VinSzukaj />
    </main>
  );
}

/**
 * VIN, ktorego nie mamy, NIE MOZE byc indeksowany.
 *
 * Sama strona zostaje i ma sens dla czlowieka: rozpoznaje marke z trzech
 * pierwszych znakow numeru i kieruje do CEPiK-u po historie, ktorej my nie
 * mamy. Ale dla wyszukiwarki jest to tresc niemal identyczna dla kazdego
 * z nieskonczenie wielu mozliwych numerow — czyli dokladnie to, za co Google
 * obniza ocene calej domeny.
 *
 * Status zostaje 200, bo `notFound()` byloby klamstwem: adres jest poprawny,
 * a odpowiedz prawdziwa. Od odciecia tego od indeksu jest `noindex`, tak samo
 * jak przy ofertach, ktore zniknely (patrz app/oferta/[id]/page.tsx).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ vin: string }>;
}): Promise<Metadata> {
  const { vin } = await params;
  const numer = decodeURIComponent(vin).toUpperCase();
  const data = await getVinHistory(numer);

  if (!data) {
    return {
      title: `VIN ${numer} — brak w bazie`,
      robots: { index: false, follow: true },
    };
  }

  const spec = data.listings.find((l) => l.powerHp && l.engineCcm) ?? data.listings[0];
  const nazwa = [spec?.make, spec?.model].filter(Boolean).join(" ");
  /*
   * Rocznik w tytule i cena w opisie (29.10.2026). Search Console: 4 486 stron VIN
   * "zeskanowanych, ale niezindeksowanych" — z zewnatrz kazda wygladala jak ta
   * sama strona z innym numerem. Rocznik i cena to dwie rzeczy, ktore ja odroznia.
   */
  const rok = spec?.year ? ` ${spec.year}` : "";
  const ceny = data.listings.map((l) => l.priceGross).filter((c): c is number => c != null);
  const odCeny = ceny.length > 0 ? Math.min(...ceny) : null;
  return {
    title: nazwa ? `${nazwa}${rok} — VIN ${numer}` : `VIN ${numer}`,
    description:
      `Historia ofert i cen dla VIN ${numer}` +
      (nazwa ? ` (${nazwa}${rok})` : "") +
      `: ${wystawienia(data.listings.length)} w śledzonych źródłach poleasingowych` +
      (odCeny != null ? `, ceny od ${pln.format(odCeny)}` : "") +
      ".",
    alternates: { canonical: `/vin/${numer}` },
  };
}

export default async function VinPage({ params }: { params: Promise<{ vin: string }> }) {
  const { vin } = await params;
  const numer = decodeURIComponent(vin).toUpperCase();
  const data = await getVinHistory(numer);

  /*
   * Brak tego VIN-u w bazie NIE JEST bledem 404. Ludzie wklejaja tu numery
   * z dokumentow aut, ktorych u nas nigdy nie bylo — i to jest normalny wynik,
   * a nie pomylka. Zamiast pustej strony mowimy, czego sie dowiedzielismy
   * (producent z WMI, o ile jest jednoznaczny) i gdzie szukac reszty.
   */
  if (!data) return <BrakVin numer={numer} />;

  // Dane pojazdu sa te same we wszystkich ofertach — bierzemy najbogatszy rekord.
  const spec =
    data.listings.find((l) => l.powerHp && l.engineCcm) ?? data.listings[0];

  /*
   * Numer rejestracyjny i data pierwszej rejestracji przychodza z ROZNYCH zrodel
   * — jedno moze podac numer, inne date. Bierzemy pierwsze niepuste z kazdego
   * osobno, bo dopiero komplet otwiera droge do CEPiK.
   */
  const registration = data.listings.find((l) => l.registration)?.registration ?? null;
  const firstRegistrationAt =
    data.listings.find((l) => l.firstRegistrationAt)?.firstRegistrationAt ?? null;

  const mileages = data.listings
    .filter((l) => l.mileageKm != null)
    .map((l) => l.mileageKm as number);
  const mileageSpread =
    mileages.length > 1
      ? {
          min: Math.min(...mileages),
          max: Math.max(...mileages),
          sources: new Set(data.listings.map((l) => l.sourceId)).size,
        }
      : null;

  /*
   * Tekst opisowy, podobne auta i linki w gore hierarchii (29.10.2026).
   *
   * Strona VIN miala 240–340 slow tresci wlasnej, w wiekszosci szablonowej, i nie
   * linkowala do modelu, marki ani miasta, wiec byla slepa uliczka. Google odrzucal
   * ja jako niemal identyczna z kazda inna. Teraz kazda ma akapit z konkretnymi
   * liczbami tej sztuki, liste podobnych aut i sciezke Marka > Model > VIN.
   */
  const nazwaAuta = [spec.make, spec.model].filter(Boolean).join(" ");
  const [podobne, paryMiast] = await Promise.all([
    getListings(
      {
        make: spec.make,
        model: spec.model,
        ...(spec.year ? { yearMin: spec.year - 1, yearMax: spec.year + 1 } : {}),
        kind: "fixed",
        withPrice: "1",
        sort: "deal_desc",
      },
      1,
      7,
    ),
    paryMarkaMiastoZeStrona(),
  ]);
  const idTych = new Set(data.listings.map((l) => l.id));
  const podobneAuta = podobne.filter((o) => !idTych.has(o.id)).slice(0, 6);

  const wycenione = data.listings
    .filter((l) => l.dealScore != null && l.marketPrice != null && l.priceGross != null)
    .sort((a, b) => (b.dealScore ?? 0) - (a.dealScore ?? 0))[0];
  const cenyVin = data.listings.map((l) => l.priceGross).filter((c): c is number => c != null);
  const pierwszyRaz = data.listings
    .map((l) => l.firstSeenAt)
    .filter((d): d is Date => d != null)
    .sort((a, b) => a.getTime() - b.getTime())[0];
  const miejsca = data.listings.map(
    (l) => `${shortSource(l.sourceName)}${l.city ? ` (${l.city})` : ""}`,
  );
  const opis = [
    `${nazwaAuta}${spec.year ? ` z ${spec.year} roku` : ""}${spec.trim ? `, wersja ${spec.trim}` : ""}, numer VIN ${data.vin}.`,
    [
      spec.mileageKm != null ? `przebieg ${num.format(spec.mileageKm)} km` : null,
      spec.fuel ? `napęd ${(FUEL_PL[spec.fuel] ?? spec.fuel).toLowerCase()}` : null,
      spec.gearbox ? `skrzynia ${(GEARBOX_PL[spec.gearbox] ?? spec.gearbox).toLowerCase()}` : null,
      spec.powerHp ? `moc ${spec.powerHp} KM` : null,
    ]
      .filter(Boolean)
      .join(", ")
      .replace(/^./, (c) => c.toUpperCase()) + ".",
    `W naszej bazie to auto ma ${wystawienia(data.listings.length)}: ${miejsca.join(", ")}.`,
    cenyVin.length > 0
      ? cenyVin.length > 1 && Math.min(...cenyVin) !== Math.max(...cenyVin)
        ? `Ceny wahają się od ${pln.format(Math.min(...cenyVin))} do ${pln.format(Math.max(...cenyVin))}.`
        : `Cena wynosi ${pln.format(cenyVin[0])}.`
      : null,
    wycenione?.dealScore != null && wycenione.marketPrice != null
      ? `Najlepsza oferta jest ${Math.round(Math.abs(wycenione.dealScore) * 100)}% ` +
        `${wycenione.dealScore >= 0 ? "poniżej" : "powyżej"} mediany rynkowej ` +
        `(${pln.format(wycenione.marketPrice)}) dla porównywalnych aut.`
      : null,
    pierwszyRaz ? `Pierwszy raz zobaczyliśmy je ${day.format(pierwszyRaz)}.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const miastoSlug = spec.city ? slugMiasta(spec.city) : null;
  const linkMiasta =
    spec.make && spec.city && miastoSlug && paryMiast.includes(`${spec.make}|${miastoSlug}`)
      ? makaMiastoHref(spec.make, spec.city)
      : null;
  const porownania = spec.make && spec.model ? paryModelu(spec.make, spec.model, 3) : [];

  return (
    <main className="mx-auto max-w-[1000px] px-4 py-6">
      <Crumbs
        items={[
          ...(spec.make ? [{ label: spec.make, href: makeHref(spec.make) }] : []),
          ...(spec.make && spec.model
            ? [{ label: spec.model, href: modelHref(spec.make, spec.model) }]
            : []),
          { label: `VIN ${data.vin}` },
        ]}
      />

      {/*
        Dane strukturalne pojazdu z numerem VIN. BEZ ceny: strona VIN-u zbiera
        kilka wystawien tej samej sztuki, a cena nalezy do konkretnej oferty
        (tam jest w JSON-LD strony oferty).
      */}
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: dane strukturalne, tresc wlasna
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            daneStrukturalnePojazdu(
              { ...spec, vin: data.vin, priceGross: null },
              `https://autopoleasingu.pl/vin/${data.vin}`,
            ),
          ),
        }}
      />

      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">
          {spec.make} {spec.model}
          {spec.year && <span className="text-neutral-500"> · {spec.year}</span>}
        </h1>
        {spec.trim && <p className="text-sm text-neutral-400">{spec.trim}</p>}
        <p className="mt-1 font-mono text-xs tracking-wider text-neutral-600">{data.vin}</p>
        <p className="mt-3 max-w-[75ch] text-[13px] leading-relaxed text-neutral-400">{opis}</p>
      </header>

      <div className="mb-6 flex flex-wrap gap-x-5 gap-y-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4 text-sm">
        {spec.mileageKm != null && (
          <Fact icon={<Gauge size={14} />}>{num.format(spec.mileageKm)} km</Fact>
        )}
        {spec.fuel && <Fact icon={<Fuel size={14} />}>{FUEL_PL[spec.fuel] ?? spec.fuel}</Fact>}
        {spec.gearbox && (
          <Fact icon={<Settings2 size={14} />}>{GEARBOX_PL[spec.gearbox] ?? spec.gearbox}</Fact>
        )}
        {spec.powerHp && <Fact icon={<Zap size={14} />}>{spec.powerHp} KM</Fact>}
        {spec.engineCcm && <Fact icon={null}>{num.format(spec.engineCcm)} cm³</Fact>}
        {spec.drive && <Fact icon={null}>{DRIVE_PL[spec.drive] ?? spec.drive}</Fact>}
        {spec.body && <Fact icon={null}>{spec.body}</Fact>}
        {spec.color && <Fact icon={null}>{spec.color}</Fact>}
        {spec.seats && <Fact icon={null}>{spec.seats} miejsc</Fact>}
      </div>

      {/*
        Rozpietosc miedzy kanalami to sedno calego projektu: ta sama sztuka,
        ten sam VIN, dwie rozne ceny. Podpisujemy ja tylko wtedy, gdy obie
        strony to ceny "kup teraz" — patrz getVinHistory.
      */}
      {data.spread != null && data.spread > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <Banknote size={18} className="mt-0.5 shrink-0 text-emerald-400" />
          <div>
            <p className="font-semibold text-emerald-300">
              Różnica {pln.format(data.spread)} za tę samą sztukę
            </p>
            <p className="text-sm text-neutral-400">
              To auto stoi w {data.listings.length} miejscach naraz. Najtańsza i najdroższa oferta
              „kup teraz" różnią się o tę kwotę.
            </p>
          </div>
        </div>
      )}

      {/*
        Wycena dotyczy KONKRETNEJ oferty, nie pojazdu — ta sama sztuka moze byc
        okazja u jednego sprzedawcy i przecena u drugiego. Bierzemy najlepiej
        ocenioną, bo to ona jest odpowiedzia na pytanie "czy warto".
      */}
      {(() => {
        const best = data.listings
          .filter((l) => l.dealScore != null && l.marketPrice != null && l.priceGross != null)
          .sort((a, b) => (b.dealScore ?? 0) - (a.dealScore ?? 0))[0];
        return best ? (
          <Valuation
            price={best.priceGross as number}
            marketPrice={best.marketPrice as number}
            dealScore={best.dealScore as number}
            samples={best.dealSamples}
            fromSold={best.dealFromSold}
          />
        ) : null;
      })()}

      <VehicleHistory
        vin={data.vin}
        registration={registration}
        firstRegistrationAt={firstRegistrationAt}
        mileageSpread={mileageSpread}
      />

      <VinDekoder vin={data.vin} />

      {/*
        OC zaraz pod historia pojazdu, bo to ten sam krok mysli: czlowiek
        sprawdza KONKRETNY egzemplarz przed zakupem, a polisa jest nastepna
        rzecza, ktora bedzie mu potrzebna. Bloku kredytowego tu nie ma —
        strona VIN-u nie dotyczy jednej ceny, tylko wszystkich wystawien tej
        samej sztuki.
      */}
      <div className="mb-6">
        <HistoriaBlok
          vin={vin}
          gdzie="vin"
          wariant="duzy"
          nazwa={spec.make ? `${spec.make} ${spec.model ?? ""}`.trim() : null}
        />
        <UbezpieczenieBlok
          gdzie="vin"
          nazwa={spec.make ? `${spec.make} ${spec.model ?? ""}`.trim() : null}
        />
      </div>

      <h2 className="mb-3 text-sm font-semibold text-neutral-300">
        Gdzie to auto jest wystawione ({data.listings.length})
      </h2>

      <div className="flex flex-col gap-3">
        {data.listings.map((l) => {
          const isGone = l.status === "gone";
          const isCheapest = l.id === data.cheapestId && data.listings.length > 1;
          const standing = daysBetween(l.firstSeenAt, l.goneAt ?? new Date());

          return (
            <div
              key={l.id}
              className={`rounded-xl border p-4 transition-colors ${
                isGone
                  ? "border-[var(--color-line)] bg-black/20 opacity-60"
                  : isCheapest
                    ? "border-emerald-500/40 bg-[var(--color-panel)]"
                    : "border-[var(--color-line)] bg-[var(--color-panel)]"
              }`}
            >
              <div className="flex gap-4">
                {/*
                  Miniatura per oferta, nie jedna na pojazd: kazdy sprzedawca
                  fotografuje to samo auto inaczej, a roznica w zdjeciach bywa
                  pierwsza wskazowka, ze jedna z ofert jest nieaktualna.
                  Hot-link do zrodla — nic nie hostujemy (patrz README).
                */}
                {l.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={l.thumbnailUrl}
                    alt={`${l.make} ${l.model} — ${shortSource(l.sourceName)}`}
                    loading="lazy"
                    className={`hidden h-24 w-32 shrink-0 rounded-lg object-cover sm:block ${
                      isGone ? "grayscale" : ""
                    }`}
                  />
                ) : (
                  <div className="hidden h-24 w-32 shrink-0 items-center justify-center rounded-lg bg-black/40 text-neutral-700 sm:flex">
                    <ImageOff size={18} />
                  </div>
                )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{shortSource(l.sourceName)}</span>
                    {l.offerKind === "auction" && (
                      <span className="flex items-center gap-0.5 rounded-md bg-violet-500 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                        <Gavel size={11} />
                        AUKCJA
                      </span>
                    )}
                    {isCheapest && !isGone && (
                      <span className="rounded-md bg-emerald-500 px-1.5 py-0.5 text-[11px] font-semibold text-black">
                        NAJTANIEJ
                      </span>
                    )}
                    {isGone && (
                      <span className="flex items-center gap-0.5 rounded-md border border-[var(--color-line)] px-1.5 py-0.5 text-[11px] text-neutral-400">
                        <CircleSlash size={11} />
                        ZNIKNĘŁA
                      </span>
                    )}
                  </div>

                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
                    {l.seller && <span>{l.seller}</span>}
                    {l.city && (
                      <span className="flex items-center gap-0.5">
                        <MapPin size={11} />
                        {l.city}
                      </span>
                    )}
                    <span className="flex items-center gap-0.5">
                      <Calendar size={11} />
                      {isGone
                        ? `widoczna ${daysPl(standing)}, zniknęła ${l.goneAt ? day.format(l.goneAt) : ""}`
                        : standing === 0
                          ? "znaleziona dziś"
                          : `w sprzedaży ${daysPl(standing)}`}
                    </span>
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-lg font-bold tabular-nums">
                    {l.priceGross != null ? (
                      pln.format(l.priceGross)
                    ) : (
                      <span className="text-sm text-neutral-500">cena na zapytanie</span>
                    )}
                  </p>
                  {l.priceNet != null && (
                    <p className="text-[11px] text-neutral-500 tabular-nums">
                      netto {pln.format(l.priceNet)}
                    </p>
                  )}
                  {l.offerKind === "auction" && (
                    <p className="text-[11px] text-violet-300">aktualna oferta</p>
                  )}
                </div>
                </div>

                {/* Historia ceny tej konkretnej oferty — przeceny widac tu jako spadki. */}
                <PriceHistory points={l.history} />

                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-sm text-neutral-400 transition-colors hover:text-accent"
                >
                  Otwórz ofertę
                  <ArrowUpRight size={14} />
                </a>
              </div>
              </div>
            </div>
          );
        })}
      </div>

      {podobneAuta.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-semibold text-neutral-100">
            Podobne {nazwaAuta}
            {spec.year ? ` z lat ${spec.year - 1}–${spec.year + 1}` : ""}
          </h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
            {podobneAuta.map((o, i) => (
              <OfferCard key={o.id} o={o} index={i} />
            ))}
          </div>
        </section>
      )}

      {spec.make && spec.model && (
        <nav className="mt-8" aria-label="Zobacz też">
          <h2 className="mb-3 text-base font-semibold text-neutral-100">Zobacz też</h2>
          <ul className="flex flex-wrap gap-2 text-[13px]">
            <li>
              <Link
                href={modelHref(spec.make, spec.model)}
                className="inline-block rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-1.5 text-neutral-300 transition-colors hover:border-neutral-600 hover:text-neutral-100"
              >
                {nazwaAuta} poleasingowe: ceny i oferty
              </Link>
            </li>
            {linkMiasta && spec.city && (
              <li>
                <Link
                  href={linkMiasta}
                  className="inline-block rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-1.5 text-neutral-300 transition-colors hover:border-neutral-600 hover:text-neutral-100"
                >
                  {spec.make} poleasingowe {spec.city}
                </Link>
              </li>
            )}
            {porownania.map(({ para, drugi }) => (
              <li key={para.slug}>
                <Link
                  href={`/porownaj/${para.slug}`}
                  className="inline-block rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-1.5 text-neutral-300 transition-colors hover:border-neutral-600 hover:text-neutral-100"
                >
                  {nazwaAuta} czy {drugi}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <PoradnikiVin className="mt-10 border-t border-[var(--color-line)] pt-6" />
    </main>
  );
}

function Fact({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 text-neutral-300">
      {icon && <span className="text-neutral-600">{icon}</span>}
      {children}
    </span>
  );
}
