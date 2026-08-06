#!/bin/bash
# Wrapper dla launchd — cron nie dziedziczy PATH-u powloki interaktywnej.
#
# Dwie kadencje, bo jeden przebieg nie obsluzy obu potrzeb naraz:
#
#   fast (co 10 min)  — wykrywanie NOWYCH i ZNIKNIETYCH ofert. Liczy sie tu
#                       discover, nie detale: nowa oferta trafia na poczatek
#                       kolejki detali, wiec maly limit w zupelnosci wystarcza.
#   deep (raz na dobe)— odswiezenie cen wszystkich znanych ofert.
#
# Bez tego podzialu przebieg z limitem 250 na kazde z 26 zrodel to ~6,5 tys.
# zadan (~2 h), a launchd probowalby go odpalac co 10 minut.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

MODE="${1:-fast}"

case "$MODE" in
  fast) LIMIT="${SCRAPE_LIMIT:-12}";    REFRESH="${REFRESH_AFTER:-24}" ;;
  deep) LIMIT="${SCRAPE_LIMIT:-10000}"; REFRESH="${REFRESH_AFTER:-20}" ;;
  *) echo "Uzycie: scrape.sh [fast|deep]" >&2; exit 1 ;;
esac

cd "$REPO"
echo "=== $(date '+%Y-%m-%d %H:%M:%S') [$MODE] limit=$LIMIT refresh=${REFRESH}h ==="

# Dwa przebiegi naraz waliloby w te same serwisy podwojnym tempem i biloby sie
# o wiersze w bazie. launchd nie odpala drugiej kopii tego samego Label, ale
# fast i deep to dwa osobne Labele — stad wspolna blokada.
#
# mkdir zamiast flock: macOS nie ma flocka, a tworzenie katalogu jest atomowe.
LOCK="/tmp/auta-scraper.lock"
if ! mkdir "$LOCK" 2>/dev/null; then
  # Zamek po ubitym procesie zablokowalby scrapera na zawsze — sprawdzamy, czy
  # wlasciciel jeszcze zyje, i dopiero wtedy odpuszczamy.
  OWNER="$(cat "$LOCK/pid" 2>/dev/null || echo "")"
  if [ -n "$OWNER" ] && kill -0 "$OWNER" 2>/dev/null; then
    echo "Poprzedni przebieg (PID $OWNER) jeszcze trwa — pomijam."
    exit 0
  fi
  echo "Zamek po nieaktywnym procesie — przejmuje."
  rm -rf "$LOCK"
  mkdir "$LOCK"
fi
echo $$ > "$LOCK/pid"
trap 'rm -rf "$LOCK"' EXIT

pnpm scrape --limit "$LIMIT" --refresh-after "$REFRESH"

# Wycena PO zaciagu, nie w jego trakcie: mediana musi widziec komplet danych,
# inaczej skakalaby zaleznie od tego, ktore zrodla akurat zdazyly wpasc.
# Kosztuje ~0,5 s przy 20 tys. ofert, wiec robimy ja przy kazdym przebiegu —
# swiezo dodana oferta dostaje ocene od razu, a nie dopiero w nocy.
pnpm revalue
