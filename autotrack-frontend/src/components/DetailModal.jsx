import { useState, useEffect } from 'react';
import { assignables } from '../lib/tickets';
import { fmtDate, dateStatus, colorClass, fmtLogDate } from '../utils/helpers';

const STATUS_CLS = {
  backlog:'status-backlog',progress:'status-progress',
  standby:'status-standby',testing:'status-testing',done:'status-done',soporte:'status-soporte',
  cancelado:'status-cancelado',
};
const STATUS_L = {
  backlog:'Por hacer',progress:'En proceso',
  standby:'En standby',testing:'En testing',done:'Finalizado',soporte:'En soporte',
  cancelado:'Cancelado',
};
const PR_PILL = { high: 'pp-high', mid: 'pp-mid', low: 'pp-low' };
const PR_L    = { high: 'Alta',   mid: 'Media',  low: 'Baja'   };

const TIPO_LABEL = { automatizacion: 'Automatización', analitica: 'Analítica', compartido: 'Compartido', asignacion_flash: 'Asignación Flash' };
const TIPO_CLS   = { automatizacion: 'tipo-auto', analitica: 'tipo-analitica', compartido: 'tipo-compartido', asignacion_flash: 'tipo-flash' };

const fmtDateTime = (isoStr) => {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
    + ', ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
};

export default function DetailModal({ open, project, onClose, onEdit, onAddLog, onCloseSupport, onAddTask, onToggleTask, onDeleteTask, onUpdateTask, currentUser, users = [] }) {
  const isManager = currentUser?.role === 'manager';
  // Líderes reales gestionan todo; ingenieros/miembros de Analítica solo lo suyo.
  const isLeader     = ['admin', 'leader_analytics'].includes(currentUser?.role);
  const isRestricted = ['engineer', 'member_analytics'].includes(currentUser?.role);
  const isOwner = project && [...(project.assigneeIds || [project.assigneeId]), project.coAssigneeId, project.generalAssigneeId]
    .filter(v => v != null).map(Number).includes(Number(currentUser?.id));
  const canEdit = isLeader || (isRestricted && isOwner);
  const [logText, setLogText] = useState('');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [taskText, setTaskText]     = useState('');
  const [taskWeight, setTaskWeight] = useState(2);
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskSaving, setTaskSaving] = useState(false);
  const [busyTaskIds, setBusyTaskIds] = useState(new Set());
  const [isBlock, setIsBlock]       = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editAssignee, setEditAssignee]   = useState('');

  const tipo = project?.tipo || 'automatizacion';

  /* Una tarea se puede asignar a cualquiera del equipo del proyecto, no solo a
     quien figure como responsable general ni solo a quien tenga rol de
     ejecutor: en equipos pequeños quien coordina también saca trabajo, y
     filtrar por rol dejaba el selector sin nadie. */
  const delEquipo = (equipo) => assignables(users, equipo);
  const taskAssigneePool = tipo === 'analitica'
    ? delEquipo('analitica')
    : tipo === 'compartido'
      ? [...new Set([...delEquipo('automatizacion'), ...delEquipo('analitica')])]
      : delEquipo('automatizacion');

  useEffect(() => {
    const self = taskAssigneePool.some(u => u.id === currentUser?.id);
    setTaskAssignee(self ? String(currentUser.id) : '');
    setTaskWeight(2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  if (!open || !project) return null;

  const pct  = project.progress || 0;
  const eng  = project.assignee;
  const peopleAll = project.assignees?.length ? project.assignees : (eng ? [eng] : []);
  const dSt  = dateStatus(project.dueDate);
  const pr   = project.priority || 'mid';
  /* En compartidos, «Resp. Automatización» muestra solo a quien trabaja en ese
     equipo: separa las dos columnas cuando alguien de analítica quedó asignado
     por error. Quien trabaja en los dos equipos cuenta para ambas. */
  const idsAutomatizacion = new Set(delEquipo('automatizacion').map(u => u.id));
  const people = tipo === 'compartido' ? peopleAll.filter(p => idsAutomatizacion.has(p.id)) : peopleAll;

  const addLog = async () => {
    if (!logText.trim()) { setError('Escribe el avance de la reunión'); return; }
    setSaving(true); setError('');
    try {
      await onAddLog(project.id, { text: logText.trim(), block: isBlock });
      setLogText('');
      setIsBlock(false);
    } catch (err) {
      setError(err.error || 'Error al guardar');
    } finally { setSaving(false); }
  };

  const addTask = async () => {
    if (!taskText.trim() || taskSaving) return;
    setTaskSaving(true);
    try {
      await onAddTask(project.id, taskText.trim(), {
        weight: taskWeight,
        assigneeId: taskAssignee ? Number(taskAssignee) : null,
      });
      setTaskText(''); setTaskWeight(2);
    } finally { setTaskSaving(false); }
  };

  const startEditTask = (t) => {
    setEditingTaskId(t.id);
    setEditAssignee(t.assigneeId ? String(t.assigneeId) : '');
  };

  const saveEditTask = async (taskId) => {
    await withTaskBusy(taskId, () => onUpdateTask(project.id, taskId, {
      assigneeId: editAssignee ? Number(editAssignee) : null,
    }));
    setEditingTaskId(null);
  };

  // Evita disparar dos peticiones sobre la misma tarea (doble clic en el checkbox o en
  // eliminar) — junto con la cola por-proyecto en App.jsx, esto es lo que evitaba que
  // una tarea recién marcada/agregada "desapareciera" por una respuesta que llega en desorden.
  const withTaskBusy = async (taskId, fn) => {
    if (busyTaskIds.has(taskId)) return;
    setBusyTaskIds(s => new Set(s).add(taskId));
    try {
      await fn();
    } finally {
      setBusyTaskIds(s => { const n = new Set(s); n.delete(taskId); return n; });
    }
  };

  const tasks     = project?.tasks || [];
  const tasksDone = tasks.filter(t => t.done).length;

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 600 }}>
        <div className="modal-header">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              <span className={`badge ${STATUS_CLS[project.status] || 'status-backlog'}`}>{STATUS_L[project.status] || project.status}</span>
              <span className={`priority-pill ${PR_PILL[pr]}`}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: PR_L[pr] === 'Alta' ? 'var(--high)' : PR_L[pr] === 'Media' ? 'var(--mid)' : 'var(--low)', display: 'inline-block' }} />
                {PR_L[pr]}
              </span>
              <span className={`tipo-badge ${TIPO_CLS[tipo]}`}>{TIPO_LABEL[tipo]}</span>
              {project.wasSoporte && project.status !== 'soporte' && <span className="badge status-soporte">Pasó por soporte</span>}
            </div>
            <div className="modal-title">{project.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
              {people.length ? `Asignado a ${people.map(p => p.name).join(', ')}` : 'Sin asignar'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {canEdit && <button className="btn btn-ghost btn-sm" onClick={() => onEdit(project.id)}>Editar</button>}
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
        </div>

        <div className="modal-body" style={{ paddingBottom: 8 }}>
          {/* Info grid */}
          <div className="detail-info-grid" style={{ marginBottom: 16, background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '14px 16px' }}>
            {project.generalAssignee && (
              <div>
                <div className="detail-label">Resp. general</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <div className={`avatar-xs ${colorClass(project.generalAssignee.colorIndex)}`}>{project.generalAssignee.initials}</div>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{project.generalAssignee.name.split(' ')[0]}</span>
                </div>
              </div>
            )}
            {people.length > 0 && (
              <div>
                <div className="detail-label">{tipo === 'compartido' ? 'Resp. Automatización' : 'Responsable'}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                  {people.map(p => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div className={`avatar-xs ${colorClass(p.colorIndex)}`}>{p.initials}</div>
                      <span style={{ fontSize: 12, fontWeight: 500 }}>{p.name.split(' ')[0]}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {project.coAssignee && (
              <div>
                <div className="detail-label">Resp. Analítica</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <div className={`avatar-xs ${colorClass(project.coAssignee.colorIndex)}`}>{project.coAssignee.initials}</div>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{project.coAssignee.name.split(' ')[0]}</span>
                </div>
              </div>
            )}
            <div>
              <div className="detail-label">Entrega</div>
              <div style={{ fontSize: 13, fontFamily: 'var(--mono)', fontWeight: 600, marginTop: 4, color: dSt === 'overdue' ? 'var(--high)' : dSt === 'soon' ? 'var(--rb-navy)' : 'var(--text)' }}>
                {fmtDate(project.dueDate)}
              </div>
            </div>
            {project.client && (
              <div>
                <div className="detail-label">Área / Cliente</div>
                <div style={{ fontSize: 13, marginTop: 4, fontWeight: 500 }}>{project.client}</div>
              </div>
            )}
          </div>

          {/* Documentation link */}
          <div style={{ marginBottom: 16 }}>
            {project.docUrl ? (
              <a
                href={project.docUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none', transition: '.12s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-light)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--surface2)'}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
                Abrir carpeta de documentación
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ opacity: .6 }}>
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
                Sin documentación
              </span>
            )}
          </div>

          {/* Shared project breakdown */}
          {tipo === 'compartido' && (project.participationAuto || project.participationAnalitica) && (
            <div style={{ background: 'rgba(8,145,178,.07)', border: '1px solid rgba(8,145,178,.2)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: '#0B6E80', marginBottom: 10 }}>Proyecto compartido</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {project.participationAuto && (
                  <div>
                    <div className="detail-label">Automatización</div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 3 }}>{project.participationAuto}</div>
                    <div style={{ marginTop: 6 }}>
                      <div className="card-progress" style={{ height: 5 }}>
                        <div className="card-progress-fill" style={{ width: `${project.progressAuto || 0}%`, background: 'var(--accent)' }} />
                      </div>
                      <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--accent)', fontWeight: 700 }}>{project.progressAuto || 0}%</span>
                    </div>
                  </div>
                )}
                {project.participationAnalitica && (
                  <div>
                    <div className="detail-label">Analítica</div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 3 }}>{project.participationAnalitica}</div>
                    <div style={{ marginTop: 6 }}>
                      <div className="card-progress" style={{ height: 5 }}>
                        <div className="card-progress-fill" style={{ width: `${project.progressAnalitica || 0}%`, background: '#7c3aed' }} />
                      </div>
                      <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: '#7c3aed', fontWeight: 700 }}>{project.progressAnalitica || 0}%</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Progress */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div className="detail-label">Progreso</div>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>{pct}%</span>
            </div>
            <div className="progress-big">
              <div className={`progress-big-fill${pct >= 100 ? ' done' : ''}`} style={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* Description */}
          {project.description && (
            <div style={{ marginBottom: 18 }}>
              <div className="detail-label">Descripción</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginTop: 4 }}>{project.description}</div>
            </div>
          )}

          {/* Tareas */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div className="detail-label">Tareas</div>
              {tasks.length > 0 && (
                <span style={{ fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 700, color: tasksDone === tasks.length ? 'var(--green)' : 'var(--text3)' }}>
                  {tasksDone}/{tasks.length}
                </span>
              )}
            </div>
            {tasks.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 8 }}>
                {tasks.map(t => (
                  <div key={t.id} className="task-row" style={{ flexWrap: 'wrap', alignItems: editingTaskId === t.id ? 'flex-start' : 'center' }}>
                    <button
                      className={`task-check${t.done ? ' task-check--done' : ''}`}
                      disabled={!canEdit || busyTaskIds.has(t.id)}
                      onClick={() => canEdit && withTaskBusy(t.id, () => onToggleTask(project.id, t.id, !t.done))}
                    >
                      {t.done && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </button>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                      <span className={`task-title${t.done ? ' task-title--done' : ''}`}>{t.title}</span>
                      {t.createdAt && (
                        <span style={{ fontSize: 10.5, color: 'var(--text3)' }}>Creada {fmtDateTime(t.createdAt)}</span>
                      )}
                    </div>
                    {t.assigneeId && (() => {
                      const owner = taskAssigneePool.find(u => u.id === t.assigneeId);
                      return owner ? (
                        <span className={`avatar-xs ${colorClass(owner.colorIndex)}`} title={owner.name}>{owner.initials}</span>
                      ) : null;
                    })()}
                    {canEdit && (
                      <button className="task-del" style={{ opacity: 1 }} disabled={busyTaskIds.has(t.id)}
                        onClick={() => startEditTask(t)} title="Editar responsable">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>
                        </svg>
                      </button>
                    )}
                    {canEdit && (
                      <button className="task-del" disabled={busyTaskIds.has(t.id)}
                        onClick={() => withTaskBusy(t.id, () => onDeleteTask(project.id, t.id))} title="Eliminar tarea">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    )}
                    {editingTaskId === t.id && (
                      <div style={{ display: 'flex', gap: 6, width: '100%', marginTop: 4, paddingLeft: 26 }}>
                        <select className="form-input" style={{ flex: 1, fontSize: 12.5, padding: '6px 8px' }}
                          value={editAssignee} onChange={e => setEditAssignee(e.target.value)} title="Asignar a">
                          <option value="">Sin asignar</option>
                          {taskAssigneePool.map(u => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
                        </select>
                        <button className="btn btn-primary btn-sm" disabled={busyTaskIds.has(t.id)} onClick={() => saveEditTask(t.id)}>
                          Guardar
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditingTaskId(null)}>Cancelar</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {tasks.length === 0 && !canEdit && (
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>Sin tareas registradas</div>
            )}
            {canEdit && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <input
                  className="form-input"
                  style={{ flex: 1, minWidth: 140, fontSize: 13, padding: '7px 10px' }}
                  placeholder="Nueva tarea…"
                  value={taskText}
                  onChange={e => setTaskText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addTask()}
                />
                <select className="form-input" style={{ width: 100, fontSize: 13, padding: '7px 10px' }}
                  value={taskWeight} onChange={e => setTaskWeight(Number(e.target.value))} title="Tamaño de la tarea">
                  <option value={1}>Pequeña</option>
                  <option value={2}>Media</option>
                  <option value={3}>Grande</option>
                </select>
                {taskAssigneePool.length > 0 && (
                  <select className="form-input" style={{ width: 130, fontSize: 13, padding: '7px 10px', borderColor: taskAssignee ? undefined : 'var(--high)' }}
                    value={taskAssignee} onChange={e => setTaskAssignee(e.target.value)} title="Asignar a (obligatorio)">
                    <option value="" disabled>Asignar a…</option>
                    {taskAssigneePool.map(u => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
                  </select>
                )}
                <button className="btn btn-ghost btn-sm" onClick={addTask}
                  disabled={taskSaving || !taskText.trim() || (taskAssigneePool.length > 0 && !taskAssignee)}>
                  Agregar
                </button>
              </div>
            )}
          </div>

          {/* Logs */}
          <div className="log-divider">Seguimiento semanal</div>
          <div className="log-list">
            {project.logs?.length ? (
              project.logs.map(l => (
                <div className="log-item" key={l.id}>
                  <div className="log-meta">
                    <span className="log-author">{l.author?.name || 'Sistema'}</span>
                    <span className="log-date">{fmtLogDate(l.createdAt)}{l.progress != null ? ` · ${l.progress}%` : ''}</span>
                  </div>
                  <div className="log-text">{l.text}</div>
                </div>
              ))
            ) : (
              <div className="empty" style={{ padding: 16, fontSize: 12 }}>Sin avances registrados aún</div>
            )}
          </div>

          {/* Add log — solo el responsable del proyecto o un líder */}
          {canEdit && (
            <div style={{ marginTop: 14, background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: 16, border: '1px solid var(--border)' }}>
              {error && <div className="login-error" style={{ marginBottom: 10 }}>{error}</div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Registrar avance</label>
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                  Progreso: <b style={{ color: 'var(--accent)' }}>{pct}%</b> (según tareas completadas)
                </span>
              </div>
              <textarea
                className="form-textarea"
                value={logText}
                onChange={e => setLogText(e.target.value)}
                placeholder={isBlock ? 'Describe el bloqueo: qué lo causa, qué se necesita para destrabarlo...' : 'Registra el avance de la reunión semanal...'}
                rows={2}
                style={{ marginBottom: 8, fontSize: 13 }}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, cursor: 'pointer', fontSize: 12, color: isBlock ? 'var(--high)' : 'var(--text2)', fontWeight: isBlock ? 600 : 400 }}>
                <input type="checkbox" checked={isBlock} onChange={e => setIsBlock(e.target.checked)}
                  style={{ accentColor: 'var(--high)', width: 14, height: 14, cursor: 'pointer' }} />
                Reportar como bloqueo — el proyecto pasará a "En standby"
              </label>
              <button
                className={`btn btn-sm${isBlock ? ' btn-danger' : ' btn-primary'}`}
                style={{ width: '100%', justifyContent: 'center' }} onClick={addLog} disabled={saving}>
                {saving ? 'Guardando...' : isBlock ? 'Reportar bloqueo' : 'Registrar avance'}
              </button>
            </div>
          )}
          {!canEdit && !isManager && (
            <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: '10px 0' }}>
              Solo el responsable de este proyecto puede actualizarlo — tú puedes ver la información, pero no editarla.
            </div>
          )}
        </div>

        <div className="modal-footer">
          {project.status === 'soporte' && canEdit && (
            <button
              className="btn btn-sm"
              style={{ marginRight: 'auto', background: 'var(--c-soporte-bg)', color: 'var(--c-soporte)' }}
              onClick={() => onCloseSupport?.(project.id)}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Cerrar soporte
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
