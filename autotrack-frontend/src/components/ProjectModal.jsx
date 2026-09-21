import { useState, useEffect, useRef } from 'react';
import { colorClass, fmtLogDate } from '../utils/helpers';
import { assignables } from '../lib/tickets';
import { analyticsReportAPI } from '../services/api';

const EMPTY = {
  name: '', description: '', client: '', clientIds: [],
  status: 'backlog', priority: 'mid', assigneeIds: [],
  startDate: '', dueDate: '', progress: 0,
  docUrl: '',
  coAssigneeId: '', generalAssigneeId: '', participationAuto: '', participationAnalitica: '',
  progressAuto: 0, progressAnalitica: 0,
};

const AREAS = [
  { value: 'automatizacion', label: 'Automatización' },
  { value: 'analitica',      label: 'Analítica' },
  { value: 'compartido',     label: 'Compartido' },
];

// Líderes reales gestionan todo sin restricción; member_analytics queda como engineer: solo lo suyo.
const LEADER_ROLES = ['admin', 'leader_analytics'];

const fmtShort = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : null;
const fmtDateTime = (isoStr) => {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
    + ', ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
};

// Flujo de estados permitido para ingenieros/miembros
const ENGINEER_FLOW = { progress: ['testing'], testing: ['done', 'soporte'] };
const STATUS_OPTS = [
  ['backlog', 'Por hacer'], ['progress', 'En proceso'], ['standby', 'En standby'],
  ['testing', 'En testing'], ['done', 'Finalizado'], ['soporte', 'En soporte'],
  ['cancelado', 'Cancelado'],
];

export default function ProjectModal({ open, project, defStatus, defAssigneeId, defClientIds, defArea, users, onSave, onDelete, onClose, onAddLog, currentUser }) {
  const isLeader  = LEADER_ROLES.includes(currentUser?.role);
  const canDelete = isLeader;
  const isEdit    = Boolean(project);
  // El equipo de Analítica solo crea proyectos de Analítica o Compartidos
  const isAnalyticsUser = ['leader_analytics', 'member_analytics'].includes(currentUser?.role);
  const availableAreas  = isAnalyticsUser ? AREAS.filter(a => a.value !== 'automatizacion') : AREAS;
  const defaultArea     = isAnalyticsUser ? 'analitica' : 'automatizacion';
  // Ingenieros/miembros editando: solo progreso y flujo de estado — el resto es del líder
  const lockCore  = isEdit && !isLeader;
  // El responsable del proyecto sí puede armar y gestionar su propio checklist de tareas
  const isOwner = isEdit && [...(project.assigneeIds || [project.assigneeId]), project.coAssigneeId, project.generalAssigneeId]
    .filter(v => v != null).map(Number).includes(Number(currentUser?.id));
  const canManageTasks = isLeader || isOwner;

  const [form, setForm]         = useState(EMPTY);
  const [areaSel, setAreaSel]   = useState('automatizacion');
  const [typeSel, setTypeSel]   = useState('proyecto');
  const [showDoc, setShowDoc]   = useState(false);
  const [error, setError]       = useState('');
  const [saving, setSaving]     = useState(false);
  const [delConfirm, setDelConfirm] = useState(false);

  // Tareas — lista local, se sincroniza al guardar
  const [tasks, setTasks]       = useState([]);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDate, setTaskDate]   = useState('');
  const [taskWeight, setTaskWeight] = useState(2);
  const [taskPriority, setTaskPriority] = useState('mid');
  const [taskClientId, setTaskClientId] = useState('');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [removedTasks, setRemovedTasks] = useState([]);
  const [editingTaskId, setEditingTaskId] = useState(null);

  // Clientes (analítica): selector múltiple + alta rápida
  const [clientOpen, setClientOpen] = useState(false);
  const [newClientText, setNewClientText] = useState('');
  const [clientError, setClientError] = useState('');
  const [sectionTitles, setSectionTitles] = useState({});
  /* Marca de «analítica cargada» por cliente. Se guarda con el resto del
     formulario, no al pulsar: el modal tiene botón Guardar y aplicar unos
     cambios al instante y otros no es justo lo que confunde. */
  const [analyticsLoaded, setAnalyticsLoaded] = useState({});
  const clientRef = useRef(null);
  const clientPanelRef = useRef(null);
  /* Aunque el disparador ya no crece, el campo puede quedar al fondo del modal
     y el desplegable abrirse por debajo del área visible. Se trae a la vista
     al abrirlo, para que nunca haya que adivinar que está ahí. */
  useEffect(() => {
    if (!clientOpen) return;
    const t = setTimeout(() => clientPanelRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 30);
    return () => clearTimeout(t);
  }, [clientOpen]);
  useEffect(() => {
    if (!clientOpen) return;
    const onDown = (e) => { if (clientRef.current && !clientRef.current.contains(e.target)) setClientOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [clientOpen]);

  // Seguimiento (solo edición)
  const [logs, setLogs]         = useState([]);
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [logText, setLogText]   = useState('');
  const [isBlock, setIsBlock]   = useState(false);
  const [logSaving, setLogSaving] = useState(false);
  const [analyticsClients, setAnalyticsClients] = useState([]);

  /* Responsables seleccionables: cualquiera que trabaje en ese equipo, no solo
     quien tiene rol de ejecutor. En equipos pequeños quien coordina también
     saca trabajo, y filtrar por rol dejaba el selector vacío —sin nadie a quien
     asignar— en cuanto no había un analista dado de alta.
     En «compartido» este selector es el de Automatización; el de Analítica va
     aparte, en coAssigneeId. */
  const delEquipo = (equipo) => assignables(users, equipo);

  const analiticaPool  = delEquipo('analitica');
  const assignablePool = areaSel === 'analitica' ? analiticaPool : delEquipo('automatizacion');

  // Una tarea se puede asignar a cualquiera del equipo correspondiente al
  // proyecto, no solo a quien quedó como responsable general.
  const taskAssigneePool = areaSel === 'analitica'
    ? analiticaPool
    : areaSel === 'compartido'
      ? [...new Set([...delEquipo('automatizacion'), ...analiticaPool])]
      : assignablePool;

  useEffect(() => {
    if (!currentUser) { setTaskAssignee(''); return; }
    const self = taskAssigneePool.some(u => String(u.id) === String(currentUser.id));
    setTaskAssignee(self ? String(currentUser.id) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaSel]);

  useEffect(() => {
    if (open) {
      analyticsReportAPI.getClients().then(setAnalyticsClients).catch(() => {});
    }
  }, [open]);

  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const assigneeRef = useRef(null);
  useEffect(() => {
    if (!assigneeOpen) return;
    const onDown = (e) => { if (assigneeRef.current && !assigneeRef.current.contains(e.target)) setAssigneeOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [assigneeOpen]);

  useEffect(() => {
    if (open) {
      setDelConfirm(false);
      setError('');
      setTaskTitle(''); setTaskDate('');
      setRemovedTasks([]);
      setLogText(''); setIsBlock(false); setShowAllLogs(false);
      if (project) {
        const tipo = project.tipo || 'automatizacion';
        if (tipo === 'asignacion_flash') {
          // El tipo no dice a qué equipo pertenece — se infiere del rol del responsable asignado.
          const assigneeRole = users.find(u => u.id === (project.assigneeIds?.[0] ?? project.assigneeId))?.role;
          setAreaSel(assigneeRole === 'member_analytics' ? 'analitica' : 'automatizacion');
        } else {
          setAreaSel(tipo);
        }
        setTypeSel(tipo === 'asignacion_flash' ? 'flash' : 'proyecto');
        setShowDoc(Boolean(project.docUrl));
        setForm({
          name:                  project.name,
          description:           project.description || '',
          client:                project.client || '',
          clientIds:             (project.clients || []).map(c => String(c.id)),
          status:                project.status,
          priority:              project.priority || 'mid',
          assigneeIds:           (project.assigneeIds || (project.assigneeId != null ? [project.assigneeId] : [])).map(String),
          startDate:             project.startDate || '',
          dueDate:               project.dueDate || '',
          progress:              project.progress || 0,
          docUrl:                project.docUrl || '',
          coAssigneeId:          project.coAssigneeId != null ? String(project.coAssigneeId) : '',
          generalAssigneeId:     project.generalAssigneeId != null ? String(project.generalAssigneeId) : '',
          participationAuto:     project.participationAuto || '',
          participationAnalitica:project.participationAnalitica || '',
          progressAuto:          project.progressAuto || 0,
          progressAnalitica:     project.progressAnalitica || 0,
        });
        setTasks((project.tasks || []).map(t => ({ ...t })));
        setLogs(project.logs || []);
        const st = {};
        const cargas = {};
        (project.clients || []).forEach(c => {
          if (c.sectionTitle) st[String(c.id)] = c.sectionTitle;
          cargas[String(c.id)] = Boolean(c.analyticsLoaded);
        });
        setSectionTitles(st);
        setAnalyticsLoaded(cargas);
      } else {
        setAreaSel(defArea || defaultArea);
        setTypeSel('proyecto');
        setShowDoc(false);
        setForm({
          ...EMPTY,
          status: defStatus || 'backlog',
          assigneeIds: defAssigneeId != null ? [String(defAssigneeId)] : [],
          clientIds: (defClientIds || []).map(String),
        });
        setTasks([]);
        setLogs([]);
        setSectionTitles({});
        setAnalyticsLoaded({});
      }
    }
  }, [open, project, defStatus, defAssigneeId, defClientIds]);

  /* Con pocos clientes se leen los nombres; con muchos, la cuenta dice más que
     una lista truncada que no cabe. */
  const seleccionados = analyticsClients.filter(c => form.clientIds.includes(String(c.id)));
  const resumenClientes = seleccionados.length === 0
    ? 'Selecciona uno o más clientes…'
    : seleccionados.length <= 2
      ? seleccionados.map(c => c.name).join(', ')
      : `${seleccionados.length} clientes seleccionados`;

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const tipoFinal = typeSel === 'flash' ? 'asignacion_flash' : areaSel;

  const toggleAssignee = (id) => {
    const key = String(id);
    setForm(f => ({
      ...f,
      assigneeIds: f.assigneeIds.includes(key) ? f.assigneeIds.filter(x => x !== key) : [...f.assigneeIds, key],
    }));
  };

  const toggleClient = (id) => {
    const key = String(id);
    setForm(f => ({
      ...f,
      clientIds: f.clientIds.includes(key) ? f.clientIds.filter(x => x !== key) : [...f.clientIds, key],
    }));
  };

  /* Si esto falla hay que decirlo. Callar el error hacía que un rechazo del
     servidor —sin permiso, nombre repetido, red caída— se viera igual que si
     el botón no hiciera nada, y no había forma de saber cuál de las dos era. */
  const quickAddClient = async () => {
    const name = newClientText.trim();
    if (!name) return;
    setClientError('');
    try {
      const created = await analyticsReportAPI.createClient({ name, active: true });
      setAnalyticsClients(prev => (prev.some(c => c.id === created.id) ? prev : [...prev, created]));
      setForm(f => ({ ...f, clientIds: f.clientIds.includes(String(created.id)) ? f.clientIds : [...f.clientIds, String(created.id)] }));
      setNewClientText('');
    } catch (err) {
      setClientError(err?.error || 'No se pudo crear el cliente. Inténtalo de nuevo.');
    }
  };

  const addLocalTask = () => {
    if (!taskTitle.trim()) return;
    setTasks(ts => [...ts, {
      _localId: Date.now(), title: taskTitle.trim(), dueDate: taskDate || null, done: false, _new: true,
      weight: taskWeight, priority: taskPriority, clientId: taskClientId ? Number(taskClientId) : null,
      assigneeId: taskAssignee ? Number(taskAssignee) : null,
    }]);
    setTaskTitle(''); setTaskDate(''); setTaskWeight(2); setTaskPriority('mid'); setTaskClientId('');
  };

  const toggleLocalTask = (t) => {
    setTasks(ts => ts.map(x => (x.id ?? x._localId) === (t.id ?? t._localId) ? { ...x, done: !x.done, _toggled: !x._new } : x));
  };

  const removeLocalTask = (t) => {
    if (t.id) setRemovedTasks(r => [...r, t.id]);
    setTasks(ts => ts.filter(x => (x.id ?? x._localId) !== (t.id ?? t._localId)));
  };

  const reassignLocalTask = (t, newAssigneeId) => {
    setTasks(ts => ts.map(x => (x.id ?? x._localId) === (t.id ?? t._localId)
      ? { ...x, assigneeId: newAssigneeId, _reassigned: !x._new }
      : x));
    setEditingTaskId(null);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('El nombre del proyecto es obligatorio'); return; }
    if (!isEdit && tasks.length === 0) { setError('Agrega al menos una tarea para crear el proyecto'); return; }
    setSaving(true); setError('');
    try {
      const tasksDelta = {
        added:   tasks.filter(t => t._new).map(t => ({ title: t.title, dueDate: t.dueDate, done: t.done, weight: t.weight, priority: t.priority, clientId: t.clientId, assigneeId: t.assigneeId })),
        removed: removedTasks,
        toggled: tasks.filter(t => t._toggled && t.id).map(t => ({ id: t.id, done: t.done })),
        reassigned: tasks.filter(t => t._reassigned && t.id).map(t => ({ id: t.id, assigneeId: t.assigneeId })),
      };
      await onSave({
        name:                  form.name.trim(),
        description:           form.description.trim() || null,
        client:                form.client.trim() || null,
        clientIds:             form.clientIds.map(Number),
        sectionTitles:         Object.fromEntries(Object.entries(sectionTitles).map(([k, v]) => [Number(k), v])),
        analyticsLoaded:       Object.fromEntries(Object.entries(analyticsLoaded).map(([k, v]) => [Number(k), v])),
        status:                form.status,
        priority:              form.priority,
        assigneeIds:           form.assigneeIds.map(Number),
        startDate:             form.startDate || null,
        dueDate:               form.dueDate || null,
        progress:              parseInt(form.progress) || 0,
        tipo:                  tipoFinal,
        docUrl:                showDoc ? (form.docUrl.trim() || null) : null,
        coAssigneeId:          form.coAssigneeId ? parseInt(form.coAssigneeId) : null,
        generalAssigneeId:     form.generalAssigneeId ? parseInt(form.generalAssigneeId) : null,
        participationAuto:     form.participationAuto.trim() || null,
        participationAnalitica:form.participationAnalitica.trim() || null,
        progressAuto:          parseInt(form.progressAuto) || 0,
        progressAnalitica:     parseInt(form.progressAnalitica) || 0,
      }, tasksDelta);
    } catch (err) {
      setError(err.error || err.errors?.[0]?.msg || 'Error al guardar');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setSaving(true);
    try { await onDelete(); } catch (err) { setError(err.error || 'Error al eliminar'); setSaving(false); }
  };

  const submitLog = async () => {
    if (!logText.trim() || logSaving) return;
    setLogSaving(true);
    try {
      const updated = await onAddLog(project.id, { text: logText.trim(), block: isBlock });
      const newProgress = updated?.progress ?? form.progress;
      setLogs(l => [{ id: `tmp${Date.now()}`, text: (isBlock ? '⚠ BLOQUEO: ' : '') + logText.trim(), progress: newProgress, createdAt: new Date().toISOString(), author: { name: currentUser?.name } }, ...l]);
      setForm(f => ({ ...f, progress: newProgress, status: isBlock ? 'standby' : f.status }));
      setLogText(''); setIsBlock(false);
    } finally { setLogSaving(false); }
  };

  if (!open) return null;

  const visibleLogs = showAllLogs ? logs : logs.slice(0, 2);

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 720 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{isEdit ? 'Editar proyecto' : 'Crear proyecto'}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }}>Configura la información principal</div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}

          {/* ── Tipo de registro ── */}
          <div className="pm-box">
            <div className="pm-box-title">Tipo de registro</div>
            <div className="pm-step-label">1. Elige el área</div>
            <div className="pm-seg">
              {availableAreas.map(a => (
                <button key={a.value} type="button" disabled={lockCore}
                  className={`pm-seg-btn${areaSel === a.value ? ' pm-seg-btn--active' : ''}`}
                  onClick={() => setAreaSel(a.value)}>
                  {areaSel === a.value && <span className="pm-seg-dot" />}
                  {a.label}
                </button>
              ))}
            </div>
            <div className="pm-step-label" style={{ marginTop: 14 }}>2. Elige el tipo de registro</div>
            <div className="pm-seg">
              <button type="button" disabled={lockCore} className={`pm-seg-btn${typeSel === 'proyecto' ? ' pm-seg-btn--active' : ''}`}
                onClick={() => setTypeSel('proyecto')}>
                {typeSel === 'proyecto' && <span className="pm-seg-dot" />}
                Proyecto
              </button>
              <button type="button" disabled={lockCore} className={`pm-seg-btn${typeSel === 'flash' ? ' pm-seg-btn--active' : ''}`}
                onClick={() => setTypeSel('flash')}>
                {typeSel === 'flash' && <span className="pm-seg-dot" />}
                Asignación flash
              </button>
            </div>
          </div>

          {/* ── Información principal ── */}
          <div className="pm-box">
            <div className="pm-box-title">Información principal</div>
            <div className="pm-grid">
              <div className="pm-field">
                <label className="pm-field-label">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                  Nombre *
                </label>
                <input className="pm-input" value={form.name} onChange={set('name')} placeholder="Ej. Dashboard de seguimiento de datos" disabled={lockCore} />
              </div>
              {areaSel !== 'compartido' && (
                <div className="pm-field" style={{ gridColumn: '1 / -1', position: 'relative' }} ref={assigneeRef}>
                  <label className="pm-field-label">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    Responsable(s) — puedes elegir más de uno
                  </label>
                  <button type="button" className="pm-dropdown-btn"
                    disabled={isEdit && !isLeader}
                    onClick={() => setAssigneeOpen(o => !o)}>
                    <span className="pm-dropdown-btn-text">
                      {form.assigneeIds.length
                        ? assignablePool.filter(u => form.assigneeIds.includes(String(u.id))).map(u => u.name).join(', ')
                        : 'Selecciona responsable(s)'}
                    </span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transform: assigneeOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>
                  {assigneeOpen && (
                    <div className="pm-dropdown-panel">
                      {assignablePool.length === 0 && (
                        <div style={{ padding: '10px 12px', fontSize: 12.5, color: 'var(--text3)' }}>No hay personas disponibles para este equipo</div>
                      )}
                      {assignablePool.map(u => {
                        const active = form.assigneeIds.includes(String(u.id));
                        return (
                          <label key={u.id} className={`pm-dropdown-item${active ? ' pm-dropdown-item--active' : ''}`}>
                            <input type="checkbox" checked={active} onChange={() => toggleAssignee(u.id)} />
                            <span className={`avatar-xs ${colorClass(u.colorIndex)}`}>{u.initials}</span>
                            {u.name}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              <div className="pm-field">
                <label className="pm-field-label">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                  Clientes / Áreas
                </label>
                <div className="pm-cluser" ref={clientRef}>
                  {/* El resumen se mantiene en una línea a propósito. Escribir
                      los veinte nombres hacía crecer el disparador hasta 165 px,
                      y como el desplegable se ancla debajo, acababa fuera del
                      modal —que recorta— y parecía que no se podía abrir. */}
                  <div className={`pm-input pm-cluser-trigger${clientOpen ? ' pm-cluser-trigger--open' : ''}`} onClick={() => !lockCore && setClientOpen(o => !o)}>
                    <span className={`pm-cluser-resumen${seleccionados.length ? '' : ' pm-cluser-placeholder'}`}>
                      {resumenClientes}
                    </span>
                    <span className="pm-cluser-caret">▾</span>
                  </div>
                  {clientOpen && !lockCore && (
                    <div className="pm-cluser-panel" ref={clientPanelRef}>
                      {analyticsClients.filter(c => c.active).map(c => {
                        const active = form.clientIds.includes(String(c.id));
                        return (
                          <label key={c.id} className={`pm-cluser-item${active ? ' pm-cluser-item--active' : ''}`}>
                            <input type="checkbox" checked={active} onChange={() => toggleClient(c.id)} />
                            <span>{c.name}</span>
                          </label>
                        );
                      })}
                      {analyticsClients.filter(c => c.active).length === 0 && (
                        <div className="pm-cluser-empty">No hay clientes aún. Créalo abajo.</div>
                      )}
                      <div className="pm-cluser-quick">
                        <input className="pm-input" value={newClientText} onChange={e => setNewClientText(e.target.value)}
                          placeholder="Nuevo cliente…" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); quickAddClient(); } }} />
                        <button type="button" className="pm-cluser-add" onClick={quickAddClient} disabled={!newClientText.trim()}>Agregar</button>
                      </div>
                      {clientError
                        ? <div className="pm-cluser-error">{clientError}</div>
                        : <div className="pm-cluser-hint">Selecciona los clientes o áreas que aplican a este proyecto.</div>}
                    </div>
                  )}
                </div>
              </div>
              {form.clientIds.length > 0 && (
                <div className="pm-field" style={{ gridColumn: '1 / -1' }}>
                  <label className="pm-field-label">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    Cada cliente de este proyecto
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {form.clientIds.map(cid => {
                      const cl = analyticsClients.find(c => String(c.id) === cid);
                      if (!cl) return null;
                      const cargada = Boolean(analyticsLoaded[cid]);
                      return (
                        <div key={cid} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span className="pill-mini" style={{ background: 'var(--rb-magenta-tint)', color: 'var(--rb-magenta-ink)', fontSize: 11, minWidth: 100, justifyContent: 'center' }}>
                            {cl.name}
                          </span>
                          <input className="pm-input" style={{ flex: 1, minWidth: 140 }}
                            placeholder={`Título de la sección (ej: ${cl.name})`}
                            value={sectionTitles[cid] || ''}
                            onChange={e => setSectionTitles(st => ({ ...st, [cid]: e.target.value }))} />
                          <label className={`pm-carga${cargada ? ' pm-carga--si' : ''}`}
                            title="Marca que a este cliente ya se le cargó la analítica">
                            <input type="checkbox" checked={cargada}
                              onChange={e => setAnalyticsLoaded(a => ({ ...a, [cid]: e.target.checked }))} />
                            <span>Analítica cargada</span>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                    El título de sección es opcional. «Analítica cargada» es lo que cuenta
                    el panorama de gerencia: cuántos clientes están hechos y cuántos faltan.
                  </div>
                </div>
              )}
              <div className="pm-field">
                <label className="pm-field-label">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
                  Prioridad
                </label>
                <select className="pm-input" value={form.priority} onChange={set('priority')} disabled={lockCore}>
                  <option value="high">Alta</option>
                  <option value="mid">Media</option>
                  <option value="low">Baja</option>
                </select>
              </div>
              <div className="pm-field">
                <label className="pm-field-label">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>
                  Estado
                </label>
                <select className="pm-input" value={form.status} onChange={set('status')}>
                  {STATUS_OPTS
                    .filter(([k]) => !lockCore || k === form.status || (ENGINEER_FLOW[form.status] || []).includes(k))
                    .map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </div>
            </div>
            {!isEdit && (
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                El progreso se calcula solo, según las tareas que completes más abajo — agrega al menos una.
              </div>
            )}

            {/* Documentación */}
            <div className="pm-doc-row">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              {!showDoc ? (
                <>
                  <span style={{ color: 'var(--text3)', fontSize: 13 }}>Sin documentación</span>
                  {!lockCore && <button type="button" className="pm-link" onClick={() => setShowDoc(true)}>Agregar documentación</button>}
                </>
              ) : lockCore ? (
                <a href={form.docUrl} target="_blank" rel="noopener noreferrer" className="pm-link">
                  Abrir carpeta de documentación
                </a>
              ) : (
                <>
                  <input className="pm-input" style={{ flex: 1 }} type="url" placeholder="https://drive.google.com/..."
                    value={form.docUrl} onChange={set('docUrl')} autoFocus />
                  <button type="button" className="pm-link" style={{ color: 'var(--text3)' }}
                    onClick={() => { setShowDoc(false); setForm(f => ({ ...f, docUrl: '' })); }}>Quitar</button>
                </>
              )}
            </div>
          </div>

          {/* ── Compartido ── */}
          {areaSel === 'compartido' && typeSel === 'proyecto' && (
            <div className="pm-box" style={{ borderColor: 'rgba(8,145,178,.3)' }}>
              <div className="pm-box-title" style={{ color: '#0B6E80' }}>Proyecto compartido</div>
              <div className="pm-grid">
                <div className="pm-field">
                  <label className="pm-field-label">Responsable general</label>
                  <select className="pm-input" value={form.generalAssigneeId} onChange={set('generalAssigneeId')} disabled={isEdit && !isLeader}>
                    <option value="">— Sin asignar —</option>
                    {users.map(u => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
                  </select>
                </div>
                <div className="pm-field" style={{ position: 'relative' }} ref={assigneeRef}>
                  <label className="pm-field-label">Responsable(s) Automatización</label>
                  <button type="button" className="pm-dropdown-btn"
                    disabled={isEdit && !isLeader}
                    onClick={() => setAssigneeOpen(o => !o)}>
                    <span className="pm-dropdown-btn-text">
                      {form.assigneeIds.length
                        ? assignablePool.filter(u => form.assigneeIds.includes(String(u.id))).map(u => u.name).join(', ')
                        : 'Selecciona responsable(s)'}
                    </span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transform: assigneeOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>
                  {assigneeOpen && (
                    <div className="pm-dropdown-panel">
                      {assignablePool.length === 0 && (
                        <div style={{ padding: '10px 12px', fontSize: 12.5, color: 'var(--text3)' }}>No hay personas disponibles para este equipo</div>
                      )}
                      {assignablePool.map(u => {
                        const active = form.assigneeIds.includes(String(u.id));
                        return (
                          <label key={u.id} className={`pm-dropdown-item${active ? ' pm-dropdown-item--active' : ''}`}>
                            <input type="checkbox" checked={active} onChange={() => toggleAssignee(u.id)} />
                            <span className={`avatar-xs ${colorClass(u.colorIndex)}`}>{u.initials}</span>
                            {u.name}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="pm-field">
                  <label className="pm-field-label">Responsable Analítica</label>
                  <select className="pm-input" value={form.coAssigneeId} onChange={set('coAssigneeId')} disabled={isEdit && !isLeader}>
                    <option value="">— Sin asignar —</option>
                    {analiticaPool.map(u => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
                  </select>
                </div>
                <div className="pm-field">
                  <label className="pm-field-label">Participación Automatización</label>
                  <input className="pm-input" value={form.participationAuto} onChange={set('participationAuto')} placeholder="Integración, flujo, agente..." />
                </div>
                <div className="pm-field">
                  <label className="pm-field-label">Participación Analítica</label>
                  <input className="pm-input" value={form.participationAnalitica} onChange={set('participationAnalitica')} placeholder="Dashboard, indicadores..." />
                </div>
                <div className="pm-field">
                  <label className="pm-field-label" style={{ justifyContent: 'space-between' }}>
                    <span>Avance Automatización</span>
                    <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{form.progressAuto}%</span>
                  </label>
                  <input type="range" min={0} max={100} step={5} value={form.progressAuto}
                    onChange={e => setForm(f => ({ ...f, progressAuto: parseInt(e.target.value) }))} style={{ marginTop: 10 }} />
                </div>
                <div className="pm-field">
                  <label className="pm-field-label" style={{ justifyContent: 'space-between' }}>
                    <span>Avance Analítica</span>
                    <span style={{ color: '#7c3aed', fontWeight: 700 }}>{form.progressAnalitica}%</span>
                  </label>
                  <input type="range" min={0} max={100} step={5} value={form.progressAnalitica}
                    onChange={e => setForm(f => ({ ...f, progressAnalitica: parseInt(e.target.value) }))} style={{ marginTop: 10 }} />
                </div>
              </div>
            </div>
          )}

          {/* ── Descripción ── */}
          <div className="pm-box">
            <div className="pm-box-title">Descripción</div>
            <textarea className="pm-input pm-textarea" value={form.description} onChange={set('description')}
              placeholder="Describe el objetivo, alcance y contexto del proyecto..." rows={3} disabled={lockCore} />
          </div>

          {/* ── Tareas ── */}
          <div className="pm-box">
            <div className="pm-box-title">Tareas</div>
            <div className="pm-box-sub">
              {!canManageTasks
                ? 'Marca las tareas completadas — solo el responsable o un líder pueden crearlas o modificarlas.'
                : isEdit
                  ? 'Agrega las tareas con su fecha de entrega y prioridad. El progreso del proyecto se calcula según las tareas completadas.'
                  : 'Obligatorio: agrega al menos una tarea. El progreso del proyecto se calculará según las que vayas completando.'}
            </div>
            {canManageTasks && (
              <div className="pm-task-add" style={{ flexWrap: 'wrap' }}>
                <input className="pm-input" style={{ flex: 1, minWidth: 160 }} placeholder="Nueva tarea..."
                  value={taskTitle} onChange={e => setTaskTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addLocalTask())} />
                <select className="pm-input" style={{ width: 110 }} value={taskWeight}
                  onChange={e => setTaskWeight(Number(e.target.value))} title="Tamaño de la tarea">
                  <option value={1}>Pequeña</option>
                  <option value={2}>Media</option>
                  <option value={3}>Grande</option>
                </select>
                <select className="pm-input" style={{ width: 105 }} value={taskPriority}
                  onChange={e => setTaskPriority(e.target.value)} title="Prioridad de la tarea">
                  <option value="high">Alta</option>
                  <option value="mid">Media</option>
                  <option value="low">Baja</option>
                </select>
                {form.clientIds.length > 0 && (
                  <select className="pm-input" style={{ width: 150 }} value={taskClientId}
                    onChange={e => setTaskClientId(e.target.value)} title="Cliente (si es específico de este cliente)">
                    <option value="">General (proyecto)</option>
                    {analyticsClients.filter(c => c.active && form.clientIds.includes(String(c.id))).map(c =>
                      <option key={c.id} value={String(c.id)}>{c.name}</option>
                    )}
                  </select>
                )}
                {taskAssigneePool.length > 0 && (
                  <select className="pm-input" style={{ width: 150, borderColor: taskAssignee ? undefined : 'var(--high)' }} value={taskAssignee}
                    onChange={e => setTaskAssignee(e.target.value)} title="Asignar a (obligatorio)">
                    <option value="" disabled>Asignar a…</option>
                    {taskAssigneePool.map(u => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
                  </select>
                )}
                <input className="pm-input" type="date" style={{ width: 150 }}
                  value={taskDate} onChange={e => setTaskDate(e.target.value)} />
                <button type="button" className="btn btn-primary btn-sm" onClick={addLocalTask}
                  disabled={!taskTitle.trim() || (taskAssigneePool.length > 0 && !taskAssignee)}>
                  Agregar
                </button>
              </div>
            )}
            {tasks.length > 0 && (
              <div className="pm-task-list">
                {tasks.map(t => (
                  <div key={t.id ?? t._localId} className="pm-task" style={{ flexWrap: 'wrap' }}>
                    <button type="button"
                      className={`task-check${t.done ? ' task-check--done' : ''}`}
                      onClick={() => toggleLocalTask(t)}>
                      {t.done && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      )}
                    </button>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                      <span className={`task-title${t.done ? ' task-title--done' : ''}`}>{t.title}</span>
                      {t.createdAt && <span style={{ fontSize: 10.5, color: 'var(--text3)' }}>Creada {fmtDateTime(t.createdAt)}</span>}
                    </div>
                    {t.assigneeId && (() => {
                      const owner = users.find(u => u.id === t.assigneeId);
                      return owner ? (
                        <span className={`avatar-xs ${colorClass(owner.colorIndex)}`} title={owner.name}>{owner.initials}</span>
                      ) : null;
                    })()}
                    {t.priority && (
                      <span className={`prio-pill prio-pill--${t.priority}`} title="Prioridad">
                        {t.priority === 'high' ? 'Alta' : t.priority === 'low' ? 'Baja' : 'Media'}
                      </span>
                    )}
                    {t.clientId && (() => {
                      const cl = analyticsClients.find(c => c.id === t.clientId);
                      return cl ? <span className="pm-client-chip" title="Cliente">{cl.name}</span> : null;
                    })()}
                    {t.dueDate && (
                      <span className="pm-task-date">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        {fmtShort(t.dueDate)}
                      </span>
                    )}
                    {canManageTasks && (
                      <button type="button" className="task-del" style={{ opacity: 1 }}
                        onClick={() => setEditingTaskId(editingTaskId === (t.id ?? t._localId) ? null : (t.id ?? t._localId))} title="Editar responsable">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>
                        </svg>
                      </button>
                    )}
                    {canManageTasks && (
                      <button type="button" className="task-del" style={{ opacity: 1 }} onClick={() => removeLocalTask(t)} title="Eliminar tarea">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    )}
                    {editingTaskId === (t.id ?? t._localId) && (
                      <div style={{ display: 'flex', gap: 6, width: '100%', marginTop: 4, paddingLeft: 26 }}>
                        <select className="pm-input" style={{ flex: 1, fontSize: 12.5, padding: '6px 8px' }}
                          defaultValue={t.assigneeId ? String(t.assigneeId) : ''}
                          onChange={e => reassignLocalTask(t, e.target.value ? Number(e.target.value) : null)}>
                          <option value="">Sin asignar</option>
                          {taskAssigneePool.map(u => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
                        </select>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingTaskId(null)}>Cerrar</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Seguimiento + progreso (solo edición) ── */}
          {isEdit && (
            <div className="pm-panels">
              <div className="pm-box" style={{ margin: 0 }}>
                <div className="pm-box-title">Seguimiento semanal</div>
                {visibleLogs.length === 0 && <div style={{ fontSize: 12, color: 'var(--text3)', padding: '8px 0' }}>Sin avances registrados aún</div>}
                {visibleLogs.map(l => (
                  <div key={l.id} className="pm-log">
                    <div className={`avatar-xs ${colorClass(0)}`}>{(l.author?.name || 'S').slice(0, 2).toUpperCase()}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{l.author?.name || 'Sistema'}</span>
                        <span style={{ fontSize: 10.5, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{fmtLogDate(l.createdAt)}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5, marginTop: 2 }}>{l.text}</div>
                    </div>
                  </div>
                ))}
                {logs.length > 2 && (
                  <button type="button" className="pm-link" style={{ marginTop: 6 }} onClick={() => setShowAllLogs(s => !s)}>
                    {showAllLogs ? 'Ver menos' : `Ver más seguimientos (${logs.length - 2})`}
                  </button>
                )}
              </div>

              <div className="pm-box" style={{ margin: 0 }}>
                <div className="pm-box-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  Registrar avance
                  <span style={{ color: 'var(--accent)' }}>{form.progress}% completado</span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: -4, marginBottom: 10 }}>
                  El progreso se actualiza solo al completar tareas — aquí solo dejas la nota del avance.
                </div>
                <textarea className="pm-input pm-textarea" rows={2}
                  placeholder={isBlock ? 'Describe el bloqueo...' : 'Registra el avance de la reunión semanal...'}
                  value={logText} onChange={e => setLogText(e.target.value)} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 7, margin: '10px 0', cursor: 'pointer', fontSize: 12, color: isBlock ? 'var(--high)' : 'var(--text2)', fontWeight: isBlock ? 600 : 400 }}>
                  <input type="checkbox" checked={isBlock} onChange={e => setIsBlock(e.target.checked)}
                    style={{ accentColor: 'var(--high)', width: 13, height: 13, cursor: 'pointer' }} />
                  Reportar como bloqueo — el proyecto pasará a "En standby"
                </label>
                <button type="button" className={`btn btn-sm${isBlock ? ' btn-danger' : ' btn-primary'}`}
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={submitLog} disabled={logSaving || !logText.trim()}>
                  {logSaving ? 'Guardando...' : isBlock ? 'Reportar bloqueo' : 'Registrar avance'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {isEdit && canDelete && !delConfirm && (
            <button className="btn btn-danger btn-sm" onClick={() => setDelConfirm(true)} disabled={saving} style={{ marginRight: 'auto' }}>
              Eliminar
            </button>
          )}
          {isEdit && canDelete && delConfirm && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 'auto' }}>
              <span style={{ fontSize: 13, color: 'var(--text2)' }}>¿Eliminar este proyecto?</span>
              <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={saving}>
                {saving ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setDelConfirm(false)} disabled={saving}>No</button>
            </div>
          )}
          {!delConfirm && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={saving}>Cancelar</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : isEdit ? 'Actualizar' : 'Crear proyecto'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
