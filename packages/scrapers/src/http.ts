/**
 * Klient HTTP dla scraperow. Bez platnych proxy, wiec etykieta jest jedyna
 * ochrona przed banem: identyfikujemy sie, trzymamy limit i cofamy sie przy 429.
 */

const CONTACT = process.env.SCRAPER_CONTACT ?? "kontakt-nieustawiony";

const UA =
  `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) ` +
  `Chrome/131.0.0.0 Safari/537.36 (+auta-sniper; ${CONTACT})`;

export interface FetchOptions {
  /** Minimalny odstep miedzy zadaniami do tego samego hosta (ms). */
  delayMs?: number;
  retries?: number;
  timeoutMs?: number;
}

const lastHit = new Map<string, number>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Ciasteczka per host — WYLACZNIE dla zrodel, ktore o to poprosza (`cookies: true`).
 * Node fetch ich nie przechowuje, a ASP.NET WebForms bez sesji odrzuca postback
 * paginacji bledem 500 (patrz mhc.ts). Trzymamy tylko to, co serwis sam odesle —
 * zadnego logowania ani podszywania sie.
 *
 * DLACZEGO OPT-IN, A NIE DOMYSLNIE: sesja zmienia to, co serwis renderuje.
 * Wlaczone globalnie wywrocilo `pkoaukcje` — z sesja serwis wstawia w okruszki
 * "Wszystkie aukcje publiczne" i "[ powrot do listy aukcji ]", przez co znika
 * z nich marka i model, a parser cicho oddawal null dla WSZYSTKICH 62 ofert.
 * Przebieg raportowal wtedy "0 bledow", bo odsiew to normalna sciezka — czyli
 * dokladnie ten rodzaj cichej utraty danych, ktory opisuje README.
 */
const cookieJar = new Map<string, Map<string, string>>();

function cookieHeader(host: string): Record<string, string> {
  const jar = cookieJar.get(host);
  if (!jar?.size) return {};
  return { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") };
}

function storeCookies(host: string, res: Response): void {
  const raw = res.headers.getSetCookie?.() ?? [];
  if (raw.length === 0) return;
  const jar = cookieJar.get(host) ?? new Map<string, string>();
  for (const line of raw) {
    const [pair] = line.split(";");
    const at = pair.indexOf("=");
    if (at > 0) jar.set(pair.slice(0, at).trim(), pair.slice(at + 1).trim());
  }
  cookieJar.set(host, jar);
}

/** Losowy jitter +-30%, zeby ruch nie wygladal na regularny co do milisekundy. */
function jitter(ms: number): number {
  return Math.round(ms * (0.7 + Math.random() * 0.6));
}

async function throttle(host: string, delayMs: number): Promise<void> {
  const prev = lastHit.get(host) ?? 0;
  const wait = prev + jitter(delayMs) - Date.now();
  if (wait > 0) await sleep(wait);
  lastHit.set(host, Date.now());
}

export async function fetchText(
  url: string,
  opts: FetchOptions & {
    /**
     * Pola formularza do wyslania POST-em (application/x-www-form-urlencoded).
     * Potrzebne przy ASP.NET WebForms, gdzie paginacja to __doPostBack z
     * __VIEWSTATE — zwyklym GET-em nie da sie zejsc na druga strone.
     */
    form?: Record<string, string>;
    headers?: Record<string, string>;
    /** Przenosic ciasteczka miedzy zadaniami do tego hosta. Patrz uwaga przy cookieJar. */
    cookies?: boolean;
  } = {},
): Promise<string> {
  const {
    delayMs = 1500,
    retries = 3,
    timeoutMs = 30_000,
    form,
    headers = {},
    cookies = false,
  } = opts;
  const host = new URL(url).host;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle(host, delayMs);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        method: form ? "POST" : "GET",
        body: form ? new URLSearchParams(form).toString() : undefined,
        headers: {
          "User-Agent": UA,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "pl-PL,pl;q=0.9,en;q=0.8",
          ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
          ...(cookies ? cookieHeader(host) : {}),
          ...headers,
        },
      });

      if (cookies) storeCookies(host, res);

      // 429/503 to prosba o zwolnienie, nie blad — cofamy sie wykladniczo.
      if (res.status === 429 || res.status === 503) {
        const retryAfter = Number(res.headers.get("retry-after"));
        const backoff = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : 2 ** attempt * 5000;
        lastErr = new Error(`${res.status} od ${host}, czekam ${backoff}ms`);
        await sleep(backoff);
        continue;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status} dla ${url}`);
      return await res.text();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await sleep(2 ** attempt * 1000);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`Nie udalo sie pobrac ${url}: ${String(lastErr)}`);
}

/** GET/POST zwracajace JSON. Dla zrodel z prawdziwym API zamiast HTML-a. */
export async function fetchJson<T>(
  url: string,
  opts: FetchOptions & {
    method?: "GET" | "POST";
    body?: unknown;
    /** Dodatkowe naglowki — niektore API wymagaja np. Origin z domeny serwisu. */
    headers?: Record<string, string>;
  } = {},
): Promise<T> {
  const {
    delayMs = 1200,
    retries = 3,
    timeoutMs = 30_000,
    method = "GET",
    body,
    headers = {},
  } = opts;
  const host = new URL(url).host;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle(host, delayMs);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        signal: ctrl.signal,
        headers: {
          "User-Agent": UA,
          Accept: "application/json",
          "Accept-Language": "pl-PL,pl;q=0.9",
          ...(body != null ? { "Content-Type": "application/json" } : {}),
          ...headers,
        },
        body: body != null ? JSON.stringify(body) : undefined,
      });

      if (res.status === 429 || res.status === 503) {
        const retryAfter = Number(res.headers.get("retry-after"));
        const backoff = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : 2 ** attempt * 5000;
        lastErr = new Error(`${res.status} od ${host}, czekam ${backoff}ms`);
        await sleep(backoff);
        continue;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status} dla ${url}`);
      return (await res.json()) as T;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await sleep(2 ** attempt * 1000);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`Nie udalo sie pobrac ${url}: ${String(lastErr)}`);
}

/** Wyciaga <loc> z sitemapy. Celowo regexem — sitemapy potrafia miec 500 kB+. */
export function extractSitemapLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
}

/**
 * Wyciaga props.pageProps z <script id="__NEXT_DATA__"> (Next.js Pages Router).
 * Kolejnosc atrybutow bywa rozna (dochodzi np. nonce), wiec nie zakladamy jej.
 */
export function extractNextPageProps<T>(html: string): T | null {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    const parsed = JSON.parse(m[1]) as { props?: { pageProps?: T } };
    return parsed.props?.pageProps ?? null;
  } catch {
    return null;
  }
}

/** Wycina obiekt JSON zaczynajacy sie na `start`, liczac nawiasy klamrowe. */
export function sliceJsonObject(text: string, start: number): string | null {
  if (start < 0 || text[start] !== "{") return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/** Zwraca sparsowane bloki application/ld+json. Niepoprawne pomija po cichu. */
export function extractJsonLd(html: string): unknown[] {
  const out: unknown[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    const raw = m[1].trim();
    try {
      out.push(JSON.parse(raw));
      continue;
    } catch {
      // Ponizej jeszcze jedno podejscie.
    }
    /*
     * Renault domyka blok nadmiarowym "}};" i JSON.parse wywala sie na
     * "Extra data". Sam obiekt jest poprawny, wiec bierzemy go po zbalansowanym
     * nawiasie i ignorujemy ogon.
     */
    const sliced = sliceJsonObject(raw, raw.indexOf("{"));
    if (!sliced) continue;
    try {
      out.push(JSON.parse(sliced));
    } catch {
      // Naprawde zepsuty JSON — pomijamy.
    }
  }
  return out;
}
