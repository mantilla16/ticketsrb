/**
 * Semilla de datos para desarrollo LOCAL.
 *
 *   cd autotrack-backend && npm run seed:local
 *
 * Crea un usuario por cada rol que entiende el código, más proyectos, tareas,
 * avances y solicitudes de ejemplo que cubren todos los estados y los tres
 * `tipo` de proyecto, para poder recorrer Dashboard, Kanban, Gantt, Analítica
 * y Solicitudes sin datos reales.
 *
 * Es re-ejecutable: los usuarios van por ON CONFLICT (email) y los proyectos
 * usan IDs fijos, así que correrlo dos veces no duplica nada.
 *
 * Los correos usan el dominio ficticio @autotrack.local a propósito: nunca
 * pueden coincidir con una cuenta real de @americana.edu.co.
 */
process.env.TZ = 'UTC'; // misma convención que src/index.js
require('dotenv').config();

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Pool } = require('pg');

// Pool propio en vez de src/config/database.js: ese módulo hace un
// pool.connect(cb) de arranque y nunca libera el cliente, así que pool.end()
// se queda esperando para siempre y el script nunca termina.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

if (process.env.NODE_ENV === 'production') {
  console.error('✖ Este script no corre con NODE_ENV=production. Abortado.');
  process.exit(1);
}

const USERS = [
  { email: 'admin@autotrack.local',            name: 'Ana Admin',              role: 'admin' },
  { email: 'lider.analitica@autotrack.local',  name: 'Luis Líder Analítica',   role: 'leader_analytics' },
  { email: 'miembro.analitica@autotrack.local',name: 'Mara Miembro Analítica', role: 'member_analytics' },
  { email: 'ingeniero@autotrack.local',        name: 'Iván Ingeniero',         role: 'engineer' },
  { email: 'ingeniera@autotrack.local',        name: 'Elena Ingeniera',        role: 'engineer' },
  { email: 'coordinacion@autotrack.local',     name: 'Carla Coordinadora',     role: 'coordinator' },
  { email: 'gerencia@autotrack.local',         name: 'Gloria Gerente',         role: 'manager' },
  { email: 'solicitante@autotrack.local',      name: 'Sara Solicitante',       role: 'user' },
];

const initials = (name) =>
  name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('');

// Fechas relativas a hoy para que el Gantt y la barra "Hoy" tengan sentido
const day = (offset) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

async function seedUsers() {
  const ids = {};
  for (let i = 0; i < USERS.length; i++) {
    const u = USERS[i];
    // Hash aleatorio: el acceso es por Google o por /api/auth/dev-login, nunca por clave
    const hash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 12);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password, initials, color_index, role)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role
       RETURNING id`,
      [u.name, u.email, hash, initials(u.name), i % 5, u.role]
    );
    ids[u.email] = rows[0].id;
  }
  return ids;
}

async function seedProjects(u) {
  const admin     = u['admin@autotrack.local'];
  const liderAna  = u['lider.analitica@autotrack.local'];
  const miembroAna= u['miembro.analitica@autotrack.local'];
  const ing       = u['ingeniero@autotrack.local'];
  const inga      = u['ingeniera@autotrack.local'];

  const projects = [
    {
      id: 'seed-auto-001', name: 'Automatización de conciliación bancaria',
      description: 'Robot que cruza el extracto del banco contra el auxiliar contable y genera el papel de trabajo.',
      client: 'Contabilidad', status: 'progress', priority: 'high', tipo: 'automatizacion',
      assignee: ing, extra: [inga], start: day(-20), due: day(15),
      tasks: [
        { title: 'Levantar requerimiento con Contabilidad', done: true,  weight: 2, assignee: ing,  due: day(-15) },
        { title: 'Parser del extracto en PDF',              done: true,  weight: 3, assignee: ing,  due: day(-8) },
        { title: 'Motor de cruce determinístico',           done: false, weight: 3, assignee: inga, due: day(6) },
        { title: 'Pruebas con cierre de mes real',          done: false, weight: 2, assignee: ing,  due: day(12) },
      ],
      logs: [
        { author: ing,  text: 'Parser de extracto terminado. Lee los 3 formatos que usa el banco.' },
        { author: inga, text: 'Arranca el motor de cruce. Falta definir la tolerancia en fechas.' },
      ],
    },
    {
      id: 'seed-ana-002', name: 'Tablero de deserción estudiantil',
      description: 'Modelo descriptivo y tablero de seguimiento de deserción por programa y periodo.',
      client: 'Vicerrectoría Académica', status: 'backlog', priority: 'mid', tipo: 'analitica',
      assignee: miembroAna, extra: [], start: day(3), due: day(45),
      tasks: [
        { title: 'Inventario de fuentes de datos', done: false, weight: 2, assignee: miembroAna, due: day(10) },
        { title: 'Definir indicadores con el área', done: false, weight: 1, assignee: liderAna,  due: day(14) },
      ],
      logs: [],
    },
    {
      id: 'seed-comp-003', name: 'Portal de indicadores de admisiones',
      description: 'Proyecto compartido: Automatización monta la ETL y Analítica el tablero.',
      client: 'Admisiones', status: 'testing', priority: 'high', tipo: 'compartido',
      assignee: inga, extra: [miembroAna], co: miembroAna, general: liderAna,
      start: day(-40), due: day(8),
      participationAuto: 'ETL y carga incremental a la bodega',
      participationAnalitica: 'Modelo semántico y tablero final',
      progressAuto: 80, progressAnalitica: 55,
      tasks: [
        { title: 'ETL de admisiones',            done: true,  weight: 3, assignee: inga,        due: day(-20) },
        { title: 'Validación de cifras vs ERP',  done: true,  weight: 2, assignee: inga,        due: day(-10) },
        { title: 'Tablero en producción',        done: false, weight: 3, assignee: miembroAna,  due: day(5) },
      ],
      logs: [
        { author: inga, text: 'ETL validada contra el ERP, cuadra al peso. Pasa a Analítica.' },
      ],
    },
    {
      id: 'seed-sop-004', name: 'Soporte robot de matrículas',
      description: 'Atención de incidencias del robot ya en producción.',
      client: 'Registro y Control', status: 'soporte', priority: 'mid', tipo: 'automatizacion',
      assignee: ing, extra: [], start: day(-90), due: null, wasSoporte: true,
      tasks: [
        { title: 'Revisar log de fallos del lunes', done: true, weight: 1, assignee: ing, due: day(-2) },
      ],
      logs: [
        { author: ing, text: 'El fallo era un cambio de selector en el portal. Ajustado.' },
      ],
    },
    {
      id: 'seed-done-005', name: 'Automatización de certificados laborales',
      description: 'Generación y envío automático de certificados laborales.',
      client: 'Talento Humano', status: 'done', priority: 'low', tipo: 'automatizacion',
      assignee: inga, extra: [], start: day(-120), due: day(-30),
      tasks: [
        { title: 'Plantilla del certificado', done: true, weight: 1, assignee: inga, due: day(-60) },
        { title: 'Envío por correo',          done: true, weight: 2, assignee: inga, due: day(-40) },
      ],
      logs: [
        { author: inga, text: 'Entregado y en producción. 340 certificados el primer mes.' },
      ],
    },
    {
      id: 'seed-flash-006', name: 'Extracción rápida de datos para auditoría',
      description: 'Asignación flash: consulta puntual solicitada por Revisoría.',
      client: 'Revisoría Fiscal', status: 'progress', priority: 'high', tipo: 'asignacion_flash',
      assignee: miembroAna, extra: [], start: day(-2), due: day(2),
      tasks: [
        { title: 'Armar la consulta y exportar', done: false, weight: 1, assignee: miembroAna, due: day(1) },
      ],
      logs: [],
    },
  ];

  for (const p of projects) {
    await pool.query(
      `INSERT INTO projects
         (id, name, description, client, status, priority, assignee_id, start_date, due_date,
          progress, tipo, co_assignee_id, general_assignee_id,
          participation_auto, participation_analitica, progress_auto, progress_analitica,
          created_by, was_soporte)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       ON CONFLICT (id) DO UPDATE SET
         name=EXCLUDED.name, description=EXCLUDED.description, client=EXCLUDED.client,
         status=EXCLUDED.status, priority=EXCLUDED.priority, assignee_id=EXCLUDED.assignee_id,
         start_date=EXCLUDED.start_date, due_date=EXCLUDED.due_date, tipo=EXCLUDED.tipo,
         co_assignee_id=EXCLUDED.co_assignee_id, general_assignee_id=EXCLUDED.general_assignee_id,
         participation_auto=EXCLUDED.participation_auto,
         participation_analitica=EXCLUDED.participation_analitica,
         progress_auto=EXCLUDED.progress_auto, progress_analitica=EXCLUDED.progress_analitica,
         was_soporte=EXCLUDED.was_soporte, updated_at=NOW()`,
      [p.id, p.name, p.description, p.client, p.status, p.priority, p.assignee,
       p.start, p.due, p.tipo, p.co || null, p.general || null,
       p.participationAuto || null, p.participationAnalitica || null,
       p.progressAuto || 0, p.progressAnalitica || 0, admin, p.wasSoporte || false]
    );

    // Responsables múltiples (misma tabla que usa syncAssignees)
    await pool.query('DELETE FROM project_assignees WHERE project_id=$1', [p.id]);
    const ids = [...new Set([p.assignee, ...(p.extra || [])].filter(Boolean))];
    for (const uid of ids) {
      await pool.query(
        'INSERT INTO project_assignees (project_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [p.id, uid]
      );
    }

    // Tareas y avances se recrean para no acumular duplicados al re-ejecutar
    await pool.query('DELETE FROM project_tasks WHERE project_id=$1', [p.id]);
    for (const t of p.tasks) {
      await pool.query(
        `INSERT INTO project_tasks (project_id, title, done, due_date, created_by, assignee_id, weight)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [p.id, t.title, t.done, t.due, admin, t.assignee, t.weight]
      );
    }

    await pool.query('DELETE FROM project_logs WHERE project_id=$1', [p.id]);
    for (const l of p.logs) {
      await pool.query(
        'INSERT INTO project_logs (project_id, author_id, text, progress) VALUES ($1,$2,$3,NULL)',
        [p.id, l.author, l.text]
      );
    }

    // El progreso lo manda el % de tareas hechas — igual que recalcProgress()
    const done = p.tasks.filter(t => t.done).length;
    const progress = p.tasks.length ? Math.round((done / p.tasks.length) * 100) : 0;
    await pool.query('UPDATE projects SET progress=$1 WHERE id=$2', [progress, p.id]);
  }

  return projects.length;
}

async function seedSolicitudes(u) {
  const solicitante = u['solicitante@autotrack.local'];
  const ing         = u['ingeniero@autotrack.local'];
  const miembroAna  = u['miembro.analitica@autotrack.local'];

  const rows = [
    {
      title: 'Automatizar el reporte semanal de cartera',
      description: 'Hoy se arma a mano en Excel, toma 4 horas cada lunes.',
      type: 'automatizacion', priority: 'alta', area: 'Cartera',
      status: 'recibido', equipo: 'automatizacion', assignee: null,
      frecuencia: 'Semanal', herramientas: 'Excel, SAP',
      impacto: 'Libera 16 horas al mes del equipo de Cartera', urgencia: 'alta',
      dueDate: day(30), fechaReunion: null, notes: null,
    },
    {
      title: 'Tablero de ocupación de aulas',
      description: 'Necesitamos ver ocupación por bloque, día y franja horaria.',
      type: 'analitica', priority: 'media', area: 'Planeación',
      status: 'reunion_agendada', equipo: 'analitica', assignee: miembroAna,
      frecuencia: 'Diaria', herramientas: 'Power BI, Banner',
      impacto: 'Mejor asignación de espacios en el próximo periodo', urgencia: 'media',
      dueDate: day(60), fechaReunion: `${day(3)} 15:00:00`,
      notes: 'Reunión para acotar el alcance y confirmar fuentes de datos.',
    },
    {
      title: 'Robot para radicar facturas de proveedores',
      description: 'Radicación manual en el portal, ~120 facturas al mes.',
      type: 'automatizacion', priority: 'alta', area: 'Cuentas por Pagar',
      status: 'aceptado', equipo: 'automatizacion', assignee: ing,
      frecuencia: 'Mensual', herramientas: 'Portal proveedores, SAP',
      impacto: 'Elimina reprocesos y errores de digitación', urgencia: 'alta',
      dueDate: day(45), fechaReunion: `${day(-5)} 10:00:00`,
      notes: 'Aprobada. Entra al backlog de Automatización este sprint.',
    },
    {
      title: 'Enviar recordatorios por WhatsApp a estudiantes',
      description: 'Mensajes automáticos de fechas de pago.',
      type: 'requerimiento', priority: 'baja', area: 'Financiera',
      status: 'rechazado', equipo: 'automatizacion', assignee: null,
      frecuencia: 'Mensual', herramientas: 'WhatsApp Business',
      impacto: 'Reducir mora temprana', urgencia: 'baja',
      dueDate: null, fechaReunion: null,
      notes: 'No hay licencia de WhatsApp Business API. Se retoma cuando exista.',
    },
  ];

  await pool.query('DELETE FROM solicitudes WHERE nombre_solicitante = $1', ['Sara Solicitante']);
  for (const s of rows) {
    await pool.query(
      `INSERT INTO solicitudes
         (title, description, type, priority, area, due_date, user_id, assignee_id,
          status, notes, frecuencia, herramientas, impacto, urgencia,
          nombre_solicitante, correo_solicitante, fecha_reunion, equipo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [s.title, s.description, s.type, s.priority, s.area, s.dueDate, solicitante, s.assignee,
       s.status, s.notes, s.frecuencia, s.herramientas, s.impacto, s.urgencia,
       'Sara Solicitante', 'solicitante@autotrack.local', s.fechaReunion, s.equipo]
    );
  }
  return rows.length;
}

(async () => {
  try {
    const users = await seedUsers();
    console.log(`✔ ${Object.keys(users).length} usuarios`);
    const nP = await seedProjects(users);
    console.log(`✔ ${nP} proyectos (con tareas, responsables y avances)`);
    const nS = await seedSolicitudes(users);
    console.log(`✔ ${nS} solicitudes`);
    console.log('\nEntra en http://localhost:5173 con el panel naranja "ACCESO LOCAL DE DESARROLLO".');
    console.log('Para ver todo, usa Ana Admin (admin@autotrack.local).');
  } catch (err) {
    console.error('\n✖ Falló la semilla:', err.message);
    if (err.code === '42P01') {
      console.error('  Falta una tabla. Corre primero:  npm run db:schema');
    }
    if (err.code === '3D000' || err.code === '28P01' || err.code === 'ECONNREFUSED') {
      console.error('  Revisa que la base "autotrack" y el rol existan, y el DATABASE_URL del .env');
    }
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
