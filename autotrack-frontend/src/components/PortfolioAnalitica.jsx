/* Portafolio Analítica — vista operativa: cliente → proyecto → tareas.
   Que se hace, qué queda por hacer y con qué fechas. El catálogo de
   clientes y la creación de proyectos viven aquí; el Reporte Analítica
   queda únicamente como lectura. */

import { useState, useEffect } from 'react';
import { analyticsReportAPI } from '../services/api';
import { colorClass } from '../utils/helpers';

const STATUS_DEF = {
  backlog:  { l: 'Por hacer',  c: 'var(--rb-neutral)', bg: 'var(--rb-neutral-bg)' },
  progress: { l: 'En proceso', c: 'var(--rb-navy)',    bg: 'var(--rb-navy-tint)' },
  standby:  { l: 'En standby', c: 'var(--rb-warning)', bg: 'var(--rb-warning-bg)' },
  testing:  { l: 'En testing', c: 'var(--rb-violet)',  bg: 'var(--rb-violet-bg)' },
  done:     { l: 'Finalizado', c: 'var(--rb-success)', bg: 'var(--rb-success-bg)' },
  soporte:  { l: 'Soporte',    c: 'var(--rb-info)',    bg: 'var(--rb-info-bg)' },
  cancelado:{ l: 'Cancelado',  c: 'var(--rb-danger)',  bg: 'var(--rb-danger-bg)' },
};

const PR_PILL = {
  high: { l: 'Alta',  c: 'var(--rb-danger)',  bg: 'var(--rb-danger-bg)' },
  mid:  { l: 'Media', c: 'var(--rb-navy)',    bg: 'var(--rb-navy-tint)' },
  low:  { l: 'Baja',  c: 'var(--rb-success)', bg: 'var(--rb-success-bg)' },
};

const fmtShort = (d) => {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
};

const isOverdue = (d) => {
  if (!d) return false;
  return new Date(d + 'T00:00:00') < new Date(new Date().toDateString());
};

/* Una sección de cliente con sus proyectos y tareas pendientes */
function ClientSection({ client, projects, users, index, onCardClick, onNewProject }) {
  const [expanded, setExpanded] = useState(true);

  const pendingTasks = projects.flatMap(p =>
    (p.tasks || []).filter(t => !t.done && !['done', 'cancelado'].includes(p.status))
      .map(t => ({ ...t, project: p })),
  );
  const overdue = pendingTasks.filter(t => isOverdue(t.dueDate)).length;
  const inCourse = projects.filter(p => ['progress', 'testing'].includes(p.status)).length;
  const next = pendingTasks.length
    ? pendingTasks.reduce((a, b) => !a.dueDate || (b.dueDate && b.dueDate < a.dueDate) ? b : a)
    : null;

  const userName = (id) => users.find(u => Number(u.id) === Number(id))?.name || null;

  return (
    <div style={{
      border: '1px solid var(--rb-line)', borderRadius: 'var(--rb-r-lg)',
      background: 'var(--rb-surface)', overflow: 'hidden',
    }}>
      {/* Encabezado */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
          background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span className={`avatar ${colorClass(index % 8)}`} style={{ fontSize: 12 }}>
          {client.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 'var(--rb-w-bold)', fontSize: 'var(--rb-fs-md)', color: 'var(--rb-text)' }}>
              {client.name}
            </span>
            {overdue > 0 && (
              <span className="pill-mini" style={{ background: 'var(--rb-danger-bg)', color: 'var(--rb-danger)' }}>
                {overdue} vencida{overdue !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--rb-text-3)' }}>
              <b style={{ color: 'var(--rb-text)' }}>{projects.length}</b> proyectos
            </span>
            <span style={{ fontSize: 12, color: 'var(--rb-text-3)' }}>
              <b style={{ color: 'var(--rb-navy)' }}>{inCourse}</b> en curso
            </span>
            <span style={{ fontSize: 12, color: 'var(--rb-text-3)' }}>
              <b style={{ color: 'var(--rb-warning)' }}>{pendingTasks.length}</b> tareas pend.
            </span>
            {next?.dueDate && (
              <span style={{ fontSize: 12, color: isOverdue(next.dueDate) ? 'var(--rb-danger)' : 'var(--rb-text-3)', fontWeight: isOverdue(next.dueDate) ? 700 : 400 }}>
                próxima: <b>{fmtShort(next.dueDate)}</b>
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={(e) => { e.stopPropagation(); onNewProject([client.id]); }}
            title={`Nuevo proyecto para ${client.name}`}
          >
            + Proyecto
          </button>
          <span className="pill-mini" style={{ background: 'var(--rb-n-100)', color: 'var(--rb-text-3)' }}>
            {expanded ? 'Ocultar' : 'Ver proyectos'}
          </span>
        </div>
      </button>

      {/* Proyectos */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--rb-line-soft)' }}>
          {projects.length === 0 && (
            <div style={{ padding: '14px 16px', color: 'var(--rb-text-4)', fontSize: 13 }}>
              Sin proyectos todavía — crea el primero con «+ Proyecto».
            </div>
          )}
          <div style={{ display: 'grid', gap: 8, padding: '10px 16px' }}>
            {projects.map(p => {
              const st = STATUS_DEF[p.status] || STATUS_DEF.backlog;
              const pr = PR_PILL[p.priority] || PR_PILL.mid;
              const pend = (p.tasks || []).filter(t => !t.done && !['done', 'cancelado'].includes(p.status));
              const doneCount = (p.tasks || []).filter(t => t.done).length;
              return (
                <div key={p.id} style={{
                  border: '1px solid var(--rb-line-soft)', borderRadius: 'var(--rb-r-md)',
                  background: 'var(--rb-surface-2)', padding: '10px 12px', cursor: 'pointer',
                }} onClick={() => onCardClick(p.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ flex: 1, minWidth: 160, fontSize: 13.5, fontWeight: 600, color: 'var(--rb-text)' }}>{p.name}</span>
                    <span className="pill-mini" style={{ background: st.bg, color: st.c }}>{st.l}</span>
                    <span className="pill-mini" style={{ background: pr.bg, color: pr.c }}>{pr.l}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="at-card-bar" style={{ width: 48 }}>
                        <span style={{ width: `${p.progress}%`, background: p.progress >= 80 ? 'var(--rb-success)' : 'var(--rb-navy)' }} />
                      </span>
                      <span style={{ fontSize: 11.5, color: 'var(--rb-text-3)' }}>{p.progress}%</span>
                    </div>
                    <span style={{ fontSize: 11.5, color: 'var(--rb-text-3)' }}>
                      {pend.length} pend · {doneCount} hecha{doneCount !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Tareas pendientes del proyecto */}
                  {pend.length > 0 && (
                    <div style={{ marginTop: 8, borderTop: '1px dashed var(--rb-line-soft)', paddingTop: 8, display: 'grid', gap: 4 }}>
                      {pend.map(t => {
const tp = t.priority ? PR_PILL[t.priority] || PR_PILL.mid : null;
                            const assignee = t.assigneeId ? userName(t.assigneeId) : null;
                        return (
                          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, flexWrap: 'wrap' }}>
                            <span style={{ color: 'var(--rb-text-2)', flex: 1, minWidth: 140 }}>{t.title}</span>
                            {tp && (
                              <span className="pill-mini" style={{ background: tp.bg, color: tp.c, fontSize: 10.5 }}>{tp.l}</span>
                            )}
                            {t.dueDate && (
                              <span className="pill-mini" style={{
                                fontSize: 10.5,
                                background: isOverdue(t.dueDate) ? 'var(--rb-danger-bg)' : 'var(--rb-success-bg)',
                                color: isOverdue(t.dueDate) ? 'var(--rb-danger)' : 'var(--rb-success)',
                              }}>
                                {isOverdue(t.dueDate) ? 'Vence' : 'Para'} {fmtShort(t.dueDate)}
                              </span>
                            )}
                            {assignee && <span style={{ fontSize: 11, color: 'var(--rb-text-3)' }}>{assignee}</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PortfolioAnalitica({ projects, users, allUsers, currentUser, onCardClick, onNewProject }) {
  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [filter, setFilter] = useState('todos');

  // Gestión del catálogo de clientes
  const [showClientModal, setShowClientModal] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [editingClient, setEditingClient] = useState(null);
  const [editClientName, setEditClientName] = useState('');
  const [editClientActive, setEditClientActive] = useState(true);
  const [clientError, setClientError] = useState('');

  const loadCatalog = () => {
    setCatalogLoading(true);
    analyticsReportAPI.getClients()
      .then(setCatalog)
      .catch(() => setCatalog([]))
      .finally(() => setCatalogLoading(false));
  };
  useEffect(() => { loadCatalog(); }, []);

  const addClient = async () => {
    const name = newClientName.trim();
    if (!name) return;
    setClientError('');
    try {
      const created = await analyticsReportAPI.createClient({ name, active: true });
      loadCatalog();
      setNewClientName('');
    } catch (e) {
      setClientError(e.error || 'Error al crear cliente');
    }
  };

  const saveClient = async (id) => {
    const name = editClientName.trim();
    if (!name) return;
    setClientError('');
    try {
      await analyticsReportAPI.updateClient(id, { name, active: editClientActive });
      setEditingClient(null);
      loadCatalog();
    } catch (e) {
      setClientError(e.error || 'Error al actualizar cliente');
    }
  };

  const removeClient = async (id) => {
    setClientError('');
    try {
      await analyticsReportAPI.deleteClient(id);
      setEditingClient(null);
      loadCatalog();
    } catch (e) {
      setClientError(e.error || 'Error al eliminar cliente');
    }
  };

  const toggleClientActive = async (client) => {
    setClientError('');
    try {
      await analyticsReportAPI.updateClient(client.id, { name: client.name, active: !client.active });
      loadCatalog();
    } catch (e) {
      setClientError(e.error || 'Error al cambiar estado');
    }
  };

  /* Agrupar los proyectos de analítica por cliente (incluye los clientes del
     catálogo que todavía no tienen proyectos). */
  const analyticsProjects = projects.filter(p => p.tipo === 'analitica');
  const projsByClient = {};
  analyticsProjects.forEach(p => {
    let ids = (p.clients || []).map(c => c.id);
    if (!ids.length && (p.client || '').trim()) {
      const legacy = catalog.find(c => c.name.toLowerCase() === p.client.trim().toLowerCase());
      if (legacy) ids = [legacy.id];
    }
    ids.forEach(id => {
      if (!projsByClient[id]) projsByClient[id] = [];
      projsByClient[id].push(p);
    });
  });

  const sections = catalog.map((c, i) => ({
    ...c,
    projects: (projsByClient[c.id] || []).sort((a, b) => {
      const order = { progress: 0, testing: 1, standby: 2, backlog: 3, soporte: 4, done: 5, cancelado: 6 };
      return (order[a.status] ?? 9) - (order[b.status] ?? 9) || b.progress - a.progress;
    }),
    index: i,
  }));

  const visible = filter === 'activos'
    ? sections.filter(c => c.active)
    : sections;

  const allPend = analyticsProjects.flatMap(p =>
    (p.tasks || []).filter(t => !t.done && !['done', 'cancelado'].includes(p.status)),
  );
  const allOverdue = allPend.filter(t => isOverdue(t.dueDate)).length;

  return (
    <div className="ar-root">
      {/* Encabezado con acciones */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, color: 'var(--rb-text-3)' }}>
          {analyticsProjects.length} proyectos de analítica · {allPend.length} tareas pendientes
          {allOverdue > 0 && <span style={{ color: 'var(--rb-danger)', fontWeight: 700 }}> · {allOverdue} vencidas</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {[
            ['todos', 'Todos'], ['activos', 'Solo activos'],
          ].map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} style={{
              cursor: 'pointer', padding: '6px 14px', borderRadius: 'var(--rb-r-pill)',
              fontSize: 12.5, fontWeight: 600, fontFamily: 'var(--rf-font, var(--font))',
              background: filter === k ? 'var(--rb-navy)' : 'var(--rb-surface)',
              color: filter === k ? '#fff' : 'var(--rb-text-3)',
              border: filter === k ? '1px solid var(--rb-navy)' : '1px solid var(--rb-line)',
            }}>
              {l}
            </button>
          ))}
          <button className="btn btn-ghost btn-sm" onClick={() => setShowClientModal(true)}>
            Gestionar clientes
          </button>
        </div>
      </div>

      {catalogLoading ? (
        <div style={{ display: 'grid', placeItems: 'center', padding: 40, color: 'var(--rb-text-3)' }}>
          Cargando clientes…
        </div>
      ) : visible.length === 0 ? (
        <div style={{
          border: '1px dashed var(--rb-line)', borderRadius: 'var(--rb-r-lg)',
          padding: 32, textAlign: 'center', color: 'var(--rb-text-3)', fontSize: 13.5,
        }}>
          No hay clientes configurados. Usa «Gestionar clientes» para crearlos.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {visible.map((c) => (
            <ClientSection
              key={c.id} client={c} projects={c.projects} users={allUsers}
              index={c.index} onCardClick={onCardClick} onNewProject={onNewProject}
            />
          ))}
        </div>
      )}

      {/* ── Modal de gestión de clientes ── */}
      {showClientModal && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setShowClientModal(false)}>
          <div className="modal" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <div>
                <div className="modal-title">Gestionar clientes</div>
                <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }}>
                  Agrega, renombra o desactiva los clientes del proyecto de analítica
                </div>
              </div>
              <button className="modal-close" onClick={() => { setShowClientModal(false); setEditingClient(null); }}>×</button>
            </div>
            <div className="modal-body">
              {clientError && (
                <div className="login-error" style={{ marginBottom: 12 }}>{clientError}</div>
              )}

              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <input
                  className="pm-input" style={{ flex: 1 }}
                  placeholder="Nombre del nuevo cliente…"
                  value={newClientName}
                  onChange={e => setNewClientName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addClient()}
                />
                <button className="btn btn-primary btn-sm" onClick={addClient} disabled={!newClientName.trim()}>
                  Agregar
                </button>
              </div>

              {catalog.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text3)', padding: '12px 0' }}>No hay clientes registrados</div>
              ) : (
                <div style={{ display: 'grid', gap: 6 }}>
                  {catalog.map(c => (
                    <div key={c.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 12px', borderRadius: 'var(--rb-r-md)',
                      background: 'var(--rb-surface-2)',
                      border: '1px solid var(--rb-line-soft)',
                      opacity: c.active ? 1 : 0.55,
                    }}>
                      {editingClient === c.id ? (
                        <>
                          <input
                            className="pm-input" style={{ flex: 1, fontSize: 13 }}
                            value={editClientName}
                            onChange={e => setEditClientName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && saveClient(c.id)}
                            autoFocus
                          />
                          <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 12, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                            <input type="checkbox" checked={editClientActive}
                              onChange={e => setEditClientActive(e.target.checked)}
                              style={{ accentColor: 'var(--accent)', width: 13, height: 13 }} />
                            Activo
                          </label>
                          <button className="btn btn-primary btn-sm" style={{ fontSize: 12 }} onClick={() => saveClient(c.id)} disabled={!editClientName.trim()}>Guardar</button>
                          <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }} onClick={() => setEditingClient(null)}>Cancelar</button>
                        </>
                      ) : (
                        <>
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{c.name}</span>
                          {!c.active && (
                            <span className="pill-mini" style={{ background: 'var(--rb-neutral-bg)', color: 'var(--rb-neutral)', fontSize: 11 }}>No activo</span>
                          )}
                          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '3px 8px' }}
                            onClick={() => toggleClientActive(c)} title={c.active ? 'Desactivar' : 'Activar'}>
                            {c.active ? 'Desactivar' : 'Activar'}
                          </button>
                          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '3px 8px' }}
                            onClick={() => { setEditingClient(c.id); setEditClientName(c.name); setEditClientActive(c.active); }}>
                            Editar
                          </button>
                          <button className="btn btn-danger btn-sm" style={{ fontSize: 11, padding: '3px 8px' }}
                            onClick={() => { if (window.confirm(`¿Eliminar "${c.name}"?`)) removeClient(c.id); }}>
                            ×
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowClientModal(false); setEditingClient(null); }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}