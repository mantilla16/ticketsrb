import { useState, useEffect } from 'react';

const EMPTY = {
  name: '', description: '', client: '',
  status: 'backlog', priority: 'mid', assigneeId: '',
  startDate: '', dueDate: '', progress: 0,
  tipo: 'automatizacion', docUrl: '',
  coAssigneeId: '', participationAuto: '', participationAnalitica: '',
  progressAuto: 0, progressAnalitica: 0,
};

const TIPO_OPTIONS = [
  { value: 'automatizacion',  label: 'Automatización' },
  { value: 'analitica',       label: 'Analítica' },
  { value: 'compartido',      label: 'Compartido' },
  { value: 'asignacion_flash',label: 'Asignación Flash' },
];

const LEADER_ROLES = ['admin', 'leader_analytics'];

export default function ProjectModal({ open, project, defStatus, defAssigneeId, users, onSave, onDelete, onClose, currentUser }) {
  const isLeader  = LEADER_ROLES.includes(currentUser?.role);
  const canDelete = isLeader;
  const [form, setForm]         = useState(EMPTY);
  const [error, setError]       = useState('');
  const [saving, setSaving]     = useState(false);
  const [delConfirm, setDelConfirm] = useState(false);
  const isEdit = Boolean(project);

  useEffect(() => {
    if (open) {
      setDelConfirm(false);
      if (project) {
        setForm({
          name:                  project.name,
          description:           project.description || '',
          client:                project.client || '',
          status:                project.status,
          priority:              project.priority || 'mid',
          assigneeId:            project.assigneeId != null ? String(project.assigneeId) : '',
          startDate:             project.startDate || '',
          dueDate:               project.dueDate || '',
          progress:              project.progress || 0,
          tipo:                  project.tipo || 'automatizacion',
          docUrl:                project.docUrl || '',
          coAssigneeId:          project.coAssigneeId != null ? String(project.coAssigneeId) : '',
          participationAuto:     project.participationAuto || '',
          participationAnalitica:project.participationAnalitica || '',
          progressAuto:          project.progressAuto || 0,
          progressAnalitica:     project.progressAnalitica || 0,
        });
      } else {
        setForm({ ...EMPTY, status: defStatus || 'backlog', assigneeId: defAssigneeId != null ? String(defAssigneeId) : '' });
      }
      setError('');
    }
  }, [open, project, defStatus, defAssigneeId]);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError('El nombre del proyecto es obligatorio'); return; }
    setSaving(true); setError('');
    try {
      await onSave({
        name:                  form.name.trim(),
        description:           form.description.trim() || null,
        client:                form.client.trim() || null,
        status:                form.status,
        priority:              form.priority,
        assigneeId:            form.assigneeId ? parseInt(form.assigneeId) : null,
        startDate:             form.startDate || null,
        dueDate:               form.dueDate || null,
        progress:              parseInt(form.progress) || 0,
        tipo:                  form.tipo || 'automatizacion',
        docUrl:                form.docUrl.trim() || null,
        coAssigneeId:          form.coAssigneeId ? parseInt(form.coAssigneeId) : null,
        participationAuto:     form.participationAuto.trim() || null,
        participationAnalitica:form.participationAnalitica.trim() || null,
        progressAuto:          parseInt(form.progressAuto) || 0,
        progressAnalitica:     parseInt(form.progressAnalitica) || 0,
      });
    } catch (err) {
      setError(err.error || err.errors?.[0]?.msg || 'Error al guardar');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setSaving(true);
    try { await onDelete(); } catch (err) { setError(err.error || 'Error al eliminar'); setSaving(false); }
  };

  if (!open) return null;

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--accent)', marginBottom: 3 }}>
              {isEdit ? 'Editando proyecto' : 'Nuevo proyecto'}
            </div>
            <div className="modal-title">{isEdit ? project.name : 'Crear proyecto'}</div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}

          <div className="form-group">
            <label className="form-label">Nombre del proyecto *</label>
            <input className="form-input" value={form.name} onChange={set('name')} placeholder="Ej. Automatización de facturación" />
          </div>
          <div className="form-group">
            <label className="form-label">Descripción</label>
            <textarea className="form-textarea" value={form.description} onChange={set('description')} placeholder="Breve descripción del alcance y objetivos..." rows={2} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Tipo de registro</label>
              <select className="form-select" value={form.tipo} onChange={set('tipo')}>
                {TIPO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Prioridad</label>
              <select className="form-select" value={form.priority} onChange={set('priority')}>
                <option value="high">Alta</option>
                <option value="mid">Media</option>
                <option value="low">Baja</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Cliente / Área</label>
              <input className="form-input" value={form.client} onChange={set('client')} placeholder="Ej. Contabilidad" />
            </div>
            <div className="form-group">
              <label className="form-label">Link de documentación</label>
              <input className="form-input" value={form.docUrl} onChange={set('docUrl')} placeholder="https://..." type="url" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Estado</label>
              <select className="form-select" value={form.status} onChange={set('status')}>
                <option value="backlog">Por hacer</option>
                <option value="progress">En proceso</option>
                <option value="standby">En standby</option>
                <option value="testing">En testing</option>
                <option value="done">Finalizado</option>
                <option value="soporte">En soporte</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Responsable principal</label>
              <select className="form-select" value={form.assigneeId} onChange={set('assigneeId')} disabled={!isLeader}>
                <option value="">— Sin asignar —</option>
                {users.map(u => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
              </select>
            </div>
          </div>

          {/* Shared project extra fields */}
          {form.tipo === 'compartido' && (
            <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: '#0891b2' }}>
                Campos del proyecto compartido
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Responsable Analítica</label>
                  <select className="form-select" value={form.coAssigneeId} onChange={set('coAssigneeId')} disabled={!isLeader}>
                    <option value="">— Sin asignar —</option>
                    {users.map(u => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Participación Automatización</label>
                  <input className="form-input" value={form.participationAuto} onChange={set('participationAuto')} placeholder="Integración, flujo, agente..." />
                </div>
                <div className="form-group">
                  <label className="form-label">Participación Analítica</label>
                  <input className="form-input" value={form.participationAnalitica} onChange={set('participationAnalitica')} placeholder="Dashboard, indicadores..." />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Avance Automatización</span>
                    <span style={{ fontFamily: 'var(--mono)', color: '#f9924d', fontWeight: 700, textTransform: 'none', letterSpacing: 0 }}>{form.progressAuto}%</span>
                  </label>
                  <input type="range" min={0} max={100} step={5} value={form.progressAuto}
                    onChange={e => setForm(f => ({ ...f, progressAuto: parseInt(e.target.value) }))} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Avance Analítica</span>
                    <span style={{ fontFamily: 'var(--mono)', color: '#7c3aed', fontWeight: 700, textTransform: 'none', letterSpacing: 0 }}>{form.progressAnalitica}%</span>
                  </label>
                  <input type="range" min={0} max={100} step={5} value={form.progressAnalitica}
                    onChange={e => setForm(f => ({ ...f, progressAnalitica: parseInt(e.target.value) }))} />
                </div>
              </div>
            </div>
          )}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Fecha de inicio</label>
              <input className="form-input" type="date" value={form.startDate} onChange={set('startDate')} />
            </div>
            <div className="form-group">
              <label className="form-label">Fecha de entrega</label>
              <input className="form-input" type="date" value={form.dueDate} onChange={set('dueDate')} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Progreso</span>
              <span style={{ fontFamily: 'var(--mono)', color: 'var(--accent)', fontWeight: 700, textTransform: 'none', letterSpacing: 0 }}>{form.progress}%</span>
            </label>
            <input type="range" min={0} max={100} step={5} value={form.progress}
              onChange={e => setForm(f => ({ ...f, progress: parseInt(e.target.value) }))} />
          </div>
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
