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

function fmtProject(p, logs = []) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    client: p.client,
    status: p.status,
    priority: p.priority,
    assigneeId: p.assignee_id,
    assignee: p.assignee_id ? {
      id: p.assignee_id,
      name: p.assignee_name,
      initials: p.assignee_initials,
      colorIndex: p.assignee_color,
    } : null,
    startDate: fmtDate(p.start_date),
    dueDate: fmtDate(p.due_date),
    progress: p.progress,
    createdAt: p.created_at,
    logs: logs.map(l => ({
      id: l.id,
      text: l.text,
      progress: l.progress,
      createdAt: l.created_at,
      author: { name: l.author_name, initials: l.author_initials },
    })),
  };
}

const PROJECT_JOIN = `
  SELECT p.*,
    u.name AS assignee_name,
    u.initials AS assignee_initials,
    u.color_index AS assignee_color
  FROM projects p
  LEFT JOIN users u ON p.assignee_id = u.id
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
  return fmtProject(rows[0], logs.rows);
}

const validators = [
  body('name').notEmpty().trim().withMessage('Nombre requerido'),
  body('status').isIn(['backlog', 'progress', 'standby', 'testing', 'done']),
  body('priority').isIn(['high', 'mid', 'low']),
  body('progress').isInt({ min: 0, max: 100 }),
];

// GET /api/projects
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`${PROJECT_JOIN} ORDER BY p.created_at DESC`);
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

    res.json(rows.map(p => fmtProject(p, byProject[p.id] || [])));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/projects
router.post('/', auth, validators, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, description, client, status, priority, assigneeId, startDate, dueDate, progress } = req.body;
  const id = uid();
  try {
    await pool.query(`
      INSERT INTO projects (id, name, description, client, status, priority, assignee_id, start_date, due_date, progress, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    `, [id, name, description || null, client || null, status, priority,
        assigneeId || null, startDate || null, dueDate || null, progress || 0, req.user.id]);

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

  const { name, description, client, status, priority, assigneeId, startDate, dueDate, progress } = req.body;
  try {
    const result = await pool.query(`
      UPDATE projects SET
        name=$1, description=$2, client=$3, status=$4, priority=$5,
        assignee_id=$6, start_date=$7, due_date=$8, progress=$9, updated_at=NOW()
      WHERE id=$10 RETURNING id
    `, [name, description || null, client || null, status, priority,
        assigneeId || null, startDate || null, dueDate || null, progress || 0, req.params.id]);

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

module.exports = router;
