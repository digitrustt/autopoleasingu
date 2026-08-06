#!/bin/bash
# Przeniesienie lokalnej bazy na produkcje (Neon albo dowolny hostowany Postgres).
#
#   ./scripts/migrate-to-prod.sh "postgresql://user:haslo@host/db?sslmode=require"
#
# Robi zrzut lokalnej bazy i wgrywa go pod podany adres. Bezpieczne do powtorzenia:
# --clean kasuje istniejace obiekty przed wgraniem, wiec drugi przebieg nadpisuje
# zamiast dublowac.
set -euo pipefail

TARGET="${1:-}"
if [ -z "$TARGET" ]; then
  echo "Uzycie: $0 <DATABASE_URL produkcyjnej bazy>" >&2
  exit 1
fi

DUMP="$(mktemp -t auta-dump).sql"
trap 'rm -f "$DUMP"' EXIT

echo "1/3 Zrzut lokalnej bazy…"
pg_dump -d auta --no-owner --no-acl --clean --if-exists -f "$DUMP"
echo "    $(du -h "$DUMP" | cut -f1)"

echo "2/3 Wgrywanie na produkcje…"
psql "$TARGET" -v ON_ERROR_STOP=1 -q -f "$DUMP"

echo "3/3 Weryfikacja…"
psql "$TARGET" -tAc "
  select 'ofert: ' || count(*) from listings
  union all select 'zrodel: ' || count(distinct source_id) from listings
  union all select 'koszykow wyceny: ' || count(*) from valuations
  union all select 'snapshotow: ' || count(*) from listing_snapshots;"

echo
echo "Gotowe. Ustaw DATABASE_URL w Vercelu na ten sam adres:"
echo "  vercel env add DATABASE_URL production"
