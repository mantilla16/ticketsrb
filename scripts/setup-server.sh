#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
#  Mesa de Servicio — Russell Bedford Barranquilla
#  Instalación en un servidor Ubuntu 22.04 / 24.04 limpio.
#
#  Uso:
#      sudo APP_DOMAIN=mesa.rbcol.co bash setup-server.sh
#
#  Es idempotente: se puede volver a correr sobre un servidor ya instalado
#  sin romper nada ni perder datos.
#
#  No contiene ninguna credencial. La contraseña de la base se genera sola y
#  queda únicamente en el .env del backend, con permisos 600.
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

# ── Parámetros (todos sobreescribibles por entorno) ────────────────────────
REPO="${REPO:-https://github.com/mantilla16/ticketsrb.git}"
BRANCH="${BRANCH:-master}"
APP_DIR="${APP_DIR:-/var/www/mesa-servicio}"
WEB_ROOT="${WEB_ROOT:-/var/www/html/mesa-servicio}"
SERVICE="${SERVICE:-mesa-servicio}"
APP_PORT="${APP_PORT:-3001}"

# `_` acepta cualquier nombre de host: sirve para entrar por IP mientras no
# haya dominio. Con APP_DOMAIN definido, nginx responde solo a ese nombre.
APP_DOMAIN="${APP_DOMAIN:-_}"
AUTH_ALLOWED_DOMAIN="${AUTH_ALLOWED_DOMAIN:-rbcol.co}"
MS_CLIENT_ID="${MS_CLIENT_ID:-}"
MS_TENANT_ID="${MS_TENANT_ID:-}"

DB_NAME="${DB_NAME:-mesa_servicio}"
DB_USER="${DB_USER:-mesa_servicio}"

say() { printf '\n\033[1;34m▶ %s\033[0m\n' "$1"; }
ok()  { printf '  \033[32m✓\033[0m %s\n' "$1"; }

[ "$(id -u)" -eq 0 ] || { echo "Ejecuta con sudo."; exit 1; }

# ── Comprobaciones previas ────────────────────────────────────────────────
# Si el servidor ya sirve otro sitio, `server_name _` lo convertiría en el
# servidor por defecto y le robaría el tráfico. Con otros sitios activos se
# exige un dominio explícito en vez de adivinar.
OTROS_SITIOS=$(ls /etc/nginx/sites-enabled/ 2>/dev/null | grep -v "^default$" | grep -v "^$SERVICE$" || true)
if [ -n "$OTROS_SITIOS" ] && [ "$APP_DOMAIN" = "_" ]; then
  echo "Este servidor ya sirve otros sitios en nginx:"
  echo "$OTROS_SITIOS" | sed 's/^/    /'
  echo
  echo "Usar un comodín los dejaría sin tráfico. Vuelve a correr indicando el"
  echo "nombre de host de la mesa, por ejemplo:"
  echo "    sudo APP_DOMAIN=mesa.rbcol.co bash setup-server.sh"
  exit 1
fi

# El puerto de la API tiene que estar libre, o systemd arrancará en bucle.
if ss -lntp 2>/dev/null | grep -q ":$APP_PORT "; then
  QUIEN=$(ss -lntp 2>/dev/null | grep ":$APP_PORT " | head -1)
  if ! systemctl is-active --quiet "$SERVICE"; then
    echo "El puerto $APP_PORT ya está ocupado por otro proceso:"
    echo "    $QUIEN"
    echo "Elige otro con:  sudo APP_PORT=3002 bash setup-server.sh"
    exit 1
  fi
fi

say "Instalando dependencias del sistema"
apt-get update -qq
apt-get install -y -qq curl git nginx postgresql postgresql-contrib openssl
if ! command -v node >/dev/null || [ "$(node -v | cut -c2-3)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
  apt-get install -y -qq nodejs
fi
ok "node $(node -v) · nginx · postgresql"

systemctl enable --now postgresql nginx >/dev/null 2>&1

# ── Base de datos ─────────────────────────────────────────────────────────
say "Preparando la base de datos"
DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'")
if [ "$DB_EXISTS" = "1" ]; then
  ok "la base «$DB_NAME» ya existe — no se toca"
  KEEP_DB=1
else
  DB_PASS="$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)"
  sudo -u postgres psql -qc "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
  sudo -u postgres psql -qc "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
  ok "base «$DB_NAME» creada con contraseña generada al azar"
  KEEP_DB=0
fi

# ── Código ────────────────────────────────────────────────────────────────
say "Descargando el código"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" remote set-url origin "$REPO"
  git -C "$APP_DIR" fetch --quiet origin "$BRANCH"
  git -C "$APP_DIR" reset --quiet --hard "origin/$BRANCH"
else
  mkdir -p "$(dirname "$APP_DIR")"
  git clone --quiet --branch "$BRANCH" "$REPO" "$APP_DIR"
fi
ok "$APP_DIR en $(git -C "$APP_DIR" rev-parse --short HEAD)"

# ── Configuración del backend ─────────────────────────────────────────────
ENV_FILE="$APP_DIR/autotrack-backend/.env"
say "Configurando el backend"
if [ -f "$ENV_FILE" ]; then
  ok ".env existente — se conserva (edítalo a mano si cambia algo)"
else
  [ "$KEEP_DB" = "1" ] && {
    echo "  La base ya existía pero no hay .env: no puedo adivinar su contraseña."
    echo "  Crea $ENV_FILE a mano con DATABASE_URL y vuelve a correr el script."
    exit 1
  }
  PUBLIC_URL="http://${APP_DOMAIN}"
  [ "$APP_DOMAIN" = "_" ] && PUBLIC_URL="http://$(hostname -I | awk '{print $1}')"
  cat > "$ENV_FILE" <<ENVEOF
# Generado por scripts/setup-server.sh — contiene secretos, no versionar.
DATABASE_URL=postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME
JWT_SECRET=$(openssl rand -hex 32)
PORT=$APP_PORT
NODE_ENV=production

# Identidad de la firma
AUTH_ALLOWED_DOMAIN=$AUTH_ALLOWED_DOMAIN
FRONTEND_URL=$PUBLIC_URL
FRONTEND_URL_PUBLIC=$PUBLIC_URL

# Login con Microsoft 365 (Entra ID). Ninguno de los dos es secreto.
MS_CLIENT_ID=$MS_CLIENT_ID
MS_TENANT_ID=$MS_TENANT_ID

# Correo saliente por SMTP de Microsoft 365 — opcional, ver .env.example
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
REPORT_FROM_EMAIL=
ENVEOF
  chmod 600 "$ENV_FILE"
  ok ".env creado con secretos generados (permisos 600)"
fi

cd "$APP_DIR/autotrack-backend"
npm install --omit=dev --silent
ok "dependencias del backend"

say "Aplicando el esquema de la base"
# schema.full.sql es idempotente (CREATE TABLE IF NOT EXISTS): seguro de
# repetir sobre una base que ya tiene datos.
DB_URL=$(sed -n 's/^DATABASE_URL=//p' "$ENV_FILE")
psql "$DB_URL" -q -f "$APP_DIR/autotrack-backend/db/schema.full.sql"
ok "esquema al día"

# ── Frontend ──────────────────────────────────────────────────────────────
say "Compilando el frontend"
cd "$APP_DIR/autotrack-frontend"
npm install --silent
VITE_API_URL=/api npx vite build --base=/ >/dev/null
mkdir -p "$WEB_ROOT"
rm -rf "${WEB_ROOT:?}/"*
cp -r dist/* "$WEB_ROOT/"
ok "publicado en $WEB_ROOT"

# ── Nginx ─────────────────────────────────────────────────────────────────
say "Configurando nginx"
cat > "/etc/nginx/sites-available/$SERVICE" <<NGINXEOF
server {
    listen 80;
    server_name $APP_DOMAIN;

    root $WEB_ROOT;
    index index.html;

    # SPA: cualquier ruta desconocida la resuelve el enrutador del cliente.
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api {
        proxy_pass            http://127.0.0.1:$APP_PORT;
        proxy_http_version    1.1;
        proxy_read_timeout    600s;
        proxy_send_timeout    600s;
        proxy_set_header      Host \$host;
        proxy_set_header      X-Real-IP \$remote_addr;
        proxy_set_header      X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header      X-Forwarded-Proto \$scheme;
    }

    # Los adjuntos pueden pesar hasta 10 MB (límite de multer en el backend).
    client_max_body_size 12M;
}
NGINXEOF
ln -sf "/etc/nginx/sites-available/$SERVICE" "/etc/nginx/sites-enabled/$SERVICE"
# El sitio por defecto solo estorba si la mesa es el comodín; con un dominio
# propio pueden convivir.
[ "$APP_DOMAIN" = "_" ] && rm -f /etc/nginx/sites-enabled/default
nginx -t >/dev/null && systemctl reload nginx
ok "nginx sirviendo $APP_DOMAIN"

# ── Servicio ──────────────────────────────────────────────────────────────
say "Registrando el servicio"
cat > "/etc/systemd/system/$SERVICE.service" <<SVCEOF
[Unit]
Description=Mesa de Servicio — API (Russell Bedford Barranquilla)
After=network.target postgresql.service

[Service]
Type=simple
WorkingDirectory=$APP_DIR/autotrack-backend
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/node src/index.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$SERVICE

[Install]
WantedBy=multi-user.target
SVCEOF
systemctl daemon-reload
systemctl enable --now "$SERVICE" >/dev/null
sleep 2
systemctl restart "$SERVICE"
ok "servicio $SERVICE activo"

# ── Comprobación ──────────────────────────────────────────────────────────
say "Comprobando"
sleep 2
if curl -fsS "http://127.0.0.1:$APP_PORT/api/health" >/dev/null; then
  ok "la API responde"
  curl -fsS "http://127.0.0.1:$APP_PORT/api/health"; echo
else
  echo "  La API no respondió. Revisa:  journalctl -u $SERVICE -n 40 --no-pager"
  exit 1
fi

cat <<FIN

╔════════════════════════════════════════════════════════════╗
  Instalación completada.

  App        http://${APP_DOMAIN/_/$(hostname -I | awk '{print $1}')}
  Config     $ENV_FILE
  Logs       journalctl -u $SERVICE -f
  Actualizar bash $APP_DIR/scripts/deploy.sh

  Falta para poder entrar: MS_CLIENT_ID y MS_TENANT_ID en el .env
  y reiniciar con  systemctl restart $SERVICE
╚════════════════════════════════════════════════════════════╝

FIN
