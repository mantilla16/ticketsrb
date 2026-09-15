const router = require('express').Router();
const pool = require('../config/database');
const auth = require('../middleware/auth');
const { requierePermiso } = require('../config/roles');

// Clientes configurados del proyecto de analítica
const ANALYTICS_CLIENTS = [
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

// La tabla project_assignees la crea en caliente projects.js; acá se replica
// el ensure por si una base vieja aún no la tiene.
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

function fmtDate(d) {
  return d ? d.toISOString().slice(0, 10) : null;
}

// GET /api/analytics-report — Resumen ejecutivo por cliente
router.get('/', auth, requierePermiso('verReporteAnalitica'), async (req, res) => {
  try {
    // Obtener todos los proyectos de analítica
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

    // Obtener tareas para cada proyecto
    const projectIds = projects.map(p => p.id);
    let tasksByProject = {};
    if (projectIds.length) {
      const { rows: tasks } = await pool.query(
        'SELECT project_id, COUNT(*)::int AS total, COUNT(*) FILTER (WHERE done)::int AS done FROM project_tasks WHERE project_id = ANY($1) GROUP BY project_id',
        [projectIds]
      );
      tasks.forEach(t => { tasksByProject[t.project_id] = t; });
    }

    // Obtener responsables extras
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
        // La tabla de responsables múltiples es opcional; el reporte funciona sin ella.
        console.warn('analytics-report: project_assignees no disponible', err.message);
      }
    }

    // Agrupar proyectos por cliente
    const clientMap = {};
    ANALYTICS_CLIENTS.forEach(c => {
      clientMap[c.name] = {
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

    // También crear entradas para clientes que no están en la lista
    projects.forEach(p => {
      const clientName = (p.client || '').trim();
      if (clientName && !clientMap[clientName]) {
        clientMap[clientName] = {
          name: clientName,
          active: true,
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
      }
    });

    // Llenar datos de proyectos
    projects.forEach(p => {
      const clientName = (p.client || '').trim();
      if (!clientName || !clientMap[clientName]) return;

      const client = clientMap[clientName];
      const tasks = tasksByProject[p.id] || { total: 0, done: 0 };
      const extra = assigneesByProject[p.id] || [];

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
        assignee: p.assignee_id ? { id: p.assignee_id, name: p.assignee_name, initials: p.assignee_initials } : null,
        coAssignee: p.co_assignee_id ? { id: p.co_assignee_id, name: p.co_assignee_name, initials: p.co_assignee_initials } : null,
        extraAssignees: extra,
        tasksTotal: tasks.total,
        tasksDone: tasks.done,
      };

      client.projects.push(projectData);
      client.totalProjects++;

      if (p.status === 'progress') client.activeProjects++;
      else if (p.status === 'done') client.completedProjects++;
      else if (p.status === 'standby') client.standbyProjects++;
      else if (p.status === 'testing') client.testingProjects++;
      else if (p.status === 'backlog') client.backlogProjects++;

      if (p.assignee_id) client.teamMembers.add(p.assignee_id);
      extra.forEach(a => client.teamMembers.add(a.id));

      // Próxima entrega
      if (p.due_date && p.status !== 'done' && p.status !== 'cancelado') {
        const due = new Date(p.due_date);
        if (!client.nextDelivery || due < new Date(client.nextDelivery)) {
          client.nextDelivery = fmtDate(p.due_date);
        }
      }
    });

    // Calcular promedios y convertir sets a arrays
    const result = Object.values(clientMap).map(c => {
      const avg = c.totalProjects
        ? Math.round(c.projects.reduce((sum, p) => sum + p.progress, 0) / c.totalProjects)
        : 0;
      return {
        ...c,
        avgProgress: avg,
        teamMembers: [...c.teamMembers],
        projects: c.projects.sort((a, b) => {
          const statusOrder = { progress: 0, testing: 1, standby: 2, backlog: 3, done: 4, cancelado: 5, soporte: 6 };
          return (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
        }),
      };
    });

    // Ordenar: activos primero, luego por cantidad de proyectos
    result.sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return b.totalProjects - a.totalProjects;
    });

    res.json({ clients: result, config: ANALYTICS_CLIENTS });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

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
    // Obtener todos los proyectos de analítica agrupados por cliente
    const { rows: projects } = await pool.query(`
      SELECT client, status, progress
      FROM projects
      WHERE tipo = 'analitica' AND client IS NOT NULL AND client != ''
    `);

    const clientData = {};
    projects.forEach(p => {
      const name = p.client.trim();
      if (!clientData[name]) {
        clientData[name] = { total: 0, active: 0, completed: 0, standby: 0, testing: 0, progressSum: 0 };
      }
      const c = clientData[name];
      c.total++;
      if (p.status === 'progress') c.active++;
      else if (p.status === 'done') c.completed++;
      else if (p.status === 'standby') c.standby++;
      else if (p.status === 'testing') c.testing++;
      c.progressSum += p.progress || 0;
    });

    // Insertar snapshots
    const today = new Date().toISOString().slice(0, 10);
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

    // También agregar clientes configurados sin proyectos
    for (const client of ANALYTICS_CLIENTS) {
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
