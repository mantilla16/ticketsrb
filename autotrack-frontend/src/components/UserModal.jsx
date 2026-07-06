import { useState, useEffect } from 'react';

const ROLES = [
  { value: 'admin',    label: 'Administrador' },
  { value: 'engineer', label: 'Ingeniero'      },
  { value: 'user',     label: 'Usuario'        },
];

function pwStrength(pw) {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8)           s++;
  if (pw.length >= 12)          s++;
  if (/[A-Z]/.test(pw))         s++;
  if (/[0-9]/.test(pw))         s++;
  if (/[^A-Za-z0-9]/.test(pw))  s++;
  return s;
}
const STR_COLOR = ['', '#DC2626', '#F97316', '#EAB308', '#22C55E', '#16A34A'];
const STR_LABEL = ['', 'Muy débil', 'Débil', 'Regular', 'Buena', 'Fuerte'];

export default function UserModal({ open, user: editUser, onSave, onClose }) {
  const isEdit = !!editUser;

  const [form, setForm]     = useState({ name: '', email: '', password: '', role: 'engineer' });
  const [showPw, setShowPw] = useState(false);
  const [error, setError]   = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(isEdit
        ? { name: editUser.name, email: editUser.email, password: '', role: editUser.role || 'engineer' }
        : { name: '', email: '', password: '', role: 'engineer' }
      );
      setError('');
      setShowPw(false);
    }
  }, [open, editUser]);

  if (!open) return null;

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    setError('');

    if (!isEdit && pwStrength(form.password) < 2) {
      setError('La contraseña es demasiado débil.'); return;
    }

    setSaving(true);
    try {
      const data = { name: form.name, email: form.email, role: form.role };
      if (form.password) data.password = form.password;
      await onSave(data, editUser?.id);
    } catch (err) {
      setError(err.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const strength = pwStrength(form.password);

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <div className="modal-title">{isEdit ? 'Editar usuario' : 'Nuevo usuario'}</div>
          <button className="modal-close" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {error && <div className="login-error" style={{ margin: '0 0 14px' }}>{error}</div>}

        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">Nombre completo</label>
            <input className="form-input" type="text" placeholder="Ej. Juan Pérez" value={form.name} onChange={set('name')} required />
          </div>

          <div className="form-group">
            <label className="form-label">Correo electrónico</label>
            <input className="form-input" type="email" placeholder="correo@empresa.com" value={form.email} onChange={set('email')} required />
          </div>

          <div className="form-group">
            <label className="form-label">
              Contraseña
              {isEdit && <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 6, fontWeight: 400 }}>Dejar vacío para no cambiar</span>}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                type={showPw ? 'text' : 'password'}
                placeholder={isEdit ? '••••••••' : 'Mínimo 8 caracteres'}
                value={form.password}
                onChange={set('password')}
                required={!isEdit}
                style={{ paddingRight: 40 }}
              />
              <button type="button" onClick={() => setShowPw(v => !v)} style={{
                position:'absolute', right:11, top:'50%', transform:'translateY(-50%)',
                background:'none', border:'none', cursor:'pointer', padding:4, color:'var(--text3)',
              }}>
                {showPw
                  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
            {form.password && (
              <div style={{ marginTop: 7 }}>
                <div style={{ display:'flex', gap:3, marginBottom:4 }}>
                  {[1,2,3,4,5].map(i => (
                    <div key={i} style={{ flex:1, height:3, borderRadius:2, transition:'background .2s',
                      background: i <= strength ? STR_COLOR[strength] : 'var(--border)' }} />
                  ))}
                </div>
                <span style={{ fontSize:11, color: STR_COLOR[strength], fontWeight:600 }}>{STR_LABEL[strength]}</span>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Rol</label>
            <select className="form-input" value={form.role} onChange={set('role')}>
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          <div style={{ display:'flex', gap:10, marginTop:20 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} style={{ flex:1, justifyContent:'center' }}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex:2, justifyContent:'center' }}>
              {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear usuario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
