/**
 * Wysylka maili przez Resend + szablony.
 *
 * W pakiecie `core`, bo korzystaja z tego dwie strony: web (mail potwierdzajacy
 * zapis) i worker (alerty o nowych ofertach). Trzymanie tego w jednym miejscu
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
 * Mail potwierdzajacy zapis (double opt-in).
 *
 * Bez tego kroku kazdy moglby zapisac cudzy adres, a my slalibysmy alerty
 * komus, kto o nic nie prosil — czyli spamowali.
 */
export function confirmSubscription(email: string, token: string, label: string | null) {
  const url = `${SITE}/alerty/potwierdz?token=${encodeURIComponent(token)}`;
  return send(
    email,
    "Potwierdź powiadomienia — autopoleasingu.pl",
    layout(
      "Potwierdź zapis",
      `<p>Ktoś (mamy nadzieję, że Ty) zapisał ten adres na powiadomienia o nowych ofertach${
        label ? `: <strong style="color:#e7ecf3">${esc(label)}</strong>` : ""
      }.</p>
       <p style="padding:18px 0">
         <a href="${esc(url)}" style="background:#f2f5f9;color:#0b0d10;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:600;display:inline-block">Potwierdzam</a>
       </p>
       <p style="font-size:13px;color:#6b7280">Jeśli to nie Ty — po prostu zignoruj tę wiadomość. Bez kliknięcia nie wyślemy Ci nic więcej.</p>`,
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
}

/** Alert o nowych ofertach pasujacych do subskrypcji. */
export function newOffers(email: string, token: string, label: string | null, offers: AlertOffer[]) {
  const unsub = `${SITE}/alerty/wypisz?token=${encodeURIComponent(token)}`;

  const rows = offers
    .map((o) => {
      const deal =
        o.dealScore != null && o.dealScore >= 0.1
          ? `<span style="color:#34d399;font-weight:600"> · ${Math.round(o.dealScore * 100)}% pod rynkiem</span>`
          : "";
      const spec = [o.year, o.mileageKm != null ? `${num.format(o.mileageKm)} km` : null]
        .filter(Boolean)
        .join(" · ");
      return `<tr><td style="padding:12px 0;border-bottom:1px solid #232a32">
        <a href="${esc(o.url)}" style="color:#e7ecf3;text-decoration:none;font-weight:600;font-size:15px">${esc(o.make)} ${esc(o.model)}</a>
        ${o.trim ? `<div style="font-size:12px;color:#6b7280">${esc(o.trim)}</div>` : ""}
        <div style="font-size:13px;color:#8b95a1;padding-top:3px">${esc(spec)}</div>
        <div style="padding-top:5px;font-size:16px;font-weight:700;color:#e7ecf3">
          ${o.priceGross != null ? esc(pln.format(o.priceGross)) : "cena na zapytanie"}${deal}
        </div>
        <div style="font-size:12px;color:#6b7280">${esc(o.sourceName)}</div>
      </td></tr>`;
    })
    .join("");

  const n = offers.length;
  return send(
    email,
    `${n} ${n === 1 ? "nowa oferta" : "nowych ofert"}${label ? ` — ${label}` : ""}`,
    layout(
      `${n === 1 ? "Nowa oferta" : `Nowe oferty: ${n}`}`,
      `${label ? `<p style="color:#6b7280;font-size:13px;margin-top:0">Powiadomienie: ${esc(label)}</p>` : ""}
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`,
      unsub,
    ),
  );
}
