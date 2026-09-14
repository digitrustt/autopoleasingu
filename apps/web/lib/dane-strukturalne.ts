/**
 * Dane strukturalne pojazdu dla strony oferty.
 *
 * PO CO: Google pokazuje przy wyniku cene, rocznik i przebieg, jesli dostanie
 * je w schema.org — zamiast samego tytulu i opisu. Zmierzone w Search Console:
 * CTR 2,3% przy sredniej pozycji 26. To i tak nienormalnie duzo jak na trzecia
 * strone wynikow, wiec tytuly dzialaja; brakuje wylacznie tego, zeby wynik
 * wygladal jak oferta, a nie jak artykul.
 *
 * To jedyna dzwignia ruchu, ktora NIE wymaga ani lepszych pozycji, ani nowych
 * stron, ani linkow z zewnatrz — dziala przy dokladnie tym samym rankingu.
 *
 * DWIE RZECZY, KTORYCH TU NIE MA I NIE MOZE BYC:
 *
 * 1. Nie podajemy `seller` jako organizacji sprzedajacej w naszym imieniu.
 *    Nie sprzedajemy aut i nie posredniczymy — deklarowanie sie jako sprzedawca
 *    byloby nieprawda w danych, ktore Google czyta doslownie.
 * 2. Przy ofercie, ktora zniknela, `availability` mowi SoldOut. Oznaczanie
 *    martwej oferty jako dostepnej to wprowadzanie w blad i szybka droga do
 *    recznej kary.
 */

interface Oferta {
  id: number;
  make: string;
  model: string;
  year: number | null;
  vin: string | null;
  priceGross: number | null;
  mileageKm: number | null;
  fuel: string | null;
  gearbox: string | null;
  powerHp: number | null;
  engineCcm: number | null;
  body: string | null;
  color: string | null;
  drive: string | null;
  seats: number | null;
  city: string | null;
  status: string;
  offerKind: string | null;
  thumbnailUrl: string | null;
  firstRegistrationAt: Date | null;
}

/** Mapowanie na slownik schema.org — inne wartosci Google zignoruje. */
const PALIWO: Record<string, string> = {
  petrol: "Gasoline",
  diesel: "Diesel",
  hybrid: "Hybrid",
  phev: "Plug-in Hybrid",
  electric: "Electric",
  lpg: "LPG",
};
const SKRZYNIA: Record<string, string> = {
  automatic: "AutomaticTransmission",
  manual: "ManualTransmission",
};

/*
 * Naped MUSI byc adresem ze slownika schema.org, nie naszym skrotem.
 * Wysylalismy goly ciag "fwd", ktorego Google nie rozpoznaje i po cichu pomija
 * — pole bylo w kodzie, a w wynikach go nie bylo. W bazie sa trzy wartosci:
 * fwd (8920), awd (1351), rwd (456).
 */
const NAPED: Record<string, string> = {
  fwd: "https://schema.org/FrontWheelDriveConfiguration",
  rwd: "https://schema.org/RearWheelDriveConfiguration",
  awd: "https://schema.org/AllWheelDriveConfiguration",
};

export function daneStrukturalnePojazdu(o: Oferta, url: string) {
  const nazwa = [o.make, o.model, o.year].filter(Boolean).join(" ");
  const zywa = o.status === "active";

  const pojazd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Car",
    name: nazwa,
    url,
    brand: { "@type": "Brand", name: o.make },
    model: o.model,
    // Auto poleasingowe jest z definicji uzywane — nigdy nie deklarujemy inaczej.
    itemCondition: "https://schema.org/UsedCondition",
  };

  if (o.year) pojazd.vehicleModelDate = String(o.year);
  if (o.vin) pojazd.vehicleIdentificationNumber = o.vin;
  if (o.thumbnailUrl) pojazd.image = o.thumbnailUrl;
  if (o.color) pojazd.color = o.color;
  if (o.body) pojazd.bodyType = o.body;
  if (o.seats) pojazd.seatingCapacity = o.seats;
  if (o.drive && NAPED[o.drive]) pojazd.driveWheelConfiguration = NAPED[o.drive];
  if (o.firstRegistrationAt) {
    pojazd.dateVehicleFirstRegistered = o.firstRegistrationAt.toISOString().slice(0, 10);
  }

  if (o.mileageKm != null) {
    pojazd.mileageFromOdometer = { "@type": "QuantitativeValue", value: o.mileageKm, unitCode: "KMT" };
  }
  if (o.fuel && PALIWO[o.fuel]) pojazd.fuelType = PALIWO[o.fuel];
  if (o.gearbox && SKRZYNIA[o.gearbox]) pojazd.vehicleTransmission = SKRZYNIA[o.gearbox];

  if (o.powerHp || o.engineCcm) {
    const silnik: Record<string, unknown> = { "@type": "EngineSpecification" };
    if (o.powerHp) {
      // Google czyta KM jako "BHP"; jednostka musi byc jawna, inaczej pole wypada.
      silnik.enginePower = { "@type": "QuantitativeValue", value: o.powerHp, unitCode: "BHP" };
    }
    if (o.engineCcm) {
      silnik.engineDisplacement = {
        "@type": "QuantitativeValue",
        value: o.engineCcm,
        unitCode: "CMQ",
      };
    }
    pojazd.vehicleEngine = silnik;
  }

  /*
   * Cena tylko przy ofertach "kup teraz".
   *
   * Przy licytacji widoczna kwota to biezaca stawka, ktora jeszcze urosnie —
   * podanie jej jako `price` obiecywaloby w wynikach wyszukiwania cene, ktorej
   * nikt nie dostanie. Ta sama zasada obowiazuje w calym serwisie przy medianach.
   */
  if (o.priceGross != null && o.offerKind === "fixed") {
    pojazd.offers = {
      "@type": "Offer",
      price: o.priceGross,
      priceCurrency: "PLN",
      availability: zywa ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
      itemCondition: "https://schema.org/UsedCondition",
      url,
      ...(o.city ? { availableAtOrFrom: { "@type": "Place", name: o.city } } : {}),
    };
  }

  return pojazd;
}
