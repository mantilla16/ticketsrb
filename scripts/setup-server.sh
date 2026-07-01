#!/bin/bash
# ═══════════════════════════════════════════════════════
#  AutoTrack — Setup para DigitalOcean Ubuntu 22.04
#  IP: 64.23.209.179
#  Uso: bash setup-server.sh
# ═══════════════════════════════════════════════════════
set -e

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

# ── 5. Base de datos ──
echo "▶ Configurando base de datos PostgreSQL..."
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null || echo "   (usuario ya existe)"
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || echo "   (base de datos ya existe)"

# ── 6. Clonar repo ──
echo "▶ Clonando repositorio..."
mkdir -p $APP_DIR
if [ -d "$APP_DIR/.git" ]; then
  cd $APP_DIR && git pull
else
  git clone $REPO $APP_DIR
fi

# ── 7. Backend ──
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

# ── 8. Frontend ──
echo "▶ Instalando dependencias del frontend..."
cd $APP_DIR/autotrack-frontend
npm install -q

echo "▶ Compilando frontend..."
VITE_API_URL=/api npm run build

echo "▶ Copiando build a nginx..."
mkdir -p /var/www/html/autotrack
cp -r $APP_DIR/autotrack-frontend/dist/* /var/www/html/autotrack/

# ── 9. Nginx config ──
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

    # Backend API — proxy a Node.js :3001
    location /api {
        proxy_pass              http://127.0.0.1:3001;
        proxy_http_version      1.1;
        proxy_connect_timeout   1200s;
        proxy_send_timeout      1200s;
        proxy_read_timeout      1200s;
        send_timeout            1200s;
        proxy_set_header        Host $host;
        proxy_set_header        X-Real-IP $remote_addr;
        proxy_set_header        X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header        X-Forwarded-Proto $scheme;
        proxy_set_header        Upgrade $http_upgrade;
        proxy_set_header        Connection 'upgrade';
        proxy_cache_bypass      $http_upgrade;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/autotrack /etc/nginx/sites-enabled/autotrack
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ── 10. Servicio systemd ──
echo "▶ Creando servicio systemd para el backend..."
cat > /etc/systemd/system/autotrack.service << SVCEOF
[Unit]
Description=AutoTrack API (Node.js)
After=network.target postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=$APP_DIR/autotrack-backend
ExecStart=/usr/bin/node src/index.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=autotrack

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable autotrack
systemctl start autotrack

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║            ✅  LISTO                     ║"
echo "║                                          ║"
echo "║  App:  http://64.23.209.179              ║"
echo "║  API:  http://64.23.209.179/api          ║"
echo "║                                          ║"
echo "║  Contraseña del equipo: americana2026    ║"
echo "╚══════════════════════════════════════════╝"
echo ""
