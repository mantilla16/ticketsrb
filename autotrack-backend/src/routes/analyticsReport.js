const router = require('express').Router();
const pool = require('../config/database');
const auth = require('../middleware/auth');
const { requierePermiso } = require('../config/roles');

// ── Clientes semilla (insertados solo si la tabla queda vacía) ─────────
const SEED_CLIENTS = [
  { name: 'Centro Empresarial Buenavista', active: true },
  { name: 'Centro Comercial Buenavista Monteria', active: true },
  { name: 'Camacol Atlántico', active: true },
  { name: 'C.I. ACA', active: true },
  { name: 'Kredit Plus', active: true },
  { name: 'Grupo KAIA', active: true },
  { name: 'Kredit S.A.S', active: true },
  { name: 'Probarranquilla', active: true },
  { name: 'Instituto del Corazón de Bucaramanga', active: true },
  { name: 'HCM Pinturas', active: true },
  { name: 'Liquitech', active: true },
  { name: 'Inversiones D JUAN', active: false },
  { name: 'General 3000', active: false },
  { name: 'Constructora Avanade', active: true },
  { name: 'Boubalos S.A.S', active: true },
  { name: 'Doxa Talent', active: true },
  { name: 'Cedel', active: true },
  { name: 'FNG Garantia', active: true },
  { name: 'EQUINORTE', active: true },
  { name: 'AB Marine', active: true },
  { name: 'Quintal', active: true },
  { name: 'Ground Investment', active: true },
];

// ── Inicialización de la tabla analytics_clients ───────────────────────
let clientsReady = null;
function ensureClientsTable() {
  if (!clientsReady) {
    clientsReady = pool.query(`
      CREATE TABLE IF NOT EXISTS analytics_clients (
        id         SERIAL PRIMARY KEY,
        name       VARCHAR(150) NOT NULL UNIQUE,
        active     BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `).then(async () => {
      const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM analytics_clients');
      if (rows[0].n === 0) {
        for (const c of SEED_CLIENTS) {
          await pool.query(
            'INSERT INTO analytics_clients (name, active) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [c.name, c.active],
          );
        }
      }
    }).catch(err => { clientsReady = null; throw err; });
  }
  return clientsReady;
}

async function getClientsFromDB() {
  await ensureClientsTable();
  const { rows } = await pool.query('SELECT id, name, active FROM analytics_clients ORDER BY active DESC, name');
  return rows;
}

// ── project_assignees (tolerante a base vieja) ────────────────────────
let assigneesReady = null;
function ensureAssigneesTable() {
  if (!assigneesReady) {
    assigneesReady = pool.query(`
      CREATE TABLE IF NOT EXISTS project_assignees (
        project_id VARCHAR(60) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

// ── project_clients (N a M proyecto ↔ cliente) ────────────────────────
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
    `)).then(async () => {
      // Migrar proyectos viejos: su columna `client` a la tabla puente
      await pool.query(`
        INSERT INTO project_clients (project_id, client_id)
        SELECT p.id, ac.id
        FROM projects p
        JOIN analytics_clients ac ON lower(ac.name) = lower(trim(p.client))
        WHERE p.tipo = 'analitica' AND p.client IS NOT NULL AND p.client != ''
        ON CONFLICT DO NOTHING
      `);
    }).catch(err => { projectClientsReady = null; throw err; });
  }
  return projectClientsReady;
}

function fmtDate(d) {
  return d ? d.toISOString().slice(0, 10) : null;
}

// ───────────────────────── CRUD de clientes ────────────────────────────

// GET /api/analytics-report/clients — Lista de clientes
router.get('/clients', auth, requierePermiso('verReporteAnalitica'), async (_req, res) => {
  try {
    const clients = await getClientsFromDB();
    res.json(clients);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/analytics-report/clients — Crear cliente
router.post('/clients', auth, requierePermiso('verReporteAnalitica'), async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });
    const active = req.body.active !== false;
    const { rows } = await pool.query(
      'INSERT INTO analytics_clients (name, active) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET active = EXCLUDED.active RETURNING id, name, active',
      [name, active],
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear el cliente' });
  }
});

// PUT /api/analytics-report/clients/:id — Actualizar cliente (nombre y/o active)
router.put('/clients/:id', auth, requierePermiso('verReporteAnalitica'), async (req, res) => {
  try {
    const { id } = req.params;
    const name   = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });
    const active = req.body.active ?? true;
    const { rows } = await pool.query(
      'UPDATE analytics_clients SET name = $1, active = $2 WHERE id = $3 RETURNING id, name, active',
      [name, active, id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Ya existe un cliente con ese nombre' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar el cliente' });
  }
});

// DELETE /api/analytics-report/clients/:id — Eliminar cliente
router.delete('/clients/:id', auth, requierePermiso('verReporteAnalitica'), async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM analytics_clients WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar el cliente' });
  }
});

// ─────────────────── Reporte principal ─────────────────────────────────

// GET /api/analytics-report — Resumen ejecutivo por cliente
router.get('/', auth, requierePermiso('verReporteAnalitica'), async (req, res) => {
  try {
    // 1. Catálogo de clientes
    const dbClients = await getClientsFromDB();
    const clientMap = {};
    dbClients.forEach(c => {
      clientMap[c.name] = {
        id: c.id,
        name: c.name,
        active: c.active,
        projects: [],
        totalProjects: 0,
        activeProjects: 0,
        completedProjects: 0,
        standbyProjects: 0,
        testingProjects: 0,
        backlogProjects: 0,
        avgProgress: 0,
        nextDelivery: null,
        teamMembers: new Set(),
      };
    });

    // 2. Proyectos de analítica
    const { rows: projects } = await pool.query(`
      SELECT p.*,
        u.name  AS assignee_name,
        u.initials AS assignee_initials,
        u.color_index AS assignee_color,
        u2.name AS co_assignee_name,
        u2.initials AS co_assignee_initials,
        u2.color_index AS co_assignee_color
      FROM projects p
      LEFT JOIN users u  ON p.assignee_id = u.id
      LEFT JOIN users u2 ON p.co_assignee_id = u2.id
      WHERE p.tipo = 'analitica'
      ORDER BY p.created_at DESC
    `);

    const projectIds = projects.map(p => p.id);

    // 3. Clientes de cada proyecto (N a M)
    const clientsByProject = {};
    if (projectIds.length) {
      try {
        await ensureProjectClientsTable();
        const { rows } = await pool.query(`
          SELECT pc.project_id, ac.id, ac.name, ac.active
          FROM project_clients pc
          JOIN analytics_clients ac ON ac.id = pc.client_id
          WHERE pc.project_id = ANY($1)
        `, [projectIds]);
        rows.forEach(r => {
          if (!clientsByProject[r.project_id]) clientsByProject[r.project_id] = [];
          const mapped = clientMap[r.name] || {
            id: r.id, name: r.name, active: r.active,
            projects: [], totalProjects: 0, activeProjects: 0, completedProjects: 0,
            standbyProjects: 0, testingProjects: 0, backlogProjects: 0,
            avgProgress: 0, nextDelivery: null, teamMembers: new Set(),
          };
          clientsByProject[r.project_id].push(mapped);
        });
      } catch (err) {
        console.warn('analytics-report: project_clients no disponible', err.message);
      }
    }

    // 4. Tareas (pendientes para fechas de entrega, totales para el detalle)
    let tasksByProject = {};
    if (projectIds.length) {
      const { rows: tasks } = await pool.query(`
        SELECT project_id, id, done, due_date, client_id
        FROM project_tasks
        WHERE project_id = ANY($1)
      `, [projectIds]);
      tasks.forEach(t => {
        if (!tasksByProject[t.project_id]) tasksByProject[t.project_id] = [];
        tasksByProject[t.project_id].push(t);
      });
    }

    // 5. Responsables múltiples
    let assigneesByProject = {};
    if (projectIds.length) {
      try {
        await ensureAssigneesTable();
        const { rows: assignees } = await pool.query(`
          SELECT pa.project_id, u.id, u.name, u.initials
          FROM project_assignees pa
          JOIN users u ON pa.user_id = u.id
          WHERE pa.project_id = ANY($1)
        `, [projectIds]);
        assignees.forEach(a => {
          if (!assigneesByProject[a.project_id]) assigneesByProject[a.project_id] = [];
          assigneesByProject[a.project_id].push({ id: a.id, name: a.name, initials: a.initials });
        });
      } catch (err) {
        console.warn('analytics-report: project_assignees no disponible', err.message);
      }
    }

    // 6. Asignar cada proyecto a sus clientes
    projects.forEach(p => {
      let pClients = clientsByProject[p.id] || [];
      // Fallback a proyectos viejos que guardaban el cliente como texto
      if (!pClients.length && (p.client || '').trim() && clientMap[p.client.trim()]) {
        pClients = [clientMap[p.client.trim()]];
      }

      // Clientes huérfanos (de la tabla puente pero fuera del catálogo no debería pasar; de texto sí)
      let orphans = null;
      if (!pClients.length && (p.client || '').trim()) {
        const name = p.client.trim();
        if (!clientMap[name]) {
          clientMap[name] = {
            id: null, name, active: true,
            projects: [], totalProjects: 0, activeProjects: 0, completedProjects: 0,
            standbyProjects: 0, testingProjects: 0, backlogProjects: 0,
            avgProgress: 0, nextDelivery: null, teamMembers: new Set(),
          };
          orphans = [clientMap[name]];
        }
      }
      const targets = pClients.length ? pClients : (orphans || []);
      if (!targets.length) return;

      const tasks = tasksByProject[p.id] || [];
      const doneCount = tasks.filter(t => t.done).length;
      const extra = assigneesByProject[p.id] || [];
      const deliverable = !['done', 'cancelado'].includes(p.status);

      const projectData = {
        id: p.id,
        name: p.name,
        status: p.status,
        priority: p.priority,
        progress: p.progress,
        progressAnalitica: p.progress_analitica ?? 0,
        participationAnalitica: p.participation_analitica || null,
        startDate: fmtDate(p.start_date),
        dueDate: fmtDate(p.due_date),
        clientIds: targets.map(c => c.id).filter(v => v != null),
        assignee: p.assignee_id ? { id: p.assignee_id, name: p.assignee_name, initials: p.assignee_initials } : null,
        coAssignee: p.co_assignee_id ? { id: p.co_assignee_id, name: p.co_assignee_name, initials: p.co_assignee_initials } : null,
        extraAssignees: extra,
        tasksTotal: tasks.length,
        tasksDone: doneCount,
        pendingDeliveries: deliverable
          ? tasks.filter(t => !t.done && t.due_date).map(t => ({ id: t.id, due: fmtDate(new Date(t.due_date)) }))
          : [],
      };

      targets.forEach(c => {
        c.projects.push(projectData);
        c.totalProjects++;
        if (p.status === 'progress') c.activeProjects++;
        else if (p.status === 'done') c.completedProjects++;
        else if (p.status === 'standby') c.standbyProjects++;
        else if (p.status === 'testing') c.testingProjects++;
        else if (p.status === 'backlog') c.backlogProjects++;

        if (p.assignee_id) c.teamMembers.add(p.assignee_id);
        extra.forEach(a => c.teamMembers.add(a.id));

        // Próxima entrega: la tarea pendiente más próxima (por cliente o del proyecto)
        if (deliverable) {
          const pendingDates = tasks
            .filter(t => !t.done && t.due_date)
            .map(t => ({ client_id: t.client_id, due: new Date(t.due_date) }))
            .filter(t => t.client_id === c.id || t.client_id === null);
          pendingDates.forEach(({ due }) => {
            if (!c.nextDelivery || due < new Date(c.nextDelivery)) c.nextDelivery = fmtDate(due);
          });
        }
      });
    });

    // 7. Promedios + Sets → arrays
    const result = Object.values(clientMap).map(c => ({
      ...c,
      avgProgress: c.totalProjects
        ? Math.round(c.projects.reduce((s, p) => s + p.progress, 0) / c.totalProjects)
        : 0,
      teamMembers: [...c.teamMembers],
      projects: c.projects.sort((a, b) => {
        const order = { progress: 0, testing: 1, standby: 2, backlog: 3, done: 4, cancelado: 5, soporte: 6 };
        return (order[a.status] ?? 9) - (order[b.status] ?? 9);
      }),
    }));

    result.sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return b.totalProjects - a.totalProjects;
    });

    res.json({ clients: result, config: dbClients });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ─────────────────── Histórico y snapshots ─────────────────────────────

// GET /api/analytics-report/history — Histórico de snapshots
router.get('/history', auth, requierePermiso('verReporteAnalitica'), async (req, res) => {
  try {
    const { rows: snapshots } = await pool.query(`
      SELECT * FROM analytics_client_snapshots
      ORDER BY snapshot_date DESC, client_name
      LIMIT 500
    `);
    res.json(snapshots);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/analytics-report/snapshot — Tomar snapshot del estado actual
router.post('/snapshot', auth, requierePermiso('verReporteAnalitica'), async (req, res) => {
  try {
    const { rows: projects } = await pool.query(`
      SELECT id, client, status, progress
      FROM projects
      WHERE tipo = 'analitica'
    `);

    // Clientes de cada proyecto (N a M), con fallback al texto `client`
    await ensureProjectClientsTable();
    const { rows: pcRows } = await pool.query(`
      SELECT pc.project_id, ac.id, ac.name
      FROM project_clients pc
      JOIN analytics_clients ac ON ac.id = pc.client_id
    `);

    const clientsByProject = {};
    pcRows.forEach(r => {
      if (!clientsByProject[r.project_id]) clientsByProject[r.project_id] = [];
      clientsByProject[r.project_id].push(r);
    });

    const clientData = {};
    projects.forEach(p => {
      let pClients = (clientsByProject[p.id] || []).map(c => c.name);
      if (!pClients.length && p.client) pClients = [p.client.trim()];
      pClients.forEach(name => {
        if (!clientData[name]) clientData[name] = { total: 0, active: 0, completed: 0, standby: 0, testing: 0, progressSum: 0 };
        const c = clientData[name];
        c.total++;
        if (p.status === 'progress') c.active++;
        else if (p.status === 'done') c.completed++;
        else if (p.status === 'standby') c.standby++;
        else if (p.status === 'testing') c.testing++;
        c.progressSum += p.progress || 0;
      });
    });

    const today = new Date().toISOString().slice(0, 10);

    // Insertar snapshots de clientes con proyectos
    for (const [clientName, data] of Object.entries(clientData)) {
      await pool.query(`
        INSERT INTO analytics_client_snapshots
          (snapshot_date, client_name, total_projects, active_projects, completed_projects,
           standby_projects, testing_projects, avg_progress, recorded_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        today, clientName, data.total, data.active, data.completed,
        data.standby, data.testing,
        data.total ? Math.round(data.progressSum / data.total) : 0,
        req.user.id,
      ]);
    }

    // Insertar snapshots de clientes configurados sin proyectos
    const dbClients = await getClientsFromDB();
    for (const client of dbClients) {
      if (!clientData[client.name]) {
        await pool.query(`
          INSERT INTO analytics_client_snapshots
            (snapshot_date, client_name, total_projects, active_projects, completed_projects,
             standby_projects, testing_projects, avg_progress, recorded_by)
          VALUES ($1, $2, 0, 0, 0, 0, 0, 0, $3)
        `, [today, client.name, req.user.id]);
      }
    }

    res.json({ success: true, date: today, clients: Object.keys(clientData).length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
