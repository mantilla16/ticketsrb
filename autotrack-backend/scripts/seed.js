#!/usr/bin/env node
// Ejecutar desde autotrack-backend: node scripts/seed.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const DEFAULT_PASS = 'americana2026';

/* ── EQUIPO ── */
const USERS = [
  { name: 'Bleiner Morales',  email: 'bleinermorales@americana.edu.co' },
  { name: 'Miguel Padilla',   email: 'miguelpadilla@americana.edu.co' },
  { name: 'Andres Holguin',   email: 'andresholguin@americana.edu.co' },
  { name: 'Carlos Daniel',    email: 'carlosdaniel@americana.edu.co' },
  { name: 'Brayan Lozano',    email: 'brayanlozano@americana.edu.co' },
  { name: 'Alberto Mantilla', email: 'albertomantilla@americana.edu.co' },
  { name: 'Nelson Gamez',     email: 'nelsongamez@americana.edu.co' },
  { name: 'Roger Florez',     email: 'rogerflorez@americana.edu.co' },
];

/* ── PROYECTOS ── */
const PROJECTS = [
  {
    id: 'coursera',
    name: 'Coursera',
    description: 'Integración de la plataforma Coursera al ecosistema académico, fortaleciendo el modelo de educación digital y habilitando analítica de datos oportuna.',
    client: 'Innovación Educativa',
    status: 'done', priority: 'mid', progress: 100,
    assignee: 'bleiner morales', dueDate: null, startDate: '2026-01-24',
    log: 'Finalizado-Soporte. Inconveniente con correos de estudiantes (uno en Coursera, otro en SINU). Analítica en soporte.',
  },
  {
    id: 'abblo',
    name: 'Abblo',
    description: 'Automatización de calificación de actividades en Centro de Idiomas mediante agente que integra información de la plataforma y criterios docentes en n8n con RAGs.',
    client: 'Centro de Idiomas',
    status: 'progress', priority: 'mid', progress: 70,
    assignee: 'bleiner morales', dueDate: null, startDate: '2026-01-24',
    log: 'Se realizó reunión con la Doc Claudia. Se analizaron alternativas de IA de transcripción (Whisper vs. ElevenLabs). Se propuso entrenar un LLM para transcribir y crear tutor virtual para práctica previa.',
  },
  {
    id: 'prizma-cua',
    name: 'Prizma CUA',
    description: 'Agentes especializados para gestión de contenido académico en virtualización CUA — optimizan etapas del proceso, reducen tiempos y garantizan estandarización escalable.',
    client: 'Audiovisual y Diseño',
    status: 'done', priority: 'mid', progress: 100,
    assignee: 'carlos daniel', dueDate: null, startDate: '2026-01-24',
    log: 'Finalizado - Soporte. Pendiente ajuste a los OVA de los espacios en blanco.',
  },
  {
    id: 'prizma-litoral',
    name: 'Prizma Litoral',
    description: 'Agentes especializados para gestión de contenido académico en virtualización del programa Litoral.',
    client: 'Litoral',
    status: 'done', priority: 'mid', progress: 100,
    assignee: 'carlos daniel', dueDate: null, startDate: '2026-01-24',
    log: 'Finalizado - Soporte. Pendiente ajuste a los OVA de los espacios en blanco.',
  },
  {
    id: 'pdf-litoral',
    name: 'PDF Litoral',
    description: 'Automatización de generación de recursos PDF reduciendo tiempos de producción y asegurando contenido académico estandarizado de forma ágil y escalable.',
    client: 'Litoral',
    status: 'done', priority: 'high', progress: 100,
    assignee: 'carlos daniel', dueDate: '2026-02-04', startDate: '2026-01-28',
    log: 'Proyecto asignado a Bleiner con apoyo de Carlos, explorando alternativa para generar PDF mediante HTML e imágenes desde el código.',
  },
  {
    id: 'egresados',
    name: 'Egresados y Empleabilidad',
    description: 'Optimización del seguimiento de egresados mediante centralización y automatización — valida requisitos, reduce tiempos y aumenta confiabilidad de datos para grado.',
    client: 'Egresados',
    status: 'done', priority: 'high', progress: 100,
    assignee: 'brayan lozano', dueDate: null, startDate: '2026-01-24',
    log: 'Finalizado - Soporte. Se implementaron ajustes solicitados y la automatización ya se encuentra funcionando.',
  },
  {
    id: 'gohighlevel-zoho',
    name: 'GoHighLevel con Zoho',
    description: 'Integración de GoHighLevel con Zoho para Mercadeo. Ajustes en standby porque ahora se prioriza conexión directa GoHighLevel → SINU.',
    client: 'Mercadeo',
    status: 'done', priority: 'mid', progress: 100,
    assignee: 'alberto mantilla', dueDate: null, startDate: '2026-01-24',
    log: 'Finalizado - Soporte. Los ajustes originales quedaron en standby por el cambio de prioridad a GoHighLevel con SINU.',
  },
  {
    id: 'contrasenas-correos',
    name: 'Contraseñas de Correos',
    description: 'Rotación periódica de contraseñas de cuentas de gestión de contenido, reduciendo riesgos de acceso no autorizado y protegiendo información de virtualización.',
    client: 'Automatización',
    status: 'done', priority: 'low', progress: 100,
    assignee: 'brayan lozano', dueDate: null, startDate: '2026-01-24',
    log: 'Finalizado - Soporte.',
  },
  {
    id: 'gohighlevel-sinu',
    name: 'GoHighLevel con SINU',
    description: 'Automatización del registro de personas interesadas desde GoHighLevel hacia SINU — reduce errores manuales y mantiene estados actualizados en ambas plataformas.',
    client: 'Mercadeo',
    status: 'done', priority: 'high', progress: 95,
    assignee: 'alberto mantilla', dueDate: null, startDate: '2026-01-27',
    log: 'Queda pendiente únicamente la actualización del campo Estado, pero ya está funcionando la automatización de registro.',
  },
  {
    id: 'nebula',
    name: 'Nebula',
    description: 'Plataforma central para controlar la ejecución de agentes, reduciendo dependencia de herramientas externas y mejorando la estabilidad y gestión del área.',
    client: 'Automatización',
    status: 'progress', priority: 'high', progress: 45,
    assignee: 'carlos daniel', dueDate: null, startDate: '2026-01-24',
    log: 'Analítica pendiente conectar la base de datos a SINU para que Carlos la conecte con Nebula. Próxima semana: normalización de datos de programas para seguimiento.',
  },
  {
    id: 'cert-estudios',
    name: 'Automatización de Certificados de Estudios',
    description: 'Generación automática de certificados de estudio, reduciendo tiempos de respuesta y eliminando procesos manuales en Admisiones.',
    client: 'Admisiones',
    status: 'done', priority: 'mid', progress: 100,
    assignee: 'bleiner morales', dueDate: null, startDate: '2026-01-24',
    log: 'Finalizado - Seguimiento mensual de recargas (monitorizar antes del 10 de cada mes para ajustar el plan de créditos).',
  },
  {
    id: 'cert-laborales',
    name: 'Automatización de Certificados Laborales',
    description: 'Generación automatizada de certificados laborales para empleados activos y desvinculados, mejorando la experiencia del colaborador en Talento Humano.',
    client: 'Talento Humano',
    status: 'progress', priority: 'mid', progress: 50,
    assignee: 'carlos daniel', dueDate: null, startDate: '2026-02-28',
    log: 'Estamos a la espera que el área de Talento Humano envíe los tipos de certificados laborales para continuar.',
  },
  {
    id: 'tablero-seguimiento',
    name: 'Tablero de Seguimiento de Datos',
    description: 'Dashboard de seguimiento para automatizaciones y certificados: cuántas veces falla, optimización de recursos y seguimiento mensual.',
    client: 'Admisiones',
    status: 'backlog', priority: 'mid', progress: 0,
    assignee: null, dueDate: null, startDate: null,
    log: 'A futuro — cuántas veces falla, optimización de recursos, seguimiento mensual.',
  },
  {
    id: 'matriculas',
    name: 'Matrículas',
    description: 'Dashboard de matrículas para Rectoría con seguimiento, toma de decisiones basada en datos y metas de programa actualizadas.',
    client: 'Rectoría',
    status: 'done', priority: 'high', progress: 100,
    assignee: 'miguel padilla', dueDate: null, startDate: '2026-01-24',
    log: 'Finalizado - Soporte. Se trabajará en metas 2026-2 para actualizar el reporte. URGENTE: revisión de metas el 9/5/2026.',
  },
  {
    id: 'informe-comparativo',
    name: 'Informe Comparativo',
    description: 'Tablero de informe comparativo histórico para Rectoría. En soporte, pendiente versión mejorada.',
    client: 'Rectoría',
    status: 'done', priority: 'high', progress: 100,
    assignee: 'miguel padilla', dueDate: null, startDate: '2026-01-24',
    log: 'Finalizado - Soporte.',
  },
  {
    id: 'seguimiento-abonos',
    name: 'Seguimiento de Abonos',
    description: 'Dashboard de seguimiento de abonos para Mercadeo, Financiamiento y Bienestar.',
    client: 'Mercadeo - Financiamiento - Bienestar',
    status: 'done', priority: 'mid', progress: 100,
    assignee: 'miguel padilla', dueDate: null, startDate: '2026-01-24',
    log: 'Finalizado - Soporte, susceptible a versiones.',
  },
  {
    id: 'plataformas-ingles',
    name: 'Plataformas de Inglés',
    description: 'Dashboard de seguimiento de plataformas de inglés para el área de Programas.',
    client: 'Programas',
    status: 'done', priority: 'mid', progress: 100,
    assignee: 'miguel padilla', dueDate: null, startDate: '2026-01-24',
    log: 'Finalizado - Soporte.',
  },
  {
    id: 'seg-matriculas',
    name: 'Seguimiento de Matrículas',
    description: 'Analítica de seguimiento detallado de matrículas por programa con integración n8n.',
    client: 'Programas',
    status: 'backlog', priority: 'high', progress: 0,
    assignee: 'miguel padilla', dueDate: null, startDate: null,
    log: 'A futuro — previsto para el segundo semestre.',
  },
  {
    id: 'pines-ingles',
    name: 'Pines de Inglés - Partikle',
    description: 'Plataforma de consulta por cédula para ver estado de estudiantes en Partikle y su nivel. Versión 2.0 planificada para el segundo semestre.',
    client: 'Partikle',
    status: 'done', priority: 'mid', progress: 100,
    assignee: 'miguel padilla', dueDate: null, startDate: '2026-01-24',
    log: 'Finalizado - Soporte. Se trabajará en versión 2.0 para el segundo semestre, hay otras áreas interesadas.',
  },
  {
    id: 'rendicion-cuentas',
    name: 'Rendición de Cuentas',
    description: 'Visualización de datos de rendición de cuentas para Rectoría, con escalabilidad en presentación y análisis de población estudiantil.',
    client: 'Rectoría',
    status: 'done', priority: 'mid', progress: 100,
    assignee: 'miguel padilla', dueDate: null, startDate: '2026-01-27',
    log: 'Finalizado - Soporte.',
  },
  {
    id: 'clases-virtualidad',
    name: 'Seguimiento Clases de Virtualidad',
    description: 'Dashboard de seguimiento a clases de virtualidad mediante análisis de asistencia de Meet.',
    client: 'Programas - Virtualidad',
    status: 'progress', priority: 'mid', progress: 88,
    assignee: 'miguel padilla', dueDate: '2026-05-12', startDate: '2026-01-29',
    log: 'Ya está listo el dashboard. Próxima semana se entregará el tablero (martes 12/5/2026). Pendiente incluir análisis cualitativo para versión 2.0.',
  },
  {
    id: 'correos-financiamiento',
    name: 'Asignación de Correos de Financiamiento',
    description: 'Automatización de asignación de correos electrónicos para el área de Financiamiento.',
    client: 'Financiamiento',
    status: 'backlog', priority: 'low', progress: 0,
    assignee: 'bleiner morales', dueDate: null, startDate: null,
    log: 'A futuro — Bleiner lo comenzó pero no se terminó. Pendiente reunión con el área.',
  },
  {
    id: 'dashboard-prizma',
    name: 'Dashboard de Casos en PRIZMA',
    description: 'Dashboard de seguimiento de casos en PRIZMA para Experiencias y Diseño de Productos.',
    client: 'Experiencias y Diseño',
    status: 'backlog', priority: 'high', progress: 0,
    assignee: 'miguel padilla', dueDate: null, startDate: '2026-01-28',
    log: 'Proyecto cancelado.',
  },
  {
    id: 'rpta-customer',
    name: 'Respuestas Automáticas - Customer Services',
    description: 'Automatización de atención de consultas frecuentes vía WhatsApp y correo sobre PRIZMA, mejorando disponibilidad y tiempos de respuesta.',
    client: 'Audiovisual y Diseño',
    status: 'testing', priority: 'high', progress: 90,
    assignee: 'carlos daniel', dueDate: null, startDate: '2026-01-23',
    log: 'Pendiente reunión con Daniela para presentar flujo de correos y WhatsApp Business oficialmente.',
  },
  {
    id: 'noticias-cv',
    name: 'Búsqueda de Noticias - CV Noticias',
    description: 'Automatización de búsqueda y análisis de noticias en tendencia para periodistas, agilizando producción informativa y mejorando reacción del área.',
    client: 'CV Noticias',
    status: 'done', priority: 'mid', progress: 100,
    assignee: 'brayan lozano', dueDate: null, startDate: '2026-01-29',
    log: 'Finalizado - Soporte.',
  },
  {
    id: 'kpi-bienestar',
    name: 'KPI de Bienestar',
    description: 'Scripts de Python para extracción, transformación y cálculo de 5 KPIs de Bienestar: TAI (tasa de ausencia intersemestral), tasa de deserción anual y otros.',
    client: 'Bienestar',
    status: 'progress', priority: 'mid', progress: 50,
    assignee: 'miguel padilla', dueDate: null, startDate: '2026-02-05',
    log: '5 KPI se están levantando con scripts en Python. Se entregará un código para que suban a plataforma y calculen los KPI automáticamente.',
  },
  {
    id: 'movilidad-convenio',
    name: 'Movilidad y Convenio',
    description: 'Gestión de movilidad y convenios internacionales. Requerimiento escalado a Partikle por tratarse de desarrollo de aplicativo fuera del alcance de Automatización.',
    client: 'Internacionalización',
    status: 'standby', priority: 'low', progress: 0,
    assignee: 'alberto mantilla', dueDate: null, startDate: '2026-02-02',
    log: 'Standby — el requerimiento es un desarrollo de aplicativo, competencia de Partikle, no del área de Automatización.',
  },
  {
    id: 'capacidad-correos',
    name: 'Capacidad de Correos Electrónicos',
    description: 'Análisis de capacidad, gestión y limpieza de correos electrónicos institucionales. Directriz para determinar cambios y eliminaciones de licencias.',
    client: 'Gestión TICS',
    status: 'progress', priority: 'mid', progress: 60,
    assignee: 'miguel padilla', dueDate: null, startDate: '2026-02-12',
    log: 'Nueva directriz para determinar cuándo y a quiénes se deben cambiar correos de licencia o eliminarlos.',
  },
  {
    id: 'asexpress',
    name: 'Asexpress',
    description: 'Propuesta de automatización y analítica de datos para empresa consultora externa. Análisis de costos de plataformas y equipos incluido.',
    client: 'Consultoría',
    status: 'standby', priority: 'mid', progress: 40,
    assignee: 'miguel padilla', dueDate: null, startDate: '2026-02-07',
    log: 'Propuesta comercial enviada, queda a manos de Luis Javer para decisión final.',
  },
  {
    id: 'agente-planeador',
    name: 'Agente de Planeador',
    description: 'Automatización de generación del planeador docente a partir de información académica existente, reduciendo carga manual y mejorando estandarización.',
    client: 'Innovación Educativa',
    status: 'standby', priority: 'mid', progress: 65,
    assignee: 'nelson gamez', dueDate: null, startDate: '2026-02-25',
    log: 'Pendiente reunión con Liz y Mari para pruebas del agente. Formato de salida cambiado de Word a Excel para bloquear celdas no editables.',
  },
  {
    id: 'agente-matriz',
    name: 'Agente de Matriz de Correspondencia',
    description: 'Automatización de la construcción de la matriz de correspondencia de programas académicos, garantizando consistencia en la asignación de competencias.',
    client: 'Innovación Educativa',
    status: 'standby', priority: 'high', progress: 50,
    assignee: 'bleiner morales', dueDate: null, startDate: '2026-02-25',
    log: 'Pendiente reunión con Liz y Mari para pruebas del agente y compartirlo oficialmente.',
  },
];

async function main() {
  const client = await pool.connect();
  const hash = await bcrypt.hash(DEFAULT_PASS, 10);

  try {
    await client.query('BEGIN');

    // ── Insertar / actualizar usuarios ──
    console.log('\n👥 Insertando usuarios...');
    const userMap = {};
    for (let i = 0; i < USERS.length; i++) {
      const u = USERS[i];
      const initials = u.name.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
      const { rows } = await client.query(`
        INSERT INTO users (name, email, password, initials, color_index)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (email) DO UPDATE
          SET name = EXCLUDED.name, initials = EXCLUDED.initials
        RETURNING id, name
      `, [u.name, u.email, hash, initials, i % 5]);
      userMap[u.name.toLowerCase()] = rows[0].id;
      console.log(`  ✓ ${rows[0].name} (id: ${rows[0].id})`);
    }

    // ── Insertar / actualizar proyectos ──
    console.log('\n📁 Insertando proyectos...');
    const bleinerIdFallback = userMap['bleiner morales'];

    for (const p of PROJECTS) {
      const assigneeId = p.assignee ? (userMap[p.assignee] || null) : null;

      await client.query(`
        INSERT INTO projects (id, name, description, client, status, priority, assignee_id, start_date, due_date, progress, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT (id) DO UPDATE SET
          name        = EXCLUDED.name,
          description = EXCLUDED.description,
          client      = EXCLUDED.client,
          status      = EXCLUDED.status,
          priority    = EXCLUDED.priority,
          assignee_id = EXCLUDED.assignee_id,
          due_date    = EXCLUDED.due_date,
          progress    = EXCLUDED.progress
      `, [
        p.id, p.name, p.description, p.client,
        p.status, p.priority, assigneeId,
        p.startDate || null, p.dueDate || null,
        p.progress, bleinerIdFallback,
      ]);

      // Añadir log solo si no existe ninguno para este proyecto
      if (p.log) {
        const existing = await client.query(
          'SELECT id FROM project_logs WHERE project_id = $1 LIMIT 1', [p.id]
        );
        if (existing.rows.length === 0) {
          await client.query(
            'INSERT INTO project_logs (project_id, author_id, text, progress) VALUES ($1,$2,$3,$4)',
            [p.id, assigneeId || bleinerIdFallback, p.log, p.progress]
          );
        }
      }

      console.log(`  ✓ [${p.status.toUpperCase()}] ${p.name}`);
    }

    await client.query('COMMIT');

    console.log(`\n✅  Seed completado exitosamente`);
    console.log(`   ${USERS.length} usuarios  |  ${PROJECTS.length} proyectos`);
    console.log(`\n   Contraseña de todos los usuarios: ${DEFAULT_PASS}`);
    console.log(`   Bleiner ya registrado → usa su contraseña actual\n`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌  Error en seed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
