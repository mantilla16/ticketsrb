import { useState, useEffect } from 'react';
import { solicitudesAPI, projectsAPI } from '../services/api';
import { colorClass } from '../utils/helpers';

const PRIORITY_MAP_PROJECT = { alta: 'high', media: 'mid', baja: 'low' };
const STATUS_MAP_PROJECT   = {
  recibido: 'backlog', en_revision: 'backlog', reunion_agendada: 'backlog',
  aceptado: 'progress', rechazado: 'done', convertido: 'done',
  // legacy fallbacks
  nueva: 'backlog', en_proceso: 'progress', completada: 'done', rechazada: 'done',
};

// ── Constants ──────────────────────────────────────────────────────────────────

const PRIORITY_MAP = {
  alta:  { label: 'Alta',  color: '#DC2626', bg: '#FEE2E2' },
  media: { label: 'Media', color: '#D97706', bg: '#FEF3C7' },
  baja:  { label: 'Baja',  color: '#059669', bg: '#D1FAE5' },
};

const STATUS_MAP = {
  recibido:         { label: 'Recibida',              color: '#a86040', bg: '#fdf0e8' },
  en_revision:      { label: 'En revisión',            color: '#D97706', bg: '#FEF3C7' },
  reunion_agendada: { label: 'Reunión agendada',       color: '#7c3aed', bg: '#f5f3ff' },
  aceptado:         { label: 'Aceptado',               color: '#0891b2', bg: '#e0f2fe' },
  rechazado:        { label: 'Rechazado',              color: '#DC2626', bg: '#FEE2E2' },
  convertido:       { label: 'Convertido en proyecto', color: '#16A34A', bg: '#D1FAE5' },
  // legacy
  nueva:       { label: 'Nueva',       color: '#2563EB', bg: '#DBEAFE' },
  en_proceso:  { label: 'En proceso',  color: '#7C3AED', bg: '#EDE9FE' },
  completada:  { label: 'Completada',  color: '#059669', bg: '#D1FAE5' },
  rechazada:   { label: 'Rechazada',   color: '#DC2626', bg: '#FEE2E2' },
};

const STATUSES = ['recibido','en_revision','reunion_agendada','aceptado','rechazado','convertido'];

const TIPO_CONVERT_OPTIONS = [
  { value: 'automatizacion',   label: 'Proyecto de Automatización' },
  { value: 'analitica',        label: 'Proyecto de Analítica' },
  { value: 'compartido',       label: 'Proyecto compartido' },
  { value: 'asignacion_flash', label: 'Asignación flash' },
];

const FRECUENCIA_OPTIONS = [
  { value: '', label: 'Seleccionar...' },
  { value: 'diario',   label: 'Diario' },
  { value: 'semanal',  label: 'Semanal' },
  { value: 'mensual',  label: 'Mensual' },
  { value: 'eventual', label: 'Eventual / Bajo demanda' },
];

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── New Solicitud Modal ────────────────────────────────────────────────────────

function NewSolicitudModal({ open, onClose, onSave }) {
  const [form,   setForm]   = useState({
    title: '', area: '', description: '', priority: 'media',
    frecuencia: '', herramientas: '', impacto: '', urgencia: 'media',
    nombreSolicitante: '', correoSolicitante: '', dueDate: '', file: null,
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  useEffect(() => {
    if (open) {
      setForm({
        title: '', area: '', description: '', priority: 'media',
        frecuencia: '', herramientas: '', impacto: '', urgencia: 'media',
        nombreSolicitante: '', correoSolicitante: '', dueDate: '', file: null,
      });
      setError('');
      setSaving(false);
    }
  }, [open]);

  if (!open) return null;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('El nombre del proceso es obligatorio'); return; }
    setError('');
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('title',             form.title.trim());
      fd.append('description',       form.description);
      fd.append('area',              form.area);
      fd.append('priority',          form.priority);
      fd.append('urgencia',          form.urgencia);
      fd.append('frecuencia',        form.frecuencia);
      fd.append('herramientas',      form.herramientas);
      fd.append('impacto',           form.impacto);
      fd.append('nombreSolicitante', form.nombreSolicitante);
      fd.append('correoSolicitante', form.correoSolicitante);
      if (form.dueDate) fd.append('dueDate', form.dueDate);
      if (form.file)    fd.append('file',    form.file);
      await onSave(fd);
    } catch (err) {
      setError(err.error || 'Error al enviar la solicitud');
      setSaving(false);
    }
  };

  return (
    <div className="um-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sol-modal" style={{ maxWidth: 640 }}>
        <div className="sol-modal-header">
          <div>
            <div className="sol-modal-title">Nueva solicitud</div>
            <div className="sol-modal-step">Completa los campos para enviar tu requerimiento</div>
          </div>
          <button className="um-close" onClick={onClose}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {error && <div className="um-error" style={{ margin: '12px 20px 0' }}>{error}</div>}

        <form onSubmit={submit} className="sol-modal-body">

          {/* Identificación */}
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--accent)', marginBottom: 10 }}>Identificación</div>
          <div className="um-row">
            <div className="um-field" style={{ flex: 2 }}>
              <label className="um-label">Nombre del proceso *</label>
              <div className="um-input-wrap">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                <input className="um-input" type="text"
                  placeholder="Ej. Liquidación de nómina mensual"
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

          <div className="um-row">
            <div className="um-field">
              <label className="um-label">Nombre del solicitante</label>
              <div className="um-input-wrap">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
                <input className="um-input" type="text" placeholder="Tu nombre completo"
                  value={form.nombreSolicitante} onChange={e => set('nombreSolicitante', e.target.value)} />
              </div>
            </div>
            <div className="um-field">
              <label className="um-label">Correo de contacto</label>
              <div className="um-input-wrap">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                <input className="um-input" type="email" placeholder="correo@americana.edu.co"
                  value={form.correoSolicitante} onChange={e => set('correoSolicitante', e.target.value)} />
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

          {/* El proceso */}
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--accent)', margin: '12px 0 10px' }}>El proceso</div>

          <div className="um-field">
            <label className="um-label">Descripción de la necesidad</label>
            <textarea className="um-input sol-textarea"
              placeholder="Explica con detalle el proceso, el problema o lo que necesitas automatizar..."
              value={form.description} onChange={e => set('description', e.target.value)} rows={3} />
          </div>

          <div className="um-row">
            <div className="um-field">
              <label className="um-label">Frecuencia del proceso</label>
              <select className="um-input" value={form.frecuencia} onChange={e => set('frecuencia', e.target.value)}
                style={{ cursor: 'pointer' }}>
                {FRECUENCIA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="um-field">
              <label className="um-label">Urgencia</label>
              <div className="sol-priority-wrap">
                {['alta','media','baja'].map(p => (
                  <button key={p} type="button"
                    className={`sol-prio-btn${form.urgencia === p ? ' sol-prio-btn--active' : ''}`}
                    style={form.urgencia === p
                      ? { borderColor: PRIORITY_MAP[p].color, background: PRIORITY_MAP[p].bg, color: PRIORITY_MAP[p].color }
                      : {}}
                    onClick={() => set('urgencia', p)}>
                    {PRIORITY_MAP[p].label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="um-field">
            <label className="um-label">Herramientas actuales</label>
            <textarea className="um-input sol-textarea"
              placeholder="¿Qué herramientas o sistemas usas actualmente para este proceso? (Excel, SAP, correo...)"
              value={form.herramientas} onChange={e => set('herramientas', e.target.value)} rows={2} />
          </div>

          <div className="um-field">
            <label className="um-label">Impacto esperado</label>
            <textarea className="um-input sol-textarea"
              placeholder="¿Qué beneficio esperas de la automatización? (ahorro de tiempo, reducción de errores...)"
              value={form.impacto} onChange={e => set('impacto', e.target.value)} rows={2} />
          </div>

          {/* Adjunto */}
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--accent)', margin: '12px 0 10px' }}>Soporte</div>

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
            <button type="button" className="btn btn-ghost" onClick={onClose}
              style={{ flex: 1, justifyContent: 'center' }}>Cancelar</button>
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
      </div>
    </div>
  );
}

// ── Manage Modal (Admin) ───────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

function ManageModal({ sol, open, onClose, onSave, onDelete, users = [] }) {
  const [status,       setStatus]       = useState('recibido');
  const [notes,        setNotes]        = useState('');
  const [assigneeId,   setAssigneeId]   = useState('');
  const [tipoProyecto, setTipoProyecto] = useState('automatizacion');
  const [saving,       setSaving]       = useState(false);
  const [delConfirm,   setDelConfirm]   = useState(false);

  useEffect(() => {
    if (sol) {
      setStatus(sol.status || 'recibido');
      setNotes(sol.notes || '');
      setAssigneeId(sol.assignee_id ? String(sol.assignee_id) : '');
      setTipoProyecto('automatizacion');
    }
    setDelConfirm(false);
    setSaving(false);
  }, [sol]);

  if (!open || !sol) return null;

  const pr = PRIORITY_MAP[sol.priority] || PRIORITY_MAP.media;
  const assignables = tipoProyecto === 'analitica'
    ? users.filter(u => ['member_analytics', 'leader_analytics'].includes(u.role))
    : tipoProyecto === 'compartido'
      ? users.filter(u => ['engineer', 'admin', 'member_analytics', 'leader_analytics'].includes(u.role))
      : users.filter(u => u.role === 'engineer' || u.role === 'admin');

  const submit = async () => {
    setSaving(true);
    try { await onSave(sol.id, { status, notes, assigneeId: assigneeId || null, tipoProyecto }); }
    finally { setSaving(false); }
  };

  const st = STATUS_MAP[status] || STATUS_MAP.recibido;

  return (
    <div className="um-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sol-manage-modal">
        <div className="sol-modal-header" style={{ borderBottom: `3px solid ${st.color}` }}>
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
          {/* Card with solicitud details */}
          <div className="sol-manage-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <span className="sol-badge" style={{ background: pr.bg, color: pr.color }}>{pr.label}</span>
              {sol.urgencia && (
                <span className="sol-badge" style={{ background: PRIORITY_MAP[sol.urgencia]?.bg, color: PRIORITY_MAP[sol.urgencia]?.color }}>
                  Urgencia: {PRIORITY_MAP[sol.urgencia]?.label}
                </span>
              )}
              {sol.due_date && (
                <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }}>
                  Vence: {fmtDate(sol.due_date)}
                </span>
              )}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{sol.title}</div>
            {(sol.area || sol.nombre_solicitante) && (
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>
                {[sol.area, sol.nombre_solicitante, sol.correo_solicitante].filter(Boolean).join(' · ')}
              </div>
            )}
            {sol.description && (
              <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 8 }}>{sol.description}</p>
            )}
            {/* Extra fields */}
            {(sol.frecuencia || sol.herramientas || sol.impacto) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, marginTop: 8 }}>
                {sol.frecuencia && (
                  <div>
                    <span style={{ color: 'var(--text3)' }}>Frecuencia: </span>
                    <span style={{ color: 'var(--text2)' }}>{sol.frecuencia}</span>
                  </div>
                )}
                {sol.herramientas && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span style={{ color: 'var(--text3)' }}>Herramientas: </span>
                    <span style={{ color: 'var(--text2)' }}>{sol.herramientas}</span>
                  </div>
                )}
                {sol.impacto && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span style={{ color: 'var(--text3)' }}>Impacto esperado: </span>
                    <span style={{ color: 'var(--text2)' }}>{sol.impacto}</span>
                  </div>
                )}
              </div>
            )}
            {sol.info_adicional && (
              <div style={{ marginTop: 8, padding: '8px 10px', background: 'var(--accent-light)', borderRadius: 6, fontSize: 12 }}>
                <span style={{ color: 'var(--accent)', fontWeight: 700 }}>Info adicional del solicitante: </span>
                <span style={{ color: 'var(--text2)' }}>{sol.info_adicional}</span>
              </div>
            )}
            {sol.file_name && sol.file_path && (
              <a
                href={`${API_BASE}/uploads/solicitudes/${sol.file_path}`}
                target="_blank" rel="noopener noreferrer"
                className="sol-file-download"
                onClick={e => e.stopPropagation()}
                style={{ marginTop: 8 }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                  <polyline points="13 2 13 9 20 9"/>
                </svg>
                <span>{sol.file_name}</span>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ marginLeft: 'auto', opacity: .6 }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </a>
            )}
          </div>

          {/* Flujo de estados */}
          <div className="um-field" style={{ marginTop: 4 }}>
            <label className="um-label">Flujo de la solicitud</label>
            <div className="sol-status-wrap" style={{ flexWrap: 'wrap' }}>
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

          <div className="um-row">
            <div className="um-field">
              <label className="um-label">Convertir como</label>
              <div className="um-input-wrap">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                  <polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                </svg>
                <select className="um-input" value={tipoProyecto}
                  onChange={e => setTipoProyecto(e.target.value)} style={{ cursor: 'pointer' }}>
                  {TIPO_CONVERT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div className="um-field">
              <label className="um-label">Asignar responsable</label>
              <div className="um-input-wrap">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
                <select className="um-input" value={assigneeId}
                  onChange={e => setAssigneeId(e.target.value)} style={{ cursor: 'pointer' }}>
                  <option value="">Sin asignar</option>
                  {assignables.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
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
                <button type="button" className="btn btn-danger btn-sm"
                  onClick={() => setDelConfirm(true)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  </svg>
                  Eliminar
                </button>
              )
              : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--text2)' }}>¿Eliminar esta solicitud?</span>
                  <button type="button" className="btn btn-danger btn-sm"
                    onClick={() => onDelete(sol.id)}>Sí, eliminar</button>
                  <button type="button" className="btn btn-ghost btn-sm"
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

// ── Línea de tiempo del estado ─────────────────────────────────────────────────

const FLOW_STEPS = [
  { key: 'recibido',         label: 'Recibida' },
  { key: 'en_revision',      label: 'En revisión' },
  { key: 'reunion_agendada', label: 'Reunión agendada' },
  { key: 'aceptado',         label: 'Aceptada' },
  { key: 'convertido',       label: 'Convertida en proyecto' },
];
const FLOW_INDEX = {
  recibido: 0, nueva: 0,
  en_revision: 1, en_proceso: 1,
  reunion_agendada: 2,
  aceptado: 3,
  convertido: 4, completada: 4,
};

function SolTimeline({ status }) {
  const rejected = status === 'rechazado' || status === 'rechazada';
  const idx = rejected ? -1 : (FLOW_INDEX[status] ?? 0);

  if (rejected) {
    return (
      <div className="sol-steps">
        <div className="sol-step">
          <span className="sol-step-dot done">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </span>
          <span className="sol-step-label done">Recibida</span>
        </div>
        <div className="sol-step">
          <span className="sol-step-line rejected" />
          <span className="sol-step-dot rejected">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </span>
          <span className="sol-step-label rejected">Rechazada / no aplica</span>
        </div>
      </div>
    );
  }

  return (
    <div className="sol-steps">
      {FLOW_STEPS.map((s, i) => {
        const done = i < idx;
        const curr = i === idx;
        return (
          <div key={s.key} className="sol-step">
            {i > 0 && <span className={`sol-step-line${i <= idx ? ' on' : ''}`} />}
            <span className={`sol-step-dot${done ? ' done' : ''}${curr ? ' curr' : ''}`}>
              {done
                ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                : i + 1}
            </span>
            <span className={`sol-step-label${curr ? ' curr' : ''}${done ? ' done' : ''}`}>{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Detail Modal (área solicitante) ────────────────────────────────────────────

function UserSolicitudModal({ sol, open, onClose, onSaveInfo }) {
  const [info,   setInfo]   = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (sol) setInfo(sol.info_adicional || '');
    setSaving(false);
  }, [sol]);

  if (!open || !sol) return null;
  const st = STATUS_MAP[sol.status] || STATUS_MAP.recibido;

  const save = async () => {
    setSaving(true);
    try { await onSaveInfo(sol.id, info); } finally { setSaving(false); }
  };

  return (
    <div className="um-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sol-modal" style={{ maxWidth: 560 }}>
        <div className="sol-modal-header" style={{ borderBottom: `3px solid ${st.color}` }}>
          <div style={{ minWidth: 0 }}>
            <div className="sol-modal-title">{sol.title}</div>
            <div className="sol-modal-step">Enviada el {fmtDate(sol.created_at)}</div>
          </div>
          <button className="um-close" onClick={onClose}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="sol-modal-body">
          {/* Progreso de la solicitud */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text2)', marginBottom: 8 }}>
              Progreso de tu solicitud
            </div>
            <SolTimeline status={sol.status} />
            {sol.due_date && (
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8, textAlign: 'right' }}>
                Fecha requerida: {fmtDate(sol.due_date)}
              </div>
            )}
          </div>

          {sol.notes && (
            <div style={{ background: 'var(--accent-light)', border: '1px solid rgba(249,146,77,.25)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--accent)', marginBottom: 4 }}>
                Respuesta del equipo
              </div>
              <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>{sol.notes}</div>
            </div>
          )}

          <div className="um-field">
            <label className="um-label">
              Información adicional
              <span style={{ fontWeight: 400, color: 'var(--text3)' }}> · visible para el equipo</span>
            </label>
            <textarea className="um-input sol-textarea" rows={4}
              placeholder="Agrega contexto, aclaraciones o responde a lo que el equipo te pidió..."
              value={info} onChange={e => setInfo(e.target.value)} />
          </div>

          <div className="sol-modal-footer">
            <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>Cerrar</button>
            <button className="btn btn-primary" onClick={save} disabled={saving} style={{ flex: 2, justifyContent: 'center' }}>
              {saving ? <><span className="um-spinner"/>Guardando...</> : 'Guardar información'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function SolicitudesView({ user, showToast, users = [], onProjectCreated }) {
  const isAdmin = ['admin', 'leader_analytics'].includes(user?.role);

  const [solicitudes, setSolicitudes] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [newModal,    setNewModal]    = useState(false);
  const [manageModal, setManageModal] = useState(null);
  const [ownModal,    setOwnModal]    = useState(null);
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
    const sol = solicitudes.find(x => x.id === id);
    const updated = await solicitudesAPI.updateStatus(id, data);
    setSolicitudes(s => s.map(x => x.id === updated.id ? { ...x, ...updated } : x));
    setManageModal(null);

    // Auto-crear proyecto la primera vez que se asigna
    if (data.assigneeId && !sol?.project_created) {
      try {
        const project = await projectsAPI.create({
          name:        sol.title,
          description: sol.description || '',
          client:      sol.area || '',
          status:      STATUS_MAP_PROJECT[data.status] || 'backlog',
          priority:    PRIORITY_MAP_PROJECT[sol.priority || sol.urgencia] || 'mid',
          assigneeId:  data.assigneeId,
          dueDate:     sol.due_date || null,
          progress:    0,
          tipo:        data.tipoProyecto || 'automatizacion',
        });
        await solicitudesAPI.markProjectCreated(sol.id);
        setSolicitudes(s => s.map(x => x.id === sol.id ? { ...x, project_created: true } : x));
        onProjectCreated?.(project);
        showToast(`Proyecto "${project.name}" creado y asignado`, 'success');
      } catch (err) {
        console.error('Auto-create project failed:', err);
        showToast('Estado actualizado (no se pudo crear el proyecto)', 'error');
      }
    } else {
      showToast('Estado actualizado', 'success');
    }
  };

  const handleSaveInfo = async (id, info) => {
    try {
      const updated = await solicitudesAPI.updateInfo(id, { infoAdicional: info });
      setSolicitudes(s => s.map(x => x.id === updated.id ? { ...x, ...updated } : x));
      setOwnModal(null);
      showToast('Información agregada a la solicitud', 'success');
    } catch (err) {
      showToast(err.error || 'Error al guardar', 'error');
    }
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
    : solicitudes.filter(s => s.status === filter);

  const stats = {
    total:     solicitudes.length,
    recibido:  solicitudes.filter(s => s.status === 'recibido' || s.status === 'nueva').length,
    revision:  solicitudes.filter(s => ['en_revision','reunion_agendada'].includes(s.status)).length,
    aceptado:  solicitudes.filter(s => s.status === 'aceptado').length,
    convertido:solicitudes.filter(s => s.status === 'convertido' || s.status === 'completada').length,
  };

  if (loading) return (
    <div className="empty" style={{ paddingTop: 60 }}>Cargando solicitudes…</div>
  );

  return (
    <div className="sol-root">

      {/* Stats */}
      <div className="sol-stats">
        {[
          { key: 'all',       num: stats.total,      label: 'Total',          color: 'var(--accent)' },
          { key: 'recibido',  num: stats.recibido,   label: 'Recibidas',      color: '#a86040' },
          { key: 'en_revision',num: stats.revision,  label: 'En revisión',    color: '#7c3aed' },
          { key: 'aceptado',  num: stats.aceptado,   label: 'Aceptadas',      color: '#0891b2' },
          { key: 'convertido',num: stats.convertido, label: 'Convertidas',    color: '#16A34A' },
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
          {[{ key: 'all', label: 'Todas' }, ...STATUSES.map(s => ({ key: s, label: STATUS_MAP[s].label }))].map(({ key, label }) => (
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
            {filter === 'all' ? 'Sin solicitudes aún' : `Sin solicitudes "${STATUS_MAP[filter]?.label || filter}"`}
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
            const st = STATUS_MAP[sol.status] || STATUS_MAP.recibido;
            const pr = PRIORITY_MAP[sol.priority] || PRIORITY_MAP.media;
            return (
              <div key={sol.id}
                className="sol-card sol-card--clickable"
                style={{ '--sol-status-color': st.color }}
                onClick={() => isAdmin ? setManageModal(sol) : setOwnModal(sol)}>

                <div className="sol-card-top">
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
                  {sol.urgencia && (
                    <span className="sol-meta-chip"
                      style={{ background: PRIORITY_MAP[sol.urgencia]?.bg, color: PRIORITY_MAP[sol.urgencia]?.color }}>
                      {PRIORITY_MAP[sol.urgencia]?.label}
                    </span>
                  )}
                  {!sol.urgencia && (
                    <span className="sol-meta-chip" style={{ background: pr.bg, color: pr.color }}>{pr.label}</span>
                  )}
                  {sol.frecuencia && <span className="sol-meta-chip">{sol.frecuencia}</span>}
                  <span style={{ flex: 1 }} />
                  <span className="sol-card-date">
                    {fmtDate(sol.created_at)}
                    {sol.due_date && ` · Vence: ${fmtDate(sol.due_date)}`}
                  </span>
                </div>

                {sol.assignee_name && (
                  <div className="sol-card-assignee">
                    <span className={`sol-user-dot ${colorClass(sol.assignee_color_index)}`}>
                      {sol.assignee_initials}
                    </span>
                    <span className="sol-meta-chip">{sol.assignee_name}</span>
                    {sol.project_created && (
                      <span className="sol-meta-chip" style={{ background: '#D1FAE5', color: '#059669' }}>
                        ✓ Proyecto creado
                      </span>
                    )}
                  </div>
                )}

                {sol.notes && (
                  <div className="sol-card-notes">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    {sol.notes}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <NewSolicitudModal open={newModal} onClose={() => setNewModal(false)} onSave={handleCreate} />
      <UserSolicitudModal
        sol={ownModal}
        open={Boolean(ownModal)}
        onClose={() => setOwnModal(null)}
        onSaveInfo={handleSaveInfo}
      />
      <ManageModal
        sol={manageModal}
        open={Boolean(manageModal)}
        onClose={() => setManageModal(null)}
        onSave={handleUpdateStatus}
        onDelete={handleDelete}
        users={users}
      />
    </div>
  );
}
