#!/bin/bash
# Wpina klucz Resend we wszystkie trzy miejsca, w ktorych jest potrzebny.
#
#   ./scripts/setup-resend.sh re_XXXXXXXXXXXX
#
# Trzy miejsca, bo trzy rzeczy wysylaja maile niezaleznie od siebie:
#   .env            — lokalne uruchomienia (pnpm --filter @auta/worker alerts)
#   Vercel          — API /api/alerty, czyli mail potwierdzajacy zapis
#   GitHub Actions  — nocna wysylka powiadomien o nowych ofertach
#
# Pominiecie ktoregokolwiek daje najgorszy wariant: czesc maili wychodzi,
# czesc nie, i nie widac ktora.
set -euo pipefail

KEY="${1:-}"
FROM="${2:-alerty@autopoleasingu.pl}"

if [ -z "$KEY" ]; then
  echo "Uzycie: $0 re_TWOJ_KLUCZ [adres@nadawcy]" >&2
  exit 1
fi
case "$KEY" in
  re_*) ;;
  *) echo "Klucz Resend zaczyna sie od 're_'. Podano: ${KEY:0:6}..." >&2; exit 1 ;;
esac

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

echo "→ .env"
# Podmiana zamiast dopisania — inaczej przy drugim uruchomieniu byly by dwa wpisy.
touch .env
grep -v '^RESEND_API_KEY=' .env | grep -v '^MAIL_FROM=' > .env.tmp || true
{ cat .env.tmp; echo "RESEND_API_KEY=$KEY"; echo "MAIL_FROM=$FROM"; } > .env
rm -f .env.tmp

echo "→ Vercel (production)"
for V in RESEND_API_KEY MAIL_FROM; do
  npx --yes vercel@latest env rm "$V" production --yes >/dev/null 2>&1 || true
done
printf '%s' "$KEY"  | npx --yes vercel@latest env add RESEND_API_KEY production >/dev/null
printf '%s' "$FROM" | npx --yes vercel@latest env add MAIL_FROM production >/dev/null

echo "→ GitHub Actions"
gh secret set RESEND_API_KEY --body "$KEY"
gh secret set MAIL_FROM --body "$FROM"

echo
echo "Gotowe. Zostaly dwie rzeczy:"
echo "  1. Wdroz na nowo, zeby Vercel podniosl zmienne:  npx vercel deploy --prod --yes"
echo "  2. Sprawdz, czy mail wychodzi:"
echo "     curl -s -X POST https://autopoleasingu.pl/api/alerty \\"
echo "       -H 'Content-Type: application/json' \\"
echo "       -d '{\"email\":\"TWOJ@ADRES\",\"filters\":{}}'"
echo "     Odpowiedz {\"ok\":true} BEZ pola \"dev\" znaczy, ze klucz dziala."
