/**
 * Cobertura de analítica por cliente — el número que mira gerencia.
 *
 * Se comprueba aquí y no en la pantalla porque el riesgo no está en cómo se
 * dibuja sino en cómo se cuenta: la marca vive en la pareja proyecto↔cliente,
 * así que un cliente que aparece en dos proyectos se contaría dos veces con
 * la aritmética ingenua, y el porcentaje que ve dirección sería falso sin que
 * nada falle.
 *
 *   node scripts/probar-cobertura.mjs
 *
 * `coberturaAnalitica` es pura y no toca React, así que se extrae del módulo
 * y se evalúa suelta, sin montar nada.
 */

import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(raiz, 'autotrack-frontend/src/lib/tickets.js'), 'utf8');
const i = src.indexOf('export function coberturaAnalitica');
if (i < 0) {
  console.error('No encuentro coberturaAnalitica en lib/tickets.js');
  process.exit(1);
}
const tmp = join(tmpdir(), `cobertura-${process.pid}.mjs`);
writeFileSync(tmp, src.slice(i));
const { coberturaAnalitica } = await import(pathToFileURL(tmp).href);
rmSync(tmp, { force: true });

let fallos = 0;
const check = (c,m) => { if(!c) fallos++; console.log(`  ${c?'OK  ':'FALLA'} ${m}`); };

const C = (id, name, loaded, by, at) => ({ id, name, analyticsLoaded: loaded, analyticsLoadedBy: by, analyticsLoadedAt: at });

// Caso 1 — vacío
let r = coberturaAnalitica([]);
check(r.total === 0 && r.pct === 0, 'sin proyectos: 0 de 0, sin dividir por cero');

// Caso 2 — el caso base
r = coberturaAnalitica([
  { name: 'P1', clients: [C(1,'Camacol',true,'Ana','2026-09-10T10:00:00Z'), C(2,'Quintal',false)] },
  { name: 'P2', clients: [C(3,'Cedel',true,'Luis','2026-09-12T10:00:00Z')] },
]);
check(r.total === 3, 'cuenta 3 clientes');
check(r.hechos.length === 2 && r.faltan.length === 1, '2 cargados, 1 pendiente');
check(r.pct === 67, `porcentaje redondeado: ${r.pct}%`);
check(r.faltan[0].nombre === 'Quintal', 'nombra al que falta');
check(r.porPersona.length === 2, 'reparte por persona');

// Caso 3 — EL CASO QUE IMPORTA: el mismo cliente en dos proyectos
r = coberturaAnalitica([
  { name: 'P1', clients: [C(1,'Camacol',false)] },
  { name: 'P2', clients: [C(1,'Camacol',true,'Ana','2026-09-10T10:00:00Z')] },
]);
check(r.total === 1, 'un cliente en dos proyectos cuenta UNA vez, no dos');
check(r.hechos.length === 1 && r.faltan.length === 0, 'cargado en uno basta para contar como hecho');
check(r.hechos[0].proyectos.length === 2, 'pero se ven los dos proyectos donde aparece');

// Caso 4 — orden por fecha: gana la carga más reciente
r = coberturaAnalitica([
  { name: 'P1', clients: [C(1,'Camacol',true,'Ana','2026-09-01T10:00:00Z')] },
  { name: 'P2', clients: [C(1,'Camacol',true,'Luis','2026-09-20T10:00:00Z')] },
]);
check(r.hechos[0].quien === 'Luis', `de dos cargas queda la más reciente (${r.hechos[0].quien})`);

// Caso 5 — sin autor registrado (marcas anteriores a esto)
r = coberturaAnalitica([{ name:'P1', clients:[C(1,'Camacol',true,null,null)] }]);
check(r.porPersona[0].label === 'Sin registrar', 'una carga sin autor no se pierde: «Sin registrar»');

// Caso 6 — datos defectuosos no deben romper la pantalla de dirección
r = coberturaAnalitica([{ name:'P1' }, { name:'P2', clients:null }, { name:'P3', clients:[{},{id:null}] }]);
check(r.total === 0, 'proyectos sin clientes o con filas corruptas no rompen nada');

// Caso 6b — un proyecto que no requiere analítica no arrastra la cobertura
r = coberturaAnalitica([
  { name:'Ana1', clients:[C(1,'Camacol',true,'Ana','2026-09-10T10:00:00Z')] },
  { name:'Auto1', requiresAnalytics:false, clients:[C(2,'Quintal',false), C(3,'Cedel',false)] },
]);
check(r.total === 1, 'un proyecto marcado «no requiere analítica» queda fuera del conteo');
check(r.pct === 100, `sus clientes no cuentan como pendientes (${r.pct}%)`);

// Caso 6c — el valor por defecto (sin el campo) sí cuenta
r = coberturaAnalitica([{ name:'Viejo', clients:[C(9,'Kredit',false)] }]);
check(r.total === 1, 'un proyecto sin el campo sigue contando, como antes');

// Caso 7 — proyectos que no son de analítica sin clientes no ensucian
r = coberturaAnalitica([
  { name:'Auto1', clients: [] },
  { name:'Ana1', clients: [C(5,'Kredit',false)] },
]);
check(r.total === 1, 'solo cuentan los proyectos que tienen clientes');

console.log(fallos ? `\n${fallos} fallo(s)\n` : '\nLa cobertura calcula bien.\n');
process.exit(fallos ? 1 : 0);
