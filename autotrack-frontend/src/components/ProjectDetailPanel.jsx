/* ProjectDetailPanel — panel lateral de detalle estilo Notion/Linear.
   Tareas agrupadas por cliente/sección. Cada sección colapsable con sus
   propias tareas y botón "+" que auto-asigna el clientId. */

import { useState, useEffect, useMemo } from 'react';
import { assignables, can } from '../lib/tickets';
import { fmtDate, fmtLogDate } from '../utils/helpers';
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

/* Acepta tanto una fecha suelta («2026-09-16», como las de vencimiento) como
   una marca de tiempo completa («2026-09-16T14:22:00.000Z», como la de carga
   de analítica): se queda con el día. Concatenar la hora a algo que ya la
   traía daba «Invalid Date». Se lee como fecha local, no UTC, para que no se
   corra un día. */
const fmtShort = (d) => {
  if (!d) return '—';
  const dia = String(d).slice(0, 10);
  const fecha = new Date(`${dia}T00:00:00`);
  return Number.isNaN(fecha.getTime())
    ? '—'
    : fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
};

const isOverdue = (d) => {
  if (!d) return false;
  return new Date(d + 'T00:00:00') < new Date(new Date().toDateString());
};

/* Sección colapsable genérica */
function Section({ title, count, children, defaultOpen = true, accent, extra }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="dp-section">
      {/* `extra` va fuera del botón: un control dentro de otro control no se
          puede pulsar sin plegar la sección. */}
      <div className="dp-section-bar">
      <button className="dp-section-head" onClick={() => setOpen(o => !o)}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>
          <polyline points="9 18 15 12 9 6"/>
        </svg>
        {accent && <span className="dp-section-dot" style={{ background: accent }} />}
        {title}
        {count != null && <span className="dp-section-count">{count}</span>}
      </button>
        {extra}
      </div>
      {open && <div className="dp-section-body">{children}</div>}
    </div>
  );
}

/**
 * Marca de analítica cargada para un cliente del proyecto.
 *
 * Responde «¿a este cliente ya se le cargó la analítica?», que es lo que
 * cuenta dirección. Muestra quién y cuándo: una marca sin autor no sirve
 * para preguntar.
 *
 * Antes esto se marcaba tarea a tarea (`platform_uploaded`). Eran dos casillas
 * para lo mismo, así que la de tarea se retiró de la interfaz; la columna
 * sigue en la base por si hiciera falta volver a ella.
 */
function MarcaAnalitica({ cliente, canEdit, guardando, onToggle }) {
  const cargada = cliente.analyticsLoaded;
  const quien = cliente.analyticsLoadedBy;
  const cuando = cliente.analyticsLoadedAt ? fmtShort(cliente.analyticsLoadedAt) : null;

  const detalle = cargada
    ? [quien, cuando].filter(Boolean).join(' · ') || 'Cargada'
    : 'Sin cargar';

  return (
    <button
      type="button"
      className={`dp-carga${cargada ? ' dp-carga--si' : ''}`}
      disabled={!canEdit || guardando}
      onClick={() => onToggle(cliente.id, !cargada)}
      title={canEdit
        ? (cargada ? `Analítica cargada — ${detalle}. Pulsa para desmarcar.` : 'Marcar la analítica de este cliente como cargada')
        : `Analítica ${cargada ? `cargada — ${detalle}` : 'sin cargar'}`}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        {cargada ? <polyline points="20 6 9 17 4 12" /> : <circle cx="12" cy="12" r="9" strokeWidth="2" />}
      </svg>
      <span>{cargada ? 'Analítica cargada' : 'Analítica pendiente'}</span>
      {cargada && (quien || cuando) && <span className="dp-carga-quien">{detalle}</span>}
    </button>
  );
}

/* Renderiza una lista de tareas (usada tanto para General como por cliente) */
function TaskList({ tasks, canEdit, busyTaskIds, taskAssigneePool, analyticsClients, project, tipo,
                    onToggle, onDelete, onEdit, editingTaskId, setEditingTaskId,
                    editPriority, setEditPriority, editClientId, setEditClientId,
                    editAssignee, setEditAssignee, saveEditTask }) {
  return (
    <div className="dp-tasks">
      {tasks.map(t => {
        const owner = t.assigneeId ? taskAssigneePool.find(u => u.id === t.assigneeId) : null;
        return (
          <div key={t.id} className="dp-task">
            <button className={`task-check${t.done ? ' task-check--done' : ''}`}
              disabled={!canEdit || busyTaskIds.has(t.id)}
              onClick={() => canEdit && onToggle(t.id)}>
              {t.done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
            </button>
            <div className="dp-task-info">
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
                onClick={() => onDelete(t.id)} title="Eliminar">
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
                {analyticsClients.filter(c => c.active && (project.clients || []).some(pc => pc.id === c.id)).length > 0 && (
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
  );
}

/* Formulario inline para agregar tarea dentro de una sección de cliente */
function AddTaskInline({ clientId, canEdit, taskSaving, onAdd, taskAssigneePool, tipo, analyticsClients, project }) {
  const [text, setText] = useState('');
  const [date, setDate] = useState('');
  const [priority, setPriority] = useState('mid');
  const [assignee, setAssignee] = useState('');

  const add = () => {
    if (!text.trim()) return;
    onAdd({ text: text.trim(), clientId: clientId || null, date: date || null, priority, assigneeId: assignee ? Number(assignee) : null });
    setText(''); setDate(''); setPriority('mid');
  };

  return (
    <div className="dp-add-task">
      <input className="rb-input" style={{ flex: 1, minWidth: 120, height: 30, fontSize: 12 }}
        placeholder="Nueva tarea…" value={text} onChange={e => setText(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && add()} />
      <select className="rb-select" style={{ width: 80, height: 30, fontSize: 12 }}
        value={priority} onChange={e => setPriority(e.target.value)}>
        <option value="high">Alta</option>
        <option value="mid">Media</option>
        <option value="low">Baja</option>
      </select>
      <input className="rb-input" type="date" style={{ width: 110, height: 30, fontSize: 12 }}
        value={date} onChange={e => setDate(e.target.value)} />
      {taskAssigneePool.length > 0 && (
        <select className="rb-select" style={{ width: 110, height: 30, fontSize: 12 }}
          value={assignee} onChange={e => setAssignee(e.target.value)}>
          <option value="" disabled>Asignar a…</option>
          {taskAssigneePool.map(u => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
        </select>
      )}
      <button className="rb-btn rb-btn--primary rb-btn--sm" style={{ height: 30 }}
        onClick={add} disabled={taskSaving || !text.trim()}>
        {taskSaving ? '...' : 'Agregar'}
      </button>
    </div>
  );
}

export default function ProjectDetailPanel({ open, project, onClose, onEdit, onAddLog, onAddTask, onToggleTask, onDeleteTask, onUpdateTask, onSetClientAnalytics, currentUser, users = [] }) {
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
  const [cargaBusy, setCargaBusy]     = useState(null);  // id del cliente guardándose

  const tipo = project?.tipo || 'automatizacion';
  /* Quién puede editar, por capacidad y no por nombre de rol: una lista
     literal aquí dejaba fuera al coordinador, que sí gestiona proyectos.
     Quien gestiona proyectos edita cualquiera; quien solo edita los suyos,
     los suyos. */
  const isOwner = project && [...(project.assigneeIds || [project.assigneeId]), project.coAssigneeId, project.generalAssigneeId]
    .filter(v => v != null).map(Number).includes(Number(currentUser?.id));
  const canEdit = can(currentUser, 'gestionarProyectos')
    || (can(currentUser, 'editarProyectosPropios') && isOwner);

  const delEquipo = (equipo) => assignables(users, equipo);
  const taskAssigneePool = tipo === 'analitica'
    ? delEquipo('analitica')
    : tipo === 'compartido'
      ? [...new Set([...delEquipo('automatizacion'), ...delEquipo('analitica')])]
      : delEquipo('automatizacion');

  useEffect(() => {
    if (open) {
      analyticsReportAPI.getClients().then(setAnalyticsClients).catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      setEditingTaskId(null); setLogText(''); setIsBlock(false); setError('');
    }
  }, [project?.id, open]);

  const allTasks  = project?.tasks || [];
  const clients   = project?.clients || [];

  /* Agrupar tareas por cliente — hooks deben estar antes del early return */
  const tasksByClient = useMemo(() => {
    const grouped = {};
    const clientIds = new Set(clients.map(c => c.id));

    allTasks.forEach(t => {
      const cid = t.clientId;
      if (cid && clientIds.has(cid)) {
        if (!grouped[cid]) grouped[cid] = [];
        grouped[cid].push(t);
      } else {
        if (!grouped['_general']) grouped['_general'] = [];
        grouped['_general'].push(t);
      }
    });

    return grouped;
  }, [allTasks, clients]);

  if (!open || !project) return null;

  const tasksDone = allTasks.filter(t => t.done).length;
  const pct       = project.progress || 0;
  const st        = STATUS_L[project.status] || project.status;
  const people    = project.assignees?.length ? project.assignees : (project.assignee ? [project.assignee] : []);

  const withTaskBusy = async (taskId, fn) => {
    if (busyTaskIds.has(taskId)) return;
    setBusyTaskIds(s => new Set(s).add(taskId));
    try { await fn(); } finally { setBusyTaskIds(s => { const n = new Set(s); n.delete(taskId); return n; }); }
  };

  const handleToggle = (taskId) => withTaskBusy(taskId, () => onToggleTask(project.id, taskId, !allTasks.find(t => t.id === taskId)?.done));
  const handleDelete = (taskId) => withTaskBusy(taskId, () => onDeleteTask(project.id, taskId));

  const saveEditTask = async (taskId) => {
    await withTaskBusy(taskId, () => onUpdateTask(project.id, taskId, {
      assigneeId: editAssignee ? Number(editAssignee) : null,
      priority: editPriority,
      clientId: editClientId ? Number(editClientId) : null,
    }));
    setEditingTaskId(null);
  };

  const handleMarcarAnalitica = async (clientId, cargada) => {
    if (cargaBusy != null) return;
    setCargaBusy(clientId);
    setError('');
    try {
      await onSetClientAnalytics(project.id, clientId, cargada);
    } catch (err) {
      setError(err.error || 'No se pudo guardar la marca de analítica');
    } finally { setCargaBusy(null); }
  };

  const handleAddTaskInSection = (clientId) => async ({ text, date, priority, assigneeId }) => {
    setTaskSaving(true);
    try {
      await onAddTask(project.id, text, {
        weight: 2, priority, clientId: clientId || null,
        assigneeId: assigneeId || null, dueDate: date || null,
      });
    } finally { setTaskSaving(false); }
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

  const showSections = clients.length > 0;

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

          {/* Tareas agrupadas por cliente */}
          {showSections ? (
            <>
              {/* Todos los clientes del proyecto, también los que aún no tienen
                  tareas: si no se vieran, no habría dónde marcar su analítica
                  ni forma de notar que están sin empezar. */}
              {clients.map(c => {
                const clientTasks = tasksByClient[c.id] || [];
                const clientDone  = clientTasks.filter(t => t.done).length;
                const sectionTitle = c.sectionTitle || c.name;
                return (
                  <Section key={c.id} title={sectionTitle}
                    count={clientTasks.length ? `${clientDone}/${clientTasks.length}` : '0'}
                    defaultOpen={clientTasks.length > 0}
                    accent={c.analyticsLoaded ? 'var(--rb-teal)' : 'var(--rb-magenta)'}
                    extra={<MarcaAnalitica cliente={c} canEdit={canEdit}
                      guardando={cargaBusy === c.id} onToggle={handleMarcarAnalitica} />}>
                    <TaskList tasks={clientTasks} canEdit={canEdit} busyTaskIds={busyTaskIds}
                      taskAssigneePool={taskAssigneePool} analyticsClients={analyticsClients}
                      project={project} tipo={tipo}
                      onToggle={handleToggle} onDelete={handleDelete}
                      editingTaskId={editingTaskId} setEditingTaskId={setEditingTaskId}
                      editPriority={editPriority} setEditPriority={setEditPriority}
                      editClientId={editClientId} setEditClientId={setEditClientId}
                      editAssignee={editAssignee} setEditAssignee={setEditAssignee}
                      saveEditTask={saveEditTask} />
                    {canEdit && editingTaskId == null && (
                      <AddTaskInline clientId={c.id} canEdit={canEdit} taskSaving={taskSaving}
                        onAdd={handleAddTaskInSection(c.id)} taskAssigneePool={taskAssigneePool}
                        tipo={tipo} analyticsClients={analyticsClients} project={project} />
                    )}
                  </Section>
                );
              })}

              {/* Sección General: tareas sin cliente asignado, o todas si no hay clientes con tareas */}
              {((tasksByClient['_general'] || []).length > 0 || clients.length === 0) && (
                <Section title="Tareas" count={`${(tasksByClient['_general'] || allTasks).filter(t => t.done).length}/${(tasksByClient['_general'] || allTasks).length}`}>
                  <TaskList tasks={tasksByClient['_general'] || allTasks} canEdit={canEdit} busyTaskIds={busyTaskIds}
                    taskAssigneePool={taskAssigneePool} analyticsClients={analyticsClients}
                    project={project} tipo={tipo}
                      onToggle={handleToggle} onDelete={handleDelete}
                    editingTaskId={editingTaskId} setEditingTaskId={setEditingTaskId}
                    editPriority={editPriority} setEditPriority={setEditPriority}
                    editClientId={editClientId} setEditClientId={setEditClientId}
                    editAssignee={editAssignee} setEditAssignee={setEditAssignee}
                    saveEditTask={saveEditTask} />
                  {canEdit && editingTaskId == null && (
                    <AddTaskInline clientId={null} canEdit={canEdit} taskSaving={taskSaving}
                      onAdd={handleAddTaskInSection(null)} taskAssigneePool={taskAssigneePool}
                      tipo={tipo} analyticsClients={analyticsClients} project={project} />
                  )}
                </Section>
              )}
            </>
          ) : (
            /* Sin clientes: vista plana (fallback) */
            <Section title="Tareas" count={`${tasksDone}/${allTasks.length}`}>
              <TaskList tasks={allTasks} canEdit={canEdit} busyTaskIds={busyTaskIds}
                taskAssigneePool={taskAssigneePool} analyticsClients={analyticsClients}
                project={project} tipo={tipo}
                      onToggle={handleToggle} onDelete={handleDelete}
                editingTaskId={editingTaskId} setEditingTaskId={setEditingTaskId}
                editPriority={editPriority} setEditPriority={setEditPriority}
                editClientId={editClientId} setEditClientId={setEditClientId}
                editAssignee={editAssignee} setEditAssignee={setEditAssignee}
                saveEditTask={saveEditTask} />
              {canEdit && editingTaskId == null && (
                <AddTaskInline clientId={null} canEdit={canEdit} taskSaving={taskSaving}
                  onAdd={handleAddTaskInSection(null)} taskAssigneePool={taskAssigneePool}
                  tipo={tipo} analyticsClients={analyticsClients} project={project} />
              )}
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
          <span>Creado {fmtDate((project.createdAt || '').slice(0, 10))}</span>
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
