// Debe fijarse antes de cargar pg/dotenv: si el proceso no corre en UTC, pg
// interpreta los TIMESTAMP (sin zona) usando la zona horaria local del sistema,
// y eso desfasa fecha_reunion (y cualquier otra hora "de pared") al convertir a UTC.
process.env.TZ = 'UTC';

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const rateLimit = require('express-rate-limit');
const path    = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Trust nginx proxy so rate-limit sees real client IPs
app.set('trust proxy', 1);

// Security headers — API pura, sin contenido embebible ni recursos externos
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'none'"],
    },
  },
}));

// Global rate limiter: 300 req/min per IP
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones. Intenta de nuevo en un momento.' },
}));

// Orígenes permitidos. CORS_ORIGINS acepta una lista separada por comas para
// no tener que tocar el código al cambiar de dominio o agregar integraciones.
//
// Se normaliza a origen (esquema + host + puerto): cuando la aplicación vive
// bajo una ruta —https://host/mesa— esa URL incluye el path, pero el navegador
// manda `Origin: https://host` y la comparación de CORS nunca casaría.
const soloOrigen = (u) => {
  try { return new URL(u).origin; } catch { return u; }
};
const corsOrigins = [...new Set([
  process.env.FRONTEND_URL || 'http://localhost:5173',
  ...(process.env.CORS_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean),
].map(soloOrigen))];
app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json({ limit: '1mb' }));

// Serve uploaded files (solicitudes attachments) — requiere sesión válida.
// Usa un middleware aparte porque los links de descarga (<a href>) llevan el
// token por query string; el resto de la API solo acepta el header Authorization.
const authDownload = require('./middleware/authDownload');
app.use('/api/uploads', authDownload, express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth',         require('./routes/auth'));
app.use('/api/projects',     require('./routes/projects'));
app.use('/api/analytics-report', require('./routes/analyticsReport'));
app.use('/api/users',        require('./routes/users'));
app.use('/api/solicitudes',  require('./routes/solicitudes'));
app.use('/api/notifications', require('./routes/notifications'));

// Health check. Expone la configuración efectiva —sin secretos— para poder
// diagnosticar un despliegue sin entrar por SSH: qué dominio acepta el login,
// a qué URL apuntan los correos y qué orígenes permite CORS.
app.get('/api/health', (_, res) => res.json({
  status: 'ok',
  time: new Date().toISOString(),
  config: {
    allowedDomain:  (process.env.AUTH_ALLOWED_DOMAIN || 'rbcol.co').replace(/^@/, ''),
    publicUrl:      process.env.FRONTEND_URL_PUBLIC || null,
    corsOrigins,
    microsoftLogin: Boolean(process.env.MS_CLIENT_ID && process.env.MS_TENANT_ID),
    correoSaliente: require('./utils/mailer').mailerReady(),
    env:            process.env.NODE_ENV || 'development',
  },
}));

app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`Mesa de Servicio — API en http://localhost:${PORT}`);
  console.log(`  dominio permitido : @${(process.env.AUTH_ALLOWED_DOMAIN || 'rbcol.co').replace(/^@/, '')}`);
  console.log(`  URL pública       : ${process.env.FRONTEND_URL_PUBLIC || '(sin definir — los correos enlazarán a ' + corsOrigins[0] + ')'}`);
  console.log(`  orígenes CORS     : ${corsOrigins.join(', ')}`);
  console.log(`  login Microsoft   : ${process.env.MS_CLIENT_ID && process.env.MS_TENANT_ID ? 'configurado' : 'SIN CONFIGURAR — nadie podrá entrar'}`);
  console.log(`  correo saliente   : ${process.env.SMTP_USER ? process.env.SMTP_HOST || 'smtp.office365.com' : 'sin configurar'}`);
  if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_URL_PUBLIC) {
    console.warn('  ⚠ Falta FRONTEND_URL_PUBLIC: los enlaces de los correos de notificación no apuntarán a la app.');
  }
});
