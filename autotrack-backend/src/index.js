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

// Security headers
app.use(helmet());

// Global rate limiter: 300 req/min per IP
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones. Intenta de nuevo en un momento.' },
}));

app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'https://n8n.americana.edu.co',
    'https://ambarc.americana.edu.co',
  ],
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

// Serve uploaded files (solicitudes attachments) — requiere sesión válida
const authMw = require('./middleware/auth');
app.use('/api/uploads', authMw, express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth',         require('./routes/auth'));
app.use('/api/projects',     require('./routes/projects'));
app.use('/api/users',        require('./routes/users'));
app.use('/api/solicitudes',  require('./routes/solicitudes'));
app.use('/api/notifications', require('./routes/notifications'));

app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`AutoTrack API corriendo en http://localhost:${PORT}`);
});
