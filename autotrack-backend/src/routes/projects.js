const router = require('express').Router();
const pool = require('../config/database');
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function fmtDate(d) {
  return d ? d.toISOString().slice(0, 10) : null;
}

function fmtProject(p, logs = [], tasks = []) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    client: p.client,
    status: p.status,
    priority: p.priority,
    tipo: p.tipo || 'automatizacion',
    docUrl: p.doc_url || null,
    assigneeId: p.assignee_id,
    assignee: p.assignee_id ? {
      id: p.assignee_id,
      name: p.assignee_name,
      initials: p.assignee_initials,
      colorIndex: p.assignee_color,
    } : null,
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
      dueDate: fmtDate(t.due_date),
      createdAt: t.created_at,
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
  const tasks = await pool.query(
    'SELECT * FROM project_tasks WHERE project_id = $1 ORDER BY created_at ASC', [id]
  );
  return fmtProject(rows[0], logs.rows, tasks.rows);
}

const validators = [
  body('name').notEmpty().trim().withMessage('Nombre requerido'),
  body('status').isIn(['backlog', 'progress', 'standby', 'testing', 'done', 'soporte']),
  body('priority').isIn(['high', 'mid', 'low']),
  body('progress').isInt({ min: 0, max: 100 }),
  body('tipo').optional().isIn(['automatizacion', 'analitica', 'compartido', 'asignacion_flash']),
];

// GET /api/projects
router.get('/', auth, async (req, res) => {
  try {
    let { rows } = await pool.query(`${PROJECT_JOIN} ORDER BY p.created_at DESC`);
    // Ingenieros de automatización no ven proyectos exclusivos de Analítica
    if (req.user.role === 'engineer') {
      rows = rows.filter(r => (r.tipo || 'automatizacion') !== 'analitica');
    }
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

    const tasksRes = await pool.query(
      'SELECT * FROM project_tasks WHERE project_id = ANY($1) ORDER BY created_at ASC', [ids]
    );
    const tasksByProject = {};
    tasksRes.rows.forEach(t => {
      if (!tasksByProject[t.project_id]) tasksByProject[t.project_id] = [];
      tasksByProject[t.project_id].push(t);
    });

    res.json(rows.map(p => fmtProject(p, byProject[p.id] || [], tasksByProject[p.id] || [])));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/projects
router.post('/', auth, validators, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, description, client, status, priority, assigneeId, startDate, dueDate, progress, tipo, docUrl,
          coAssigneeId, generalAssigneeId, participationAuto, participationAnalitica, progressAuto, progressAnalitica } = req.body;
  const id = uid();
  try {
    await pool.query(`
      INSERT INTO projects (id, name, description, client, status, priority, assignee_id, start_date, due_date, progress, tipo, doc_url,
        co_assignee_id, general_assignee_id, participation_auto, participation_analitica, progress_auto, progress_analitica, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
    `, [id, name, description || null, client || null, status, priority,
        assigneeId || null, startDate || null, dueDate || null, progress || 0,
        tipo || 'automatizacion', docUrl || null,
        coAssigneeId || null, generalAssigneeId || null,
        participationAuto || null, participationAnalitica || null,
        progressAuto || 0, progressAnalitica || 0, req.user.id]);

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

  const { name, description, client, status, priority, assigneeId, startDate, dueDate, progress, tipo, docUrl,
          coAssigneeId, generalAssigneeId, participationAuto, participationAnalitica, progressAuto, progressAnalitica,
          supportClosed } = req.body;
  try {
    const result = await pool.query(`
      UPDATE projects SET
        name=$1, description=$2, client=$3, status=$4, priority=$5,
        assignee_id=$6, start_date=$7, due_date=$8, progress=$9,
        tipo=$10, doc_url=$11,
        co_assignee_id=$12, general_assignee_id=$13,
        participation_auto=$14, participation_analitica=$15,
        progress_auto=$16, progress_analitica=$17,
        support_closed=COALESCE($18, support_closed), updated_at=NOW()
      WHERE id=$19 RETURNING id
    `, [name, description || null, client || null, status, priority,
        assigneeId || null, startDate || null, dueDate || null, progress || 0,
        tipo || 'automatizacion', docUrl || null,
        coAssigneeId || null, generalAssigneeId || null,
        participationAuto || null, participationAnalitica || null,
        progressAuto || 0, progressAnalitica || 0,
        supportClosed === undefined ? null : supportClosed === true, req.params.id]);

    if (!result.rows.length) return res.status(404).json({ error: 'Proyecto no encontrado' });
    res.json(await fetchProject(req.params.id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// DELETE /api/projects/:id
router.delete('/:id', auth, async (req, res) => {
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
router.post('/:id/logs', auth, [
  body('text').notEmpty().trim().withMessage('Texto requerido'),
  body('progress').isInt({ min: 0, max: 100 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { text, progress } = req.body;
  try {
    await pool.query(
      'INSERT INTO project_logs (project_id, author_id, text, progress) VALUES ($1,$2,$3,$4)',
      [req.params.id, req.user.id, text, progress]
    );
    await pool.query(
      'UPDATE projects SET progress=$1, updated_at=NOW() WHERE id=$2',
      [progress, req.params.id]
    );
    const project = await fetchProject(req.params.id);
    if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });
    res.json(project);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/projects/:id/tasks
router.post('/:id/tasks', auth, [
  body('title').notEmpty().trim().withMessage('Título requerido'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    await pool.query(
      'INSERT INTO project_tasks (project_id, title, due_date, created_by) VALUES ($1,$2,$3,$4)',
      [req.params.id, req.body.title.trim(), req.body.dueDate || null, req.user.id]
    );
    const project = await fetchProject(req.params.id);
    if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });
    res.status(201).json(project);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// PATCH /api/projects/:id/tasks/:taskId
router.patch('/:id/tasks/:taskId', auth, async (req, res) => {
  const { done, title, dueDate } = req.body;
  try {
    const result = await pool.query(
      `UPDATE project_tasks
       SET done = COALESCE($1, done), title = COALESCE($2, title), due_date = COALESCE($3, due_date)
       WHERE id = $4 AND project_id = $5 RETURNING id`,
      [typeof done === 'boolean' ? done : null, title?.trim() || null, dueDate || null, req.params.taskId, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Tarea no encontrada' });
    res.json(await fetchProject(req.params.id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// DELETE /api/projects/:id/tasks/:taskId
router.delete('/:id/tasks/:taskId', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM project_tasks WHERE id = $1 AND project_id = $2 RETURNING id',
      [req.params.taskId, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Tarea no encontrada' });
    res.json(await fetchProject(req.params.id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
