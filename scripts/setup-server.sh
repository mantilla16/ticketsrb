#!/bin/bash
# ═══════════════════════════════════════════════════════
#  AutoTrack — Setup para DigitalOcean Ubuntu 22.04
#  IP: 64.23.209.179
#  Uso: bash setup-server.sh
# ═══════════════════════════════════════════════════════
set -e

SERVER_IP="64.23.209.179"
APP_DIR="/var/www/autotrack"
REPO="https://github.com/bleinermorales-collab/SEGUIMIENTO-PROYECTO.git"
DB_USER="autotrack"
DB_PASS="At2026Americana!"
DB_NAME="autotrack"
JWT_SECRET="$(openssl rand -hex 32)"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   AutoTrack — Instalación servidor   ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── 1. Sistema ──
echo "▶ Actualizando sistema..."
apt-get update -qq && apt-get upgrade -y -qq

# ── 2. Node.js 20 ──
echo "▶ Instalando Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
apt-get install -y nodejs -qq

# ── 3. PostgreSQL ──
echo "▶ Instalando PostgreSQL..."
apt-get install -y postgresql postgresql-contrib -qq
systemctl enable postgresql
systemctl start postgresql

# ── 4. Nginx ──
echo "▶ Instalando Nginx..."
apt-get install -y nginx -qq
systemctl enable nginx

# ── 5. PM2 ──
echo "▶ Instalando PM2..."
npm install -g pm2 -q

# ── 6. Base de datos ──
echo "▶ Configurando base de datos PostgreSQL..."
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null || echo "   (usuario ya existe)"
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || echo "   (base de datos ya existe)"

# ── 7. Clonar repo ──
echo "▶ Clonando repositorio..."
mkdir -p $APP_DIR
if [ -d "$APP_DIR/.git" ]; then
  cd $APP_DIR && git pull
else
  git clone $REPO $APP_DIR
fi

# ── 8. Backend ──
echo "▶ Instalando dependencias del backend..."
cd $APP_DIR/autotrack-backend
npm install --omit=dev -q

echo "▶ Creando .env del backend..."
cat > $APP_DIR/autotrack-backend/.env << ENVEOF
DATABASE_URL=postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME
JWT_SECRET=$JWT_SECRET
PORT=3001
NODE_ENV=production
ENVEOF

echo "▶ Ejecutando schema SQL..."
sudo -u postgres psql -d $DB_NAME -f $APP_DIR/autotrack-backend/db/schema.sql

echo "▶ Ejecutando seed de proyectos..."
cd $APP_DIR/autotrack-backend && node scripts/seed.js

# ── 9. Frontend ──
echo "▶ Instalando dependencias del frontend..."
cd $APP_DIR/autotrack-frontend
npm install -q

echo "▶ Compilando frontend..."
VITE_API_URL=/api npm run build

echo "▶ Copiando build a nginx..."
mkdir -p /var/www/html/autotrack
cp -r $APP_DIR/autotrack-frontend/dist/* /var/www/html/autotrack/

# ── 10. Nginx config ──
echo "▶ Configurando Nginx..."
cat > /etc/nginx/sites-available/autotrack << 'NGINXEOF'
server {
    listen 80;
    server_name 64.23.209.179;

    # Frontend (React SPA)
    root /var/www/html/autotrack;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API — proxy a Node.js
    location /api {
        proxy_pass         http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/autotrack /etc/nginx/sites-enabled/autotrack
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ── 11. PM2 ──
echo "▶ Iniciando backend con PM2..."
cd $APP_DIR/autotrack-backend
pm2 delete autotrack-api 2>/dev/null || true
pm2 start src/index.js --name autotrack-api
pm2 startup systemd -u root --hp /root | tail -1 | bash
pm2 save

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║            ✅  LISTO                     ║"
echo "║                                          ║"
echo "║  App:  http://64.23.209.179              ║"
echo "║  API:  http://64.23.209.179/api          ║"
echo "║                                          ║"
echo "║  Usuario:   bleinermorales@americana...  ║"
echo "║  Contraseña del equipo: americana2026    ║"
echo "╚══════════════════════════════════════════╝"
echo ""
