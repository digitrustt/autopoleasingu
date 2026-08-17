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
   * Male pule sa tu celowe. Nie chodzi o wydajnosc pojedynczego zapytania,
   * tylko o to, ile polaczen serwis potrafi otworzyc naraz — a przy
   * renderowaniu na zadanie jest to trudne do przewidzenia.
   */
  max: Number(process.env.DB_POOL_MAX ?? 3),
  prepare: !transakcyjny,
  connect_timeout: 10,
  idle_timeout: 20,
});
export const db = drizzle(client, { schema });

export * from "./schema";
export { schema };
