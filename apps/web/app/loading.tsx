import { Radar } from "@/components/Radar";

/**
 * Granica Suspense dla calej strony. Zapytania z filtrami potrafia trwac
 * ulamek sekundy, a przy `force-dynamic` Next nie ma co pokazac — bez tego
 * pliku uzytkownik widzi zamrozona poprzednia liste i nie wie, czy klikniecie
 * w ogole zadzialalo.
 */
export default function Loading() {
  return <Radar />;
}
