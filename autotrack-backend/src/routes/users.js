const router = require('express').Router();
const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

function genInitials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');
}

// GET /api/users — any authenticated user
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, initials, color_index AS "colorIndex",
              COALESCE(role, 'engineer') AS role,
              (locked_until IS NOT NULL AND locked_until > NOW()) AS locked
       FROM users ORDER BY name`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/users — admin only: create user (el acceso siempre es vía Google, sin contraseña)
router.post('/', auth, requireRole('admin'), async (req, res) => {
  const { name, email, role } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'Nombre y correo son requeridos' });
  }
  try {
    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length) return res.status(409).json({ error: 'El correo ya está registrado' });

    const count = await pool.query('SELECT COUNT(*) FROM users');
    const colorIndex = parseInt(count.rows[0].count) % 5;
    const initials = genInitials(name);
    const hash = await bcrypt.hash(require('crypto').randomBytes(24).toString('hex'), 12);

    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password, initials, color_index, role)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, name, email, initials, color_index AS "colorIndex", role`,
      [name, email, hash, initials, colorIndex, role || 'engineer']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// PUT /api/users/:id — admin only: update user
router.put('/:id', auth, requireRole('admin'), async (req, res) => {
  const { name, email, role } = req.body;
  const { id } = req.params;

  try {
    if (email) {
      const dup = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, id]);
      if (dup.rows.length) return res.status(409).json({ error: 'El correo ya está en uso por otro usuario' });
    }

    const sets = [];
    const vals = [];
    let i = 1;

    if (name) {
      sets.push(`name = $${i++}`, `initials = $${i++}`);
      vals.push(name, genInitials(name));
    }
    if (email)    { sets.push(`email = $${i++}`);    vals.push(email); }
    if (role)     { sets.push(`role = $${i++}`);     vals.push(role);  }

    if (!sets.length) return res.status(400).json({ error: 'Nada que actualizar' });

    vals.push(id);
    const { rows } = await pool.query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${i}
       RETURNING id, name, email, initials, color_index AS "colorIndex", role`,
      vals
    );
    if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/users/:id/unlock — admin only: desbloquear cuenta tras intentos fallidos
router.post('/:id/unlock', auth, requireRole('admin'), async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = $1',
      [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// DELETE /api/users/:id — admin only
router.delete('/:id', auth, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: 'No puedes eliminar tu propio usuario' });
  }
  try {
    const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [id]);
    if (!rowCount) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
