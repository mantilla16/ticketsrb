/**
 * Comprueba tres invariantes que ya se rompieron una vez y que ninguna
 * herramienta del proyecto vigila: son coherencias entre archivos, así que ni
 * el compilador ni `vite build` las ven.
 *
 *   1. Todo rol entra a una sección que existe en su menú y que se renderiza.
 *   2. Backend y frontend declaran los mismos permisos para cada rol.
 *   3. `db/schema.full.sql` cubre todo lo que `src/db/esquema.js` crea en
 *      caliente, para que instalar de cero deje la misma base que actualizar.
 *
 * Sin dependencias, para poder correrlo en el servidor antes de desplegar:
 *   node scripts/verificar-coherencia.mjs
 *
 * Sale con código 1 si algo no cuadra, para encadenarlo en despliegue o CI.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => readFileSync(join(raiz, p), 'utf8');
const require = createRequire(import.meta.url);

const fallos = [];
const mal = (msg) => fallos.push(msg);

/* La tabla de roles del frontend es un literal dentro de un módulo que importa
   React y otras cosas que aquí no se pueden cargar, así que se extrae el
   literal y se evalúa suelto. */
function tablaFrontend() {
  const src = leer('autotrack-frontend/src/lib/tickets.js');
  const i = src.indexOf('const ROLE');
  if (i < 0) throw new Error('No encuentro la tabla ROLE en lib/tickets.js');
  return eval(`(${src.slice(src.indexOf('{', i), src.indexOf('\n};', i) + 2)})`);
}

function secciones() {
  const src = leer('autotrack-frontend/src/components/Sidebar.jsx');
  const i = src.indexOf('export const SECTIONS');
  if (i < 0) throw new Error('No encuentro SECTIONS en Sidebar.jsx');
  return eval(`(${src.slice(src.indexOf('[', i), src.indexOf('\n];', i) + 2)})`);
}

/* ── 1. Cada rol aterriza en algún sitio ────────────────────────────────── */

function verificarNavegacion(ROLE, SECTIONS) {
  const app = leer('autotrack-frontend/src/App.jsx');
  // Secciones con rama de render en App.jsx: `section === 'x'` y las de tickets.
  const renderizables = new Set([
    ...[...app.matchAll(/section === '([\w-]+)'/g)].map(m => m[1]),
    ...(app.match(/isTicketView = \[([^\]]+)\]/)?.[1] ?? '')
      .split(',').map(s => s.trim().replace(/'/g, '')).filter(Boolean),
  ]);

  const roleOf  = (r) => ROLE[r] || ROLE.user;
  const can     = (r, c) => Boolean(roleOf(r)[c]);
  const equipos = (r) => roleOf(r).equipos || [];

  // Espejo de defaultSection() en App.jsx. Si aquella cambia, esta tiene que
  // cambiar con ella; es el precio de comprobarlo sin importar el módulo.
  const seccionInicial = (role) => {
    const r = roleOf(role);
    if (!r.bandeja) return 'mine';
    if (r.ejecuta)  return 'mine';
    return r.triage ? 'inbox' : 'reports';
  };

  for (const role of Object.keys(ROLE)) {
    const menu = SECTIONS
      .filter(s => s.id
        && (!s.cap    || can(role, s.cap))
        && (!s.sinCap || !can(role, s.sinCap))
        && (!s.equipo || equipos(role).includes(s.equipo)))
      .map(s => s.id);
    const inicio = seccionInicial(role);

    if (!menu.includes(inicio)) {
      mal(`«${role}» entra en "${inicio}", que no está en su menú (${menu.join(', ') || 'vacío'})`);
    }
    if (!renderizables.has(inicio)) {
      mal(`«${role}» entra en "${inicio}", que no tiene rama de render en App.jsx`);
    }
    for (const id of menu) {
      if (!renderizables.has(id)) {
        mal(`«${role}» ve "${id}" en el menú, pero App.jsx no lo renderiza`);
      }
    }
  }
}

/* ── 2. Los dos lados dicen lo mismo ────────────────────────────────────── */

function verificarPermisos(ROLE) {
  const { ROLES } = require(join(raiz, 'autotrack-backend/src/config/roles.js'));
  const capacidades = [
    'bandeja', 'triage', 'eliminarTickets', 'crearProyectos',
    'gestionarProyectos', 'editarProyectosPropios', 'gestionarUsuarios',
    'verReporteAnalitica',
  ];

  for (const r of new Set([...Object.keys(ROLES), ...Object.keys(ROLE)])) {
    if (!ROLES[r]) { mal(`el rol «${r}» existe en el frontend pero no en el backend`); continue; }
    if (!ROLE[r])  { mal(`el rol «${r}» existe en el backend pero no en el frontend`); continue; }

    for (const c of capacidades) {
      if (Boolean(ROLES[r][c]) !== Boolean(ROLE[r][c])) {
        mal(`«${r}.${c}»: backend=${Boolean(ROLES[r][c])}, frontend=${Boolean(ROLE[r][c])}`);
      }
    }
    const back = (ROLES[r].equipos || []).join(',');
    const front = (ROLE[r].equipos || []).join(',');
    if (back !== front) mal(`«${r}.equipos»: backend=[${back}], frontend=[${front}]`);
  }
}

/* ── 3. El esquema describe la base real ────────────────────────────────── */

function verificarEsquema() {
  const esquema = leer('autotrack-backend/src/db/esquema.js');
  const sql = leer('autotrack-backend/db/schema.full.sql').toLowerCase();

  for (const [, tabla, cols] of esquema.matchAll(
    /ALTER TABLE (\w+)\s*((?:\s*ADD COLUMN IF NOT EXISTS[^;`]*)+)/g)) {
    for (const [, col] of cols.matchAll(/ADD COLUMN IF NOT EXISTS\s+(\w+)/g)) {
      if (!sql.includes(col.toLowerCase())) {
        mal(`schema.full.sql no declara «${tabla}.${col}», que la aplicación crea al arrancar`);
      }
    }
  }
  for (const [, tabla] of esquema.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)) {
    if (!sql.includes(tabla.toLowerCase())) {
      mal(`schema.full.sql no declara la tabla «${tabla}», que la aplicación crea al arrancar`);
    }
  }
}

/* ── */

const ROLE = tablaFrontend();
verificarNavegacion(ROLE, secciones());
verificarPermisos(ROLE);
verificarEsquema();

if (fallos.length) {
  console.error(`\n${fallos.length} incoherencia(s):\n`);
  fallos.forEach(f => console.error(`  · ${f}`));
  console.error('');
  process.exit(1);
}
console.log('Roles, navegación y esquema son coherentes.');
