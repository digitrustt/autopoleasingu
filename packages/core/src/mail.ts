/**
 * Wysylka maili przez Resend + szablony.
 *
 * W pakiecie `core`, bo korzystaja z tego dwie strony: web (mail powitalny
 * po zapisie) i worker (alerty o nowych ofertach). Trzymanie tego w jednym miejscu
 * gwarantuje, ze oba wygladaja tak samo i oba maja link wypisujacy.
 *
 * Bez RESEND_API_KEY funkcje nic nie wysylaja i zwracaja `skipped` — dzieki temu
 * development i podglady nie strzelaja mailami do prawdziwych ludzi, a brak
 * konfiguracji nie wywala aplikacji.
 */
import { Resend } from "resend";

const KEY = process.env.RESEND_API_KEY;
/** Adres nadawcy musi byc na domenie zweryfikowanej w Resend. */
const FROM = process.env.MAIL_FROM ?? "alerty@autopoleasingu.pl";
const SITE = process.env.SITE_URL ?? "https://autopoleasingu.pl";

const client = KEY ? new Resend(KEY) : null;

export interface SendResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
}

async function send(to: string, subject: string, html: string): Promise<SendResult> {
  if (!client) return { ok: false, skipped: true };
  try {
    const { error } = await client.emails.send({ from: FROM, to, subject, html });
    return error ? { ok: false, error: error.message } : { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/* ------------------------------------------------------------------ szablon */

const pln = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("pl-PL");

/** Ucieczka HTML — dane ofert pochodza z cudzych serwisow i moga zawierac znaczniki. */
function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/*
 * Style inline i tabele zamiast flexboxa — klienci pocztowi (zwlaszcza Outlook)
 * ignoruja arkusze i nowoczesny layout. To nie jest zaniedbanie, tylko warunek
 * tego, zeby mail wygladal tak samo w Gmailu i w Outlooku.
 */
function layout(title: string, body: string, unsubUrl?: string): string {
  return `<!doctype html>
<html lang="pl"><body style="margin:0;padding:24px;background:#0b0d10;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#e7ecf3">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto">
    <tr><td style="padding-bottom:20px">
      <span style="font-size:18px;font-weight:700;letter-spacing:-.3px">
        <span style="color:#f2f5f9">auto</span><span style="color:#f2f5f9">poleasingu</span><span style="color:#6b7280">.pl</span>
      </span>
    </td></tr>
    <tr><td style="font-size:20px;font-weight:700;padding-bottom:14px">${esc(title)}</td></tr>
    <tr><td style="font-size:15px;line-height:1.6;color:#b6bec9">${body}</td></tr>
    <tr><td style="padding-top:26px;border-top:1px solid #232a32;margin-top:20px;font-size:12px;color:#6b7280">
      Porównywarka ofert poleasingowych. Nie sprzedajemy aut ani nie pośredniczymy.
      ${unsubUrl ? `<br><a href="${esc(unsubUrl)}" style="color:#6b7280">Wypisz się z powiadomień</a>` : ""}
    </td></tr>
  </table>
</body></html>`;
}

/* --------------------------------------------------------------- wiadomosci */

/**
 * Mail powitalny — wychodzi od razu po zapisie, powiadomienia sa juz wlaczone.
 *
 * DLACZEGO NIE MA JUZ POTWIERDZENIA LINKIEM. Double opt-in zjadal polowe ludzi:
 * z trzech obcych osob, ktore sie zapisaly, dwie nigdy nie kliknely w link
 * (obie na wp.pl i onet.pl, ktore agresywnie filtruja maile od nowych
 * nadawcow). Kto wpisal adres w formularz, ten chcial dostawac powiadomienia.
 *
 * Ryzyko, przed ktorym potwierdzenie chronilo, nie zniknelo — zmienilo sie
 * miejsce obrony. Ktos wciaz moze wpisac cudzy adres albo sie pomylic. Dlatego
 * ten mail:
 *
 *  - wychodzi NATYCHMIAST, zanim poleci jakikolwiek alert — wlasciciel adresu
 *    dowiaduje sie o zapisie od razu, a nie z jutrzejszej wysylki;
 *  - ma wypisanie jako pierwsza rzecz pod trescia, nie w stopce drobnym
 *    drukiem. Jedno klikniecie konczy sprawe, bez logowania.
 *
 * Tresc mowi dokladnie to, co bedzie: mail tylko wtedy, gdy doszla pasujaca
 * oferta, najwyzej jeden dziennie. To samo obiecuje formularz.
 */
export function welcomeSubscription(email: string, token: string, label: string | null) {
  const wypisz = `${SITE}/alerty/wypisz?token=${encodeURIComponent(token)}`;
  return send(
    email,
    label ? `Powiadomienia włączone: ${label}` : "Powiadomienia włączone — autopoleasingu.pl",
    layout(
      "Powiadomienia włączone",
      `<p>Zapisaliśmy ten adres na powiadomienia o nowych ofertach${
        label ? `: <strong style="color:#e7ecf3">${esc(label)}</strong>` : ""
      }.</p>
       <p>Codziennie przeglądamy 26 źródeł poleasingowych. Gdy pojawi się pasująca oferta, dostaniesz maila — najwyżej jednego dziennie i tylko wtedy, gdy faktycznie coś doszło.</p>
       <p style="padding:14px 0 4px">
         <a href="${esc(SITE)}" style="background:#f2f5f9;color:#0b0d10;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:600;display:inline-block">Zobacz aktualne oferty</a>
       </p>
       <p style="font-size:13px;color:#6b7280;padding-top:10px">
         Nie zapisywałeś się? <a href="${esc(wypisz)}" style="color:#b6bec9">Wypisz ten adres</a> — jedno kliknięcie, bez logowania. Nie wyślemy wtedy nic więcej.
       </p>`,
      wypisz,
    ),
  );
}

export interface AlertOffer {
  make: string;
  model: string;
  trim: string | null;
  year: number | null;
  mileageKm: number | null;
  priceGross: number | null;
  marketPrice: number | null;
  dealScore: number | null;
  sourceName: string;
  url: string;
  /** Miniatura hot-linkowana ze zrodla — patrz komentarz przy szablonie. */
  thumbnailUrl: string | null;
  fuel: string | null;
  gearbox: string | null;
}

/** Polskie nazwy paliwa i skrzyni — w mailu nie ma miejsca na ikony. */
const PALIWO_PL: Record<string, string> = {
  petrol: "Benzyna",
  diesel: "Diesel",
  hybrid: "Hybryda",
  phev: "PHEV",
  electric: "Elektryk",
  lpg: "LPG",
};
const SKRZYNIA_PL: Record<string, string> = { automatic: "Automat", manual: "Manual" };

/**
 * Alert o nowych ofertach pasujacych do subskrypcji.
 *
 * ZDJECIA SA HOT-LINKOWANE ZE ZRODEL, tak samo jak na stronie. Nie kopiujemy
 * ich do siebie: to cudze zdjecia cudzych aut, a ich kopiowanie na wlasny
 * serwer bylo by ich rozpowszechnianiem.
 *
 * Mail MUSI byc czytelny bez obrazkow — Gmail i Outlook domyslnie blokuja
 * zewnetrzne obrazki, dopoki czlowiek nie kliknie "pokaz". Dlatego zdjecie ma
 * staly rozmiar (nie rozjezdza ukladu, gdy sie nie zaladuje), sensowny tekst
 * alternatywny, a WSZYSTKIE informacje potrzebne do decyzji — cena, rocznik,
 * przebieg, ile pod rynkiem — stoja w tekscie obok, nie na obrazku.
 *
 * Tabele i style inline zamiast flexboxa, bo Outlook nie zna nowoczesnego
 * layoutu. `border-radius` i tak zignoruje — to jest ozdoba dla reszty.
 */
export function newOffers(email: string, token: string, label: string | null, offers: AlertOffer[]) {
  const { subject, html } = renderNewOffers(token, label, offers);
  return send(email, subject, html);
}

/**
 * Sam HTML alertu, bez wysylki — zeby dalo sie go podejrzec i sprawdzic
 * w przegladarce, nie strzelajac mailem do prawdziwego subskrybenta.
 */
export function renderNewOffers(token: string, label: string | null, offers: AlertOffer[]) {
  const unsub = `${SITE}/alerty/wypisz?token=${encodeURIComponent(token)}`;

  const rows = offers
    .map((o) => {
      const procent = o.dealScore != null ? Math.round(o.dealScore * 100) : null;
      const okazja =
        procent != null && procent >= 10
          ? `<div style="padding-top:6px">
               <span style="background:#065f46;color:#6ee7b7;font-size:12px;font-weight:700;padding:3px 8px;border-radius:5px;display:inline-block">
                 ${procent}% pod rynkiem
               </span>
             </div>`
          : "";

      const spec = [
        o.year,
        o.mileageKm != null ? `${num.format(o.mileageKm)} km` : null,
        o.fuel ? PALIWO_PL[o.fuel] : null,
        o.gearbox ? SKRZYNIA_PL[o.gearbox] : null,
      ]
        .filter(Boolean)
        .join(" · ");

      const nazwa = `${o.make} ${o.model}`;

      /*
       * Szerokosc i wysokosc jako ATRYBUTY, nie tylko w stylu: klienci pocztowi,
       * ktore nie zaladowaly obrazka, rezerwuja miejsce tylko na podstawie
       * atrybutow. Bez nich zablokowane zdjecie zwija sie do zera i caly wiersz
       * podskakuje, gdy uzytkownik kliknie "pokaz obrazki".
       */
      /*
       * Kolor i `text-decoration` NA OBRAZKU, nie tylko na linku: gdy klient
       * pocztowy zablokuje zdjecie, pokazuje tekst alternatywny, ktory dziedziczy
       * style po <img>. Bez tego alt wychodzil niebieski i podkreslony — czyli
       * wygladal jak zepsuty link, a nie jak podpis.
       */
      const foto = o.thumbnailUrl
        ? `<img src="${esc(o.thumbnailUrl)}" width="140" height="94" alt="${esc(nazwa)}"
             style="display:block;width:140px;height:94px;object-fit:cover;border-radius:8px;border:0;background:#14181d;color:#6b7280;font-size:11px;text-decoration:none">`
        : `<div style="width:140px;height:94px;border-radius:8px;background:#14181d"></div>`;

      return `<tr><td style="padding:14px 0;border-bottom:1px solid #232a32">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td width="140" valign="top" style="width:140px;padding-right:14px">
            <a href="${esc(o.url)}" style="text-decoration:none">${foto}</a>
          </td>
          <td valign="top">
            <a href="${esc(o.url)}" style="color:#e7ecf3;text-decoration:none;font-weight:700;font-size:16px;line-height:1.3">${esc(nazwa)}</a>
            ${o.trim ? `<div style="font-size:12px;color:#6b7280;padding-top:2px">${esc(o.trim)}</div>` : ""}
            <div style="font-size:13px;color:#8b95a1;padding-top:5px">${esc(spec)}</div>
            <div style="padding-top:7px;font-size:18px;font-weight:700;color:#e7ecf3">
              ${o.priceGross != null ? esc(pln.format(o.priceGross)) : "cena na zapytanie"}
            </div>
            ${okazja}
            <div style="font-size:12px;color:#6b7280;padding-top:6px">${esc(o.sourceName)}</div>
          </td>
        </tr></table>
      </td></tr>`;
    })
    .join("");

  const n = offers.length;
  return {
    subject: `${n} ${n === 1 ? "nowa oferta" : "nowych ofert"}${label ? ` — ${label}` : ""}`,
    html: layout(
      `${n === 1 ? "Nowa oferta" : `Nowe oferty: ${n}`}`,
      `${label ? `<p style="color:#6b7280;font-size:13px;margin-top:0">Powiadomienie: ${esc(label)}</p>` : ""}
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
       <p style="padding-top:20px;font-size:13px;color:#6b7280;margin:0">
         Ceny porównujemy z medianą rynkową dla tego samego rocznika, przebiegu i napędu.
         <a href="${SITE}" style="color:#8b95a1">Zobacz wszystkie oferty</a>.
       </p>`,
      unsub,
    ),
  };
}
