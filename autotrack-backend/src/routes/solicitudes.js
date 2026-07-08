const router = require('express').Router();
const pool   = require('../config/database');
const auth   = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const uploadDir = path.join(__dirname, '../../uploads/solicitudes');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename:    (_req, file,  cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['.pdf','.doc','.docx','.xlsx','.xls','.png','.jpg','.jpeg'];
    ok.includes(path.extname(file.originalname).toLowerCase())
      ? cb(null, true)
      : cb(new Error('Tipo de archivo no permitido'));
  },
});

// GET /api/solicitudes
// admin → todas; user → solo las propias
router.get('/', auth, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const { rows } = await pool.query(
      `SELECT s.id, s.title, s.description, s.type, s.priority, s.area,
              s.due_date, s.file_name, s.file_path, s.status, s.notes,
              s.project_created,
              s.frecuencia, s.herramientas, s.impacto, s.urgencia, s.correo_solicitante,
              s.created_at, s.updated_at,
              u.id          AS user_id,
              u.name        AS user_name,
              u.initials    AS user_initials,
              u.color_index AS user_color_index,
              a.id          AS assignee_id,
              a.name        AS assignee_name,
              a.initials    AS assignee_initials,
              a.color_index AS assignee_color_index
       FROM solicitudes s
       LEFT JOIN users u ON s.user_id    = u.id
       LEFT JOIN users a ON s.assignee_id = a.id
       ${isAdmin ? '' : 'WHERE s.user_id = $1'}
       ORDER BY s.created_at DESC`,
      isAdmin ? [] : [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/solicitudes  — cualquier usuario autenticado
router.post('/', auth, upload.single('file'), async (req, res) => {
  const { title, description, type, priority, area, dueDate,
          frecuencia, herramientas, impacto, urgencia, correoSolicitante } = req.body;
  if (!title?.trim()) {
    return res.status(400).json({ error: 'El nombre del proceso es requerido' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO solicitudes
         (title, description, type, priority, area, due_date, file_name, file_path, user_id,
          frecuencia, herramientas, impacto, urgencia, correo_solicitante)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        title.trim(), description || null, type || 'requerimiento',
        priority || 'media', area || null,
        dueDate || null,
        req.file?.originalname || null,
        req.file?.filename     || null,
        req.user.id,
        frecuencia || null, herramientas || null, impacto || null,
        urgencia || 'media', correoSolicitante || null,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// PUT /api/solicitudes/:id/status  — solo admin
router.put('/:id/status', auth, requireRole('admin', 'leader_analytics'), async (req, res) => {
  const { status, notes, assigneeId } = req.body;
  const valid = ['recibido','en_revision','reunion_agendada','aceptado','rechazado','convertido',
                 'nueva','en_proceso','completada','rechazada'];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE solicitudes
       SET status=$1, notes=$2, assignee_id=$3, updated_at=NOW()
       WHERE id=$4
       RETURNING *`,
      [status, notes || null, assigneeId || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Solicitud no encontrada' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// PATCH /api/solicitudes/:id/project-created  — solo admin
router.patch('/:id/project-created', auth, requireRole('admin', 'leader_analytics'), async (req, res) => {
  try {
    await pool.query(
      'UPDATE solicitudes SET project_created=TRUE WHERE id=$1',
      [req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// DELETE /api/solicitudes/:id  — solo admin
router.delete('/:id', auth, requireRole('admin', 'leader_analytics'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT file_path FROM solicitudes WHERE id=$1', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Solicitud no encontrada' });

    if (rows[0].file_path) {
      const fp = path.join(uploadDir, rows[0].file_path);
      try { fs.unlinkSync(fp); } catch {}
    }

    await pool.query('DELETE FROM solicitudes WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
