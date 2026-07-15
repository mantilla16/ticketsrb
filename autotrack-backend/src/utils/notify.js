const pool = require('../config/database');

// La tabla se crea desde el propio usuario de la app para evitar problemas de GRANT
let ready = null;
function ensureTable() {
  if (!ready) {
    ready = pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        project_id VARCHAR(60),
        type VARCHAR(30) NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `).catch(err => { ready = null; throw err; });
  }
  return ready;
}

/**
 * Crea notificaciones para los destinatarios indicados.
 * Ignora nulos, duplicados y al propio actor. Nunca lanza (fire-and-forget).
 */
async function notify(recipientIds, actorId, projectId, type, message) {
  try {
    const targets = [...new Set(recipientIds.filter(Boolean))]
      .filter(id => Number(id) !== Number(actorId));
    if (!targets.length) return;
    await ensureTable();
    const values = [];
    const params = [];
    targets.forEach((uid, i) => {
      const base = i * 5;
      values.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5})`);
      params.push(uid, actorId || null, projectId || null, type, message);
    });
    await pool.query(
      `INSERT INTO notifications (user_id, actor_id, project_id, type, message) VALUES ${values.join(',')}`,
      params
    );
  } catch (err) {
    console.error('notify failed:', err.message);
  }
}

module.exports = { notify, ensureTable };
