const router = require('express').Router();
const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const auth = require('../middleware/auth');

// Strict rate limiter for login: 10 attempts per 15 min per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de acceso. Espera 15 minutos e intenta de nuevo.' },
});

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

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
      role:       user.role || 'engineer',
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function fmtUser(row) {
  return {
    id:         row.id,
    name:       row.name,
    email:      row.email,
    initials:   row.initials,
    colorIndex: row.color_index,
    role:       row.role || 'engineer',
  };
}

// POST /api/auth/register
router.post('/register', [
  body('name').notEmpty().trim().withMessage('Nombre requerido'),
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 8 }).withMessage('Contraseña mínimo 8 caracteres'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, email, password } = req.body;
  try {
    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length) return res.status(409).json({ error: 'El correo ya está registrado' });

    const count = await pool.query('SELECT COUNT(*) FROM users');
    const colorIndex = parseInt(count.rows[0].count) % 5;
    const initials = genInitials(name);
    const hash = await bcrypt.hash(password, 12);

    const { rows } = await pool.query(
      'INSERT INTO users (name, email, password, initials, color_index) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [name, email, hash, initials, colorIndex]
    );
    res.status(201).json({ token: makeToken(rows[0]), user: fmtUser(rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/auth/login
router.post('/login', loginLimiter, [
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
  body('password').notEmpty().withMessage('Contraseña requerida'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email, password } = req.body;
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    // Check account lockout
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const mins = Math.ceil((new Date(user.locked_until) - Date.now()) / 60000);
      return res.status(429).json({
        error: `Cuenta bloqueada. Intenta de nuevo en ${mins} minuto${mins !== 1 ? 's' : ''}.`,
        locked: true,
      });
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      const attempts = (user.failed_attempts || 0) + 1;

      if (attempts >= MAX_ATTEMPTS) {
        await pool.query(
          `UPDATE users SET failed_attempts = $1, locked_until = NOW() + INTERVAL '${LOCK_MINUTES} minutes' WHERE id = $2`,
          [attempts, user.id]
        );
        return res.status(429).json({
          error: `Cuenta bloqueada por ${LOCK_MINUTES} minutos tras ${MAX_ATTEMPTS} intentos fallidos.`,
          locked: true,
        });
      }

      await pool.query('UPDATE users SET failed_attempts = $1 WHERE id = $2', [attempts, user.id]);
      const left = MAX_ATTEMPTS - attempts;
      return res.status(401).json({
        error: `Credenciales incorrectas. ${left} intento${left !== 1 ? 's' : ''} restante${left !== 1 ? 's' : ''} antes del bloqueo.`,
      });
    }

    // Success → reset counters
    await pool.query('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = $1', [user.id]);

    res.json({ token: makeToken(user), user: fmtUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/auth/me
router.get('/me', auth, (req, res) => res.json(req.user));

module.exports = router;
