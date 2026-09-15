/* ProjectDetailPanel — panel lateral de detalle estilo Notion/Linear.
   Se desliza desde la derecha mostrando: nombre editable, estado, prioridad,
   descripción, tareas con check/inline edit, clientes, seguimiento. */

import { useState, useEffect } from 'react';
import { assignables } from '../lib/tickets';
import { fmtDate, colorClass, fmtLogDate } from '../utils/helpers';
import { analyticsReportAPI } from '../services/api';

const STATUS_L = {
  backlog: 'Por hacer', progress: 'En proceso', standby: 'En standby',
  testing: 'Testing', done: 'Finalizado', soporte: 'Soporte', cancelado: 'Cancelado',
};
const STATUS_BG = {
  backlog: 'var(--rb-neutral-bg)', progress: 'var(--rb-navy-tint)', standby: 'var(--rb-n-100)',
  testing: 'var(--rb-warning-bg)', done: 'var(--rb-success-bg)', soporte: '#e0f2fe', cancelado: 'var(--rb-danger-bg)',
};
const STATUS_C = {
  backlog: 'var(--rb-neutral)', progress: 'var(--rb-navy)', standby: 'var(--rb-n-400)',
  testing: 'var(--rb-warning)', done: 'var(--rb-success)', soporte: '#0B6E80', cancelado: 'var(--rb-danger)',
};
const PR_L = { high: 'Alta', mid: 'Media', low: 'Baja' };
const PR_BG = { high: 'var(--rb-danger-bg)', mid: 'var(--rb-navy-tint)', low: 'var(--rb-success-bg)' };
const PR_C  = { high: 'var(--rb-danger)', mid: 'var(--rb-navy)', low: 'var(--rb-success)' };

const fmtShort = (d) => {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
};

const isOverdue = (d) => {
  if (!d) return false;
  return new Date(d + 'T00:00:00') < new Date(new Date().toDateString());
};

function Section({ title, count, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="dp-section">
      <button className="dp-section-head" onClick={() => setOpen(o => !o)}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>
          <polyline points="9 18 15 12 9 6"/>
        </svg>
        {title}
        {count != null && <span className="dp-section-count">{count}</span>}
      </button>
      {open && <div className="dp-section-body">{children}</div>}
    </div>
  );
}

export default function ProjectDetailPanel({ open, project, onClose, onEdit, onAddLog, onAddTask, onToggleTask, onDeleteTask, onUpdateTask, currentUser, users = [] }) {
  const [taskText, setTaskText]       = useState('');
  const [taskDate, setTaskDate]       = useState('');
  const [taskPriority, setTaskPriority] = useState('mid');
  const [taskClientId, setTaskClientId] = useState('');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskSaving, setTaskSaving]   = useState(false);
  const [busyTaskIds, setBusyTaskIds] = useState(new Set());
  const [analyticsClients, setAnalyticsClients] = useState([]);
  const [logText, setLogText]         = useState('');
  const [isBlock, setIsBlock]         = useState(false);
  const [logSaving, setLogSaving]     = useState(false);
  const [error, setError]             = useState('');
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editPriority, setEditPriority] = useState('mid');
  const [editClientId, setEditClientId] = useState('');
  const [editAssignee, setEditAssignee] = useState('');

  const tipo = project?.tipo || 'automatizacion';
  const isLeader     = ['admin', 'leader_analytics'].includes(currentUser?.role);
  const isRestricted = ['engineer', 'member_analytics'].includes(currentUser?.role);
  const isOwner = project && [...(project.assigneeIds || [project.assigneeId]), project.coAssigneeId, project.generalAssigneeId]
    .filter(v => v != null).map(Number).includes(Number(currentUser?.id));
  const canEdit = isLeader || (isRestricted && isOwner);

  const delEquipo = (equipo) => assignables(users, equipo);
  const taskAssigneePool = tipo === 'analitica'
    ? delEquipo('analitica')
    : tipo === 'compartido'
      ? [...new Set([...delEquipo('automatizacion'), ...delEquipo('analitica')])]
      : delEquipo('automatizacion');

  useEffect(() => {
    if (open && tipo === 'analitica') {
      analyticsReportAPI.getClients().then(setAnalyticsClients).catch(() => {});
    }
  }, [open, tipo]);

  useEffect(() => {
    if (open) {
      setTaskText(''); setTaskDate(''); setTaskPriority('mid'); setTaskClientId('');
      setEditingTaskId(null); setLogText(''); setIsBlock(false); setError('');
      const self = taskAssigneePool.some(u => u.id === currentUser?.id);
      setTaskAssignee(self ? String(currentUser.id) : '');
    }
  }, [project?.id, open]);

  if (!open || !project) return null;

  const tasks     = project.tasks || [];
  const tasksDone = tasks.filter(t => t.done).length;
  const pct       = project.progress || 0;
  const st        = STATUS_L[project.status] || project.status;
  const people    = project.assignees?.length ? project.assignees : (project.assignee ? [project.assignee] : []);

  const addTask = async () => {
    if (!taskText.trim() || taskSaving) return;
    setTaskSaving(true);
    try {
      await onAddTask(project.id, taskText.trim(), {
        weight: 2, priority: taskPriority,
        clientId: taskClientId ? Number(taskClientId) : null,
        assigneeId: taskAssignee ? Number(taskAssignee) : null,
        dueDate: taskDate || null,
      });
      setTaskText(''); setTaskDate(''); setTaskPriority('mid'); setTaskClientId('');
    } finally { setTaskSaving(false); }
  };

  const withTaskBusy = async (taskId, fn) => {
    if (busyTaskIds.has(taskId)) return;
    setBusyTaskIds(s => new Set(s).add(taskId));
    try { await fn(); } finally { setBusyTaskIds(s => { const n = new Set(s); n.delete(taskId); return n; }); }
  };

  const saveEditTask = async (taskId) => {
    await withTaskBusy(taskId, () => onUpdateTask(project.id, taskId, {
      assigneeId: editAssignee ? Number(editAssignee) : null,
      priority: editPriority,
      clientId: editClientId ? Number(editClientId) : null,
    }));
    setEditingTaskId(null);
  };

  const addLog = async () => {
    if (!logText.trim()) { setError('Escribe el avance'); return; }
    setLogSaving(true); setError('');
    try {
      await onAddLog(project.id, { text: logText.trim(), block: isBlock });
      setLogText(''); setIsBlock(false);
    } catch (err) { setError(err.error || 'Error al guardar'); }
    finally { setLogSaving(false); }
  };

  return (
    <div className="rb-drawer-backdrop" onClick={onClose}>
      <div className="rb-drawer" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="dp-header">
          <button className="dp-back" onClick={onClose} title="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="dp-title">{project.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              <span className="pill-mini" style={{ background: STATUS_BG[project.status], color: STATUS_C[project.status] }}>{st}</span>
              {project.priority && (
                <span className="pill-mini" style={{ background: PR_BG[project.priority], color: PR_C[project.priority] }}>
                  {PR_L[project.priority] || PR_L.mid}
                </span>
              )}
              {tipo === 'analitica' && <span className="pill-mini" style={{ background: 'var(--rb-magenta-tint)', color: 'var(--rb-magenta-ink)' }}>Analítica</span>}
            </div>
          </div>
          {canEdit && onEdit && (
            <button className="rb-btn rb-btn--ghost rb-btn--sm" onClick={() => onEdit(project.id)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              Editar
            </button>
          )}
        </div>

        {/* Body */}
        <div className="dp-body">
          {/* Info */}
          <div className="dp-info">
            {people.length > 0 && (
              <div className="dp-info-item">
                <div className="dp-info-label">Responsable{people.length > 1 ? 's' : ''}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                  {people.map(p => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className={`rb-avatar rb-avatar--sm`} data-c={(p.colorIndex ?? 0) % 8}>{p.initials}</span>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {project.dueDate && (
              <div className="dp-info-item">
                <div className="dp-info-label">Entrega</div>
                <div style={{ fontSize: 13, fontFamily: 'var(--mono)', fontWeight: 600, marginTop: 4,
                  color: isOverdue(project.dueDate) ? 'var(--rb-danger)' : 'var(--rb-text)' }}>
                  {fmtDate(project.dueDate)}
                </div>
              </div>
            )}
            <div className="dp-info-item">
              <div className="dp-info-label">Progreso</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <span className="rb-progress" style={{ flex: 1, height: 6 }}>
                  <i style={{ width: `${pct}%`, background: pct >= 80 ? 'var(--rb-success)' : 'var(--rb-navy)' }} />
                </span>
                <span style={{ fontSize: 13, fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--rb-navy)' }}>{pct}%</span>
              </div>
            </div>
          </div>

          {/* Descripción */}
          {project.description && (
            <Section title="Descripción">
              <div style={{ fontSize: 13, color: 'var(--rb-text-2)', lineHeight: 1.6 }}>{project.description}</div>
            </Section>
          )}

          {/* Tareas */}
          <Section title="Tareas" count={`${tasksDone}/${tasks.length}`}>
            {tasks.length > 0 && (
              <div className="dp-tasks">
                {tasks.map(t => {
                  const owner = t.assigneeId ? taskAssigneePool.find(u => u.id === t.assigneeId) : null;
                  const cl = t.clientId ? analyticsClients.find(c => c.id === t.clientId) : null;
                  return (
                    <div key={t.id} className="dp-task">
                      <button className={`task-check${t.done ? ' task-check--done' : ''}`}
                        disabled={!canEdit || busyTaskIds.has(t.id)}
                        onClick={() => canEdit && withTaskBusy(t.id, () => onToggleTask(project.id, t.id, !t.done))}>
                        {t.done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                      </button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span className={`task-title${t.done ? ' task-title--done' : ''}`}>{t.title}</span>
                        {t.dueDate && (
                          <span className="dp-task-date" style={isOverdue(t.dueDate) ? { color: 'var(--rb-danger)' } : undefined}>
                            {fmtShort(t.dueDate)}
                          </span>
                        )}
                      </div>
                      {t.priority && (
                        <span className="pill-mini" style={{ background: PR_BG[t.priority], color: PR_C[t.priority], fontSize: 10.5 }}>
                          {PR_L[t.priority]}
                        </span>
                      )}
                      {cl && <span className="pill-mini" style={{ background: 'var(--rb-magenta-tint)', color: 'var(--rb-magenta-ink)', fontSize: 10.5 }}>{cl.name}</span>}
                      {owner && <span className={`rb-avatar rb-avatar--sm`} data-c={(owner.colorIndex ?? 0) % 8} title={owner.name}>{owner.initials}</span>}
                      {canEdit && (
                        <button className="task-del" style={{ opacity: 1 }} onClick={() => {
                          setEditingTaskId(editingTaskId === t.id ? null : t.id);
                          setEditPriority(t.priority || 'mid');
                          setEditClientId(t.clientId ? String(t.clientId) : '');
                          setEditAssignee(t.assigneeId ? String(t.assigneeId) : '');
                        }} title="Editar tarea">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                        </button>
                      )}
                      {canEdit && (
                        <button className="task-del" disabled={busyTaskIds.has(t.id)}
                          onClick={() => withTaskBusy(t.id, () => onDeleteTask(project.id, t.id))} title="Eliminar">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      )}
                      {editingTaskId === t.id && (
                        <div className="dp-task-edit">
                          <select className="rb-select" style={{ width: 90, height: 30, fontSize: 12 }}
                            value={editPriority} onChange={e => setEditPriority(e.target.value)}>
                            <option value="high">Alta</option>
                            <option value="mid">Media</option>
                            <option value="low">Baja</option>
                          </select>
                          {tipo === 'analitica' && (
                            <select className="rb-select" style={{ width: 120, height: 30, fontSize: 12 }}
                              value={editClientId} onChange={e => setEditClientId(e.target.value)}>
                              <option value="">General</option>
                              {analyticsClients.filter(c => c.active && (project.clients || []).some(pc => pc.id === c.id)).map(c =>
                                <option key={c.id} value={String(c.id)}>{c.name}</option>
                              )}
                            </select>
                          )}
                          <select className="rb-select" style={{ flex: 1, height: 30, fontSize: 12 }}
                            value={editAssignee} onChange={e => setEditAssignee(e.target.value)}>
                            <option value="">Sin asignar</option>
                            {taskAssigneePool.map(u => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
                          </select>
                          <button className="rb-btn rb-btn--primary rb-btn--sm" style={{ height: 30 }}
                            disabled={busyTaskIds.has(t.id)} onClick={() => saveEditTask(t.id)}>Guardar</button>
                          <button className="rb-btn rb-btn--ghost rb-btn--sm" style={{ height: 30 }}
                            onClick={() => setEditingTaskId(null)}>Cancelar</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Agregar tarea */}
            {canEdit && editingTaskId == null && (
              <div className="dp-add-task">
                <input className="rb-input" style={{ flex: 1, minWidth: 140, height: 32, fontSize: 12 }}
                  placeholder="Nueva tarea…" value={taskText}
                  onChange={e => setTaskText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addTask()} />
                <select className="rb-select" style={{ width: 90, height: 32, fontSize: 12 }}
                  value={taskPriority} onChange={e => setTaskPriority(e.target.value)}>
                  <option value="high">Alta</option>
                  <option value="mid">Media</option>
                  <option value="low">Baja</option>
                </select>
                <input className="rb-input" type="date" style={{ width: 120, height: 32, fontSize: 12 }}
                  value={taskDate} onChange={e => setTaskDate(e.target.value)} />
                {tipo === 'analitica' && (
                  <select className="rb-select" style={{ width: 120, height: 32, fontSize: 12 }}
                    value={taskClientId} onChange={e => setTaskClientId(e.target.value)}>
                    <option value="">General</option>
                    {analyticsClients.filter(c => c.active && (project.clients || []).some(pc => pc.id === c.id)).map(c =>
                      <option key={c.id} value={String(c.id)}>{c.name}</option>
                    )}
                  </select>
                )}
                {taskAssigneePool.length > 0 && (
                  <select className="rb-select" style={{ width: 120, height: 32, fontSize: 12 }}
                    value={taskAssignee} onChange={e => setTaskAssignee(e.target.value)}>
                    <option value="" disabled>Asignar a…</option>
                    {taskAssigneePool.map(u => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
                  </select>
                )}
                <button className="rb-btn rb-btn--primary rb-btn--sm" style={{ height: 32 }}
                  onClick={addTask} disabled={taskSaving || !taskText.trim()}>
                  {taskSaving ? '...' : 'Agregar'}
                </button>
              </div>
            )}
          </Section>

          {/* Clientes (solo analítica) */}
          {tipo === 'analitica' && project.clients?.length > 0 && (
            <Section title="Clientes" count={project.clients.length}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {project.clients.map(c => (
                  <span key={c.id} className="pill-mini" style={{ background: 'var(--rb-magenta-tint)', color: 'var(--rb-magenta-ink)', fontSize: 12, padding: '4px 10px' }}>
                    {c.name}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* Seguimiento */}
          <Section title="Seguimiento" count={project.logs?.length || 0} defaultOpen={false}>
            {project.logs?.length > 0 ? (
              <div className="dp-logs">
                {project.logs.map(l => (
                  <div key={l.id} className="dp-log">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--rb-text)' }}>{l.author?.name || 'Sistema'}</span>
                      <span style={{ fontSize: 11, color: 'var(--rb-text-4)' }}>{fmtLogDate(l.createdAt)}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--rb-text-2)', lineHeight: 1.5, marginTop: 3 }}>{l.text}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--rb-text-4)', padding: '8px 0' }}>Sin avances registrados</div>
            )}

            {canEdit && (
              <div className="dp-add-log">
                {error && <div className="rb-alert rb-alert--danger" data-tone="danger" style={{ marginBottom: 8 }}>{error}</div>}
                <textarea className="rb-textarea" rows={2} style={{ fontSize: 12, minHeight: 60 }}
                  placeholder={isBlock ? 'Describe el bloqueo...' : 'Registra el avance...'}
                  value={logText} onChange={e => setLogText(e.target.value)} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '8px 0', cursor: 'pointer', fontSize: 12, color: isBlock ? 'var(--rb-danger)' : 'var(--rb-text-3)' }}>
                  <input type="checkbox" checked={isBlock} onChange={e => setIsBlock(e.target.checked)}
                    style={{ accentColor: 'var(--rb-danger)', width: 13, height: 13 }} />
                  Reportar como bloqueo
                </label>
                <button className={`rb-btn rb-btn--sm ${isBlock ? 'rb-btn--danger' : 'rb-btn--primary'}`}
                  style={{ width: '100%' }} onClick={addLog} disabled={logSaving || !logText.trim()}>
                  {logSaving ? 'Guardando...' : isBlock ? 'Reportar bloqueo' : 'Registrar avance'}
                </button>
              </div>
            )}
          </Section>
        </div>

        {/* Footer */}
        <div className="dp-footer">
          <span>Creado {fmtDate(project.createdAt)}</span>
          {project.docUrl && (
            <a href={project.docUrl} target="_blank" rel="noopener noreferrer" className="dp-footer-link">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Documentación
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
