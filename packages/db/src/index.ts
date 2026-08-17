import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "postgres://kuba@localhost:5432/auta";

/**
 * max:1 w workerze wystarcza (pipeline jest sekwencyjny), a na Neon free tier
 * oszczedza limit polaczen. Web ustawia wlasna pule przez createDb().
 *
 * LIMITY CZASU sa tu po to, zeby awaria bazy konczyla sie bledem, a nie
 * zawieszeniem. Gdy Neon odcial transfer za przekroczenie limitu, polaczenia
 * nie byly odrzucane — one wisialy. Funkcja na Vercelu czekala wtedy do
 * wlasnego limitu czasu, paliła CPU i nie zdazyla pokazac zadnego komunikatu,
 * bo obsluga bledu nigdy sie nie uruchamiala. Dziesiec sekund wystarcza
 * kazdemu zapytaniu w tym serwisie z ogromnym zapasem.
 */
/*
 * Pooler Supabase w trybie TRANSAKCYJNYM (port 6543) nie obsluguje instrukcji
 * przygotowanych — kazde zapytanie moze trafic na inne polaczenie backendu.
 * postgres-js uzywa ich domyslnie, wiec trzeba je wylaczyc.
 *
 * Tryb sesji (port 5432) je obsluguje, ale na darmowym planie dopuszcza tylko
 * PIETNASTU klientow naraz — a kazda funkcja na Vercelu otwiera wlasna pule.
 * Przy zaciagu chodzacym rownolegle z ruchem na stronie konczylo sie to bledem
 * "max clients reached" i wywalalo polowe zrodel.
 */
const transakcyjny = url.includes(":6543");

export const client = postgres(url, {
  /*
   * JEDNO polaczenie na instancje, nie trzy.
   *
   * Funkcja na Vercelu obsluguje jedno zadanie naraz, wiec wieksza pula nie
   * przyspiesza niczego — a mnozy sie przez liczbe rownoczesnych instancji
   * i wyczerpuje pooler. Zmierzone na produkcji przy puli 3: pierwsze dwa
   * wejscia wisialy po czterdziesci sekund i konczyly sie pusta strona,
   * kolejne szly w 1,5 s. Klasyczne wyczerpanie puli przy zimnym starcie.
   */
  /*
   * Wyjatek na czas budowania. Next prerenderuje wtedy wiele stron ROWNOCZESNIE
   * w jednym procesie, wiec pula jednego polaczenia ustawia je wszystkie
   * w kolejce — `/vin` przekraczal przez to limit 60 s na strone i wywracal
   * caly build. W czasie dzialania zostaje jedno polaczenie, bo tam kazda
   * instancja funkcji obsluguje jedno zadanie naraz.
   */
  max: Number(
    process.env.DB_POOL_MAX ??
      (process.env.NEXT_PHASE === "phase-production-build" ? 8 : 1),
  ),
  prepare: !transakcyjny,
  connect_timeout: 10,
  /*
   * Polaczenie oddajemy poolerowi po DWOCH sekundach bezczynnosci, nie po
   * dwudziestu.
   *
   * Na Vercelu instancje funkcji zyja dlugo po obsluzeniu zadania, a kazda
   * trzymala wlasne polaczenie. Przy kilkunastu instancjach naraz wyczerpywalo
   * to limit klientow poolera Supabase i kolejne zadania nie dostawaly juz
   * polaczenia — objawialo sie to tym, ze pierwsze wejscie szlo w sekunde,
   * a nastepne wisialy do limitu czasu.
   */
  idle_timeout: 2,
  max_lifetime: 60,
  /*
   * Zapytanie, ktore utknelo, ma polec, a nie wisiec do limitu funkcji.
   * Bez tego uzytkownik zostawal z animacja ladowania w nieskonczonosc,
   * bo obsluga bledu nigdy sie nie uruchamiala.
   */
  connection: { statement_timeout: 15_000 },
});
export const db = drizzle(client, { schema });

export * from "./schema";
export { schema };
