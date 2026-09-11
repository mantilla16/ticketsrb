/* Navegación principal.

   La arquitectura de información gira alrededor del ticket: primero la
   operación de la mesa (bandeja, lo mío, flujo), después la ejecución del
   trabajo que ya se aceptó, y al final análisis y administración.

   El auditor solicitante ve una sola entrada — sus tickets — porque es lo
   único que necesita: radicar y seguir. */

import { ORG, roleOf } from '../lib/tickets';
import Icon from './ui/Icon';

const DESK   = ['admin', 'leader_analytics', 'engineer', 'member_analytics', 'manager'];
const LEADS  = ['admin', 'leader_analytics'];
const ENGINE = ['admin', 'engineer', 'leader_analytics', 'member_analytics'];

/* `badge` nombra la métrica que la entrada muestra; App la calcula. */
export const SECTIONS = [
  { group: 'Mesa de servicio' },
  { id: 'inbox',    label: 'Bandeja',       icon: 'inbox',  roles: DESK,            badge: 'unassigned' },
  { id: 'mine',     label: 'Mis tickets',   icon: 'ticket', roles: [...DESK, 'user'], badge: 'mine' },
  { id: 'board',    label: 'Flujo',         icon: 'board',  roles: DESK },

  { group: 'Ejecución', roles: ENGINE },
  { id: 'team-kanban', label: 'Proyectos',        icon: 'users',    roles: ['admin', 'engineer'] },
  { id: 'analytics',   label: 'Equipo Analítica', icon: 'trend',    roles: ['admin', 'leader_analytics', 'member_analytics'] },
  { id: 'gantt',       label: 'Cronograma',       icon: 'calendar', roles: [...ENGINE, 'manager'] },

  { group: 'Análisis', roles: DESK },
  { id: 'reports',   label: 'Reportes',  icon: 'chart',   roles: DESK },
  { id: 'dashboard', label: 'Panel',     icon: 'target',  roles: [...ENGINE, 'manager'] },
  { id: 'historial', label: 'Historial', icon: 'archive', roles: [...ENGINE, 'manager'] },

  { group: 'Administración', roles: LEADS },
  { id: 'users', label: 'Usuarios', icon: 'user', roles: ['admin'] },
];

/** Secciones que el rol puede abrir — también la usa App para validar la sección activa. */
export function sectionsFor(role) {
  return SECTIONS.filter(s => s.id && s.roles.includes(role));
}

/**
 * Deja solo las entradas del rol y descarta los encabezados que se quedaron
 * sin nada debajo, para que ningún rol vea un grupo vacío.
 */
function buildMenu(role) {
  const kept = SECTIONS.filter(s => s.group || s.roles.includes(role));
  return kept.filter((s, i) => !s.group || (kept[i + 1] && !kept[i + 1].group));
}

export default function Sidebar({ section, onSection, user, onLogout, isOpen, badges = {} }) {
  const role    = user?.role || 'user';
  const visible = buildMenu(role);

  return (
    <aside className={`rb-sidebar${isOpen ? ' is-open' : ''}`}>
      {/* El manual fija el logo arriba a la izquierda, con área de seguridad
          alrededor y sin alterar proporciones ni color. */}
      <div className="rb-brand">
        <img className="rb-brand-logo" src="/logo-russell-bedford-white.svg"
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
            <span className="rb-userchip-role">{roleOf(role).label}</span>
          </span>
          <Icon name="logout" size={14} />
        </button>
      </div>
    </aside>
  );
}
