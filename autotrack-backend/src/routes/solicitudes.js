const router = require('express').Router();
const pool   = require('../config/database');
const auth   = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const { notifyInApp } = require('../utils/notify');
const { sendNotificationEmail } = require('../utils/mailer');
const { createCalendarEvent } = require('../utils/calendar');
const escapeHtml = require('../utils/escapeHtml');

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

// La extensión declarada en el nombre del archivo no garantiza el contenido real;
// se valida además la firma binaria (magic bytes) del archivo ya escrito en disco.
const MAGIC_SIGNATURES = {
  '.pdf':  [[0x25, 0x50, 0x44, 0x46]],                                     // %PDF
  '.png':  [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  '.jpg':  [[0xFF, 0xD8, 0xFF]],
  '.jpeg': [[0xFF, 0xD8, 0xFF]],
  '.doc':  [[0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]],             // formato OLE (doc/xls legacy)
  '.xls':  [[0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]],
  '.docx': [[0x50, 0x4B, 0x03, 0x04]],                                    // OOXML = ZIP
  '.xlsx': [[0x50, 0x4B, 0x03, 0x04]],
};

function hasValidMagicBytes(filePath, ext) {
  const sigs = MAGIC_SIGNATURES[ext];
  if (!sigs) return false;
  const fd = fs.openSync(filePath, 'r');
  const header = Buffer.alloc(8);
  fs.readSync(fd, header, 0, 8, 0);
  fs.closeSync(fd);
  return sigs.some(sig => sig.every((byte, i) => header[i] === byte));
}

// Convierte los errores de multer (tamaño, tipo no permitido) en un 400 claro
// en vez de dejarlos caer al 500 genérico del handler global.
function uploadSingle(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'El archivo supera el límite de 10MB' });
      }
      return res.status(400).json({ error: err.message || 'No se pudo subir el archivo' });
    }
    if (req.file) {
      const ext = path.extname(req.file.originalname).toLowerCase();
      if (!hasValidMagicBytes(req.file.path, ext)) {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ error: 'El contenido del archivo no coincide con su extensión' });
      }
    }
    next();
  });
}

// GET /api/solicitudes
// admin → todas; user → solo las propias
router.get('/', auth, async (req, res) => {
  try {
    const role = req.user.role;
    const isAdmin = ['admin', 'leader_analytics', 'manager'].includes(role);
    const isAnalytics = role === 'member_analytics';
    const whereClause = isAdmin ? ''
      : isAnalytics ? "WHERE s.equipo IN ('analitica', 'compartido')"
      : 'WHERE s.user_id = $1';
    const { rows } = await pool.query(
      `SELECT s.id, s.title, s.description, s.type, s.priority, s.area,
              s.due_date, s.file_name, s.file_path, s.status, s.notes,
              s.project_created,
              s.frecuencia, s.herramientas, s.impacto, s.urgencia,
              s.nombre_solicitante, s.correo_solicitante, s.info_adicional, s.fecha_reunion, s.equipo,
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
       ${whereClause}
       ORDER BY s.created_at DESC`,
      isAdmin || isAnalytics ? [] : [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/solicitudes  — cualquier usuario autenticado
router.post('/', auth, uploadSingle, async (req, res) => {
  const { title, description, type, priority, area, dueDate,
          frecuencia, herramientas, impacto, urgencia,
          nombreSolicitante, correoSolicitante } = req.body;
  if (!title?.trim()) {
    return res.status(400).json({ error: 'El nombre del proceso es requerido' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO solicitudes
         (title, description, type, priority, area, due_date, file_name, file_path, user_id,
          frecuencia, herramientas, impacto, urgencia, nombre_solicitante, correo_solicitante)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        title.trim(), description || null, type || 'requerimiento',
        priority || 'media', area || null,
        dueDate || null,
        req.file?.originalname || null,
        req.file?.filename     || null,
        req.user.id,
        frecuencia || null, herramientas || null, impacto || null,
        urgencia || 'media', nombreSolicitante || null, correoSolicitante || null,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// PUT /api/solicitudes/:id/status  — solo admin
router.put('/:id/status', auth, requireRole('admin', 'leader_analytics', 'member_analytics'), async (req, res) => {
  const { status, notes, assigneeId, fechaReunion, equipo } = req.body;
  const valid = ['recibido','en_revision','reunion_agendada','aceptado','rechazado','convertido',
                 'nueva','en_proceso','completada','rechazada'];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }
  if (status === 'reunion_agendada' && !fechaReunion) {
    return res.status(400).json({ error: 'Selecciona la fecha y hora de la reunión antes de agendarla.' });
  }
  try {
    // Los miembros de Analítica solo gestionan solicitudes de su equipo
    if (req.user.role === 'member_analytics') {
      const cur = await pool.query('SELECT equipo FROM solicitudes WHERE id=$1', [req.params.id]);
      if (!cur.rows.length) return res.status(404).json({ error: 'Solicitud no encontrada' });
      if (!['analitica', 'compartido'].includes(cur.rows[0].equipo)) {
        return res.status(403).json({ error: 'Esta solicitud no pertenece al equipo de Analítica' });
      }
    }
    const { rows } = await pool.query(
      `UPDATE solicitudes
       SET status=$1, notes=$2, assignee_id=$3, fecha_reunion=$4,
           equipo=COALESCE($5, equipo), updated_at=NOW()
       WHERE id=$6
       RETURNING *`,
      [status, notes || null, assigneeId || null, fechaReunion || null, equipo || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Solicitud no encontrada' });
    const sol = rows[0];

    if (['rechazado', 'rechazada'].includes(status)) {
      if (sol.user_id) {
        notifyInApp(sol.user_id, req.user.id, 'solicitud',
          `rechazó tu solicitud «${sol.title}»${notes ? `: ${notes}` : '.'}`);
      }
      if (sol.correo_solicitante) {
        const actor = await pool.query('SELECT name, email FROM users WHERE id=$1', [req.user.id]);
        sendNotificationEmail({
          to: sol.correo_solicitante,
          title: `Tu solicitud "${sol.title}" fue rechazada`,
          message: `rechazó tu solicitud «${escapeHtml(sol.title)}»${notes ? `.<br><br><b>Motivo:</b> ${escapeHtml(notes)}` : '.'}`,
          actorName:  actor.rows[0]?.name  || null,
          actorEmail: actor.rows[0]?.email || null,
          type: 'solicitud',
          meta: { projectName: sol.title },
        });
      }
    } else if (status === 'reunion_agendada' && sol.fecha_reunion) {
      const when = new Date(sol.fecha_reunion).toLocaleString('es-CO', {
        weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC',
      });
      if (sol.user_id) {
        notifyInApp(sol.user_id, req.user.id, 'solicitud',
          `agendó una reunión de levantamiento para tu solicitud «${sol.title}»: el ${when}`);
      }
      const actor = await pool.query('SELECT name, email FROM users WHERE id=$1', [req.user.id]);
      const actorName  = actor.rows[0]?.name  || null;
      const actorEmail = actor.rows[0]?.email || null;

      if (sol.correo_solicitante) {
        sendNotificationEmail({
          to: sol.correo_solicitante,
          title: `Reunión agendada — "${sol.title}"`,
          message: `agendó una reunión de levantamiento para tu solicitud «${escapeHtml(sol.title)}»: el <b>${when}</b>.${notes ? `<br><br><b>Nota:</b> ${escapeHtml(notes)}` : ''}`,
          actorName, actorEmail,
          type: 'solicitud',
          meta: { projectName: sol.title },
        });
      }

      // Evento en el calendario del líder que acepta, con invitación a los contactos
      if (actorEmail) {
        const start = new Date(sol.fecha_reunion);
        const end   = new Date(start.getTime() + 60 * 60000);
        const attendees = (sol.correo_solicitante || '')
          .split(',').map(s => s.trim()).filter(Boolean);
        createCalendarEvent({
          organizerEmail: actorEmail,
          summary: `Levantamiento de necesidad — ${sol.title}`,
          description: [
            sol.nombre_solicitante && `Solicitante: ${sol.nombre_solicitante}`,
            sol.area && `Área: ${sol.area}`,
            sol.description,
          ].filter(Boolean).join('\n\n'),
          start, end, attendees,
        });
      }
    }

    res.json(sol);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// PUT /api/solicitudes/:id/info  — solo el dueño de la solicitud
router.put('/:id/info', auth, async (req, res) => {
  const { infoAdicional } = req.body;
  try {
    const { rows } = await pool.query(
      'SELECT user_id FROM solicitudes WHERE id=$1', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Solicitud no encontrada' });
    if (rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Solo puedes editar tus propias solicitudes' });
    }
    const result = await pool.query(
      `UPDATE solicitudes SET info_adicional=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [infoAdicional?.trim() || null, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// PATCH /api/solicitudes/:id/project-created  — solo admin
router.patch('/:id/project-created', auth, requireRole('admin', 'leader_analytics', 'member_analytics'), async (req, res) => {
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
