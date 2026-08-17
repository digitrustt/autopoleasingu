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
export const client = postgres(url, {
  max: 5,
  connect_timeout: 10,
  idle_timeout: 20,
});
export const db = drizzle(client, { schema });

export * from "./schema";
export { schema };
