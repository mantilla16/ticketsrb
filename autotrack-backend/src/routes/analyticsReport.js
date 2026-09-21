const router = require('express').Router();
const pool = require('../config/database');
const auth = require('../middleware/auth');
const { requierePermiso } = require('../config/roles');
const { asegurarResponsables, asegurarClientes, asegurarClientesDeProyecto,
        asegurarColumnasDeProyecto, asegurarColumnasDeLog } = require('../db/esquema');

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

// ── Siembra del catálogo ───────────────────────────────────────────────
// La tabla la crea `db/esquema.js`; aquí solo se llena la primera vez. Si ya
// tiene filas no se toca: renombrar o desactivar un cliente desde la interfaz
// no debe deshacerse en el siguiente arranque.
let siembraLista = null;
function sembrarClientes() {
  if (!siembraLista) {
    siembraLista = (async () => {
      await asegurarClientes();
      const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM analytics_clients');
      if (rows[0].n > 0) return;
      for (const c of SEED_CLIENTS) {
        await pool.query(
          'INSERT INTO analytics_clients (name, active) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [c.name, c.active],
        );
      }
    })().catch(err => { siembraLista = null; throw err; });
  }
  return siembraLista;
}

async function getClientsFromDB() {
  await sembrarClientes();
  const { rows } = await pool.query('SELECT id, name, active FROM analytics_clients ORDER BY active DESC, name');
  return rows;
}

function fmtDate(d) {
  return d ? d.toISOString().slice(0, 10) : null;
}

// ───────────────────────── CRUD de clientes ────────────────────────────

/* Leer el catálogo y administrarlo son permisos distintos.
 *
 * Leerlo lo necesita cualquiera que trabaje en la mesa: sin la lista, el
 * selector de cliente de un proyecto sale vacío. Exigir `verReporteAnalitica`
 * —que es un permiso de dirección— dejaba fuera justo al equipo de analítica,
 * y el 403 se tragaba en silencio: en pantalla solo se veía una lista vacía,
 * sin ningún error.
 *
 * Administrarlo va con quien gestiona proyectos. */

// GET /api/analytics-report/clients — Lista de clientes
router.get('/clients', auth, requierePermiso('bandeja'), async (_req, res) => {
  try {
    const clients = await getClientsFromDB();
    res.json(clients);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/analytics-report/clients — Crear cliente
router.post('/clients', auth, requierePermiso('gestionarProyectos'), async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });
    const active = req.body.active !== false;
    await asegurarClientes();
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
router.put('/clients/:id', auth, requierePermiso('gestionarProyectos'), async (req, res) => {
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
router.delete('/clients/:id', auth, requierePermiso('gestionarProyectos'), async (req, res) => {
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
        analyticsLoadedCount: 0,
        analyticsLoadedAt: null,
        analyticsLoadedBy: null,
        teamMembers: new Set(),
      };
    });

    /* 2. Los proyectos a los que les toca analítica.
          No todos la necesitan: un trabajo marcado como que no la requiere no
          debe aparecer aquí ni arrastrar los indicadores —sus clientes
          figurarían como pendientes para siempre y la cobertura no volvería a
          significar nada—. La columna puede faltar en una base que aún no ha
          arrancado con el código nuevo, así que se garantiza antes. */
    await asegurarColumnasDeProyecto();
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
      WHERE p.requires_analytics IS NOT FALSE
      ORDER BY p.created_at DESC
    `);

    const projectIds = projects.map(p => p.id);

    // 3. Clientes de cada proyecto (N a M)
    const clientsByProject = {};
    const cargaPorPareja = new Map();
    if (projectIds.length) {
      try {
        await asegurarClientesDeProyecto();
        const { rows } = await pool.query(`
          SELECT pc.project_id, ac.id, ac.name, ac.active, pc.section_title,
                 pc.analytics_loaded, pc.analytics_loaded_at,
                 u.name AS analytics_loaded_by
          FROM project_clients pc
          JOIN analytics_clients ac ON ac.id = pc.client_id
          LEFT JOIN users u ON u.id = pc.analytics_loaded_by
          WHERE pc.project_id = ANY($1)
        `, [projectIds]);
        rows.forEach(r => {
          if (!clientsByProject[r.project_id]) clientsByProject[r.project_id] = [];
          // La carga es de esta pareja proyecto↔cliente, no del cliente: se
          // guarda aparte para no pisarla cuando el cliente sale en varios.
          cargaPorPareja.set(`${r.project_id}|${r.id}`, {
            loaded: r.analytics_loaded || false,
            at: fmtDate(r.analytics_loaded_at),
            by: r.analytics_loaded_by || null,
          });
          const mapped = clientMap[r.name] || {
            id: r.id, name: r.name, active: r.active, sectionTitle: r.section_title || null,
            projects: [], totalProjects: 0, activeProjects: 0, completedProjects: 0,
            standbyProjects: 0, testingProjects: 0, backlogProjects: 0,
            avgProgress: 0, nextDelivery: null,
            analyticsLoadedCount: 0, analyticsLoadedAt: null, analyticsLoadedBy: null,
            teamMembers: new Set(),
          };
          mapped.sectionTitle = r.section_title || mapped.sectionTitle || null;
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
        SELECT project_id, id, title, done, due_date, client_id, priority, platform_uploaded, assignee_id
        FROM project_tasks
        WHERE project_id = ANY($1)
      `, [projectIds]);
      tasks.forEach(t => {
        if (!tasksByProject[t.project_id]) tasksByProject[t.project_id] = [];
        tasksByProject[t.project_id].push(t);
      });
    }

    // 4b. Comentarios de seguimiento por cliente
    // Solo los que tienen client_id: los generales del proyecto pertenecen a
    // «Seguimiento» y no forman parte del hilo de un cliente concreto.
    const logsByPair = new Map();  // clave "projectId|clientId" → [log, …]
    if (projectIds.length) {
      try {
        await asegurarColumnasDeLog();
        const { rows: logs } = await pool.query(`
          SELECT pl.project_id, pl.client_id, pl.text, pl.created_at,
                 u.name AS author_name, u.initials AS author_initials
          FROM project_logs pl
          LEFT JOIN users u ON u.id = pl.author_id
          WHERE pl.project_id = ANY($1) AND pl.client_id IS NOT NULL
          ORDER BY pl.created_at DESC
        `, [projectIds]);
        logs.forEach(l => {
          const k = `${l.project_id}|${l.client_id}`;
          if (!logsByPair.has(k)) logsByPair.set(k, []);
          logsByPair.get(k).push({
            text: l.text,
            createdAt: l.created_at,
            author: l.author_name || 'Sistema',
            authorInitials: l.author_initials || '',
          });
        });
      } catch (err) {
        console.warn('analytics-report: logs por cliente no disponibles', err.message);
      }
    }

    // 5. Responsables múltiples
    let assigneesByProject = {};
    if (projectIds.length) {
      try {
        await asegurarResponsables();
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
            avgProgress: 0, nextDelivery: null,
            analyticsLoadedCount: 0, analyticsLoadedAt: null, analyticsLoadedBy: null,
            teamMembers: new Set(),
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
        clients: targets.filter(c => c.id != null).map(c => {
          const carga = cargaPorPareja.get(`${p.id}|${c.id}`) || {};
          return {
            id: c.id, name: c.name,
            analyticsLoaded: carga.loaded || false,
            analyticsLoadedAt: carga.at || null,
            analyticsLoadedBy: carga.by || null,
            // Comentarios que se escribieron atados a este cliente en este
            // proyecto. Ya vienen del más reciente al más antiguo.
            logs: logsByPair.get(`${p.id}|${c.id}`) || [],
          };
        }),
        sectionTitle: targets[0]?.sectionTitle || null,
        assignee: p.assignee_id ? { id: p.assignee_id, name: p.assignee_name, initials: p.assignee_initials, colorIndex: p.assignee_color } : null,
        coAssignee: p.co_assignee_id ? { id: p.co_assignee_id, name: p.co_assignee_name, initials: p.co_assignee_initials, colorIndex: p.co_assignee_color } : null,
        extraAssignees: extra,
        assignees: [
          p.assignee_id ? { id: p.assignee_id, name: p.assignee_name, initials: p.assignee_initials, colorIndex: p.assignee_color } : null,
          p.co_assignee_id ? { id: p.co_assignee_id, name: p.co_assignee_name, initials: p.co_assignee_initials, colorIndex: p.co_assignee_color } : null,
          ...extra,
        ].filter(Boolean),
        tasksTotal: tasks.length,
        tasksDone: doneCount,
        tasks: tasks.map(t => ({
          id: t.id, title: t.title, done: t.done, clientId: t.client_id, dueDate: fmtDate(t.due_date), priority: t.priority,
          platformUploaded: t.platform_uploaded || false, assigneeId: t.assignee_id || null,
        })),
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

        /* Cobertura de analítica. A un cliente le basta estar cargado en un
           proyecto para contar como cubierto: la pregunta de dirección es
           «¿a este cliente ya se le hizo?», no «¿en cuántos sitios?». */
        const carga = cargaPorPareja.get(`${p.id}|${c.id}`);
        if (carga?.loaded) {
          c.analyticsLoadedCount++;
          if (!c.analyticsLoadedAt || (carga.at && carga.at > c.analyticsLoadedAt)) {
            c.analyticsLoadedAt = carga.at;
            c.analyticsLoadedBy = carga.by;
          }
        }

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
      analyticsLoaded: c.analyticsLoadedCount > 0,
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
    // Mismo criterio que el reporte: si un trabajo no requiere analítica,
    // tampoco cuenta en el histórico. Si no, las dos vistas se contradirían.
    await asegurarColumnasDeProyecto();
    const { rows: projects } = await pool.query(`
      SELECT id, client, status, progress
      FROM projects
      WHERE requires_analytics IS NOT FALSE
    `);

    // Clientes de cada proyecto (N a M), con fallback al texto `client`
    await asegurarClientesDeProyecto();
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
