import { useState, useEffect } from 'react';
import { solicitudesAPI } from '../services/api';
import { colorClass } from '../utils/helpers';

// ── Constants ──────────────────────────────────────────────────────────────────

const TYPE_MAP = {
  automatizacion: {
    label: 'Automatización', color: '#7C3AED', bg: '#F5F3FF',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    ),
  },
  requerimiento: {
    label: 'Requerimiento', color: '#1D4ED8', bg: '#EFF6FF',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
  },
  soporte: {
    label: 'Soporte / Consulta', color: '#0369A1', bg: '#F0F9FF',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  reporte: {
    label: 'Reporte / Dashboard', color: '#047857', bg: '#ECFDF5',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
};

const PRIORITY_MAP = {
  alta:  { label: 'Alta',  color: '#DC2626', bg: '#FEE2E2' },
  media: { label: 'Media', color: '#D97706', bg: '#FEF3C7' },
  baja:  { label: 'Baja',  color: '#059669', bg: '#D1FAE5' },
};

const STATUS_MAP = {
  nueva:       { label: 'Nueva',       color: '#2563EB', bg: '#DBEAFE' },
  en_revision: { label: 'En revisión', color: '#D97706', bg: '#FEF3C7' },
  en_proceso:  { label: 'En proceso',  color: '#7C3AED', bg: '#EDE9FE' },
  completada:  { label: 'Completada',  color: '#059669', bg: '#D1FAE5' },
  rechazada:   { label: 'Rechazada',   color: '#DC2626', bg: '#FEE2E2' },
};

const STATUSES = ['nueva','en_revision','en_proceso','completada','rechazada'];

const TYPES_LIST = [
  {
    value: 'automatizacion', label: 'Automatización',
    desc: 'Automatiza un proceso repetitivo o manual',
    color: '#7C3AED', bg: '#F5F3FF',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  },
  {
    value: 'requerimiento', label: 'Requerimiento',
    desc: 'Solicita una nueva funcionalidad o desarrollo',
    color: '#1D4ED8', bg: '#EFF6FF',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  },
  {
    value: 'soporte', label: 'Soporte / Consulta',
    desc: 'Tienes preguntas o necesitas orientación',
    color: '#0369A1', bg: '#F0F9FF',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  },
  {
    value: 'reporte', label: 'Reporte / Dashboard',
    desc: 'Solicita un informe, métrica o visualización',
    color: '#047857', bg: '#ECFDF5',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  },
];

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── New Solicitud Modal ────────────────────────────────────────────────────────

function NewSolicitudModal({ open, onClose, onSave }) {
  const [step,   setStep]   = useState(1);
  const [form,   setForm]   = useState({ type: '', title: '', area: '', description: '', priority: 'media', dueDate: '', file: null });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  useEffect(() => {
    if (open) {
      setStep(1);
      setForm({ type: '', title: '', area: '', description: '', priority: 'media', dueDate: '', file: null });
      setError('');
      setSaving(false);
    }
  }, [open]);

  if (!open) return null;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('title',       form.title);
      fd.append('type',        form.type);
      fd.append('area',        form.area);
      fd.append('description', form.description);
      fd.append('priority',    form.priority);
      if (form.dueDate) fd.append('dueDate', form.dueDate);
      if (form.file)    fd.append('file',    form.file);
      await onSave(fd);
    } catch (err) {
      setError(err.error || 'Error al enviar la solicitud');
      setSaving(false);
    }
  };

  const selectedType = TYPES_LIST.find(t => t.value === form.type);

  return (
    <div className="um-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sol-modal">
        <div className="sol-modal-header"
          style={selectedType ? { borderBottom: `3px solid ${selectedType.color}` } : {}}>
          <div>
            <div className="sol-modal-title">
              {step === 2 && selectedType ? selectedType.label : 'Nueva solicitud'}
            </div>
            <div className="sol-modal-step">Paso {step} de 2</div>
          </div>
          <button className="um-close" onClick={onClose}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {error && <div className="um-error" style={{ margin: '12px 20px 0' }}>{error}</div>}

        {step === 1 && (
          <div className="sol-modal-body">
            <p className="sol-modal-hint">¿Qué tipo de solicitud quieres enviar?</p>
            <div className="sol-type-grid">
              {TYPES_LIST.map(t => (
                <button
                  key={t.value}
                  type="button"
                  className={`sol-type-card${form.type === t.value ? ' sol-type-card--active' : ''}`}
                  style={form.type === t.value ? { borderColor: t.color, background: t.bg } : {}}
                  onClick={() => set('type', t.value)}
                >
                  <div className="sol-type-icon"
                    style={{ color: form.type === t.value ? t.color : 'var(--text3)' }}>
                    {t.icon}
                  </div>
                  <div className="sol-type-label"
                    style={{ color: form.type === t.value ? t.color : 'var(--text)' }}>
                    {t.label}
                  </div>
                  <div className="sol-type-desc">{t.desc}</div>
                </button>
              ))}
            </div>
            <div className="sol-modal-footer">
              <button className="btn btn-ghost" onClick={onClose}
                style={{ flex: 1, justifyContent: 'center' }}>Cancelar</button>
              <button className="btn btn-primary" disabled={!form.type}
                onClick={() => setStep(2)} style={{ flex: 2, justifyContent: 'center' }}>
                Continuar
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={submit} className="sol-modal-body">
            <div className="um-row">
              <div className="um-field" style={{ flex: 2 }}>
                <label className="um-label">Título de la solicitud *</label>
                <div className="um-input-wrap">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  <input className="um-input" type="text"
                    placeholder="Describe brevemente tu solicitud"
                    value={form.title} onChange={e => set('title', e.target.value)}
                    required autoFocus />
                </div>
              </div>
              <div className="um-field" style={{ flex: 1 }}>
                <label className="um-label">Área / Departamento</label>
                <div className="um-input-wrap">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                  <input className="um-input" type="text" placeholder="Ej. Rectoría"
                    value={form.area} onChange={e => set('area', e.target.value)} />
                </div>
              </div>
            </div>

            <div className="um-field">
              <label className="um-label">Descripción detallada</label>
              <textarea
                className="um-input sol-textarea"
                placeholder="Explica el proceso, el problema o lo que necesitas. Más detalle = mejor atención."
                value={form.description}
                onChange={e => set('description', e.target.value)}
                rows={4}
              />
            </div>

            <div className="um-row">
              <div className="um-field">
                <label className="um-label">Prioridad</label>
                <div className="sol-priority-wrap">
                  {['alta','media','baja'].map(p => (
                    <button key={p} type="button"
                      className={`sol-prio-btn${form.priority === p ? ' sol-prio-btn--active' : ''}`}
                      style={form.priority === p
                        ? { borderColor: PRIORITY_MAP[p].color, background: PRIORITY_MAP[p].bg, color: PRIORITY_MAP[p].color }
                        : {}}
                      onClick={() => set('priority', p)}>
                      {PRIORITY_MAP[p].label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="um-field">
                <label className="um-label">Fecha requerida</label>
                <div className="um-input-wrap">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <rect x="3" y="4" width="18" height="18" rx="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  <input className="um-input" type="date"
                    value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
                </div>
              </div>
            </div>

            <div className="um-field">
              <label className="um-label">
                Archivo de soporte
                <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}> · PDF, Word, Excel, imagen · máx 10 MB</span>
              </label>
              <label className="sol-file-label">
                <input type="file" accept=".pdf,.doc,.docx,.xlsx,.xls,.png,.jpg,.jpeg"
                  style={{ display: 'none' }}
                  onChange={e => set('file', e.target.files?.[0] || null)} />
                {form.file
                  ? <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                        <polyline points="13 2 13 9 20 9"/>
                      </svg>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{form.file.name}</span>
                      <span className="sol-file-remove" onClick={e => { e.preventDefault(); set('file', null); }}>✕</span>
                    </>
                  : <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                      Adjuntar archivo
                    </>
                }
              </label>
            </div>

            <div className="sol-modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}
                style={{ flex: 1, justifyContent: 'center' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
                </svg>
                Atrás
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}
                style={{ flex: 2, justifyContent: 'center' }}>
                {saving
                  ? <><span className="um-spinner"/>Enviando...</>
                  : <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="22" y1="2" x2="11" y2="13"/>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                      </svg>
                      Enviar solicitud
                    </>
                }
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Manage Modal (Admin) ───────────────────────────────────────────────────────

function ManageModal({ sol, open, onClose, onSave, onDelete }) {
  const [status,     setStatus]     = useState('nueva');
  const [notes,      setNotes]      = useState('');
  const [saving,     setSaving]     = useState(false);
  const [delConfirm, setDelConfirm] = useState(false);

  useEffect(() => {
    if (sol) { setStatus(sol.status || 'nueva'); setNotes(sol.notes || ''); }
    setDelConfirm(false);
    setSaving(false);
  }, [sol]);

  if (!open || !sol) return null;

  const tp = TYPE_MAP[sol.type]   || {};
  const pr = PRIORITY_MAP[sol.priority] || PRIORITY_MAP.media;

  const submit = async () => {
    setSaving(true);
    try { await onSave(sol.id, { status, notes }); }
    finally { setSaving(false); }
  };

  return (
    <div className="um-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sol-manage-modal">
        <div className="sol-modal-header"
          style={{ borderBottom: `3px solid ${STATUS_MAP[status]?.color || 'var(--accent)'}` }}>
          <div>
            <div className="sol-modal-title">Gestionar solicitud</div>
            <div className="sol-modal-step">{sol.user_name} · {fmtDate(sol.created_at)}</div>
          </div>
          <button className="um-close" onClick={onClose}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="sol-modal-body">
          <div className="sol-manage-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <span className="sol-badge sol-badge--type" style={{ background: tp.bg, color: tp.color }}>
                {tp.icon} {tp.label}
              </span>
              <span className="sol-badge" style={{ background: pr.bg, color: pr.color }}>{pr.label}</span>
              {sol.due_date && (
                <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }}>
                  Vence: {fmtDate(sol.due_date)}
                </span>
              )}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{sol.title}</div>
            {sol.area && <div style={{ fontSize: 12, color: 'var(--text3)' }}>{sol.area}</div>}
            {sol.description && (
              <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 8, lineHeight: 1.6 }}>{sol.description}</p>
            )}
            {sol.file_name && (
              <div className="sol-card-file" style={{ marginTop: 8 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                  <polyline points="13 2 13 9 20 9"/>
                </svg>
                {sol.file_name}
              </div>
            )}
          </div>

          <div className="um-field" style={{ marginTop: 4 }}>
            <label className="um-label">Cambiar estado</label>
            <div className="sol-status-wrap">
              {STATUSES.map(s => (
                <button key={s} type="button"
                  className={`sol-status-btn${status === s ? ' sol-status-btn--active' : ''}`}
                  style={status === s
                    ? { borderColor: STATUS_MAP[s].color, background: STATUS_MAP[s].bg, color: STATUS_MAP[s].color }
                    : {}}
                  onClick={() => setStatus(s)}>
                  {STATUS_MAP[s].label}
                </button>
              ))}
            </div>
          </div>

          <div className="um-field">
            <label className="um-label">
              Respuesta / Observaciones
              <span style={{ fontWeight: 400, color: 'var(--text3)' }}> · visible para el usuario</span>
            </label>
            <textarea className="um-input sol-textarea"
              placeholder="Escribe un comentario, instrucción o motivo para el usuario..."
              value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
          </div>

          <div className="sol-modal-footer" style={{ justifyContent: 'space-between' }}>
            {!delConfirm
              ? (
                <button type="button"
                  className="uv-action-btn uv-action-btn--del"
                  style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, gap: 5 }}
                  onClick={() => setDelConfirm(true)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  </svg>
                  Eliminar
                </button>
              )
              : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--text2)' }}>¿Confirmar?</span>
                  <button type="button" className="uv-action-btn uv-action-btn--del"
                    style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12 }}
                    onClick={() => onDelete(sol.id)}>Sí</button>
                  <button type="button" className="btn btn-ghost"
                    style={{ padding: '6px 12px', fontSize: 12 }}
                    onClick={() => setDelConfirm(false)}>No</button>
                </div>
              )
            }
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" onClick={onClose} style={{ justifyContent: 'center' }}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={submit} disabled={saving}
                style={{ justifyContent: 'center' }}>
                {saving ? <><span className="um-spinner"/>Guardando...</> : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function SolicitudesView({ user, showToast }) {
  const isAdmin = user?.role === 'admin';

  const [solicitudes, setSolicitudes] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [newModal,    setNewModal]    = useState(false);
  const [manageModal, setManageModal] = useState(null);
  const [filter,      setFilter]      = useState('all');

  useEffect(() => {
    solicitudesAPI.getAll()
      .then(setSolicitudes)
      .catch(() => showToast('Error cargando solicitudes', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (fd) => {
    const created = await solicitudesAPI.create(fd);
    setSolicitudes(s => [created, ...s]);
    setNewModal(false);
    showToast('Solicitud enviada con éxito', 'success');
  };

  const handleUpdateStatus = async (id, data) => {
    const updated = await solicitudesAPI.updateStatus(id, data);
    setSolicitudes(s => s.map(x => x.id === updated.id ? { ...x, ...updated } : x));
    setManageModal(null);
    showToast('Estado actualizado', 'success');
  };

  const handleDelete = async (id) => {
    try {
      await solicitudesAPI.remove(id);
      setSolicitudes(s => s.filter(x => x.id !== id));
      setManageModal(null);
      showToast('Solicitud eliminada', 'error');
    } catch {
      showToast('Error al eliminar', 'error');
    }
  };

  const displayed = filter === 'all'
    ? solicitudes
    : solicitudes.filter(s => {
        if (filter === 'en_proceso') return ['en_revision','en_proceso'].includes(s.status);
        return s.status === filter;
      });

  const stats = {
    total:      solicitudes.length,
    nueva:      solicitudes.filter(s => s.status === 'nueva').length,
    en_proceso: solicitudes.filter(s => ['en_revision','en_proceso'].includes(s.status)).length,
    completada: solicitudes.filter(s => s.status === 'completada').length,
  };

  if (loading) return (
    <div className="empty" style={{ paddingTop: 60 }}>
      Cargando solicitudes…
    </div>
  );

  return (
    <div className="sol-root">

      {/* Stats */}
      <div className="sol-stats">
        {[
          { key: 'all',        num: stats.total,      label: 'Total',       color: 'var(--accent)' },
          { key: 'nueva',      num: stats.nueva,      label: 'Nuevas',      color: '#2563EB' },
          { key: 'en_proceso', num: stats.en_proceso, label: 'En proceso',  color: '#7C3AED' },
          { key: 'completada', num: stats.completada, label: 'Completadas', color: '#059669' },
        ].map(({ key, num, label, color }) => (
          <div key={key}
            className={`sol-stat-card${filter === key ? ' sol-stat-card--active' : ''}`}
            style={{ '--sol-stat-color': color }}
            onClick={() => setFilter(key)}>
            <div className="sol-stat-num" style={{ color }}>{num}</div>
            <div className="sol-stat-label">{label}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="sol-toolbar">
        <div className="sol-filter-chips">
          {[
            { key: 'all', label: 'Todas' },
            ...STATUSES.map(s => ({ key: s, label: STATUS_MAP[s].label }))
          ].map(({ key, label }) => (
            <button key={key}
              className={`sol-chip${filter === key ? ' sol-chip--active' : ''}`}
              onClick={() => setFilter(key)}>
              {label}
            </button>
          ))}
        </div>
        {!isAdmin && (
          <button className="btn btn-primary" onClick={() => setNewModal(true)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Nueva solicitud
          </button>
        )}
      </div>

      {/* List */}
      {displayed.length === 0 ? (
        <div className="sol-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: .2 }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
          </svg>
          <div className="sol-empty-title">
            {filter === 'all'
              ? 'Sin solicitudes aún'
              : `Sin solicitudes "${STATUS_MAP[filter]?.label || filter}"`}
          </div>
          {!isAdmin && filter === 'all' && (
            <button className="btn btn-primary" onClick={() => setNewModal(true)}>
              Crear mi primera solicitud
            </button>
          )}
        </div>
      ) : (
        <div className="sol-list">
          {displayed.map(sol => {
            const st = STATUS_MAP[sol.status] || STATUS_MAP.nueva;
            const tp = TYPE_MAP[sol.type]    || {};
            const pr = PRIORITY_MAP[sol.priority] || PRIORITY_MAP.media;
            return (
              <div key={sol.id}
                className={`sol-card${isAdmin ? ' sol-card--clickable' : ''}`}
                style={{ '--sol-status-color': st.color }}
                onClick={() => isAdmin && setManageModal(sol)}>

                <div className="sol-card-top">
                  <span className="sol-badge sol-badge--type"
                    style={{ background: tp.bg, color: tp.color }}>
                    {tp.icon}{tp.label}
                  </span>
                  {isAdmin && sol.user_name && (
                    <span className="sol-user-chip">
                      <span className={`sol-user-dot ${colorClass(sol.user_color_index)}`}>
                        {sol.user_initials}
                      </span>
                      {sol.user_name}
                    </span>
                  )}
                  <span className="sol-badge"
                    style={{ marginLeft: 'auto', background: st.bg, color: st.color }}>
                    {st.label}
                  </span>
                </div>

                <div className="sol-card-title">{sol.title}</div>

                <div className="sol-card-meta">
                  {sol.area && <span className="sol-meta-chip">{sol.area}</span>}
                  <span className="sol-meta-chip"
                    style={{ background: pr.bg, color: pr.color }}>{pr.label}</span>
                  <span style={{ flex: 1 }} />
                  <span className="sol-card-date">
                    {fmtDate(sol.created_at)}
                    {sol.due_date && ` · Vence: ${fmtDate(sol.due_date)}`}
                  </span>
                </div>

                {sol.notes && (
                  <div className="sol-card-note">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    {sol.notes}
                  </div>
                )}

                {sol.file_name && (
                  <div className="sol-card-file">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                      <polyline points="13 2 13 9 20 9"/>
                    </svg>
                    {sol.file_name}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <NewSolicitudModal open={newModal} onClose={() => setNewModal(false)} onSave={handleCreate} />
      <ManageModal
        sol={manageModal} open={!!manageModal}
        onClose={() => setManageModal(null)}
        onSave={handleUpdateStatus}
        onDelete={handleDelete}
      />
    </div>
  );
}
