/**
 * Ekran ladowania: radar omiatajacy 26 zrodel.
 *
 * Metafora jest dokladna, nie ozdobna — scraper naprawde przeczesuje w kolko te
 * same platformy i wylapuje z nich nowe sztuki.
 *
 * Rysunek jest inline'owym SVG w konwencji Lucide: siatka 24x24, sama kreska,
 * `currentColor`, zaokraglone konce. Radar wyglada wiec jak kolejna ikona z tego
 * samego zestawu i skaluje sie bez rozmycia.
 *
 * Trzy warstwy ruchu, bo jedna nie wystarczyla — sama smuga czytala sie jak
 * nieruchoma celownica: obracajaca sie wiazka, fala rozchodzaca sie od srodka
 * i punkty zapalajace sie pod wiazka.
 *
 * Cala animacja siedzi w CSS. Ekran ladowania, ktory sam musi sie najpierw
 * zaladowac, mijalby sie z celem.
 */
function Dish() {
  return (
    <div className="relative h-24 w-24 text-accent">
      {/* Siatka tarczy — celowo przygaszona, zeby ruch byl najjasniejszym elementem. */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
        strokeLinecap="round"
        className="h-full w-full opacity-15"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10.5" />
        <circle cx="12" cy="12" r="7" />
        <circle cx="12" cy="12" r="3.5" />
        <path d="M12 1.5v21M1.5 12h21" />
      </svg>

      {/* Fale rozchodzace sie od srodka, przesuniete w fazie. */}
      <span className="radar-pulse absolute inset-0 rounded-full" />
      <span
        className="radar-pulse absolute inset-0 rounded-full"
        style={{ animationDelay: "0.9s" }}
      />

      {/* Obracajaca sie wiazka z jasna krawedzia natarcia. */}
      <div className="radar-sweep absolute inset-0 rounded-full" />

      {/* Wykryte sztuki — zapalaja sie, gdy przechodzi po nich wiazka. */}
      {[
        { x: 70, y: 31, d: "0.1s" },
        { x: 32, y: 43, d: "0.75s" },
        { x: 66, y: 66, d: "1.15s" },
        { x: 45, y: 74, d: "1.45s" },
      ].map((b) => (
        <span
          key={`${b.x}-${b.y}`}
          className="radar-blip absolute h-1 w-1 rounded-full bg-accent"
          style={{ left: `${b.x}%`, top: `${b.y}%`, animationDelay: b.d }}
        />
      ))}
    </div>
  );
}

/** Zarys kafelka oferty — te same proporcje co OfferCard, zeby nic nie skakalo. */
function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-line)]">
      <div className="skeleton aspect-[4/3] w-full" />
      <div className="flex flex-col gap-2 p-3">
        <div className="skeleton h-4 w-3/5 rounded" />
        <div className="skeleton h-3 w-2/5 rounded" />
        <div className="skeleton h-3 w-4/5 rounded" />
        <div className="skeleton mt-2 h-5 w-1/2 rounded" />
      </div>
    </div>
  );
}

export function Radar({ label = "Skanuję 26 źródeł…" }: { label?: string }) {
  return (
    <div>
      <div className="flex flex-col items-center gap-3 py-10">
        <Dish />
        <p className="text-sm tracking-wide text-neutral-500">{label}</p>
      </div>

      {/*
        Szkielety zamiast pustego ekranu. Bez nich radar wisial samotnie nad
        kilkuset pikselami niczego, a strona wygladala na zepsuta zamiast na
        zajeta. Osiem sztuk wystarcza — wypelniaja pierwszy rzad na kazdej
        szerokosci, a nie udaja, ze znamy juz liczbe wynikow.
      */}
      <div
        aria-hidden="true"
        className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4 opacity-40"
      >
        {Array.from({ length: 8 }, (_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
