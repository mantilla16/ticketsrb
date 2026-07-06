import { colorClass } from '../utils/helpers';

const ROLE_LABEL = {
  admin:     'Administrador',
  engineer:  'Ingeniero',
  analytics: 'Analítica',
  viewer:    'Visualizador',
};

const ROLE_CLASS = {
  admin:     'role-admin',
  engineer:  'role-eng',
  analytics: 'role-analytics',
  viewer:    'role-viewer',
};

function userStats(userId, projects) {
  const mine = projects.filter(p => (p.assigneeId || p.assignee_id) === userId);
  return {
    total:  mine.length,
    active: mine.filter(p => ['progress', 'testing'].includes(p.status)).length,
    standby: mine.filter(p => p.status === 'standby').length,
    done:   mine.filter(p => p.status === 'done').length,
  };
}

export default function UsersView({ users, projects, currentUser }) {
  return (
    <div className="uv-root">
      <div className="uv-summary">
        <span className="uv-summary-num">{users.length}</span>
        <span className="uv-summary-lbl">usuario{users.length !== 1 ? 's' : ''} en el equipo</span>
      </div>

      <div className="uv-grid">
        {users.map((u, i) => {
          const stats = userStats(u.id, projects);
          const role = u.role || 'engineer';
          const isMe = currentUser && u.id === currentUser.id;

          return (
            <div
              key={u.id}
              className={`uv-card${isMe ? ' uv-card--me' : ''}`}
              style={{ animationDelay: `${i * 45}ms` }}
            >
              {/* Header */}
              <div className="uv-card-head">
                <div className={`uv-avatar ${colorClass(u.colorIndex)}`}>{u.initials}</div>
                <div className="uv-info">
                  <div className="uv-name">
                    {u.name}
                    {isMe && <span className="uv-me-tag">Tú</span>}
                  </div>
                  <div className="uv-email">{u.email}</div>
                  <span className={`uv-role ${ROLE_CLASS[role] || 'role-eng'}`}>
                    {ROLE_LABEL[role] || role}
                  </span>
                </div>
              </div>

              {/* Stats */}
              <div className="uv-stats">
                <div className="uv-stat">
                  <div className="uv-stat-val">{stats.total}</div>
                  <div className="uv-stat-lbl">Total</div>
                </div>
                <div className="uv-stat-sep" />
                <div className="uv-stat">
                  <div className="uv-stat-val uv-val-active">{stats.active}</div>
                  <div className="uv-stat-lbl">Activos</div>
                </div>
                <div className="uv-stat-sep" />
                <div className="uv-stat">
                  <div className="uv-stat-val uv-val-done">{stats.done}</div>
                  <div className="uv-stat-lbl">Finalizados</div>
                </div>
              </div>

              {/* Completion bar */}
              {stats.total > 0 && (
                <div className="uv-bar-wrap">
                  <div className="uv-bar">
                    <div
                      className="uv-bar-fill uv-bar-done"
                      style={{ width: `${(stats.done / stats.total) * 100}%` }}
                    />
                    <div
                      className="uv-bar-fill uv-bar-active"
                      style={{ width: `${(stats.active / stats.total) * 100}%` }}
                    />
                  </div>
                  <span className="uv-bar-pct">
                    {Math.round((stats.done / stats.total) * 100)}% completado
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
