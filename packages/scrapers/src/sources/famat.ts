/**
 * Wspolna warstwa dla dwoch serwisow chodzacych na tym samym silniku (Famat):
 * poleasingowe.carefleet.pl (stale ceny) i famataukcje.pl (aukcje).
 *
 * Roznia sie skorka i modelem sprzedazy, ale tabela "Dane pojazdu", adresy ofert
 * (/oferta/{id}/{slug}/) i konwencja nazw obrazkow sa identyczne — dlatego
 * parsowanie danych pojazdu siedzi tutaj, a nie w dwoch kopiach.
 */

export function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&oacute;/g, "ó")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/\s+/g, " ")
    .trim();
}

/** Usuwa polskie znaki i ujednolica, zeby "Przebieg (km):" pasowal do "przebieg". */
function labelKey(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[łŁ]/g, "l")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Obie skorki opisuja pojazd para "etykieta:" -> "wartosc", ale ROZNYM markupem:
 * Carefleet daje "Marka: <strong>Mercedes</strong>", Famat dwa <p> obok siebie.
 * Zamiast dwoch regexow rozbijamy sekcje na tekstowe tokeny — wtedy w obu
 * przypadkach wartosc jest po prostu tokenem za etykieta.
 */
export function vehicleData(html: string): Map<string, string> {
  const start = html.indexOf("Dane pojazdu");
  if (start < 0) return new Map();

  // Sekcja konczy sie przed opisem/wyposazeniem — dalej sa juz teksty marketingowe.
  const rest = html.slice(start);
  const stop = ["Wyposażenie", "Oferujemy", "Dodatkowe informacje", "Historia licytacji"]
    .map((s) => rest.indexOf(s))
    .filter((i) => i > 0)
    .sort((a, b) => a - b)[0];

  const tokens = (stop ? rest.slice(0, stop) : rest)
    .split(/<[^>]+>/)
    .map((t) => stripTags(t))
    .filter(Boolean);

  const out = new Map<string, string>();
  for (let i = 0; i < tokens.length - 1; i++) {
    const t = tokens[i];
    if (!t.endsWith(":")) continue;
    const value = tokens[i + 1];
    // Kolejna etykieta zamiast wartosci = pole puste w zrodle.
    if (value.endsWith(":")) continue;
    const k = labelKey(t);
    if (!out.has(k)) out.set(k, value);
  }
  return out;
}

/** Dopasowanie po prefiksie: "przebieg" trafia w "Przebieg:" i "Przebieg (km):". */
export function field(data: Map<string, string>, ...prefixes: string[]): string | null {
  for (const p of prefixes) {
    const key = labelKey(p);
    for (const [k, v] of data) {
      if (k.startsWith(key)) return v;
    }
  }
  return null;
}

/**
 * Nazwa pliku niesie rozmiar ("zdjecie-209154_635x424_resizecfc477.jpg"), a wariantow
 * jest kilka. Bierzemy najwiekszy — miniature i tak tylko linkujemy, wiec nie placimy
 * za transfer, a mniejsze warianty (80x80) sa nieczytelne na kafelku.
 */
export function largestPhoto(html: string, base: string): string | null {
  let best: { area: number; url: string } | null = null;
  for (const m of html.matchAll(/\/i\/zd\/[^"')\s]+/g)) {
    const url = m[0];
    const size = url.match(/_(\d+)x(\d+)_/);
    if (!size) continue;
    const area = Number(size[1]) * Number(size[2]);
    if (!best || area > best.area) best = { area, url };
  }
  return best ? `${base}${best.url}` : null;
}

/** Adresy ofert na listingu bywaja wzgledne (Carefleet) albo pelne (Famat). */
export function offerLinks(html: string, host: string): { id: string; url: string }[] {
  const out = new Map<string, string>();
  const re = new RegExp(`(?:https?://${host})?(/oferta/(\\d+)/[a-z0-9-]+/)`, "g");
  for (const m of html.matchAll(re)) {
    if (!out.has(m[2])) out.set(m[2], m[1]);
  }
  return [...out].map(([id, path]) => ({ id, url: path }));
}
