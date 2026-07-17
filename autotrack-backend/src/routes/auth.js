const router = require('express').Router();
const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const auth = require('../middleware/auth');

// Red de seguridad por IP — amplia, solo frena ataques masivos desde una misma red
const ipLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones desde esta red. Intenta de nuevo en unos minutos.' },
});

const LOCK_MINUTES = 30;
const ALLOWED_DOMAIN = '@americana.edu.co';

function genInitials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');
}

function makeToken(user) {
  return jwt.sign(
    {
      id:         user.id,
      name:       user.name,
      email:      user.email,
      initials:   user.initials,
      colorIndex: user.color_index,
      role:       user.role || 'user',
    },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );
}

function fmtUser(row) {
  return {
    id:         row.id,
    name:       row.name,
    email:      row.email,
    initials:   row.initials,
    colorIndex: row.color_index,
    role:       row.role || 'user',
  };
}

// GET /api/auth/me
router.get('/me', auth, (req, res) => res.json(req.user));

// GET /api/auth/config — expone el client ID de Google al frontend
router.get('/config', (_req, res) => {
  res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || null });
});

// POST /api/auth/google — login con Google (cuentas @americana.edu.co)
router.post('/google', ipLimiter, async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'Credencial de Google requerida' });
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(503).json({ error: 'Login con Google no está configurado en el servidor' });
  }
  try {
    // Google valida la firma del id_token en este endpoint
    const resp = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!resp.ok) return res.status(401).json({ error: 'Token de Google inválido' });
    const info = await resp.json();

    if (info.aud !== process.env.GOOGLE_CLIENT_ID) {
      return res.status(401).json({ error: 'Token de Google inválido' });
    }
    if (info.email_verified !== 'true' && info.email_verified !== true) {
      return res.status(401).json({ error: 'El correo de Google no está verificado' });
    }
    const email = (info.email || '').toLowerCase();
    if (!email.endsWith(ALLOWED_DOMAIN)) {
      return res.status(403).json({ error: `Solo se permiten cuentas institucionales ${ALLOWED_DOMAIN}` });
    }

    let user = (await pool.query('SELECT * FROM users WHERE email = $1', [email])).rows[0];

    if (user && user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(429).json({
        error: `Cuenta bloqueada por múltiples intentos fallidos. Intenta de nuevo en ${LOCK_MINUTES} minutos, o contacta al administrador para desbloquearla antes.`,
        locked: true,
      });
    }

    if (!user) {
      // Primera vez: se crea como Área Solicitante con contraseña aleatoria (solo entrará con Google)
      const name = info.name || email.split('@')[0];
      const count = await pool.query('SELECT COUNT(*) FROM users');
      const colorIndex = parseInt(count.rows[0].count) % 5;
      const hash = await bcrypt.hash(require('crypto').randomBytes(24).toString('hex'), 12);
      user = (await pool.query(
        'INSERT INTO users (name, email, password, initials, color_index, role) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
        [name, email, hash, genInitials(name), colorIndex, 'user']
      )).rows[0];
    } else {
      await pool.query('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = $1', [user.id]);
    }

    res.json({ token: makeToken(user), user: fmtUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
