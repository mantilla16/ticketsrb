const router = require('express').Router();
const pool = require('../config/database');
const auth = require('../middleware/auth');
const { requierePermiso, puede, filtroEquipos } = require('../config/roles');
const { body, validationResult } = require('express-validator');
const { notify } = require('../utils/notify');
const escapeHtml = require('../utils/escapeHtml');

const STATUS_LABEL = {
  backlog: 'Por hacer', progress: 'En proceso', standby: 'En standby',
  testing: 'En testing', done: 'Finalizado', soporte: 'Soporte', cancelado: 'Cancelado',
};



// Tabla de responsables múltiples — la crea el propio usuario de la app para evitar problemas de GRANT
let assigneesReady = null;
function ensureAssigneesTable() {
  if (!assigneesReady) {
    assigneesReady = pool.query(`
      CREATE TABLE IF NOT EXISTS project_assignees (
        project_id VARCHAR(60) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (project_id, user_id)
      )
    `).then(() => pool.query(`
      INSERT INTO project_assignees (project_id, user_id)
      SELECT id, assignee_id FROM projects WHERE assignee_id IS NOT NULL
      ON CONFLICT DO NOTHING
    `)).catch(err => { assigneesReady = null; throw err; });
  }
  return assigneesReady;
}

// Reemplaza el conjunto completo de responsables de un proyecto
async function syncAssignees(projectId, userIds) {
  await ensureAssigneesTable();
  await pool.query('DELETE FROM project_assignees WHERE project_id=$1', [projectId]);
  const ids = [...new Set((userIds || []).filter(Boolean).map(Number))];
  if (!ids.length) return;
  const values = ids.map((_, i) => `($1,$${i + 2})`).join(',');
  await pool.query(
    `INSERT INTO project_assignees (project_id, user_id) VALUES ${values} ON CONFLICT DO NOTHING`,
    [projectId, ...ids]
  );
}

async function extraAssigneeIds(projectId) {
  await ensureAssigneesTable();
  const { rows } = await pool.query('SELECT user_id FROM project_assignees WHERE project_id=$1', [projectId]);
  return rows.map(r => r.user_id);
}

// Dueño individual (solo relevante en compartidos) y tamaño de cada tarea —
// columnas agregadas en caliente, igual que project_assignees más arriba.
// Además: prioridad alta/media/baja y cliente opcional (para analítica).
let taskColumnsReady = null;
function ensureTaskColumns() {
  if (!taskColumnsReady) {
    taskColumnsReady = pool.query(`
      ALTER TABLE project_tasks
        ADD COLUMN IF NOT EXISTS assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS weight SMALLINT NOT NULL DEFAULT 2,
        ADD COLUMN IF NOT EXISTS priority VARCHAR(10) NOT NULL DEFAULT 'mid',
        ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES analytics_clients(id) ON DELETE SET NULL
    `).catch(err => { taskColumnsReady = null; throw err; });
  }
  return taskColumnsReady;
}

// Tabla puente proyecto ↔ clientes (analítica). La crea el propio usuario de
// la app, igual que project_assignees, para evitar problemas de GRANT.
let projectClientsReady = null;
function ensureProjectClientsTable() {
  if (!projectClientsReady) {
    projectClientsReady = pool.query(`
      CREATE TABLE IF NOT EXISTS analytics_clients (
        id         SERIAL PRIMARY KEY,
        name       VARCHAR(150) NOT NULL UNIQUE,
        active     BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `).then(() => pool.query(`
      CREATE TABLE IF NOT EXISTS project_clients (
        project_id VARCHAR(60) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        client_id  INTEGER     NOT NULL REFERENCES analytics_clients(id) ON DELETE CASCADE,
        PRIMARY KEY (project_id, client_id)
      )
    `)).catch(err => { projectClientsReady = null; throw err; });
  }
  return projectClientsReady;
}

// Reemplaza el conjunto completo de clientes de un proyecto de analítica
async function syncProjectClients(projectId, clientIds) {
  await ensureProjectClientsTable();
  await pool.query('DELETE FROM project_clients WHERE project_id=$1', [projectId]);
  const ids = [...new Set((clientIds || []).filter(Boolean).map(Number))];
  if (!ids.length) return;
  const values = ids.map((_, i) => `($1,$${i + 2})`).join(',');
  await pool.query(
    `INSERT INTO project_clients (project_id, client_id) VALUES ${values} ON CONFLICT DO NOTHING`,
    [projectId, ...ids],
  );
}

async function projectClientsOf(projectId) {
  await ensureProjectClientsTable();
  const { rows } = await pool.query(`
    SELECT ac.id, ac.name, ac.active
    FROM project_clients pc
    JOIN analytics_clients ac ON ac.id = pc.client_id
    WHERE pc.project_id = $1
  `, [projectId]);
  return rows;
}

// Responsables actuales de un proyecto (para notificaciones)
async function projectPeople(id) {
  const { rows } = await pool.query(
    'SELECT name, assignee_id, co_assignee_id, general_assignee_id, status FROM projects WHERE id=$1', [id]
  );
  if (!rows.length) return null;
  const p = rows[0];
  const extra = await extraAssigneeIds(id);
  return {
    name: p.name,
    status: p.status,
    ids: [p.assignee_id, p.co_assignee_id, p.general_assignee_id, ...extra],
  };
}

// El progreso lo determinan las tareas: % de tareas completadas. Sin tareas, se deja como está.
async function recalcProgress(id) {
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE done)::int AS done FROM project_tasks WHERE project_id=$1',
    [id]
  );
  const { total, done } = rows[0];
  if (total === 0) {
    const cur = await pool.query('SELECT progress FROM projects WHERE id=$1', [id]);
    return cur.rows[0]?.progress ?? 0;
  }
  const progress = Math.round((done / total) * 100);
  await pool.query('UPDATE projects SET progress=$1, updated_at=NOW() WHERE id=$2', [progress, id]);
  return progress;
}

// Quien coordina gestiona cualquier proyecto; quien ejecuta, solo los que
// tiene asignados. Devuelve true si puede continuar; si no, ya respondió.
async function assertProjectAccess(req, res, projectId) {
  const role = req.user.role;
  if (puede(role, 'gestionarProyectos')) return true;
  if (!puede(role, 'editarProyectosPropios')) {
    res.status(403).json({ error: 'No tienes permisos para esta acción' });
    return false;
  }
  const people = await projectPeople(projectId);
  if (!people) { res.status(404).json({ error: 'Proyecto no encontrado' }); return false; }
  const owns = people.ids.filter(Boolean).map(Number).includes(Number(req.user.id));
  if (!owns) {
    res.status(403).json({ error: 'Solo puedes modificar proyectos asignados a ti' });
    return false;
  }
  return true;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function fmtDate(d) {
  return d ? d.toISOString().slice(0, 10) : null;
}

function fmtProject(p, logs = [], tasks = [], extraAssignees = [], clients = []) {
  const primary = p.assignee_id ? {
    id: p.assignee_id, name: p.assignee_name, initials: p.assignee_initials, colorIndex: p.assignee_color,
  } : null;
  const assignees = primary ? [primary] : [];
  extraAssignees.forEach(u => { if (!assignees.some(a => a.id === u.id)) assignees.push(u); });

  return {
    id: p.id,
    name: p.name,
    description: p.description,
    client: p.client,
    clients,
    status: p.status,
    priority: p.priority,
    tipo: p.tipo || 'automatizacion',
    docUrl: p.doc_url || null,
    assigneeId: p.assignee_id,
    assignee: primary,
    assigneeIds: assignees.map(a => a.id),
    assignees,
    coAssigneeId: p.co_assignee_id || null,
    coAssignee: p.co_assignee_id ? {
      id: p.co_assignee_id,
      name: p.co_assignee_name,
      initials: p.co_assignee_initials,
      colorIndex: p.co_assignee_color,
    } : null,
    generalAssigneeId: p.general_assignee_id || null,
    generalAssignee: p.general_assignee_id ? {
      id: p.general_assignee_id,
      name: p.general_assignee_name,
      initials: p.general_assignee_initials,
      colorIndex: p.general_assignee_color,
    } : null,
    participationAuto:       p.participation_auto       || null,
    participationAnalitica:  p.participation_analitica  || null,
    progressAuto:            p.progress_auto            ?? 0,
    progressAnalitica:       p.progress_analitica       ?? 0,
    supportClosed:           p.support_closed           || false,
    wasSoporte:              p.was_soporte              || p.status === 'soporte' || false,
    startDate: fmtDate(p.start_date),
    dueDate: fmtDate(p.due_date),
    progress: p.progress,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    logs: logs.map(l => ({
      id: l.id,
      text: l.text,
      progress: l.progress,
      createdAt: l.created_at,
      author: { name: l.author_name, initials: l.author_initials },
    })),
    tasks: tasks.map(t => ({
      id: t.id,
      title: t.title,
      done: t.done,
      priority: t.priority ?? 'mid',
      clientId: t.client_id || null,
      dueDate: fmtDate(t.due_date),
      createdAt: t.created_at,
      assigneeId: t.assignee_id || null,
      weight: t.weight ?? 2,
    })),
  };
}

const PROJECT_JOIN = `
  SELECT p.*,
    u.name  AS assignee_name,
    u.initials  AS assignee_initials,
    u.color_index AS assignee_color,
    u2.name AS co_assignee_name,
    u2.initials AS co_assignee_initials,
    u2.color_index AS co_assignee_color,
    u3.name AS general_assignee_name,
    u3.initials AS general_assignee_initials,
    u3.color_index AS general_assignee_color
  FROM projects p
  LEFT JOIN users u  ON p.assignee_id         = u.id
  LEFT JOIN users u2 ON p.co_assignee_id      = u2.id
  LEFT JOIN users u3 ON p.general_assignee_id = u3.id
`;

async function fetchProject(id) {
  const { rows } = await pool.query(`${PROJECT_JOIN} WHERE p.id = $1`, [id]);
  if (!rows.length) return null;
  const logs = await pool.query(`
    SELECT pl.*, u.name AS author_name, u.initials AS author_initials
    FROM project_logs pl
    JOIN users u ON pl.author_id = u.id
    WHERE pl.project_id = $1
    ORDER BY pl.created_at DESC
  `, [id]);
  await ensureTaskColumns();
  const tasks = await pool.query(
    'SELECT * FROM project_tasks WHERE project_id = $1 ORDER BY created_at ASC', [id]
  );
  await ensureAssigneesTable();
  const extra = await pool.query(
    `SELECT u.id, u.name, u.initials, u.color_index AS "colorIndex"
     FROM project_assignees pa JOIN users u ON pa.user_id = u.id
     WHERE pa.project_id = $1`, [id]
  );
  const clients = await projectClientsOf(id);
  return fmtProject(rows[0], logs.rows, tasks.rows, extra.rows, clients);
}

const validators = [
  body('name').notEmpty().trim().withMessage('Nombre requerido'),
  body('status').isIn(['backlog', 'progress', 'standby', 'testing', 'done', 'soporte', 'cancelado']),
  body('priority').isIn(['high', 'mid', 'low']),
  body('progress').isInt({ min: 0, max: 100 }),
  body('tipo').optional().isIn(['automatizacion', 'analitica', 'compartido', 'asignacion_flash']),
];

// GET /api/projects
router.get('/', auth, async (req, res) => {
  try {
    let { rows } = await pool.query(`${PROJECT_JOIN} ORDER BY p.created_at DESC`);
    // Visibilidad por equipo: cada equipo ve lo suyo + compartidos
    const soloSuEquipo = filtroEquipos(req.user.role);
    if (soloSuEquipo) rows = rows.filter(r => soloSuEquipo(r.tipo));
    if (!rows.length) return res.json([]);

    const ids = rows.map(p => p.id);
    const logsRes = await pool.query(`
      SELECT pl.*, u.name AS author_name, u.initials AS author_initials
      FROM project_logs pl
      JOIN users u ON pl.author_id = u.id
      WHERE pl.project_id = ANY($1)
      ORDER BY pl.created_at DESC
    `, [ids]);

    const byProject = {};
    logsRes.rows.forEach(l => {
      if (!byProject[l.project_id]) byProject[l.project_id] = [];
      byProject[l.project_id].push(l);
    });

    await ensureTaskColumns();
    const tasksRes = await pool.query(
      'SELECT * FROM project_tasks WHERE project_id = ANY($1) ORDER BY created_at ASC', [ids]
    );
    const tasksByProject = {};
    tasksRes.rows.forEach(t => {
      if (!tasksByProject[t.project_id]) tasksByProject[t.project_id] = [];
      tasksByProject[t.project_id].push(t);
    });

    await ensureAssigneesTable();
    const assigneesRes = await pool.query(
      `SELECT pa.project_id, u.id, u.name, u.initials, u.color_index AS "colorIndex"
       FROM project_assignees pa JOIN users u ON pa.user_id = u.id
       WHERE pa.project_id = ANY($1)`, [ids]
    );
    const assigneesByProject = {};
    assigneesRes.rows.forEach(a => {
      if (!assigneesByProject[a.project_id]) assigneesByProject[a.project_id] = [];
      assigneesByProject[a.project_id].push({ id: a.id, name: a.name, initials: a.initials, colorIndex: a.colorIndex });
    });

    await ensureProjectClientsTable();
    const clientsRes = await pool.query(`
      SELECT pc.project_id, ac.id, ac.name, ac.active
      FROM project_clients pc
      JOIN analytics_clients ac ON ac.id = pc.client_id
      WHERE pc.project_id = ANY($1)
    `, [ids]);
    const clientsByProject = {};
    clientsRes.rows.forEach(c => {
      if (!clientsByProject[c.project_id]) clientsByProject[c.project_id] = [];
      clientsByProject[c.project_id].push({ id: c.id, name: c.name, active: c.active });
    });

    res.json(rows.map(p => fmtProject(p, byProject[p.id] || [], tasksByProject[p.id] || [],
      assigneesByProject[p.id] || [], clientsByProject[p.id] || [])));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/projects
router.post('/', auth, requierePermiso('crearProyectos'), validators, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, description, client, clientIds, status, priority, assigneeId, assigneeIds, startDate, dueDate, progress, tipo, docUrl,
          coAssigneeId, generalAssigneeId, participationAuto, participationAnalitica, progressAuto, progressAnalitica } = req.body;
  const ids = Array.isArray(assigneeIds) && assigneeIds.length
    ? [...new Set(assigneeIds.filter(Boolean).map(Number))]
    : (assigneeId ? [Number(assigneeId)] : []);
  const primaryAssignee = ids[0] || null;
  const id = uid();
  try {
    await pool.query(`
      INSERT INTO projects (id, name, description, client, status, priority, assignee_id, start_date, due_date, progress, tipo, doc_url,
        co_assignee_id, general_assignee_id, participation_auto, participation_analitica, progress_auto, progress_analitica, created_by, was_soporte)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
    `, [id, name, description || null, client || null, status, priority,
        primaryAssignee, startDate || null, dueDate || null, 0, // el progreso arranca en 0 — lo suben las tareas
        tipo || 'automatizacion', docUrl || null,
        coAssigneeId || null, generalAssigneeId || null,
        participationAuto || null, participationAnalitica || null,
        progressAuto || 0, progressAnalitica || 0, req.user.id, status === 'soporte']);

    await syncAssignees(id, ids);
    await syncProjectClients(id, clientIds);

    notify([...ids, coAssigneeId, generalAssigneeId], req.user.id, id,
      'assign', `te asignó el proyecto «${escapeHtml(name)}»`,
      { projectName: name, priority, client, dueDate });

    const project = await fetchProject(id);
    res.status(201).json(project);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// PUT /api/projects/:id
router.put('/:id', auth, validators, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, description, client, clientIds, status, priority, assigneeId, assigneeIds, startDate, dueDate, progress, tipo, docUrl,
          coAssigneeId, generalAssigneeId, participationAuto, participationAnalitica, progressAuto, progressAnalitica,
          supportClosed } = req.body;
  const ids = Array.isArray(assigneeIds) && assigneeIds.length
    ? [...new Set(assigneeIds.filter(Boolean).map(Number))]
    : (assigneeId ? [Number(assigneeId)] : []);
  const primaryAssignee = ids[0] || null;
  try {
    if (!(await assertProjectAccess(req, res, req.params.id))) return;
    const before = await projectPeople(req.params.id);
    // El progreso ya no se recibe del cliente: lo determinan las tareas (ver recalcProgress).
    const result = await pool.query(`
      UPDATE projects SET
        name=$1, description=$2, client=$3, status=$4, priority=$5,
        assignee_id=$6, start_date=$7, due_date=$8,
        tipo=$9, doc_url=$10,
        co_assignee_id=$11, general_assignee_id=$12,
        participation_auto=$13, participation_analitica=$14,
        progress_auto=$15, progress_analitica=$16,
        support_closed=COALESCE($17, support_closed),
        was_soporte=(COALESCE(was_soporte, FALSE) OR $19='soporte'), updated_at=NOW()
      WHERE id=$18 RETURNING id
    `, [name, description || null, client || null, status, priority,
        primaryAssignee, startDate || null, dueDate || null,
        tipo || 'automatizacion', docUrl || null,
        coAssigneeId || null, generalAssigneeId || null,
        participationAuto || null, participationAnalitica || null,
        progressAuto || 0, progressAnalitica || 0,
        supportClosed === undefined ? null : supportClosed === true, req.params.id, status]);

    if (!result.rows.length) return res.status(404).json({ error: 'Proyecto no encontrado' });
    await recalcProgress(req.params.id);
    await syncAssignees(req.params.id, ids);
    await syncProjectClients(req.params.id, clientIds);

    if (before) {
      const oldIds = before.ids.filter(Boolean).map(Number);
      const newIds = [...ids, coAssigneeId, generalAssigneeId].filter(Boolean).map(Number);
      const added  = newIds.filter(uid => !oldIds.includes(uid));
      const kept   = newIds.filter(uid => oldIds.includes(uid));
      if (added.length) {
        notify(added, req.user.id, req.params.id, 'assign', `te asignó el proyecto «${escapeHtml(name)}»`,
          { projectName: name, priority, client, dueDate });
      }
      if (before.status !== status) {
        notify(kept, req.user.id, req.params.id, 'status',
          `cambió el estado de «${escapeHtml(name)}» a ${STATUS_LABEL[status] || status}`,
          { projectName: name, statusFrom: before.status, statusTo: status, priority, client, dueDate });
      } else if (kept.length) {
        notify(kept, req.user.id, req.params.id, 'update', `actualizó el proyecto «${escapeHtml(name)}»`,
          { projectName: name, priority, client, dueDate });
      }
    }

    res.json(await fetchProject(req.params.id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// DELETE /api/projects/:id
router.delete('/:id', auth, requierePermiso('eliminarProyectos'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM projects WHERE id=$1 RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Proyecto no encontrado' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/projects/:id/logs
// El progreso ya no lo elige quien escribe el avance: lo determinan las tareas completadas.
router.post('/:id/logs', auth, [
  body('text').notEmpty().trim().withMessage('Texto requerido'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { text } = req.body;
  try {
    if (!(await assertProjectAccess(req, res, req.params.id))) return;
    const progress = await recalcProgress(req.params.id);
    await pool.query(
      'INSERT INTO project_logs (project_id, author_id, text, progress) VALUES ($1,$2,$3,$4)',
      [req.params.id, req.user.id, text, progress]
    );
    const project = await fetchProject(req.params.id);
    if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });

    const people = await projectPeople(req.params.id);
    if (people) {
      notify(people.ids, req.user.id, req.params.id, 'log',
        `registró un avance del ${progress}% en «${escapeHtml(people.name)}»`,
        { projectName: people.name });
    }

    res.json(project);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/projects/:id/tasks — líderes, o el/los responsable(s) del proyecto
router.post('/:id/tasks', auth, [
  body('title').notEmpty().trim().withMessage('Título requerido'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    if (!(await assertProjectAccess(req, res, req.params.id))) return;
    await ensureTaskColumns();
    const weight = [1, 2, 3].includes(Number(req.body.weight)) ? Number(req.body.weight) : 2;
    const priority = ['high', 'mid', 'low'].includes(req.body.priority) ? req.body.priority : 'mid';
    const clientId = Number(req.body.clientId) || null;
    await pool.query(
      'INSERT INTO project_tasks (project_id, title, due_date, created_by, assignee_id, weight, priority, client_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [req.params.id, req.body.title.trim(), req.body.dueDate || null, req.user.id, req.body.assigneeId || null, weight, priority, clientId]
    );
    await recalcProgress(req.params.id);
    const project = await fetchProject(req.params.id);
    if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });

    const people = await projectPeople(req.params.id);
    if (people) {
      notify(people.ids, req.user.id, req.params.id, 'task',
        `agregó la tarea «${escapeHtml(req.body.title.trim())}» en «${escapeHtml(people.name)}»`,
        { projectName: people.name });
    }

    res.status(201).json(project);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// PATCH /api/projects/:id/tasks/:taskId
router.patch('/:id/tasks/:taskId', auth, async (req, res) => {
  const { done, title, dueDate, assigneeId, weight } = req.body;
  try {
    if (!(await assertProjectAccess(req, res, req.params.id))) return;
    await ensureTaskColumns();
    const validWeight = [1, 2, 3].includes(Number(weight)) ? Number(weight) : null;
    const validPriority = ['high', 'mid', 'low'].includes(req.body.priority) ? req.body.priority : null;
    const result = await pool.query(
      `UPDATE project_tasks
       SET done = COALESCE($1, done), title = COALESCE($2, title), due_date = COALESCE($3, due_date),
           assignee_id = CASE WHEN $6 THEN $7 ELSE assignee_id END,
           weight = COALESCE($8, weight),
           priority = COALESCE($9, priority),
           client_id = CASE WHEN $10 THEN $11 ELSE client_id END
       WHERE id = $4 AND project_id = $5 RETURNING id`,
      [typeof done === 'boolean' ? done : null, title?.trim() || null, dueDate || null, req.params.taskId, req.params.id,
       Object.prototype.hasOwnProperty.call(req.body, 'assigneeId'), assigneeId || null, validWeight,
       validPriority,
       Object.prototype.hasOwnProperty.call(req.body, 'clientId'),
       req.body.clientId === null || req.body.clientId === undefined ? null : (Number(req.body.clientId) || null)]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Tarea no encontrada' });

    if (typeof done === 'boolean') await recalcProgress(req.params.id);

    if (done === true) {
      const people = await projectPeople(req.params.id);
      if (people) {
        notify(people.ids, req.user.id, req.params.id, 'task',
          `completó una tarea en «${escapeHtml(people.name)}»`,
          { projectName: people.name });
      }
    }

    res.json(await fetchProject(req.params.id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// DELETE /api/projects/:id/tasks/:taskId — líderes, o el/los responsable(s) del proyecto
router.delete('/:id/tasks/:taskId', auth, async (req, res) => {
  try {
    if (!(await assertProjectAccess(req, res, req.params.id))) return;
    const result = await pool.query(
      'DELETE FROM project_tasks WHERE id = $1 AND project_id = $2 RETURNING id',
      [req.params.taskId, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Tarea no encontrada' });
    await recalcProgress(req.params.id);
    res.json(await fetchProject(req.params.id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
