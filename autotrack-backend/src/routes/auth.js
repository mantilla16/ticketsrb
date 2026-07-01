const router = require('express').Router();
const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');

function genInitials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');
}

function makeToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, initials: user.initials, colorIndex: user.color_index },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function fmtUser(row) {
  return { id: row.id, name: row.name, email: row.email, initials: row.initials, colorIndex: row.color_index };
}

// POST /api/auth/register
router.post('/register', [
  body('name').notEmpty().trim().withMessage('Nombre requerido'),
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 6 }).withMessage('Contraseña mínimo 6 caracteres'),
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
    const hash = await bcrypt.hash(password, 10);

    const { rows } = await pool.query(
      'INSERT INTO users (name, email, password, initials, color_index) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [name, email, hash, initials, colorIndex]
    );
    const user = fmtUser(rows[0]);
    res.status(201).json({ token: makeToken(rows[0]), user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/auth/login
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
  body('password').notEmpty().withMessage('Contraseña requerida'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email, password } = req.body;
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!rows.length || !(await bcrypt.compare(password, rows[0].password))) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }
    const user = fmtUser(rows[0]);
    res.json({ token: makeToken(rows[0]), user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/auth/me
router.get('/me', auth, (req, res) => {
  res.json(req.user);
});

module.exports = router;
