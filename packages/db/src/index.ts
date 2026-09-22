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
   * Piec polaczen, nie jedno.
   *
   * Probowalem jednego, zeby oszczedzac pooler — i to byl blad. Gdy jedno
   * polaczenie sie zepsuje, cala instancja funkcji jest martwa i KAZDE kolejne
   * zadanie na niej wisi do limitu. Objawialo sie to idealnie naprzemiennym
   * wzorcem: co drugie wejscie szlo w sekunde, co drugie ubijalo sie na
   * limicie funkcji.
   *
   * Pooler Supabase w trybie transakcyjnym udzwignie to bez problemu:
   * zmierzone, dwunastu rownoczesnych klientow odpowiada w 1,2 s.
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
      (process.env.NEXT_PHASE === "phase-production-build" ? 8 : 5),
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
/*
 * PONAWIANIE ZAPYTAN PRZY ZERWANYM POLACZENIU.
 *
 * Zmierzone na produkcji: `Connection closed.` trafil do naszego licznika
 * bledow piec razy, za kazdym razem u prawdziwego uzytkownika — ostatnio
 * 22.09 o 12:29 na `/?make=BMW&sort=price_asc`, czyli przy zwyklym filtrowaniu.
 * Czlowiek widzial wtedy ekran bledu zamiast wynikow.
 *
 * SKAD TO SIE BIERZE. Pula oddaje polaczenie poolerowi po dwoch sekundach
 * bezczynnosci i zamyka je po minucie zycia (patrz `idle_timeout` i
 * `max_lifetime` wyzej). Te wartosci sa niskie celowo — chronia przed
 * wyczerpaniem limitu klientow Supabase. Cena jest taka, ze zapytanie
 * wyslane dokladnie w chwili zamykania polaczenia ginie razem z nim.
 * Pooler moze tez zamknac polaczenie po swojej stronie, kiedy zechce.
 *
 * DLACZEGO PONOWIENIE JEST TU BEZPIECZNE. Strony serwisu WYLACZNIE CZYTAJA
 * z bazy — zapisuje tylko worker (zaciag, wycena, alerty), ktory nie uzywa
 * tej sciezki. Powtorzenie SELECT-a nie ma zadnych skutkow ubocznych.
 *
 * Ponawiamy TYLKO bledy polaczenia, nigdy bledow SQL-a. Zle zapytanie ma
 * polec od razu i glosno, a nie trzy razy ciszej.
 */
/*
 * Zerwane polaczenie zglasza sie na DWA sposoby i trzeba lapac oba —
 * sprawdzone doswiadczalnie na lokalnej bazie przez zabijanie sesji:
 *
 *   CONNECTION_CLOSED   — postgres-js zauwazyl, ze gniazdo padlo
 *   57P01               — to sam PostgreSQL odeslal "terminating connection"
 *
 * Bez tego drugiego kodu ponawianie lapalo tylko czesc przypadkow: w tescie
 * na trzydziestu zapytaniach przy zrywanych polaczeniach piec nadal padalo.
 */
const BLEDY_POLACZENIA = new Set([
  // postgres-js
  "CONNECTION_CLOSED",
  "CONNECTION_DESTROYED",
  "CONNECTION_ENDED",
  "CONNECT_TIMEOUT",
  // PostgreSQL — klasa 57, "operator intervention"
  "57P01", // admin_shutdown — sesja ubita przez serwer albo pooler
  "57P02", // crash_shutdown
  "57P03", // cannot_connect_now — baza wstaje
  // cala klasa 08 (connection exception) lapana osobno — patrz nizej
  // gniazdo padlo na poziomie systemu
  "ECONNRESET",
  "EPIPE",
  "ETIMEDOUT",
]);

const PROBY = 3;

function toZerwanePolaczenie(e: unknown): boolean {
  const kod = (e as { code?: string })?.code;
  if (typeof kod !== "string") return false;
  if (BLEDY_POLACZENIA.has(kod)) return true;
  /*
   * CALA KLASA 08 — "connection exception" w PostgreSQL.
   *
   * Dosypane po tescie na produkcji: pooler Supabase odeslal 08006
   * (connection_failure), ktorego nie bylo na liscie. Zamiast dopisywac
   * kolejne kody po kazdej awarii, lapiemy klase — wszystkie 08xxx znacza
   * to samo: polaczenie padlo, a nie zapytanie bylo zle.
   */
  return kod.startsWith("08");
}

/**
 * Powtarza zapytanie, gdy polaczenie padlo w locie.
 *
 * Krotka przerwa miedzy probami (50 ms, potem 150 ms) wystarcza, zeby pula
 * podniosla nowe polaczenie. Dluzsze czekanie nie ma sensu: strony maja
 * wlasny limit czasu, a czlowiek patrzy w ekran ladowania.
 */
async function zPonawianiem<T>(fn: () => Promise<T>): Promise<T> {
  let ostatni: unknown;
  for (let proba = 0; proba < PROBY; proba++) {
    try {
      return await fn();
    } catch (e) {
      if (!toZerwanePolaczenie(e)) throw e;
      ostatni = e;
      if (proba < PROBY - 1) await new Promise((r) => setTimeout(r, 50 * (proba + 1) ** 2));
    }
  }
  throw ostatni;
}

const bazowy = drizzle(client, { schema });

/*
 * Opakowujemy `execute` i buildery zapytan. Drizzle zwraca obiekty, ktore sa
 * "thenable" — wykonuja sie dopiero przy `await`. Przechwytujemy wiec `then`,
 * bo to jedyny moment, w ktorym zapytanie naprawde leci do bazy.
 */
function opakuj<T extends object>(cel: T): T {
  return new Proxy(cel, {
    get(obiekt, klucz, odbiorca) {
      const wartosc = Reflect.get(obiekt, klucz, odbiorca);

      if (klucz === "then" && typeof wartosc === "function") {
        return (spelnij: (v: unknown) => unknown, odrzuc: (e: unknown) => unknown) =>
          zPonawianiem(() => Promise.resolve(Reflect.apply(wartosc, obiekt, [(v: unknown) => v]))).then(
            spelnij,
            odrzuc,
          );
      }

      if (typeof wartosc === "function") {
        return (...args: unknown[]) => {
          const wynik = Reflect.apply(wartosc, obiekt, args);
          // Builder zwraca kolejny builder — opakowujemy caly lancuch.
          return wynik !== null && typeof wynik === "object" ? opakuj(wynik as object) : wynik;
        };
      }
      return wartosc;
    },
  });
}

export const db = opakuj(bazowy);

export * from "./schema";
export { schema };
