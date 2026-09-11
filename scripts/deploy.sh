#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
#  Mesa de Servicio — actualizar el servidor con lo último de GitHub
#
#  Uso:  sudo bash /var/www/mesa-servicio/scripts/deploy.sh
#
#  No toca la base de datos ni el .env: solo trae el código, recompila el
#  frontend y reinicia la API. El esquema se aplica aparte, y solo cuando
#  cambia, con:  psql "$DATABASE_URL" -f db/schema.full.sql
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/mesa-servicio}"
WEB_ROOT="${WEB_ROOT:-/var/www/html/mesa-servicio}"
SERVICE="${SERVICE:-mesa-servicio}"
BRANCH="${BRANCH:-master}"
APP_PORT="${APP_PORT:-3001}"

say() { printf '\n\033[1;34m▶ %s\033[0m\n' "$1"; }

ANTES=$(git -C "$APP_DIR" rev-parse --short HEAD)

say "Trayendo cambios"
git -C "$APP_DIR" fetch --quiet origin "$BRANCH"
git -C "$APP_DIR" reset --quiet --hard "origin/$BRANCH"
AHORA=$(git -C "$APP_DIR" rev-parse --short HEAD)
echo "  $ANTES → $AHORA"
[ "$ANTES" = "$AHORA" ] && echo "  (sin cambios nuevos)"

say "Backend"
cd "$APP_DIR/autotrack-backend"
npm install --omit=dev --silent

say "Frontend"
cd "$APP_DIR/autotrack-frontend"
npm install --silent
VITE_API_URL=/api npx vite build --base=/ >/dev/null

# Se publica en dos pasos para que el sitio no quede a medias mientras copia.
rm -rf "${WEB_ROOT:?}.nuevo"
cp -r dist "${WEB_ROOT}.nuevo"
rm -rf "${WEB_ROOT:?}"
mv "${WEB_ROOT}.nuevo" "$WEB_ROOT"

say "Reiniciando la API"
systemctl restart "$SERVICE"
sleep 3

if curl -fsS "http://127.0.0.1:$APP_PORT/api/health" >/dev/null; then
  printf '\n\033[32m✓ Despliegue correcto\033[0m — versión %s\n\n' "$AHORA"
  curl -fsS "http://127.0.0.1:$APP_PORT/api/health"; echo
else
  printf '\n\033[31m✗ La API no respondió tras reiniciar\033[0m\n'
  journalctl -u "$SERVICE" -n 30 --no-pager
  exit 1
fi
