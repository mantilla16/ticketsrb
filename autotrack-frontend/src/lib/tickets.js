/* ══════════════════════════════════════════════════════════════════════════
   Modelo de dominio de la Mesa de Servicio — Russell Bedford Barranquilla

   Un único lugar donde vive el vocabulario del ticket: estados, prioridades,
   categorías, líneas de servicio, SLA y roles. Las vistas solo consumen esto,
   nunca vuelven a declarar etiquetas ni colores por su cuenta.

   Los `value` coinciden con lo que ya guarda la base de datos, así que el
   backend no cambia: solo cambia cómo se nombra y se presenta.
   ══════════════════════════════════════════════════════════════════════════ */

export const ORG = {
  name: 'Russell Bedford',
  city: 'Barranquilla',
  product: 'Mesa de Servicio',
};

/* ─────────────────────────────── Estados ─────────────────────────────── */

export const STATUS = {
  recibido: {
    value: 'recibido', label: 'Recibido', tone: 'info', step: 0,
    hint: 'El ticket llegó a la mesa y está en cola de triage.',
  },
  en_revision: {
    value: 'en_revision', label: 'En revisión', tone: 'warning', step: 1,
    hint: 'Un analista está evaluando el alcance de la solicitud.',
  },
  reunion_agendada: {
    value: 'reunion_agendada', label: 'Reunión agendada', tone: 'violet', step: 2,
    hint: 'Hay una reunión de levantamiento programada con el solicitante.',
  },
  aceptado: {
    value: 'aceptado', label: 'Aceptado', tone: 'teal', step: 3,
    hint: 'El alcance quedó definido y el ticket entra a planificación.',
  },
  convertido: {
    value: 'convertido', label: 'En ejecución', tone: 'success', step: 4,
    hint: 'El trabajo está en marcha con un responsable asignado.',
  },
  cerrado: {
    value: 'cerrado', label: 'Cerrado', tone: 'neutral', step: 5,
    hint: 'El trabajo se entregó y el ticket queda cerrado.',
  },
  rechazado: {
    value: 'rechazado', label: 'No procede', tone: 'danger', step: -1,
    hint: 'La solicitud se cerró sin ejecución. La razón queda en la respuesta.',
  },
};

/* Estados heredados de la versión anterior — se muestran, pero no se ofrecen. */
const LEGACY_STATUS = {
  nueva:      STATUS.recibido,
  en_proceso: STATUS.en_revision,
  completada: STATUS.cerrado,
  rechazada:  STATUS.rechazado,
};

/** Flujo ofrecido en la interfaz, en orden. */
export const STATUS_FLOW = [
  STATUS.recibido, STATUS.en_revision, STATUS.reunion_agendada,
  STATUS.aceptado, STATUS.convertido, STATUS.cerrado,
];

export const statusOf = (value) =>
  STATUS[value] || LEGACY_STATUS[value] || STATUS.recibido;

/**
 * Un ticket está cerrado solo cuando el trabajo se entregó o cuando no
 * procede. «En ejecución» es trabajo en curso: sigue abierto, aunque ya tenga
 * proyecto abierto detrás.
 */
export const CLOSED_STATUSES = ['cerrado', 'rechazado', 'completada', 'rechazada'];
export const isClosed = (t) => CLOSED_STATUSES.includes(t.status);
export const isOpen   = (t) => !isClosed(t);

/**
 * Estados en los que la mesa todavía no le ha dado una respuesta al
 * solicitante. Es lo único que consume el compromiso de respuesta: agendar la
 * reunión, aceptar o rechazar ya son respuestas.
 */
const AWAITING_RESPONSE = ['recibido', 'nueva', 'en_revision', 'en_proceso'];
export const isAwaitingResponse = (t) => AWAITING_RESPONSE.includes(t.status);

/* ────────────────────────────── Prioridad ─────────────────────────────── */

export const PRIORITY = {
  alta:  { value: 'alta',  label: 'Alta',  tone: 'danger',  order: 0, slaDays: 1, hint: 'Bloquea un cierre, una entrega o un requerimiento del cliente.' },
  media: { value: 'media', label: 'Media', tone: 'warning', order: 1, slaDays: 3, hint: 'Afecta el trabajo pero existe una alternativa manual.' },
  baja:  { value: 'baja',  label: 'Baja',  tone: 'neutral', order: 2, slaDays: 5, hint: 'Mejora deseable, sin fecha crítica.' },
};

export const PRIORITY_LIST = [PRIORITY.alta, PRIORITY.media, PRIORITY.baja];
export const priorityOf = (v) => PRIORITY[v] || PRIORITY.media;

/* ───────────────────────── Categorías de solicitud ────────────────────── */
/* Se guardan en `frecuencia`… no: la categoría viaja en `type`, que ya existe
   en la tabla `solicitudes` con default 'requerimiento'. */

export const CATEGORIES = [
  { value: 'papeles_trabajo', label: 'Papeles de trabajo',        desc: 'Cédulas, sumarias, pruebas sustantivas o de corte.' },
  { value: 'analitica',       label: 'Analítica de datos',        desc: 'Cruces, muestreo, detección de atípicos sobre auxiliares.' },
  { value: 'automatizacion',  label: 'Automatización de proceso', desc: 'Tareas repetitivas que hoy se hacen a mano.' },
  { value: 'extraccion',      label: 'Extracción de información', desc: 'Descargas de ERP, extractos bancarios, consolidación.' },
  { value: 'reporte',         label: 'Reporte o tablero',         desc: 'Informes recurrentes, indicadores, tableros de control.' },
  { value: 'soporte',         label: 'Soporte a herramienta',     desc: 'Fallas, accesos o dudas sobre una herramienta interna.' },
  { value: 'capacitacion',    label: 'Acompañamiento',            desc: 'Capacitación o apoyo puntual del equipo.' },
  { value: 'otro',            label: 'Otro',                      desc: 'No encaja en las anteriores.' },
];

export const categoryOf = (v) =>
  CATEGORIES.find(c => c.value === v) || { value: v || 'otro', label: 'Otro', desc: '' };

/* ─────────────────────── Líneas de servicio / áreas ───────────────────── */

export const SERVICE_LINES = [
  'Auditoría Financiera',
  'Revisoría Fiscal',
  'Auditoría Interna',
  'Impuestos y Precios de Transferencia',
  'Outsourcing Contable',
  'Nómina',
  'Consultoría y NIIF',
  'Riesgos y Cumplimiento (SAGRLAFT)',
  'Tecnología y Sistemas',
  'Administración y Finanzas',
  'Talento Humano',
  'Dirección / Socios',
];

/* ──────────────────────────────── Roles ───────────────────────────────── */

/**
 * Roles y capacidades. Es un espejo de `autotrack-backend/src/config/roles.js`:
 * aquí se decide qué se muestra, allá qué se permite. La del servidor es la
 * que manda — esconder un botón no es un control de acceso.
 */
export const ROLE = {
  admin: {
    label: 'Administrador',
    bandeja: true, triage: true, eliminarTickets: true,
    gestionarProyectos: true, crearProyectos: true, gestionarUsuarios: true,
    ejecuta: false,
    soloLectura: false,
    equipos: ['automatizacion', 'analitica'],
  },
  /* Coordina la mesa completa sin poderes de administración: no gestiona
     usuarios ni borra nada. Para quien lleva el día a día de los dos equipos
     sin ser dueño del sistema. */
  coordinator: {
    label: 'Coordinador',
    bandeja: true, triage: true, eliminarTickets: false,
    gestionarProyectos: true, crearProyectos: true, gestionarUsuarios: false,
    ejecuta: false,
    soloLectura: false,
    equipos: ['automatizacion', 'analitica'],
  },
  leader_analytics: {
    label: 'Líder de Analítica',
    bandeja: true, triage: true, eliminarTickets: true,
    gestionarProyectos: true, crearProyectos: true, gestionarUsuarios: false,
    ejecuta: false,
    soloLectura: false,
    equipos: ['analitica'],
  },
  member_analytics: {
    label: 'Analista de Datos',
    bandeja: true, triage: true, eliminarTickets: false,
    gestionarProyectos: false, crearProyectos: true, gestionarUsuarios: false,
    ejecuta: true,
    soloLectura: false,
    equipos: ['analitica'],
  },
  engineer: {
    label: 'Analista',
    bandeja: true, triage: false, eliminarTickets: false,
    gestionarProyectos: false, crearProyectos: false, gestionarUsuarios: false,
    ejecuta: true,
    soloLectura: false,
    equipos: ['automatizacion'],
  },
  /* Puramente consultivo: ve todo pero no radica ni se le asigna nada. */
  manager: {
    label: 'Gerencia',
    bandeja: true, triage: false, eliminarTickets: false,
    gestionarProyectos: false, crearProyectos: false, gestionarUsuarios: false,
    ejecuta: false,
    soloLectura: true,
    equipos: ['automatizacion', 'analitica'],
  },
  user: {
    label: 'Auditor solicitante',
    bandeja: false, triage: false, eliminarTickets: false,
    gestionarProyectos: false, crearProyectos: false, gestionarUsuarios: false,
    ejecuta: false,
    soloLectura: false,
    equipos: [],
  },
};

/** Rol desconocido → el más restringido. */
export const roleOf = (r) => ROLE[r] || ROLE.user;

/** ¿Tiene esta capacidad? Se pregunta por lo que se puede hacer, no por el rol. */
export const can = (user, capacidad) => Boolean(roleOf(user?.role)[capacidad]);

/** ¿Ve la bandeja completa de la mesa, o solo sus propios tickets? */
export const isDesk = (user) => can(user, 'bandeja');
/** ¿Puede cambiar estado, asignar y responder? */
export const canTriage = (user) => can(user, 'triage');
/** ¿Puede eliminar tickets? */
export const canManage = (user) => can(user, 'eliminarTickets');
/** ¿Solo observa? No radica, no se le asigna nada y no interviene. */
export const esSoloLectura = (user) => can(user, 'soloLectura');

/** ¿Ejecuta trabajos, o solo los coordina? Decide quién sale en los tableros. */
export const ejecuta = (user) => can(user, 'ejecuta');
/** Quienes ejecutan en un equipo dado — las columnas del tablero de equipo. */
export const executorsOf = (users, equipo) =>
  users.filter(u => can(u, 'ejecuta') && teamsOf(u).includes(equipo));
/**
 * ¿Puede esta persona quedar como responsable de un trabajo?
 *
 * Quien lo ejecuta o quien lo gestiona. Pertenecer a un equipo no basta:
 * gerencia ve los dos equipos pero es solo lectura, y aparecía en los
 * selectores como si pudiera hacerse cargo de algo.
 */
export const puedeSerResponsable = (u) => can(u, 'ejecuta') || can(u, 'gestionarProyectos');

/** Responsables posibles, opcionalmente acotados a un equipo. */
export const assignables = (users, equipo) =>
  users.filter(u => puedeSerResponsable(u) && (!equipo || teamsOf(u).includes(equipo)));

/** Equipos cuyos trabajos ve este rol. */
export const teamsOf = (user) => roleOf(user?.role).equipos;
/** ¿Coordina los dos equipos? Decide si ve las dos vistas de ejecución. */
export const seesBothTeams = (user) => teamsOf(user).length > 1;

/* ───────────────────────── Referencia del ticket ──────────────────────── */

export const ticketRef = (t) => `RB-${String(t?.id ?? 0).padStart(5, '0')}`;

/* ──────────────────────────── Fechas y SLA ────────────────────────────── */

const MS_DAY = 86_400_000;
const LOCALE = 'es-CO';

/**
 * El backend corre con TZ=UTC y guarda `timestamp` sin zona: lo que queda en
 * la base es la hora "de pared" de Barranquilla, que luego se serializa con
 * sufijo Z. Por eso todo se formatea forzando UTC — así se muestra la hora
 * literal que se registró — y el "ahora" se lleva al mismo marco antes de
 * restar, o cada fecha aparecería corrida cinco horas.
 */
const UTC = { timeZone: 'UTC' };
const nowWall = () => Date.now() - new Date().getTimezoneOffset() * 60_000;

const startOfWallDay = (d) => {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
};

/** Suma días hábiles (lun–vie) a una fecha. No contempla festivos colombianos. */
export function addBusinessDays(from, days) {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return d;
}

/**
 * Estado del compromiso de respuesta de un ticket.
 *
 * El reloj corre desde la radicación y se detiene en cuanto la mesa responde
 * —agenda, acepta, rechaza o pone en ejecución—, no cuando el ticket se
 * cierra. Si corriera hasta el cierre, todo trabajo largo aparecería vencido
 * aunque se hubiera atendido el mismo día.
 */
export function slaOf(ticket) {
  if (!ticket?.created_at) return null;
  const pr  = priorityOf(ticket.urgencia || ticket.priority);
  const due = addBusinessDays(new Date(ticket.created_at), pr.slaDays);

  if (!isAwaitingResponse(ticket)) {
    return { due, state: 'answered', label: 'Respondido', tone: 'neutral', days: 0 };
  }

  const days = Math.round((startOfWallDay(due) - startOfWallDay(nowWall())) / MS_DAY);
  if (days < 0)   return { due, state: 'breached', label: `Vencido hace ${Math.abs(days)} d`, tone: 'danger',  days };
  if (days === 0) return { due, state: 'today',    label: 'Vence hoy',                        tone: 'danger',  days };
  if (days === 1) return { due, state: 'at_risk',  label: 'Vence mañana',                     tone: 'warning', days };
  return { due, state: 'ok', label: `${days} d restantes`, tone: 'neutral', days };
}

/* ──────────────────────────── Formateo ────────────────────────────────── */

export function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(LOCALE, { day: '2-digit', month: 'short', year: 'numeric', ...UTC });
}

export function fmtDateTime(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return `${fmtDate(dt)}, ` +
         dt.toLocaleTimeString(LOCALE, { hour: 'numeric', minute: '2-digit', hour12: true, ...UTC });
}

/** `fecha_reunion` sigue exactamente la misma convención que el resto. */
export const fmtMeeting = fmtDateTime;

/** «hace 3 h», «hace 2 d» — para listas donde la fecha exacta es ruido. */
export function fmtAgo(d) {
  if (!d) return '—';
  const mins = Math.floor((nowWall() - new Date(d).getTime()) / 60_000);
  if (mins < 1)  return 'ahora';
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `hace ${days} d`;
  return fmtDate(d);
}

export const dateOnly = (d) => (d ? String(d).slice(0, 10) : '');
export const timeOnly = (d) => (d ? (String(d).match(/T(\d{2}:\d{2})/)?.[1] ?? '') : '');

/** Días que un ticket lleva abierto — insumo de los reportes. */
export function ageInDays(ticket) {
  if (!ticket?.created_at) return 0;
  const end = isClosed(ticket) && ticket.updated_at ? new Date(ticket.updated_at) : new Date(nowWall());
  return Math.max(0, Math.round((startOfWallDay(end) - startOfWallDay(new Date(ticket.created_at))) / MS_DAY));
}

/* ─────────────────────────── Orden y filtros ──────────────────────────── */

/** Los que más arden primero: SLA vencido, luego prioridad, luego antigüedad. */
export function byUrgency(a, b) {
  const sa = slaOf(a), sb = slaOf(b);
  const rank = (s) => (s?.state === 'breached' ? 0 : s?.state === 'today' ? 1 : s?.state === 'at_risk' ? 2 : 3);
  const dr = rank(sa) - rank(sb);
  if (dr) return dr;
  const dp = priorityOf(a.urgencia || a.priority).order - priorityOf(b.urgencia || b.priority).order;
  if (dp) return dp;
  return new Date(a.created_at) - new Date(b.created_at);
}

/** Texto indexado para el buscador de la bandeja. */
export function searchBlob(t) {
  return [
    ticketRef(t), t.title, t.description, t.area, t.nombre_solicitante,
    t.correo_solicitante, t.user_name, t.assignee_name, categoryOf(t.type).label,
  ].filter(Boolean).join(' ').toLowerCase();
}
