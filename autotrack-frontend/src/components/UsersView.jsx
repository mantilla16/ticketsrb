import { useState } from 'react';
import { colorClass } from '../utils/helpers';

const ROLE_LABEL = { admin: 'Administrador', engineer: 'Ingeniero', user: 'Usuario' };
const ROLE_CLASS = { admin: 'role-admin', engineer: 'role-eng', user: 'role-user' };

function userStats(userId, projects) {
  const mine = projects.filter(p => (p.assigneeId || p.assignee_id) === userId);
  return {
    total:  mine.length,
    active: mine.filter(p => ['progress', 'testing', 'standby', 'backlog'].includes(p.status)).length,
    done:   mine.filter(p => p.status === 'done').length,
  };
}

export default function UsersView({ users, projects, currentUser, onEdit, onDelete, onAdd, onUnlock }) {
  const [search, setSearch]   = useState('');
  const [delConfirm, setDelConfirm] = useState(null);

  const filtered = search.trim()
    ? users.filter(u =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        (ROLE_LABEL[u.role] || '').toLowerCase().includes(search.toLowerCase())
      )
    : users;

  const confirmDelete = (u) => setDelConfirm(u);
  const executeDelete = () => { if (delConfirm) { onDelete(delConfirm.id); setDelConfirm(null); } };

  return (
    <div className="uv-root">
      {/* Toolbar */}
      <div className="uv-toolbar">
        <div className="uv-toolbar-left">
          <span className="uv-total">{users.length} usuario{users.length !== 1 ? 's' : ''}</span>
          <div className="uv-search-wrap">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className="uv-search"
              placeholder="Buscar por nombre, correo o rol…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && <button className="uv-search-clear" onClick={() => setSearch('')}>✕</button>}
          </div>
        </div>
        <button className="btn btn-primary" onClick={onAdd}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nuevo usuario
        </button>
      </div>

      {/* Table */}
      <div className="uv-table-wrap">
        <table className="uv-table">
          <thead>
            <tr>
              <th className="uv-th">Usuario</th>
              <th className="uv-th">Correo</th>
              <th className="uv-th">Rol</th>
              <th className="uv-th uv-th-center">Proyectos</th>
              <th className="uv-th uv-th-center">Activos</th>
              <th className="uv-th uv-th-center">Finalizados</th>
              <th className="uv-th uv-th-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan="7" className="uv-empty-row">No se encontraron usuarios</td></tr>
            ) : filtered.map(u => {
              const stats = userStats(u.id, projects);
              const isMe  = currentUser && u.id === currentUser.id;
              return (
                <tr key={u.id} className={`uv-tr${isMe ? ' uv-tr--me' : ''}`}>
                  <td className="uv-td">
                    <div className="uv-cell-user">
                      <div className={`uv-avatar-sm ${colorClass(u.colorIndex)}`}>{u.initials}</div>
                      <div>
                        <div className="uv-cell-name">
                          {u.name}
                          {isMe && <span className="uv-me-tag">Tú</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="uv-td uv-td-email">{u.email}</td>
                  <td className="uv-td">
                    <span className={`uv-role ${ROLE_CLASS[u.role] || 'role-eng'}`}>
                      {ROLE_LABEL[u.role] || u.role}
                    </span>
                  </td>
                  <td className="uv-td uv-td-num">{stats.total}</td>
                  <td className="uv-td uv-td-num uv-val-active">{stats.active}</td>
                  <td className="uv-td uv-td-num uv-val-done">{stats.done}</td>
                  <td className="uv-td uv-td-actions">
                    {u.locked && (
                      <button
                        className="uv-action-btn"
                        style={{ background: '#FEF2F2', color: '#EF4444', borderColor: 'rgba(239,68,68,.3)' }}
                        onClick={() => onUnlock(u.id)}
                        title="Cuenta bloqueada por intentos fallidos — clic para desbloquear"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>
                        </svg>
                      </button>
                    )}
                    <button className="uv-action-btn" onClick={() => onEdit(u)} title="Editar">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    {!isMe && (
                      <button className="uv-action-btn uv-action-btn--del" onClick={() => confirmDelete(u)} title="Eliminar">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                          <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Delete confirm */}
      {delConfirm && (
        <div className="um-backdrop" onClick={() => setDelConfirm(null)}>
          <div className="um-del-modal" onClick={e => e.stopPropagation()}>
            <div className="um-del-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
            </div>
            <div className="um-del-title">Eliminar usuario</div>
            <div className="um-del-user">
              <div className={`uv-avatar-sm ${colorClass(delConfirm.colorIndex)}`}>{delConfirm.initials}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{delConfirm.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>{delConfirm.email}</div>
              </div>
            </div>
            <p className="um-del-desc">
              Esta acción es <strong>irreversible</strong>. El usuario perderá acceso al sistema y sus proyectos quedarán sin asignado.
            </p>
            <div className="um-del-actions">
              <button className="btn btn-ghost" onClick={() => setDelConfirm(null)} style={{ flex: 1, justifyContent: 'center' }}>
                Cancelar
              </button>
              <button className="um-del-btn" onClick={executeDelete}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                </svg>
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
