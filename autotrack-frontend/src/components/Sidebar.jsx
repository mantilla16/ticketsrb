/* Navegación principal.

   La arquitectura de información gira alrededor del ticket: primero la
   operación de la mesa (bandeja, lo mío, flujo), después la ejecución del
   trabajo que ya se aceptó, y al final análisis y administración.

   El auditor solicitante ve una sola entrada — sus tickets — porque es lo
   único que necesita: radicar y seguir. */

import { ORG, roleOf, can, teamsOf } from '../lib/tickets';
import { asset } from '../lib/assets';
import Icon from './ui/Icon';

/**
 * Cada entrada declara qué capacidad o equipo la habilita, no una lista de
 * roles. Así, añadir un rol es declararlo en `lib/tickets.js` y nada más: el
 * menú se recalcula solo y no queda ninguna lista que olvidar actualizar.
 *
 *   cap    — capacidad necesaria (ver ROLE en lib/tickets.js)
 *   sinCap — capacidad que la descarta
 *   equipo — además, que el rol trabaje con ese equipo
 *   badge  — métrica que muestra la entrada; App la calcula
 */
export const SECTIONS = [
  { group: 'Mesa de servicio' },
  { id: 'inbox',  label: 'Bandeja',     icon: 'inbox',  cap: 'bandeja', badge: 'unassigned' },
  { id: 'mine',   label: 'Mis tickets', icon: 'ticket', badge: 'mine' },
  { id: 'board',  label: 'Flujo',       icon: 'board',  cap: 'bandeja' },

  { group: 'Proyectos' },
  { id: 'projects', label: 'Tablero',    icon: 'board',    cap: 'bandeja' },
  { id: 'gantt',    label: 'Cronograma', icon: 'calendar', cap: 'bandeja' },

  { group: 'Análisis' },
  { id: 'analytics-report', label: 'Reporte Analítica', icon: 'chart', cap: 'verReporteAnalitica' },
  { id: 'historial',        label: 'Historial',         icon: 'archive', cap: 'bandeja' },

  { group: 'Administración' },
  { id: 'users', label: 'Usuarios', icon: 'user', cap: 'gestionarUsuarios' },
];

/** ¿Este rol puede abrir esta sección? */
function habilitada(seccion, user) {
  if (seccion.cap && !can(user, seccion.cap)) return false;
  if (seccion.sinCap && can(user, seccion.sinCap)) return false;
  if (seccion.equipo && !teamsOf(user).includes(seccion.equipo)) return false;
  return true;
}

/** Secciones que el rol puede abrir — App la usa para validar la sección activa. */
export function sectionsFor(role) {
  const user = { role };
  return SECTIONS.filter(s => s.id && habilitada(s, user));
}

/**
 * Deja solo las entradas del rol y descarta los encabezados que se quedaron
 * sin nada debajo, para que ningún rol vea un grupo vacío.
 */
function buildMenu(user) {
  const kept = SECTIONS.filter(s => s.group || habilitada(s, user));
  return kept.filter((s, i) => !s.group || (kept[i + 1] && !kept[i + 1].group));
}

/**
 * `user` es siempre la persona real. `viewRole`, si viene, es el rol que se
 * está previsualizando: manda para decidir el menú, pero no para el pie —quién
 * eres no cambia porque estés mirando la aplicación con otros ojos—.
 */
export default function Sidebar({ section, onSection, user, viewRole, onLogout, isOpen, badges = {} }) {
  const rolReal = user?.role || 'user';
  const role    = viewRole || rolReal;
  const visible = buildMenu({ role });

  return (
    <aside className={`rb-sidebar${isOpen ? ' is-open' : ''}`}>
      {/* El manual fija el logo arriba a la izquierda, con área de seguridad
          alrededor y sin alterar proporciones ni color. */}
      <div className="rb-brand">
        <img className="rb-brand-logo" src={asset('logo-russell-bedford-white.svg')}
          alt={`${ORG.name} ${ORG.city}`} />
        <span className="rb-brand-sub">{ORG.city} · {ORG.product}</span>
      </div>

      <nav className="rb-nav" aria-label="Navegación principal">
        {visible.map((s, i) =>
          s.group ? (
            <div className="rb-nav-group" key={`g-${i}`}>{s.group}</div>
          ) : (
            (() => {
              const badge = s.badge ? badges[s.badge] : null;
              return (
                <button
                  key={s.id}
                  className={`rb-nav-item${section === s.id ? ' is-active' : ''}`}
                  aria-current={section === s.id ? 'page' : undefined}
                  onClick={() => onSection(s.id)}
                >
                  <Icon name={s.icon} size={16} stroke={1.9} />
                  <span className="rb-nav-label">{s.label}</span>
                  {badge?.count > 0 && (
                    <span className={`rb-nav-badge${badge.alert ? ' rb-nav-badge--alert' : ''}`}
                      title={badge.title}>
                      {badge.count}
                    </span>
                  )}
                </button>
              );
            })()
          ),
        )}
      </nav>

      <div className="rb-sidebar-foot">
        <button className="rb-userchip" onClick={onLogout} title="Cerrar sesión">
          <span className="rb-avatar" data-c={(user?.colorIndex ?? 0) % 8}>{user?.initials}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="rb-userchip-name rb-truncate" style={{ display: 'block' }}>{user?.name}</span>
            <span className="rb-userchip-role">
              {roleOf(rolReal).label}
              {viewRole && <> · viendo como {roleOf(viewRole).label}</>}
            </span>
          </span>
          <Icon name="logout" size={14} />
        </button>
      </div>
    </aside>
  );
}
