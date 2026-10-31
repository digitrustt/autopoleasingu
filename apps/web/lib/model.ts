import { getMakesWithCounts, getModelCards, getModelsWithCounts } from "@/lib/queries";
import { modelKey, resolveAliases, resolveSlug } from "@/lib/slug";

/** Slug -> nazwy z bazy. Model rozwiazujemy dopiero w obrebie znalezionej marki. */
export async function rozwiazModel(makeSlug: string, modelSlug: string) {
  const makes = await getMakesWithCounts();
  const make = resolveSlug(makes.map((m) => m.make), makeSlug);
  if (!make) return null;

  const models = await getModelCards(make);
  /*
   * Szukamy po kluczu bez separatorow, nie po dokladnym slugu. Inaczej
   * `/volvo/xc-60` znajdowalby wariant "XC 60" i uznawal WLASNY adres za
   * kanoniczny — czyli dwie strony jednego auta zostawalyby na zawsze.
   * `getModelCards` zwraca warianty posortowane malejaco po liczbie ofert,
   * wiec pierwszy pasujacy jest tym dominujacym.
   */
  const klucz = modelKey(modelSlug);
  const model = models.find((m) => modelKey(m.model) === klucz)?.model;
  if (!model) return null;

  /*
   * Do FILTROWANIA bierzemy komplet pisowni, nie samą nazwę z kafelka.
   * `getModelCards` scala warianty, ale zwraca tylko nazwe dominujaca —
   * a w bazie oferty siedza pod wszystkimi ("XC60", "XC 60", "Xc-60").
   * Bez tego strona `/volvo/xc-60` pokazywala ulamek ofert.
   */
  const surowe = await getModelsWithCounts(make);
  const aliasy = resolveAliases(surowe.map((m) => m.model), modelSlug);

  /*
   * Adres kanoniczny to pisownia o NAJWIEKSZEJ liczbie ofert — `getModelCards`
   * zwraca warianty posortowane malejaco, wiec `model` juz nia jest.
   *
   * Wejscie pod innym slugiem tej samej grupy (`/volvo/xc-60` zamiast
   * `/volvo/xc60`) renderuje te sama, scalona strone i wskazuje kanoniczny
   * przez <link rel="canonical"> w generateMetadata. Przekierowania 308 tu
   * NIE MA swiadomie: `permanentRedirect` w tej wersji Next nie ustawia
   * statusu odpowiedzi — dokladnie tak samo jak `notFound()`, ktory zwraca
   * 200 zamiast 404. Sprawdzone: strona wychodzila z kodem 200 i pustym
   * naglowkiem Location. Canonical jest mechanizmem, ktorym Google i tak
   * scala duplikaty, wiec zostaje jako jedyny — zamiast martwego wywolania,
   * ktore wyglada, jakby dzialalo.
   */
  return { make, model, models, aliasy: aliasy.length > 0 ? aliasy : [model] };
}

