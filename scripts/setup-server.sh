#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
#  Mesa de Servicio — Russell Bedford Barranquilla
#  Instalación en un servidor Ubuntu 22.04 / 24.04 limpio.
#
#  Uso:
#      sudo APP_DOMAIN=mesa.rbcol.co bash setup-server.sh
#
#  Si el puerto 80 ya lo ocupa otra aplicación, la mesa se cuelga de una ruta
#  dentro de ese mismo sitio — la URL queda sin puerto:
#      sudo BASE_PATH=/mesa PUBLIC_URL=https://host.ts.net/mesa bash setup-server.sh
#
#  ADMIN_EMAIL deja esa cuenta como coordinador desde el primer arranque.
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
# Puerto en el que escucha nginx. Se cambia cuando el 80 ya está ocupado por
# otra aplicación del servidor y la mesa se publica aparte.
HTTP_PORT="${HTTP_PORT:-80}"

# Ruta bajo la que vive la mesa cuando comparte servidor con otra aplicación.
# Vacío = la mesa es el sitio completo. Con "/mesa", nginx la cuelga de ahí y
# el puerto interno de la API queda invisible, igual que en analitica-puc.
BASE_PATH="${BASE_PATH:-}"
BASE_PATH="${BASE_PATH%/}"
# Sitio existente al que engancharse. Vacío = se detecta el comodín del puerto.
ATTACH_SITE="${ATTACH_SITE:-}"

# `_` acepta cualquier nombre de host: sirve para entrar por IP mientras no
# haya dominio. Con APP_DOMAIN definido, nginx responde solo a ese nombre.
APP_DOMAIN="${APP_DOMAIN:-_}"
AUTH_ALLOWED_DOMAIN="${AUTH_ALLOWED_DOMAIN:-rbcol.co}"
# Correo del primer coordinador de la mesa. Sin esto, toda cuenta que entra por
# primera vez queda como auditor solicitante y nadie podría promover a nadie.
ADMIN_EMAIL="${ADMIN_EMAIL:-}"
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
# Solo hay conflicto si otro sitio ya es el comodín del MISMO puerto: dos
# comodines en el mismo listen y nginx se queda con el primero.
CHOQUE=""
for f in /etc/nginx/sites-enabled/*; do
  [ -e "$f" ] || continue
  case "$f" in */default|*/"$SERVICE") continue;; esac
  # Se comparan los puertos declarados en las líneas `listen`, no la cadena
  # cruda: así `listen 8080` no cuenta como el puerto 80.
  PUERTOS=$(grep -hE "^[[:space:]]*listen[[:space:]]" "$f" 2>/dev/null | grep -oE "[0-9]+" || true)
  if echo "$PUERTOS" | grep -qx "$HTTP_PORT"      && grep -qE "^[[:space:]]*server_name[[:space:]]+_[[:space:]]*;" "$f"; then
    CHOQUE="$CHOQUE $(basename "$f")"
  fi
done
if [ -n "$CHOQUE" ] && [ "$APP_DOMAIN" = "_" ] && [ -z "$BASE_PATH" ]; then
  echo "El puerto $HTTP_PORT ya lo ocupa como comodín:$CHOQUE"
  echo
  echo "Cuélgala de una ruta dentro de ese mismo sitio (URL sin puerto):"
  echo "    sudo BASE_PATH=/mesa bash setup-server.sh"
  echo "o dale un nombre de host propio:"
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

if [ -n "$BASE_PATH" ] && [ -z "$ATTACH_SITE" ]; then
  # Primero el comodín del puerto; si no hay, el único sitio activo. Solo se
  # pregunta cuando hay varios y no está claro a cuál engancharse.
  ATTACH_SITE=$(echo "$CHOQUE" | awk '{print $1}')
  if [ -z "$ATTACH_SITE" ]; then
    ACTIVOS=$(ls /etc/nginx/sites-enabled/ 2>/dev/null | grep -v "^$SERVICE$" || true)
    CUANTOS=$(echo "$ACTIVOS" | grep -c . || true)
    if [ "$CUANTOS" = "1" ]; then
      ATTACH_SITE="$ACTIVOS"
    else
      echo "No sé a qué sitio de nginx enganchar la mesa."
      [ -n "$ACTIVOS" ] && { echo "Sitios activos:"; echo "$ACTIVOS" | sed 's/^/    /'; }
      echo
      echo "Elige uno:  sudo ATTACH_SITE=<nombre> BASE_PATH=$BASE_PATH bash setup-server.sh"
      exit 1
    fi
  fi
  ok "la mesa se colgará de «$ATTACH_SITE» bajo $BASE_PATH/"
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
  # PUBLIC_URL es la dirección por la que la gente entra de verdad: detrás de
  # Tailscale o de otro proxy no coincide con la IP ni el puerto locales, así
  # que si se pasa explícitamente manda esa.
  if [ -z "${PUBLIC_URL:-}" ]; then
    if [ "$APP_DOMAIN" = "_" ]; then
      PUBLIC_URL="http://$(hostname -I | awk '{print $1}')"
    else
      PUBLIC_URL="http://$APP_DOMAIN"
    fi
    [ "$HTTP_PORT" != "80" ] && PUBLIC_URL="$PUBLIC_URL:$HTTP_PORT"
    PUBLIC_URL="$PUBLIC_URL$BASE_PATH"
  fi
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

# Correo saliente — ver .env.example. Con verificación en dos pasos hay que
# usar Graph: permiso de aplicación Mail.Send y un secreto de cliente.
MAIL_FROM=$ADMIN_EMAIL
MS_CLIENT_SECRET=
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

if [ -n "$ADMIN_EMAIL" ]; then
  # Se deja la cuenta creada con rol de coordinador antes de que entre: al
  # iniciar sesión con Microsoft se reconoce por el correo y conserva el rol.
  # La contraseña es aleatoria y no se usa nunca — el acceso es solo por Entra.
  INICIALES=$(echo "$ADMIN_EMAIL" | cut -d@ -f1 | tr -d '.' | cut -c1-2 | tr '[:lower:]' '[:upper:]')
  psql "$DB_URL" -q <<SQLEOF
INSERT INTO users (name, email, password, initials, color_index, role)
VALUES ('Coordinador', '$ADMIN_EMAIL', 'entra-id-$(openssl rand -hex 12)', '$INICIALES', 0, 'admin')
ON CONFLICT (email) DO UPDATE SET role = 'admin';
SQLEOF
  ok "«$ADMIN_EMAIL» queda como coordinador de la mesa"
fi

# ── Frontend ──────────────────────────────────────────────────────────────
say "Compilando el frontend"
cd "$APP_DIR/autotrack-frontend"
npm install --silent
# Con BASE_PATH, los assets y las llamadas a la API tienen que llevar el
# prefijo: si no, el navegador los pediría en la raíz y caerían en la otra
# aplicación del servidor.
rm -rf dist
VITE_BASE="${BASE_PATH}/" VITE_API_URL="${BASE_PATH}/api" npx vite build > /tmp/mesa-build.log 2>&1 || {
  echo "  Falló la compilación del frontend:"; tail -20 /tmp/mesa-build.log; exit 1;
}

# Publicar un build con la base equivocada deja la página en blanco sin ningún
# error visible, así que se comprueba antes de copiar nada.
ESPERADO="${BASE_PATH}/assets/"
if ! grep -q "src=\"$ESPERADO" dist/index.html; then
  echo "  El build no quedó con la ruta base correcta."
  echo "  Esperaba que index.html pidiera $ESPERADO y pide:"
  grep -oE 'src="[^"]+"' dist/index.html | sed 's/^/      /'
  exit 1
fi
ok "compilado para $ESPERADO"

mkdir -p "$WEB_ROOT"
rm -rf "${WEB_ROOT:?}/"*
cp -r dist/* "$WEB_ROOT/"
ok "publicado en $WEB_ROOT"

# ── Nginx ─────────────────────────────────────────────────────────────────
say "Configurando nginx"
if [ -n "$BASE_PATH" ]; then
  # ── Modo ruta ───────────────────────────────────────────────────────────
  # No se crea un sitio nuevo: se añaden dos `location` al que ya existe, que
  # es como analitica-puc enruta su propio /api/. El bloque vive en un archivo
  # aparte y solo se inserta una línea `include`, para poder revertirlo.
  SNIPPET="/etc/nginx/snippets/$SERVICE.conf"
  mkdir -p /etc/nginx/snippets
  cat > "$SNIPPET" <<SNIPEOF
# Mesa de Servicio bajo $BASE_PATH — generado por scripts/setup-server.sh.
# Quitar: borrar la línea 'include $SNIPPET;' del sitio y recargar nginx.

# La API primero: es más específica que la ruta del frontend y nginx elige
# el prefijo más largo. El slash final en ambos lados quita el prefijo
# (/mesa/api/users -> 127.0.0.1:$APP_PORT/api/users).
location $BASE_PATH/api/ {
    proxy_pass            http://127.0.0.1:$APP_PORT/api/;
    proxy_http_version    1.1;
    proxy_read_timeout    600s;
    proxy_set_header      Host \$host;
    proxy_set_header      X-Real-IP \$remote_addr;
    proxy_set_header      X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header      X-Forwarded-Proto \$scheme;
    client_max_body_size  12M;
}

# Los assets llevan un hash del contenido en el nombre, así que nunca cambian
# sin cambiar de nombre: se pueden guardar para siempre sin volver a preguntar.
location $BASE_PATH/assets/ {
    alias $WEB_ROOT/assets/;
    add_header Cache-Control "public, max-age=31536000, immutable";
}

# index.html es justo lo contrario: nombre fijo y contenido que cambia en cada
# despliegue, porque es quien nombra los assets con hash. Si el navegador se
# queda con una copia vieja pide archivos que el despliegue ya borró, y la
# página carga sin estilos hasta que alguien recarga a mano. No se cachea.
location = $BASE_PATH/index.html {
    alias $WEB_ROOT/index.html;
    add_header Cache-Control "no-cache, must-revalidate";
}

# El frontend: 'alias' en vez de 'root' porque la ruta del disco no repite
# el prefijo de la URL. El try_files termina en el index para que el
# enrutador del navegador resuelva las rutas internas.
location $BASE_PATH/ {
    alias $WEB_ROOT/;
    try_files \$uri \$uri/ $BASE_PATH/index.html;
}

# Sin la barra final el navegador pediría $BASE_PATH y no entraría.
location = $BASE_PATH {
    return 301 $BASE_PATH/;
}
SNIPEOF

  SITIO="/etc/nginx/sites-available/$ATTACH_SITE"
  [ -f "$SITIO" ] || SITIO="/etc/nginx/sites-enabled/$ATTACH_SITE"
  [ -f "$SITIO" ] || { echo "No encuentro el sitio $ATTACH_SITE"; exit 1; }

  if grep -q "include $SNIPPET;" "$SITIO"; then
    ok "el sitio $ATTACH_SITE ya incluye la mesa"
  else
    cp "$SITIO" "$SITIO.antes-de-mesa-servicio"
    # Se inserta dentro del primer bloque server, justo tras su apertura.
    awk -v inc="    include $SNIPPET;" '
      !hecho && /^[[:space:]]*server[[:space:]]*\{/ { print; print inc; hecho=1; next }
      { print }
    ' "$SITIO.antes-de-mesa-servicio" > "$SITIO"

    if nginx -t >/dev/null 2>&1; then
      ok "mesa añadida a $ATTACH_SITE (respaldo en $SITIO.antes-de-mesa-servicio)"
    else
      mv "$SITIO.antes-de-mesa-servicio" "$SITIO"
      echo "  La configuración de nginx quedó inválida; se restauró el original."
      nginx -t
      exit 1
    fi
  fi
  systemctl reload nginx
  ok "nginx sirviendo la mesa en $BASE_PATH/"
else
  # ── Modo sitio completo ─────────────────────────────────────────────────
  cat > "/etc/nginx/sites-available/$SERVICE" <<NGINXEOF
server {
    listen $HTTP_PORT;
    server_name $APP_DOMAIN;

    root $WEB_ROOT;
    index index.html;

    location /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location = /index.html {
        add_header Cache-Control "no-cache, must-revalidate";
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api {
        proxy_pass            http://127.0.0.1:$APP_PORT;
        proxy_http_version    1.1;
        proxy_read_timeout    600s;
        proxy_set_header      Host \$host;
        proxy_set_header      X-Real-IP \$remote_addr;
        proxy_set_header      X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header      X-Forwarded-Proto \$scheme;
    }

    client_max_body_size 12M;
}
NGINXEOF
  ln -sf "/etc/nginx/sites-available/$SERVICE" "/etc/nginx/sites-enabled/$SERVICE"
  [ "$APP_DOMAIN" = "_" ] && [ "$HTTP_PORT" = "80" ] && rm -f /etc/nginx/sites-enabled/default
  nginx -t >/dev/null && systemctl reload nginx
  ok "nginx sirviendo $APP_DOMAIN"
fi

# ── Configuración del despliegue ──────────────────────────────────────────
# deploy.sh tiene que recompilar exactamente igual que la instalación: si no
# conoce BASE_PATH, genera un build con base «/» y deja la página en blanco.
CONF="/etc/default/$SERVICE"
cat > "$CONF" <<CONFEOF
# Generado por scripts/setup-server.sh — lo lee scripts/deploy.sh.
APP_DIR=$APP_DIR
WEB_ROOT=$WEB_ROOT
SERVICE=$SERVICE
BRANCH=$BRANCH
APP_PORT=$APP_PORT
BASE_PATH=$BASE_PATH
CONFEOF
ok "configuración guardada en $CONF"

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

  App        $(sed -n "s/^FRONTEND_URL_PUBLIC=//p" "$ENV_FILE")
  Config     $ENV_FILE
  Logs       journalctl -u $SERVICE -f
  Actualizar bash $APP_DIR/scripts/deploy.sh

$(if [ -z "$MS_CLIENT_ID" ] || [ -z "$MS_TENANT_ID" ]; then
    echo "  Falta para poder entrar: MS_CLIENT_ID y MS_TENANT_ID en el .env"
    echo "  y reiniciar con  systemctl restart $SERVICE"
  else
    echo "  Registra esta URL como URI de redirección (plataforma SPA) en el"
    echo "  registro de la aplicación de Entra ID, o el login dará AADSTS50011."
  fi)
╚════════════════════════════════════════════════════════════╝

FIN
