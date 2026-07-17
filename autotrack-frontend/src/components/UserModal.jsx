import { useState, useEffect } from 'react';

const ROLES = [
  {
    value: 'admin',
    label: 'Líder Automatización',
    desc: 'Acceso total — proyectos, equipo, solicitudes y configuración',
    color: '#92400E', bg: '#FEF3C7',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  },
  {
    value: 'leader_analytics',
    label: 'Líder Analítica',
    desc: 'Gestiona proyectos de analítica, asigna miembros y revisa solicitudes',
    color: '#5B21B6', bg: '#F5F3FF',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 4-4"/></svg>,
  },
  {
    value: 'engineer',
    label: 'Ingeniero Automatización',
    desc: 'Ve proyectos asignados, actualiza avance y agrega notas',
    color: '#3730A3', bg: '#EEF2FF',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
  },
  {
    value: 'member_analytics',
    label: 'Miembro Analítica',
    desc: 'Ve proyectos de analítica asignados y actualiza avance',
    color: '#0E7490', bg: '#ECFEFF',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9 9h.01M15 9h.01M9 15s1 1 3 1 3-1 3-1"/></svg>,
  },
  {
    value: 'manager',
    label: 'Gerente',
    desc: 'Ve el dashboard ejecutivo, historial y cronograma — solo lectura',
    color: '#047857', bg: '#ECFDF5',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>,
  },
  {
    value: 'user',
    label: 'Área Solicitante',
    desc: 'Solo puede enviar solicitudes y ver su estado',
    color: '#0369A1', bg: '#F0F9FF',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  },
];

const AVATAR_COLORS = ['#f9924d','#d4763a','#5a2807','#c4622d','#8a3a10'];

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || '?';
}

export default function UserModal({ open, user: editUser, onSave, onClose }) {
  const isEdit = !!editUser;

  const [form, setForm]     = useState({ name: '', email: '', role: 'engineer' });
  const [error, setError]   = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(isEdit
        ? { name: editUser.name, email: editUser.email, role: editUser.role || 'engineer' }
        : { name: '', email: '', role: 'engineer' }
      );
      setError('');
    }
  }, [open, editUser]);

  if (!open) return null;

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const data = { name: form.name, email: form.email, role: form.role };
      await onSave(data, editUser?.id);
    } catch (err) {
      setError(err.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const avatarIdx = isEdit ? (editUser.colorIndex ?? 0) : 0;
  const selectedRole = ROLES.find(r => r.value === form.role);

  return (
    <div className="um-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="um-modal">

        {/* Header */}
        <div className="um-header" style={{ background: selectedRole?.bg || '#EEF2FF' }}>
          <div className="um-header-avatar" style={{ background: AVATAR_COLORS[avatarIdx] }}>
            {form.name ? initials(form.name) : (isEdit ? editUser.initials : '?')}
          </div>
          <div className="um-header-info">
            <div className="um-header-title">
              {isEdit ? (form.name || editUser.name) : (form.name || 'Nuevo usuario')}
            </div>
            <div className="um-header-role" style={{ color: selectedRole?.color }}>
              {selectedRole?.label}
            </div>
          </div>
          <button className="um-close" onClick={onClose}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="um-body">
          {error && (
            <div className="um-error">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}

          <form onSubmit={submit}>
            {/* Name + Email */}
            <div className="um-row">
              <div className="um-field">
                <label className="um-label">Nombre completo</label>
                <div className="um-input-wrap">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  <input className="um-input" type="text" placeholder="Ej. Juan Pérez" value={form.name} onChange={set('name')} required />
                </div>
              </div>
              <div className="um-field">
                <label className="um-label">Correo electrónico</label>
                <div className="um-input-wrap">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  <input className="um-input" type="email" placeholder="correo@empresa.com" value={form.email} onChange={set('email')} required />
                </div>
              </div>
            </div>

            <div className="um-field">
              <div style={{ fontSize: 11.5, color: 'var(--text3)', background: 'var(--bg2, rgba(0,0,0,.03))', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                El acceso a AMBARC es solo con Google — no se define contraseña. {isEdit ? 'El usuario' : 'La persona'} entrará con su cuenta institucional {form.email ? `(${form.email})` : ''}.
              </div>
            </div>

            {/* Role selector */}
            <div className="um-field">
              <label className="um-label">Rol</label>
              <div className="um-roles">
                {ROLES.map(r => (
                  <button
                    key={r.value}
                    type="button"
                    className={`um-role-card${form.role === r.value ? ' um-role-card--active' : ''}`}
                    style={form.role === r.value ? { borderColor: r.color, background: r.bg } : {}}
                    onClick={() => setForm(f => ({ ...f, role: r.value }))}
                  >
                    <div className="um-role-icon" style={{ color: form.role === r.value ? r.color : 'var(--text3)' }}>
                      {r.icon}
                    </div>
                    <div className="um-role-label" style={{ color: form.role === r.value ? r.color : 'var(--text)' }}>
                      {r.label}
                    </div>
                    <div className="um-role-desc">{r.desc}</div>
                    {form.role === r.value && (
                      <div className="um-role-check" style={{ color: r.color }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="um-actions">
              <button type="button" className="btn btn-ghost" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 2, justifyContent: 'center' }}>
                {saving
                  ? <><span className="um-spinner"/>Guardando...</>
                  : isEdit ? 'Guardar cambios' : 'Crear usuario'
                }
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
