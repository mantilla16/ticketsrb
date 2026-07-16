const pool = require('../config/database');
const { sendNotificationEmail } = require('./mailer');

const TYPE_TITLE = {
  assign: 'Nueva asignación en AMBARC',
  status: 'Cambio de estado en AMBARC',
  update: 'Actualización de proyecto en AMBARC',
  log:    'Avance registrado en AMBARC',
  task:   'Actividad de tarea en AMBARC',
};

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

    const [{ rows: recipients }, { rows: actorRows }] = await Promise.all([
      pool.query('SELECT id, email, name FROM users WHERE id = ANY($1)', [targets]),
      actorId ? pool.query('SELECT name FROM users WHERE id = $1', [actorId]) : { rows: [] },
    ]);
    const actorName = actorRows[0]?.name || null;
    const title = TYPE_TITLE[type] || 'Notificación de AMBARC';
    await Promise.allSettled(
      recipients.map(r => sendNotificationEmail({ to: r.email, title, message, actorName }))
    );
  } catch (err) {
    console.error('notify failed:', err.message);
  }
}

module.exports = { notify, ensureTable };
