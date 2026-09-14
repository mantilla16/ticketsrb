/**
 * Roles y lo que cada uno puede hacer.
 *
 * Antes esto vivía repartido en listas literales dentro de cada ruta
 * —`requireRole('admin', 'leader_analytics', 'member_analytics')`— y añadir un
 * rol obligaba a encontrar y actualizar las nueve. Es exactamente la forma en
 * que se cuelan los agujeros de permisos: basta olvidar una.
 *
 * Aquí se declara qué puede cada rol y las rutas preguntan por la capacidad,
 * no por el nombre del rol. El frontend tiene la misma tabla en
 * `src/lib/tickets.js`; esta es la que manda, porque es la que se comprueba
 * del lado del servidor.
 */

/** Equipos de trabajo. `ambos` = ve y coordina los dos. */
const AUTO = 'automatizacion';
const ANA  = 'analitica';

const ROLES = {
  admin: {
    etiqueta: 'Administrador',
    bandeja: true,            // ve todos los tickets de la mesa
    triage: true,             // cambia estado, asigna y responde
    eliminarTickets: true,
    crearProyectos: true,
    gestionarProyectos: true,        // puede editar cualquier proyecto
    editarProyectosPropios: false,   // …así que no necesita este permiso menor
    eliminarProyectos: true,
    gestionarUsuarios: true,
    soloLectura: false,
    equipos: [AUTO, ANA],
  },

  /* Opera la mesa completa —los dos equipos— sin poderes de administración:
     no gestiona usuarios ni borra nada. Es el rol para quien coordina el día
     a día sin ser dueño del sistema. */
  coordinator: {
    etiqueta: 'Coordinador',
    bandeja: true,
    triage: true,
    eliminarTickets: false,
    crearProyectos: true,
    eliminarProyectos: false,
    gestionarUsuarios: false,
    gestionarProyectos: true,
    editarProyectosPropios: false,
    soloLectura: false,
    equipos: [AUTO, ANA],
  },

  leader_analytics: {
    etiqueta: 'Líder de Analítica',
    bandeja: true,
    triage: true,
    eliminarTickets: true,
    crearProyectos: true,
    eliminarProyectos: true,
    gestionarUsuarios: false,
    gestionarProyectos: true,
    editarProyectosPropios: false,
    soloLectura: false,
    equipos: [ANA],
  },

  member_analytics: {
    etiqueta: 'Analista de Datos',
    bandeja: true,
    triage: true,
    eliminarTickets: false,
    crearProyectos: true,
    eliminarProyectos: false,
    gestionarUsuarios: false,
    gestionarProyectos: false,
    editarProyectosPropios: true,
    soloLectura: false,
    equipos: [ANA],
  },

  engineer: {
    etiqueta: 'Analista',
    bandeja: true,
    triage: false,
    eliminarTickets: false,
    crearProyectos: false,
    eliminarProyectos: false,
    gestionarUsuarios: false,
    gestionarProyectos: false,
    editarProyectosPropios: true,
    soloLectura: false,
    equipos: [AUTO],
  },

  /* Puramente consultivo: ve todo lo que pasa pero no radica, no se le asigna
     nada y no interviene. Por eso `soloLectura`, que además lo saca de los
     selectores de responsable y le ahorra el menú de trabajo propio. */
  manager: {
    etiqueta: 'Gerencia',
    bandeja: true,
    triage: false,
    eliminarTickets: false,
    crearProyectos: false,
    eliminarProyectos: false,
    gestionarUsuarios: false,
    gestionarProyectos: false,
    editarProyectosPropios: false,
    soloLectura: true,
    equipos: [AUTO, ANA],
  },

  user: {
    etiqueta: 'Auditor solicitante',
    bandeja: false,           // solo sus propios tickets
    triage: false,
    eliminarTickets: false,
    crearProyectos: false,
    eliminarProyectos: false,
    gestionarUsuarios: false,
    gestionarProyectos: false,
    editarProyectosPropios: false,
    soloLectura: false,
    equipos: [],
  },
};

/** Rol desconocido → el más restringido. Nunca se concede por defecto. */
const rol = (nombre) => ROLES[nombre] || ROLES.user;

/** ¿Este rol tiene esta capacidad? */
const puede = (nombre, capacidad) => Boolean(rol(nombre)[capacidad]);

/** Middleware: exige una capacidad en vez de enumerar roles. */
function requierePermiso(capacidad) {
  return (req, res, next) => {
    if (puede(req.user?.role, capacidad)) return next();
    res.status(403).json({ error: 'No tienes permiso para esta acción' });
  };
}

/**
 * Filtro de visibilidad de proyectos según los equipos del rol. Quien ve los
 * dos no filtra nada; quien ve uno solo ve además los compartidos, porque por
 * definición le tocan.
 */
function filtroEquipos(nombre) {
  const equipos = rol(nombre).equipos;
  if (equipos.length !== 1) return null; // ambos o ninguno: sin filtro
  const propios = [equipos[0], 'compartido'];
  return (tipo) => propios.includes(tipo || AUTO);
}

module.exports = { ROLES, rol, puede, requierePermiso, filtroEquipos, AUTO, ANA };
