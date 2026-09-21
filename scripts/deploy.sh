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

# La instalación deja aquí cómo quedó desplegada la mesa —sobre todo la ruta
# base—. Sin esto, recompilar con la base equivocada deja la página en blanco.
CONF="${CONF:-/etc/default/mesa-servicio}"
# shellcheck source=/dev/null
[ -f "$CONF" ] && . "$CONF"

APP_DIR="${APP_DIR:-/var/www/mesa-servicio}"
WEB_ROOT="${WEB_ROOT:-/var/www/html/mesa-servicio}"
SERVICE="${SERVICE:-mesa-servicio}"
BRANCH="${BRANCH:-master}"
APP_PORT="${APP_PORT:-3001}"
BASE_PATH="${BASE_PATH:-}"
BASE_PATH="${BASE_PATH%/}"

say() { printf '\n\033[1;34m▶ %s\033[0m\n' "$1"; }

ANTES=$(git -C "$APP_DIR" rev-parse --short HEAD)

say "Trayendo cambios"
git -C "$APP_DIR" fetch --quiet origin "$BRANCH"
git -C "$APP_DIR" reset --quiet --hard "origin/$BRANCH"
AHORA=$(git -C "$APP_DIR" rev-parse --short HEAD)
echo "  $ANTES → $AHORA"
[ "$ANTES" = "$AHORA" ] && echo "  (sin cambios nuevos)"

# Coherencias entre archivos que ni el compilador ni vite ven: permisos que
# difieren entre backend y frontend, roles que entran a una pantalla que no
# existe, columnas que la aplicación crea pero el esquema no declara. Se
# comprueba antes de tocar nada, porque desplegar eso deja la mesa rota.
say "Comprobaciones previas"
node "$APP_DIR/scripts/verificar-coherencia.mjs" || {
  echo "  Se aborta el despliegue: la revisión anterior sigue en pie."; exit 1;
}

say "Backend"
cd "$APP_DIR/autotrack-backend"
npm install --omit=dev --silent

say "Frontend"
cd "$APP_DIR/autotrack-frontend"
npm install --silent
rm -rf dist
VITE_BASE="${BASE_PATH}/" VITE_API_URL="${BASE_PATH}/api" npx vite build > /tmp/mesa-build.log 2>&1 || {
  echo "  Falló la compilación:"; tail -20 /tmp/mesa-build.log; exit 1;
}

# Si la base sale mal, la página queda en blanco sin ningún error visible:
# más vale abortar aquí que publicarlo.
ESPERADO="${BASE_PATH}/assets/"
if ! grep -q "src=\"$ESPERADO" dist/index.html; then
  echo "  El build no quedó con la ruta base $ESPERADO. index.html pide:"
  grep -oE 'src="[^"]+"' dist/index.html | sed 's/^/      /'
  exit 1
fi
echo "  compilado para $ESPERADO"

# Se publica en dos pasos para que el sitio no quede a medias mientras copia.
rm -rf "${WEB_ROOT:?}.nuevo"
cp -r dist "${WEB_ROOT}.nuevo"
rm -rf "${WEB_ROOT:?}"
mv "${WEB_ROOT}.nuevo" "$WEB_ROOT"

say "Reiniciando la API"
systemctl restart "$SERVICE"
sleep 3

# Comprobar /health no basta: si un proceso viejo se quedó atado al puerto
# —EADDRINUSE tras un reset --hard interrumpido, por ejemplo—, el servicio
# nuevo entra en bucle de reinicio y quien responde es el viejo con el código
# anterior. Todo saldría en verde y el despliegue no habría desplegado nada.
if ! systemctl is-active --quiet "$SERVICE"; then
  printf '\n\033[31m\xe2\x9c\x97 El servicio no quedó activo tras reiniciar\033[0m\n'
  puerto_ocupado=$(ss -lptnH "sport = :$APP_PORT" 2>/dev/null | head -3)
  [ -n "$puerto_ocupado" ] && printf '\n  Puerto %s ocupado por:\n  %s\n' "$APP_PORT" "$puerto_ocupado"
  journalctl -u "$SERVICE" -n 30 --no-pager
  exit 1
fi

if curl -fsS "http://127.0.0.1:$APP_PORT/api/health" >/dev/null; then
  printf '\n\033[32m✓ Despliegue correcto\033[0m — versión %s\n\n' "$AHORA"
  curl -fsS "http://127.0.0.1:$APP_PORT/api/health"; echo
else
  printf '\n\033[31m✗ La API no respondió tras reiniciar\033[0m\n'
  journalctl -u "$SERVICE" -n 30 --no-pager
  exit 1
fi
