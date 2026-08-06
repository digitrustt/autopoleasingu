import { type Browser, type BrowserContext, chromium } from "playwright";

/**
 * Warstwa przegladarkowa dla zrodel, ktore odmawiaja zwyklemu HTTP:
 * WAF-y (master1, audi), Cloudflare (spotawheel) i aplikacje SPA renderujace
 * dane dopiero po stronie klienta (skoda).
 *
 * Uzywamy jej WYLACZNIE tam, gdzie nie ma taniej alternatywy — jedna instancja
 * Chromium to ~150 MB RAM, wiec 90% zrodel dalej chodzi po zwyklym fetchu.
 */

const CONTACT = process.env.SCRAPER_CONTACT ?? "kontakt-nieustawiony";

let browser: Browser | null = null;
let context: BrowserContext | null = null;

async function getContext(): Promise<BrowserContext> {
  if (context) return context;

  browser ??= await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
  });

  context = await browser.newContext({
    locale: "pl-PL",
    timezoneId: "Europe/Warsaw",
    viewport: { width: 1440, height: 900 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) " +
      `Chrome/131.0.0.0 Safari/537.36 (+auta-sniper; ${CONTACT})`,
    extraHTTPHeaders: { "Accept-Language": "pl-PL,pl;q=0.9,en;q=0.8" },
  });

  /*
   * Obrazki, fonty i media sa nam niepotrzebne — miniatury i tak tylko linkujemy.
   * Blokada tnie transfer o ~80% i przyspiesza render, a przy okazji zmniejsza
   * obciazenie serwisu, ktory odwiedzamy.
   */
  await context.route("**/*", (route) => {
    const type = route.request().resourceType();
    if (type === "image" || type === "font" || type === "media") return route.abort();
    return route.continue();
  });

  return context;
}

export interface RenderOptions {
  /** Selektor, na ktory czekamy przed odczytem HTML-a. */
  waitForSelector?: string;
  /** Ile czekac lacznie (ms). */
  timeoutMs?: number;
  /** Dodatkowa pauza po zaladowaniu — dla apek dociagajacych dane XHR-em. */
  settleMs?: number;
}

/** Zwraca HTML po wykonaniu JS. */
export async function fetchRendered(url: string, opts: RenderOptions = {}): Promise<string> {
  const { waitForSelector, timeoutMs = 45_000, settleMs = 0 } = opts;
  const ctx = await getContext();
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    if (waitForSelector) {
      await page.waitForSelector(waitForSelector, { timeout: timeoutMs });
    }
    if (settleMs > 0) await page.waitForTimeout(settleMs);
    return await page.content();
  } finally {
    await page.close();
  }
}

/**
 * Otwiera strone i zwraca odpowiedzi JSON, ktore sama wywolala. Dla aplikacji,
 * ktorych API trudno odtworzyc recznie — zamiast zgadywac endpoint, podsluchujemy
 * ten, ktorego uzywa sama strona.
 */
export interface CapturedCall {
  url: string;
  method: string;
  postData: string | null;
  body: unknown;
}

export async function captureJson(
  url: string,
  urlPattern: RegExp,
  opts: RenderOptions = {},
): Promise<CapturedCall[]> {
  const { timeoutMs = 45_000, settleMs = 3000 } = opts;
  const ctx = await getContext();
  const page = await ctx.newPage();
  const captured: CapturedCall[] = [];

  page.on("response", async (res) => {
    if (!urlPattern.test(res.url())) return;
    try {
      const ct = res.headers()["content-type"] ?? "";
      if (!ct.includes("json")) return;
      captured.push({
        url: res.url(),
        method: res.request().method(),
        postData: res.request().postData(),
        body: await res.json(),
      });
    } catch {
      // Odpowiedz mogla zostac przerwana — pomijamy.
    }
  });

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForTimeout(settleMs);
    return captured;
  } finally {
    await page.close();
  }
}

/** Worker musi to wywolac na koniec, inaczej proces nie zakonczy sie sam. */
export async function closeBrowser(): Promise<void> {
  await context?.close().catch(() => {});
  await browser?.close().catch(() => {});
  context = null;
  browser = null;
}
