#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
#  Añade las reglas de caché al nginx ya instalado.
#
#  Uso:  sudo bash /var/www/mesa-servicio/scripts/arreglar-cache-nginx.sh
#
#  Por qué hace falta
#  ──────────────────
#  El frontend se compila con los assets nombrados por el hash de su
#  contenido (index-BzL0iSnn.js). Eso los hace cacheables para siempre, pero
#  convierte a index.html en el eslabón frágil: tiene nombre fijo, cambia en
#  cada despliegue y es quien nombra a los demás.
#
#  Sin una cabecera que lo prohíba, el navegador se queda con el index.html
#  anterior, que pide unos assets que el despliegue ya borró. Resultado: la
#  primera visita tras cada despliegue carga la página sin estilos, y solo se
#  arregla recargando a mano.
#
#  Este script deja index.html sin cachear y los assets cacheados un año.
#  Es idempotente: correrlo dos veces no cambia nada la segunda.
#
#  Las instalaciones nuevas ya lo traen (scripts/setup-server.sh); esto es
#  para los servidores instalados antes de ese cambio.
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

CONF="${CONF:-/etc/default/mesa-servicio}"
[ -f "$CONF" ] || { echo "No encuentro $CONF. ¿Está instalada la mesa aquí?"; exit 1; }
# shellcheck source=/dev/null
. "$CONF"

SERVICE="${SERVICE:-mesa-servicio}"
WEB_ROOT="${WEB_ROOT:-/var/www/html/mesa-servicio}"
BASE_PATH="${BASE_PATH:-}"
BASE_PATH="${BASE_PATH%/}"
SNIPPET="${SNIPPET:-/etc/nginx/snippets/$SERVICE.conf}"

[ -f "$SNIPPET" ] || { echo "No encuentro $SNIPPET."; exit 1; }

if grep -q 'max-age=31536000' "$SNIPPET"; then
  echo "Ya estaba puesto: no hay nada que cambiar."
  exit 0
fi

# Copia de seguridad fechada, para poder volver atrás pase lo que pase.
RESPALDO="$SNIPPET.antes-de-cache.$(date +%Y%m%d%H%M%S)"
cp "$SNIPPET" "$RESPALDO"
echo "Respaldo en $RESPALDO"

# Se añade al final del archivo. El orden de los bloques no importa: nginx
# elige por prefijo más largo —/assets/ gana sobre /— y un '=' exacto gana
# sobre cualquier prefijo. Añadir al final evita tener que adivinar dónde
# cortar y no puede partir un comentario por la mitad.
cat >> "$SNIPPET" <<NGINXEOF

# ── Caché (añadido por scripts/arreglar-cache-nginx.sh) ──────────────────
# Los assets llevan un hash del contenido en el nombre: nunca cambian sin
# cambiar de nombre, así que se pueden guardar para siempre.
location $BASE_PATH/assets/ {
    alias $WEB_ROOT/assets/;
    add_header Cache-Control "public, max-age=31536000, immutable";
}

# index.html tiene nombre fijo y cambia en cada despliegue, porque es quien
# nombra los assets con hash. Si el navegador guarda una copia vieja acaba
# pidiendo archivos que el despliegue ya borró, y la página carga sin
# estilos hasta que alguien recarga a mano.
location = $BASE_PATH/index.html {
    alias $WEB_ROOT/index.html;
    add_header Cache-Control "no-cache, must-revalidate";
}
NGINXEOF

if nginx -t; then
  systemctl reload nginx
  echo
  echo "Listo. index.html ya no se cachea y los assets se cachean un año."
  echo "La próxima visita tras un despliegue cargará con estilos a la primera."
else
  echo
  echo "nginx rechazó la configuración: se deshace el cambio."
  cp "$RESPALDO" "$SNIPPET"
  nginx -t && systemctl reload nginx
  echo "Configuración restaurada. No se ha cambiado nada."
  exit 1
fi
