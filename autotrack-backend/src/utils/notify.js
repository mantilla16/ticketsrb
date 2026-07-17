const pool = require('../config/database');
const { sendNotificationEmail } = require('./mailer');

const TYPE_TITLE = {
  assign:    'Nueva asignación en AMBARC',
  status:    'Cambio de estado en AMBARC',
  update:    'Actualización de proyecto en AMBARC',
  log:       'Avance registrado en AMBARC',
  task:      'Actividad de tarea en AMBARC',
  solicitud: 'Actualización de tu solicitud en AMBARC',
};

// Enfriamiento por tipo+proyecto para evitar spam de correos (p.ej. agregar/quitar
// tareas repetidamente). La campana SIEMPRE se actualiza; solo el correo se limita.
const EMAIL_COOLDOWN_MS = { task: 15 * 60 * 1000 }; // 15 min
const lastEmailSentAt = new Map(); // key: `${type}:${projectId}` -> timestamp

function emailOnCooldown(type, projectId) {
  const window = EMAIL_COOLDOWN_MS[type];
  if (!window || !projectId) return false;
  const key = `${type}:${projectId}`;
  const last = lastEmailSentAt.get(key);
  const now = Date.now();
  if (last && now - last < window) return true;
  lastEmailSentAt.set(key, now);
  return false;
}

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

    if (emailOnCooldown(type, projectId)) return; // ya se avisó por correo hace poco — solo queda en la campana

    const [{ rows: recipients }, { rows: actorRows }] = await Promise.all([
      pool.query('SELECT id, email, name FROM users WHERE id = ANY($1)', [targets]),
      actorId ? pool.query('SELECT name, email FROM users WHERE id = $1', [actorId]) : { rows: [] },
    ]);
    const actorName  = actorRows[0]?.name  || null;
    const actorEmail = actorRows[0]?.email || null;
    const title = TYPE_TITLE[type] || 'Notificación de AMBARC';
    await Promise.allSettled(
      recipients.map(r => sendNotificationEmail({ to: r.email, title, message, actorName, actorEmail }))
    );
  } catch (err) {
    console.error('notify failed:', err.message);
  }
}

/**
 * Notificación solo en la campana (sin correo) — para casos donde el correo
 * ya se envía por otra vía (p.ej. a una lista de contactos de una solicitud).
 */
async function notifyInApp(userId, actorId, type, message) {
  try {
    if (!userId || Number(userId) === Number(actorId)) return;
    await ensureTable();
    await pool.query(
      'INSERT INTO notifications (user_id, actor_id, project_id, type, message) VALUES ($1,$2,NULL,$3,$4)',
      [userId, actorId || null, type, message]
    );
  } catch (err) {
    console.error('notifyInApp failed:', err.message);
  }
}

module.exports = { notify, notifyInApp, ensureTable };
