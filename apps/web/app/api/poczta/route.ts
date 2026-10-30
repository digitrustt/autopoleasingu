import { createHmac, timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Przekierowanie poczty przychodzacej na skrzynke wlasciciela.
 *
 * kontakt@autopoleasingu.pl stal na stronie w ponad dwudziestu miejscach,
 * a MX domeny wskazywal na Vercela, ktory poczty nie przyjmuje — wszystko,
 * co ktos do nas napisal, przepadalo bez sladu (30.10.2026). Teraz MX idzie
 * do Resend, Resend wola ten webhook (`email.received`), a my dociagamy tresc
 * i wysylamy ja dalej na POCZTA_DO, z Reply-To ustawionym na nadawce, zeby
 * "Odpowiedz" w Gmailu trafialo prosto do niego.
 *
 * Webhook podpisuje Svix: HMAC-SHA256 z "id.timestamp.body" kluczem z
 * RESEND_WEBHOOK_SECRET (po prefiksie "whsec_", base64). Bez weryfikacji
 * kazdy moglby wysylac przez nas maile na skrzynke wlasciciela.
 */

/** Odrzucamy podpisy starsze niz 5 minut — ochrona przed powtorzeniem zadania. */
const TOLERANCJA_S = 300;

function podpisOk(body: string, req: NextRequest, sekret: string): boolean {
  const id = req.headers.get("svix-id");
  const ts = req.headers.get("svix-timestamp");
  const podpisy = req.headers.get("svix-signature");
  if (!id || !ts || !podpisy) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > TOLERANCJA_S) return false;

  const klucz = Buffer.from(sekret.replace(/^whsec_/, ""), "base64");
  const oczekiwany = createHmac("sha256", klucz).update(`${id}.${ts}.${body}`).digest();

  // Naglowek moze niesc kilka podpisow ("v1,xxx v1,yyy") przy rotacji klucza.
  return podpisy.split(" ").some((p) => {
    const [wersja, wartosc] = p.split(",");
    if (wersja !== "v1" || !wartosc) return false;
    const podany = Buffer.from(wartosc, "base64");
    return podany.length === oczekiwany.length && timingSafeEqual(podany, oczekiwany);
  });
}

interface Odebrany {
  from?: string;
  to?: string[];
  subject?: string;
  html?: string | null;
  text?: string | null;
}

export async function POST(req: NextRequest) {
  const sekret = process.env.RESEND_WEBHOOK_SECRET;
  const klucz = process.env.RESEND_API_KEY;
  const doKogo = process.env.POCZTA_DO;
  const od = process.env.MAIL_FROM;
  if (!sekret || !klucz || !doKogo || !od) {
    return NextResponse.json({ error: "brak konfiguracji poczty" }, { status: 503 });
  }

  const body = await req.text();
  if (!podpisOk(body, req, sekret)) {
    return NextResponse.json({ error: "zly podpis" }, { status: 401 });
  }

  const zdarzenie = JSON.parse(body) as { type?: string; data?: { email_id?: string } };
  if (zdarzenie.type !== "email.received" || !zdarzenie.data?.email_id) {
    return NextResponse.json({ ok: true, pominieto: zdarzenie.type });
  }

  // Webhook niesie tylko metadane — tresc trzeba dociagnac osobno.
  const r = await fetch(`https://api.resend.com/emails/receiving/${zdarzenie.data.email_id}`, {
    headers: { Authorization: `Bearer ${klucz}` },
  });
  if (!r.ok) {
    // 500 = Resend ponowi webhook pozniej, zamiast zgubic maila.
    return NextResponse.json({ error: `pobranie tresci: ${r.status}` }, { status: 500 });
  }
  const mail = (await r.json()) as Odebrany;

  const naglowek =
    `Od: ${mail.from ?? "?"}\nDo: ${(mail.to ?? []).join(", ")}\n` +
    "Odpowiedz normalnie — trafi prosto do nadawcy.\n";

  const wyslij = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${klucz}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: od,
      to: [doKogo],
      reply_to: mail.from,
      subject: `[${(mail.to ?? ["kontakt"])[0]}] ${mail.subject ?? "(bez tematu)"}`,
      text: `${naglowek}\n${mail.text ?? ""}`,
      ...(mail.html
        ? {
            html:
              `<p style="color:#666;font-size:12px;white-space:pre-line">${naglowek
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")}</p><hr>${mail.html}`,
          }
        : {}),
    }),
  });
  if (!wyslij.ok) {
    return NextResponse.json({ error: `wysylka: ${wyslij.status}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
