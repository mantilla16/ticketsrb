const router = require('express').Router();
const pool   = require('../config/database');
const auth   = require('../middleware/auth');
const { ensureTable } = require('../utils/notify');

// GET /api/notifications — las propias, más recientes primero
router.get('/', auth, async (req, res) => {
  try {
    await ensureTable();
    const { rows } = await pool.query(
      `SELECT n.id, n.project_id, n.type, n.message, n.is_read, n.created_at,
              a.name AS actor_name, a.initials AS actor_initials, a.color_index AS actor_color
       FROM notifications n
       LEFT JOIN users a ON n.actor_id = a.id
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC
       LIMIT 30`,
      [req.user.id]
    );
    const unread = rows.filter(r => !r.is_read).length;
    res.json({ items: rows, unread });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// PATCH /api/notifications/read-all — marcar todas como leídas
router.patch('/read-all', auth, async (req, res) => {
  try {
    await ensureTable();
    await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE',
      [req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
