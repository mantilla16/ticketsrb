#!/bin/bash
# ═══════════════════════════════════════════════════════
#  AutoTrack — Actualizar servidor desde GitHub
#  Uso: bash update-server.sh
# ═══════════════════════════════════════════════════════
set -e

APP_DIR="/var/www/autotrack"

echo ""
echo "▶ Descargando cambios del repositorio..."
cd $APP_DIR
git pull origin main

echo "▶ Actualizando dependencias del backend..."
cd $APP_DIR/autotrack-backend
npm install --omit=dev -q

echo "▶ Recompilando frontend..."
cd $APP_DIR/autotrack-frontend
npm install -q
VITE_API_URL=/api npm run build

echo "▶ Copiando build a nginx..."
cp -r $APP_DIR/autotrack-frontend/dist/* /var/www/html/autotrack/

echo "▶ Reiniciando backend..."
systemctl restart autotrack

echo ""
echo "✅  Actualización completada — http://64.23.209.179"
echo ""
