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

const PER_PAGE = 6;

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
    + ', ' + dt.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

const dateOnly = (d) => d ? String(d).slice(0, 10) : '';

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

function SolTimeline({ status, dates = {} }) {
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
          {dates.recibido && <span className="sol-step-date">{fmtDate(dates.recibido)}</span>}
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
        const stepDate = s.key === 'recibido' ? dates.recibido
          : s.key === 'reunion_agendada' ? dates.reunion
          : null;
        return (
          <div key={s.key} className="sol-step">
            {i > 0 && <span className={`sol-step-line${i <= idx ? ' on' : ''}`} />}
            <span className={`sol-step-dot${done ? ' done' : ''}${curr ? ' curr' : ''}`}>
              {done
                ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                : i + 1}
            </span>
            <span className={`sol-step-label${curr ? ' curr' : ''}${done ? ' done' : ''}`}>{s.label}</span>
            {curr
              ? <span className="sol-step-date curr">Actual</span>
              : stepDate && (done || curr)
                ? <span className="sol-step-date">{fmtDate(stepDate)}</span>
                : stepDate && s.key === 'reunion_agendada'
                  ? <span className="sol-step-date">{fmtDate(stepDate)}</span>
                  : null}
          </div>
        );
      })}
    </div>
  );
}

// ── Nueva Solicitud — página completa ──────────────────────────────────────────

const AREAS_LIST = [
  'Rectoría', 'Mercadeo', 'Admisiones', 'Financiamiento', 'Contabilidad',
  'Talento Humano', 'Bienestar', 'Centro de Idiomas', 'Innovación Educativa',
  'Internacionalización', 'Audiovisual y Diseño', 'Gestión TICS', 'Egresados', 'Virtualidad',
];

const IMPACTO_OPTIONS = [
  { value: '', label: 'Selecciona...' },
  { value: 'Alto',  label: 'Alto — ahorro de tiempo significativo' },
  { value: 'Medio', label: 'Medio — reducción de errores' },
  { value: 'Bajo',  label: 'Bajo — mejora de trazabilidad' },
];

const DESC_MAX = 1000;

function SecHead({ icon, num, title, opt }) {
  return (
    <div className="snp-sec-head">
      <span className="snp-sec-icon">{icon}</span>
      <span className="snp-sec-title">{num}. {title}{opt && <span style={{ fontWeight: 500, color: 'var(--text3)' }}> (opcional)</span>}</span>
    </div>
  );
}

const Req = () => <span style={{ color: '#EF4444' }}> *</span>;

function NewSolicitudPage({ open, onClose, onSave, defaultName = '', defaultEmail = '' }) {
  const [form, setForm] = useState({
    title: '', areaSel: '', areaOtra: '', nombre: defaultName, correos: defaultEmail,
    dueDate: '', description: '', frecuencia: '', urgencia: 'media', impacto: '',
    herramientas: '', file: null,
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const [drag,   setDrag]   = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        title: '', areaSel: '', areaOtra: '', nombre: defaultName, correos: defaultEmail,
        dueDate: '', description: '', frecuencia: '', urgencia: 'media', impacto: '',
        herramientas: '', file: null,
      });
      setError('');
      setSaving(false);
      setDrag(false);
    }
  }, [open, defaultName, defaultEmail]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const hoy = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const takeFile = (f) => {
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { setError('El archivo supera los 10 MB.'); return; }
    set('file', f);
  };

  const submit = async (e) => {
    e.preventDefault();
    const area = form.areaSel === 'otra' ? form.areaOtra.trim() : form.areaSel;
    if (!form.title.trim())      return setError('El nombre del proceso es obligatorio.');
    if (!area)                   return setError('Selecciona el área o departamento.');
    if (!form.nombre.trim())     return setError('El nombre del solicitante es obligatorio.');
    const mails = form.correos.split(',').map(c => c.trim()).filter(Boolean);
    if (!mails.length || mails.some(m => !m.includes('@')))
      return setError('Ingresa al menos un correo de contacto válido.');
    if (!form.dueDate)           return setError('Indica la fecha en que se requiere.');
    if (!form.description.trim()) return setError('Describe la necesidad.');
    if (!form.frecuencia)        return setError('Selecciona la frecuencia del proceso.');
    if (!form.impacto)           return setError('Selecciona el impacto esperado.');

    setError('');
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('title',             form.title.trim());
      fd.append('description',       form.description);
      fd.append('area',              area);
      fd.append('priority',          form.urgencia);
      fd.append('urgencia',          form.urgencia);
      fd.append('frecuencia',        form.frecuencia);
      fd.append('herramientas',      form.herramientas);
      fd.append('impacto',           form.impacto);
      fd.append('nombreSolicitante', form.nombre.trim());
      fd.append('correoSolicitante', mails.join(', '));
      fd.append('dueDate',           form.dueDate);
      if (form.file) fd.append('file', form.file);
      await onSave(fd);
    } catch (err) {
      setError(err.error || 'Error al enviar la solicitud');
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="um-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sol-modal" style={{ maxWidth: 760 }}>
        <div className="sol-modal-header">
          <div>
            <div className="sol-modal-title">Nueva solicitud</div>
            <div className="sol-modal-step">Cuéntanos tu necesidad para que el equipo pueda ayudarte.</div>
          </div>
          <button className="um-close" onClick={onClose}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="sol-modal-body">
          {error && <div className="um-error">{error}</div>}

          <form onSubmit={submit} className="snp-card" style={{ boxShadow: 'none', border: 'none', padding: 0, background: 'transparent' }}>

        {/* 1. Información general */}
        <SecHead num={1} title="Información general"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>} />
        <div className="snp-grid">
          <div>
            <label className="snp-label">Nombre del proceso o necesidad<Req /></label>
            <input className="form-input" placeholder="Ej: Liquidación de nómina mensual"
              value={form.title} onChange={e => set('title', e.target.value)} autoFocus />
          </div>
          <div>
            <label className="snp-label">Área / Departamento<Req /></label>
            <select className="form-select" value={form.areaSel} onChange={e => set('areaSel', e.target.value)}>
              <option value="">Selecciona el área</option>
              {AREAS_LIST.map(a => <option key={a} value={a}>{a}</option>)}
              <option value="otra">Otra…</option>
            </select>
            {form.areaSel === 'otra' && (
              <input className="form-input" style={{ marginTop: 8 }} placeholder="Escribe el nombre del área"
                value={form.areaOtra} onChange={e => set('areaOtra', e.target.value)} autoFocus />
            )}
          </div>
          <div>
            <label className="snp-label">Solicitante<Req /></label>
            <input className="form-input" placeholder="Tu nombre completo"
              value={form.nombre} onChange={e => set('nombre', e.target.value)} />
          </div>
          <div>
            <label className="snp-label">Correos de contacto<Req /></label>
            <input className="form-input" placeholder="correo@americana.edu.co, otro@americana.edu.co"
              value={form.correos} onChange={e => set('correos', e.target.value)} />
            <div className="snp-hint">Separa varios correos con comas — la respuesta llegará a todos</div>
          </div>
          <div>
            <label className="snp-label">Fecha de registro<Req /></label>
            <input className="form-input" value={hoy} disabled
              style={{ color: 'var(--text3)', cursor: 'not-allowed' }} />
          </div>
          <div>
            <label className="snp-label">Fecha en que se requiere<Req /></label>
            <input className="form-input" type="date"
              value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
          </div>
        </div>

        <div className="snp-divider" />

        {/* 2. Detalle de la necesidad */}
        <SecHead num={2} title="Detalle de la necesidad"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>} />
        <div>
          <label className="snp-label">Descripción de la necesidad<Req /></label>
          <div style={{ position: 'relative' }}>
            <textarea className="form-textarea" rows={4} maxLength={DESC_MAX}
              placeholder="Explica con detalle el proceso, el problema o lo que necesitas automatizar..."
              value={form.description} onChange={e => set('description', e.target.value)} />
            <span className="snp-counter">{form.description.length}/{DESC_MAX}</span>
          </div>
        </div>
        <div className="snp-grid3">
          <div>
            <label className="snp-label">Frecuencia del proceso<Req /></label>
            <select className="form-select" value={form.frecuencia} onChange={e => set('frecuencia', e.target.value)}>
              {FRECUENCIA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="snp-label">Urgencia<Req /></label>
            <div className="sol-priority-wrap">
              {['alta','media','baja'].map(pKey => (
                <button key={pKey} type="button"
                  className="sol-prio-btn"
                  style={form.urgencia === pKey
                    ? { borderColor: PRIORITY_MAP[pKey].color, background: PRIORITY_MAP[pKey].bg, color: PRIORITY_MAP[pKey].color, boxShadow: 'none' }
                    : {}}
                  onClick={() => set('urgencia', pKey)}>
                  {PRIORITY_MAP[pKey].label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="snp-label">Impacto esperado<Req /></label>
            <select className="form-select" value={form.impacto} onChange={e => set('impacto', e.target.value)}>
              {IMPACTO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        <div className="snp-divider" />

        {/* 3. Información adicional */}
        <SecHead num={3} title="Información adicional" opt
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>} />
        <div>
          <label className="snp-label">Herramientas actuales</label>
          <input className="form-input"
            placeholder="¿Qué herramientas usas hoy? (Excel, SAP, correo, Drive...)"
            value={form.herramientas} onChange={e => set('herramientas', e.target.value)} />
        </div>
        <div style={{ marginTop: 14 }}>
          <label className="snp-label">Archivos o documentos de apoyo</label>
          <label
            className={`snp-drop${drag ? ' snp-drop--over' : ''}`}
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); takeFile(e.dataTransfer.files?.[0]); }}
          >
            <input type="file" accept=".pdf,.doc,.docx,.xlsx,.xls,.png,.jpg,.jpeg"
              style={{ display: 'none' }}
              onChange={e => takeFile(e.target.files?.[0])} />
            {form.file ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>{form.file.name}</span>
                <button type="button" className="sol-file-remove"
                  onClick={e => { e.preventDefault(); set('file', null); }}>✕</button>
              </div>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 13 }}>Arrastra archivos aquí o haz clic para seleccionar</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>PDF, Excel, Word, imágenes (Máx. 10 MB por archivo)</div>
                </div>
              </>
            )}
          </label>
        </div>
          </form>

          <div className="snp-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="button" className="btn btn-primary" disabled={saving} onClick={submit}
              style={{ minWidth: 190, justifyContent: 'center' }}>
              {saving
                ? <><span className="um-spinner"/>Enviando…</>
                : <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="22" y1="2" x2="11" y2="13"/>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                    Enviar solicitud
                  </>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Manage Modal (líderes) — detalle a dos columnas ────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const NOTES_MAX = 500;

function KV({ k, children }) {
  return (
    <div className="sol-kv">
      <span className="sol-kv-k">{k}:</span>
      <span className="sol-kv-v">{children || '—'}</span>
    </div>
  );
}

function ManageModal({ sol, open, onClose, onSave, onDelete, users = [], canDelete = true }) {
  const [status,       setStatus]       = useState('recibido');
  const [notes,        setNotes]        = useState('');
  const [assigneeId,   setAssigneeId]   = useState('');
  const [tipoProyecto, setTipoProyecto] = useState('automatizacion');
  const [fechaReunion, setFechaReunion] = useState('');
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState('');
  const [delConfirm,   setDelConfirm]   = useState(false);

  useEffect(() => {
    if (sol) {
      setStatus(sol.status || 'recibido');
      setNotes(sol.notes || '');
      setAssigneeId(sol.assignee_id ? String(sol.assignee_id) : '');
      setTipoProyecto(sol.equipo === 'analitica' ? 'analitica' : sol.equipo === 'compartido' ? 'compartido' : 'automatizacion');
      setFechaReunion(dateOnly(sol.fecha_reunion));
    }
    setDelConfirm(false);
    setSaving(false);
    setError('');
  }, [sol]);

  if (!open || !sol) return null;

  const pr = PRIORITY_MAP[sol.priority] || PRIORITY_MAP.media;
  const ur = PRIORITY_MAP[sol.urgencia] || null;
  const st = STATUS_MAP[status] || STATUS_MAP.recibido;

  const assignables = tipoProyecto === 'analitica'
    ? users.filter(u => ['member_analytics', 'leader_analytics'].includes(u.role))
    : tipoProyecto === 'compartido'
      ? users.filter(u => ['engineer', 'admin', 'member_analytics', 'leader_analytics'].includes(u.role))
      : users.filter(u => u.role === 'engineer' || u.role === 'admin');

  const doSave = async (finalStatus) => {
    if (finalStatus === 'convertido' && !assigneeId) {
      setError('Para convertir en proyecto primero asigna un responsable.');
      return;
    }
    setSaving(true); setError('');
    try {
      await onSave(sol.id, {
        status: finalStatus, notes,
        assigneeId: assigneeId || null,
        tipoProyecto,
        equipo: tipoProyecto === 'analitica' ? 'analitica' : tipoProyecto === 'compartido' ? 'compartido' : 'automatizacion',
        fechaReunion: fechaReunion || null,
      });
    } finally { setSaving(false); }
  };

  return (
    <div className="um-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sol-manage-modal" style={{ width: 'min(880px, 100%)' }}>
        <div className="sol-modal-header">
          <div style={{ minWidth: 0 }}>
            <div className="sol-modal-title">{sol.title}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginTop: 7 }}>
              <span className="sol-badge" style={{ background: st.bg, color: st.color }}>{st.label}</span>
              {ur && <span className="sol-badge" style={{ background: ur.bg, color: ur.color }}>Urgencia: {ur.label}</span>}
              <span className="sol-badge" style={{ background: pr.bg, color: pr.color }}>Prioridad: {pr.label}</span>
            </div>
            <div className="sol-modal-step" style={{ marginTop: 7 }}>
              Enviada el {fmtDateTime(sol.created_at)}
              {sol.due_date && <> &nbsp;·&nbsp; Vence: {fmtDate(sol.due_date)}</>}
            </div>
          </div>
          <button className="um-close" onClick={onClose}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="sol-modal-body">
          {error && <div className="um-error">{error}</div>}

          <div className="sol-detail-grid">
            {/* ── Columna izquierda ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
              <div>
                <div className="sol-sec-title">1. Datos del solicitante</div>
                <KV k="Área solicitante">{sol.area}</KV>
                <KV k="Solicitante">{sol.nombre_solicitante || sol.user_name}</KV>
                <KV k="Correo">{sol.correo_solicitante}</KV>
              </div>

              <div>
                <div className="sol-sec-title">2. Necesidad reportada</div>
                <KV k="Necesidad">{sol.description}</KV>
                <KV k="Frecuencia">{sol.frecuencia}</KV>
                <KV k="Herramientas actuales">{sol.herramientas}</KV>
                <KV k="Impacto esperado">{sol.impacto}</KV>
                {sol.file_name && sol.file_path && (
                  <a
                    href={`${API_BASE}/uploads/solicitudes/${sol.file_path}?token=${localStorage.getItem('at-token')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="sol-file-download"
                    onClick={e => e.stopPropagation()}
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

              {sol.info_adicional && (
                <div>
                  <div className="sol-sec-title">3. Información adicional del solicitante</div>
                  <div className="sol-info-box">{sol.info_adicional}</div>
                </div>
              )}

              <div>
                <div className="sol-sec-title">{sol.info_adicional ? '4' : '3'}. Flujo de la solicitud</div>
                <SolTimeline status={status} dates={{ recibido: sol.created_at, reunion: fechaReunion || sol.fecha_reunion }} />
                <div className="sol-status-wrap" style={{ flexWrap: 'wrap', marginTop: 10 }}>
                  {STATUSES.map(s => (
                    <button key={s} type="button"
                      className="sol-status-btn"
                      style={status === s
                        ? { borderColor: STATUS_MAP[s].color, background: STATUS_MAP[s].bg, color: STATUS_MAP[s].color, boxShadow: 'none' }
                        : {}}
                      onClick={() => setStatus(s)}>
                      {STATUS_MAP[s].label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Columna derecha ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
              <div>
                <div className="sol-sec-title">{sol.info_adicional ? '5' : '4'}. Gestión interna</div>

                <label className="um-label" style={{ marginBottom: 5 }}>Convertir como</label>
                <div className="um-input-wrap" style={{ marginBottom: 12 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                    <polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                  </svg>
                  <select className="um-input" value={tipoProyecto}
                    onChange={e => setTipoProyecto(e.target.value)} style={{ cursor: 'pointer' }}>
                    {TIPO_CONVERT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>

                <label className="um-label" style={{ marginBottom: 5 }}>Responsable</label>
                <div className="um-input-wrap" style={{ marginBottom: 12 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                  <select className="um-input" value={assigneeId}
                    onChange={e => setAssigneeId(e.target.value)} style={{ cursor: 'pointer' }}>
                    <option value="">Sin asignar</option>
                    {assignables.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>

                <label className="um-label" style={{ marginBottom: 5 }}>Fecha tentativa de reunión</label>
                <div className="um-input-wrap">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <rect x="3" y="4" width="18" height="18" rx="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  <input className="um-input" type="date" value={fechaReunion}
                    onChange={e => setFechaReunion(e.target.value)} />
                </div>
              </div>

              <div>
                <div className="sol-sec-title">
                  {sol.info_adicional ? '6' : '5'}. Respuesta para el solicitante
                  <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--text3)' }}> (visible para el usuario)</span>
                </div>
                <textarea className="um-input sol-textarea" maxLength={NOTES_MAX}
                  placeholder="Tu solicitud está siendo revisada por el equipo de Automatización y Analítica..."
                  value={notes} onChange={e => setNotes(e.target.value)} rows={5}
                  style={{ width: '100%' }} />
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, textAlign: 'right' }}>
                  {NOTES_MAX - notes.length} caracteres restantes
                </div>
              </div>

              {/* Eliminar */}
              <div style={{ marginTop: 'auto' }}>
                {!canDelete ? null : !delConfirm ? (
                  <button type="button" className="pm-link" style={{ color: 'var(--text3)', fontSize: 12 }}
                    onClick={() => setDelConfirm(true)}>
                    Eliminar esta solicitud…
                  </button>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12.5, color: 'var(--text2)' }}>¿Eliminar definitivamente?</span>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => onDelete(sol.id)}>Sí, eliminar</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDelConfirm(false)}>No</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer de acciones */}
          <div className="sol-modal-footer" style={{ justifyContent: 'space-between', marginTop: 6 }}>
            <button type="button" className="btn btn-danger btn-sm" disabled={saving}
              onClick={() => doSave('rechazado')}>
              Rechazar
            </button>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-ghost" onClick={() => doSave(status)} disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
              <button className="btn btn-primary" onClick={() => doSave('convertido')} disabled={saving}>
                {saving ? <><span className="um-spinner"/>Procesando…</> : 'Convertir en proyecto'}
              </button>
            </div>
          </div>
        </div>
      </div>
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

  const save = async () => {
    setSaving(true);
    try { await onSaveInfo(sol.id, info); } finally { setSaving(false); }
  };

  return (
    <div className="um-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sol-modal" style={{ maxWidth: 560 }}>
        <div className="sol-modal-header">
          <div style={{ minWidth: 0 }}>
            <div className="sol-modal-title">{sol.title}</div>
            <div className="sol-modal-step">Enviada el {fmtDateTime(sol.created_at)}</div>
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
            <SolTimeline status={sol.status} dates={{ recibido: sol.created_at, reunion: sol.fecha_reunion }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
              {sol.fecha_reunion
                ? <span>Reunión tentativa: <b style={{ color: '#7c3aed' }}>{fmtDate(sol.fecha_reunion)}</b></span>
                : <span />}
              {sol.due_date && <span>Fecha requerida: {fmtDate(sol.due_date)}</span>}
            </div>
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

// ── Iconos de stats ────────────────────────────────────────────────────────────

const STAT_ICONS = {
  total:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>,
  recibido: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  revision: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  reunion:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  convertido:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="8.5 12.5 11 15 15.5 9.5"/></svg>,
};

// ── Main Component ─────────────────────────────────────────────────────────────

export default function SolicitudesView({ user, showToast, users = [], onProjectCreated }) {
  const isAdmin  = ['admin', 'leader_analytics', 'member_analytics'].includes(user?.role);
  const canDelete = ['admin', 'leader_analytics'].includes(user?.role);

  const [solicitudes, setSolicitudes] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [newModal,    setNewModal]    = useState(false);
  const [manageModal, setManageModal] = useState(null);
  const [ownModal,    setOwnModal]    = useState(null);
  const [filter,      setFilter]      = useState('all');
  const [search,      setSearch]      = useState('');
  const [fArea,       setFArea]       = useState('all');
  const [fUrg,        setFUrg]        = useState('all');
  const [fResp,       setFResp]       = useState('all');
  const [fDate,       setFDate]       = useState('');
  const [page,        setPage]        = useState(1);

  useEffect(() => {
    solicitudesAPI.getAll()
      .then(setSolicitudes)
      .catch(() => showToast('Error cargando solicitudes', 'error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { setPage(1); }, [filter, search, fArea, fUrg, fResp, fDate]);

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

  // ── Filtros ──
  const areas = [...new Set(solicitudes.map(s => (s.area || '').trim()).filter(Boolean))].sort();
  const q = search.trim().toLowerCase();

  const displayed = solicitudes
    .filter(s => filter === 'all' || s.status === filter)
    .filter(s => !q
      || (s.title || '').toLowerCase().includes(q)
      || (s.area || '').toLowerCase().includes(q)
      || (s.nombre_solicitante || '').toLowerCase().includes(q)
      || (s.user_name || '').toLowerCase().includes(q))
    .filter(s => fArea === 'all' || (s.area || '').trim() === fArea)
    .filter(s => fUrg === 'all' || s.urgencia === fUrg)
    .filter(s => fResp === 'all' || String(s.assignee_id) === fResp)
    .filter(s => !fDate || dateOnly(s.due_date) === fDate);

  const totalPages = Math.max(1, Math.ceil(displayed.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageItems = displayed.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);
  const from = displayed.length === 0 ? 0 : (safePage - 1) * PER_PAGE + 1;
  const to = Math.min(safePage * PER_PAGE, displayed.length);

  const hasAdv = fArea !== 'all' || fUrg !== 'all' || fResp !== 'all' || Boolean(fDate);
  const clearAdv = () => { setFArea('all'); setFUrg('all'); setFResp('all'); setFDate(''); };

  const assignableUsers = users.filter(u => ['engineer', 'admin', 'member_analytics', 'leader_analytics'].includes(u.role));

  const stats = {
    total:     solicitudes.length,
    recibido:  solicitudes.filter(s => s.status === 'recibido' || s.status === 'nueva').length,
    revision:  solicitudes.filter(s => ['en_revision', 'en_proceso'].includes(s.status)).length,
    reunion:   solicitudes.filter(s => s.status === 'reunion_agendada').length,
    convertido:solicitudes.filter(s => s.status === 'convertido' || s.status === 'completada').length,
  };

  if (loading) return (
    <div className="empty" style={{ paddingTop: 60 }}>Cargando solicitudes…</div>
  );

  return (
    <div className="sol-root">

      {/* Toolbar superior: búsqueda + nueva solicitud */}
      <div className="sol-toolbar" style={{ justifyContent: 'flex-end' }}>
        <div className="hist-search-wrap" style={{ flex: 1, maxWidth: 380 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input className="hist-search" placeholder="Buscar solicitud, área o solicitante…"
            value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button className="hist-search-clear" onClick={() => setSearch('')}>✕</button>}
        </div>
        <button className="btn btn-primary" onClick={() => setNewModal(true)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nueva solicitud
        </button>
      </div>

      {/* Stats */}
      <div className="sol-stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        {[
          { key: 'all',              num: stats.total,      label: 'Total',                  sub: 'solicitudes', color: '#F97316', ic: 'total' },
          { key: 'recibido',         num: stats.recibido,   label: 'Recibidas',              sub: 'nuevas',      color: '#a86040', ic: 'recibido' },
          { key: 'en_revision',      num: stats.revision,   label: 'En revisión',            sub: 'en proceso',  color: '#7c3aed', ic: 'revision' },
          { key: 'reunion_agendada', num: stats.reunion,    label: 'Reunión agendada',       sub: 'pendientes',  color: '#D97706', ic: 'reunion' },
          { key: 'convertido',       num: stats.convertido, label: 'Convertidas',            sub: 'en proyecto', color: '#16A34A', ic: 'convertido' },
        ].map(({ key, num, label, sub, color, ic }) => (
          <div key={key}
            className={`sol-stat-card${filter === key ? ' sol-stat-card--active' : ''}`}
            style={{ '--sol-stat-color': color }}
            onClick={() => setFilter(key)}>
            <span className="sol-stat-icon" style={{ background: `${color}16`, color }}>{STAT_ICONS[ic]}</span>
            <div className="sol-stat-num" style={{ color: 'var(--text)' }}>{num}</div>
            <div className="sol-stat-label">{label}</div>
            <div className="sol-stat-sub">{sub}</div>
          </div>
        ))}
      </div>

      {/* Chips de estado */}
      <div className="sol-filter-chips">
        {[{ key: 'all', label: 'Todas' }, ...STATUSES.map(s => ({ key: s, label: STATUS_MAP[s].label }))].map(({ key, label }) => (
          <button key={key}
            className={`sol-chip${filter === key ? ' sol-chip--active' : ''}`}
            onClick={() => setFilter(key)}>
            {label}
          </button>
        ))}
      </div>

      {/* Filtros avanzados (líderes) */}
      {isAdmin && (
        <div className="sol-adv no-print">
          <div className="sol-adv-item">
            <span className="sol-adv-label">Área solicitante</span>
            <select value={fArea} onChange={e => setFArea(e.target.value)}>
              <option value="all">Todas</option>
              {areas.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="sol-adv-item">
            <span className="sol-adv-label">Urgencia</span>
            <select value={fUrg} onChange={e => setFUrg(e.target.value)}>
              <option value="all">Todas</option>
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </select>
          </div>
          <div className="sol-adv-item">
            <span className="sol-adv-label">Responsable</span>
            <select value={fResp} onChange={e => setFResp(e.target.value)}>
              <option value="all">Todos</option>
              {assignableUsers.map(u => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
            </select>
          </div>
          <div className="sol-adv-item">
            <span className="sol-adv-label">Fecha requerida</span>
            <input type="date" value={fDate} onChange={e => setFDate(e.target.value)} />
          </div>
          {hasAdv && (
            <button className="kb-filter-clear" onClick={clearAdv}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ marginRight: 4, verticalAlign: -1 }}>
                <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
              </svg>
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      {/* List */}
      {pageItems.length === 0 ? (
        <div className="sol-empty">
          <div className="sol-empty-icon">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </div>
          <div className="sol-empty-title">
            {filter === 'all' && !q && !hasAdv
              ? (isAdmin ? 'Aún no han llegado solicitudes' : 'Aún no has enviado solicitudes')
              : 'Sin solicitudes que coincidan con los filtros'}
          </div>
          {!isAdmin && filter === 'all' && !q && (
            <>
              <div className="sol-empty-sub">
                Cuéntanos qué proceso necesitas automatizar y el equipo lo revisará.
              </div>
              <button className="btn btn-primary" onClick={() => setNewModal(true)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
                Enviar mi primera solicitud
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="sol-list">
          {pageItems.map(sol => {
            const st = STATUS_MAP[sol.status] || STATUS_MAP.recibido;
            const ur = PRIORITY_MAP[sol.urgencia] || null;
            const pr = PRIORITY_MAP[sol.priority] || PRIORITY_MAP.media;
            const openIt = () => isAdmin ? setManageModal(sol) : setOwnModal(sol);

            if (!isAdmin) {
              // ── Tarjeta simplificada del solicitante ──
              return (
                <div key={sol.id} className="sol-card sol-card--clickable"
                  style={{ '--sol-status-color': st.color }} onClick={openIt}>
                  <div className="sol-card-top">
                    <div className="sol-card-title" style={{ marginBottom: 0 }}>{sol.title}</div>
                    <span className="sol-badge" style={{ marginLeft: 'auto', background: st.bg, color: st.color }}>{st.label}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text3)', margin: '4px 0 12px' }}>
                    Enviada el {fmtDateTime(sol.created_at)}
                    {sol.due_date && <> &nbsp;·&nbsp; Vence: {fmtDate(sol.due_date)}</>}
                  </div>

                  <SolTimeline status={sol.status} dates={{ recibido: sol.created_at, reunion: sol.fecha_reunion }} />

                  {sol.notes && (
                    <div style={{ background: 'var(--accent-light)', borderRadius: 12, padding: '10px 14px', marginTop: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--accent)', marginBottom: 3 }}>
                        Respuesta del equipo
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.55 }}>{sol.notes}</div>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, flexWrap: 'wrap', gap: 8 }}>
                    <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); openIt(); }}>
                      Ver detalle
                    </button>
                    <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                      ¿Tienes información adicional?{' '}
                      <button className="pm-link" style={{ fontSize: 12 }}
                        onClick={e => { e.stopPropagation(); openIt(); }}>
                        Agregar comentario
                      </button>
                    </span>
                  </div>
                </div>
              );
            }

            // ── Tarjeta completa (líderes) ──
            return (
              <div key={sol.id} className="sol-card sol-card--clickable"
                style={{ '--sol-status-color': st.color }} onClick={openIt}>

                <div className="sol-card-top" style={{ alignItems: 'flex-start' }}>
                  <span className={`avatar-sm ${colorClass(sol.user_color_index)}`} style={{ flexShrink: 0 }}>
                    {sol.user_initials || (sol.title || '?')[0].toUpperCase()}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="sol-card-title" style={{ marginBottom: 2 }}>{sol.title}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {[sol.area, sol.nombre_solicitante || sol.user_name, sol.correo_solicitante].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span className="sol-badge" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                    {sol.due_date && (
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 5 }}>Vence: {fmtDate(sol.due_date)}</div>
                    )}
                  </div>
                </div>

                {sol.description && (
                  <div style={{ fontSize: 12.5, color: 'var(--text2)', margin: '10px 0 0', lineHeight: 1.5 }}>
                    <b style={{ color: 'var(--text)' }}>Necesidad:</b> {sol.description}
                  </div>
                )}

                {(sol.frecuencia || sol.herramientas || sol.impacto) && (
                  <div className="sol-tiles">
                    {sol.frecuencia && (
                      <div className="sol-tile">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                        <div><div className="sol-tile-k">Frecuencia</div><div className="sol-tile-v">{sol.frecuencia}</div></div>
                      </div>
                    )}
                    {sol.herramientas && (
                      <div className="sol-tile">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        <div><div className="sol-tile-k">Herramientas actuales</div><div className="sol-tile-v">{sol.herramientas}</div></div>
                      </div>
                    )}
                    {sol.impacto && (
                      <div className="sol-tile">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                        <div><div className="sol-tile-k">Impacto esperado</div><div className="sol-tile-v">{sol.impacto}</div></div>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginTop: 12 }}>
                  {ur && <span className="sol-badge" style={{ background: ur.bg, color: ur.color }}>Urgencia: {ur.label}</span>}
                  <span className="sol-badge" style={{ background: pr.bg, color: pr.color }}>Prioridad: {pr.label}</span>
                  <span className="sol-badge" style={{ background: '#EEF2FF', color: '#4F46E5' }}>
                    Responsable: {sol.assignee_name || 'Sin asignar'}
                  </span>
                  {sol.project_created && (
                    <span className="sol-badge" style={{ background: '#D1FAE5', color: '#059669' }}>✓ Proyecto creado</span>
                  )}
                  <span style={{ flex: 1 }} />
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--accent)' }}
                    onClick={e => { e.stopPropagation(); openIt(); }}>
                    Ver detalle
                  </button>
                </div>
              </div>
            );
          })}

          {/* Paginación */}
          <div className="sol-pager">
            <span className="sol-pager-info">
              Mostrando {from} a {to} de {displayed.length} solicitud{displayed.length !== 1 ? 'es' : ''}
            </span>
            <div className="sol-pager-btns">
              <button disabled={safePage <= 1} onClick={() => setPage(p => p - 1)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <span className="sol-pager-page">{safePage}</span>
              <button disabled={safePage >= totalPages} onClick={() => setPage(p => p + 1)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          </div>
        </div>
      )}

      <NewSolicitudPage
        open={newModal}
        onClose={() => setNewModal(false)}
        onSave={handleCreate}
        defaultName={user?.name || ''}
        defaultEmail={user?.email || ''}
      />
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
        canDelete={canDelete}
      />
    </div>
  );
}
