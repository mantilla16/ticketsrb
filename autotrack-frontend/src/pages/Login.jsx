import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';

const ALLOWED_DOMAIN = '@americana.edu.co';

function pwStrength(pw) {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8)  s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s; // 0–5
}
const STR_LABEL = ['', 'Muy débil', 'Débil', 'Regular', 'Buena', 'Fuerte'];
const STR_COLOR = ['', '#DC2626', '#F97316', '#EAB308', '#22C55E', '#16A34A'];

export default function Login() {
  const { login, register, loginGoogle } = useAuth();
  const [tab, setTab]       = useState('login');
  const [form, setForm]     = useState({ name: '', email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [error, setError]   = useState('');
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleId, setGoogleId] = useState(null);
  const gBtnRef = useRef(null);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const switchTab = (t) => { setTab(t); setError(''); setLocked(false); };

  // Google Sign-In — solo si el servidor tiene configurado el client ID
  useEffect(() => {
    authAPI.config().then(c => setGoogleId(c.googleClientId)).catch(() => {});
    if (localStorage.getItem('at-idle-logout')) {
      localStorage.removeItem('at-idle-logout');
      setError('Tu sesión se cerró por inactividad. Vuelve a iniciar sesión.');
    }
  }, []);

  useEffect(() => {
    if (!googleId || !gBtnRef.current) return;
    const init = () => {
      window.google.accounts.id.initialize({
        client_id: googleId,
        hd: 'americana.edu.co',
        callback: async (resp) => {
          setError('');
          try { await loginGoogle(resp.credential); }
          catch (err) { setError(err.error || 'No se pudo iniciar sesión con Google'); }
        },
      });
      window.google.accounts.id.renderButton(gBtnRef.current, {
        theme: 'filled_black', size: 'large', width: 316, text: 'continue_with', locale: 'es', shape: 'pill',
      });
    };
    if (window.google?.accounts?.id) { init(); return; }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = init;
    document.body.appendChild(s);
  }, [googleId]);

  const submit = async e => {
    e.preventDefault();
    setError(''); setLocked(false); setLoading(true);
    try {
      if (tab === 'login') {
        await login(form.email, form.password);
      } else {
        if (!form.name.trim()) { setError('El nombre es requerido'); setLoading(false); return; }
        if (!form.email.toLowerCase().endsWith(ALLOWED_DOMAIN)) {
          setError(`Solo se permiten correos institucionales ${ALLOWED_DOMAIN}`);
          setLoading(false); return;
        }
        if (pwStrength(form.password) < 2) {
          setError('La contraseña es demasiado débil. Usa al menos 8 caracteres con letras y números.');
          setLoading(false); return;
        }
        await register(form.name, form.email, form.password);
      }
    } catch (err) {
      const msg = err.error || err.errors?.[0]?.msg || 'Error al procesar la solicitud';
      setError(msg);
      if (err.locked) setLocked(true);
    } finally {
      setLoading(false);
    }
  };

  const strength = pwStrength(form.password);

  return (
    <div className="login-page">
      <div className="login-box" style={{ position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div className="login-anim" style={{ display: 'flex', justifyContent: 'center', marginBottom: 16, position: 'relative' }}>
          <span className="login-logo-glow" />
          <img src="/logo-symbol-192.png" alt="" className="login-logo-float" style={{ width: 60, height: 60, objectFit: 'contain' }} />
        </div>
        <div className="login-anim" style={{ textAlign: 'center', marginBottom: 20, animationDelay: '70ms' }}>
          <div className="login-logo" style={{ fontSize: 26 }}>AMBAR<span>C</span></div>
          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.35)', marginTop: 2, letterSpacing: '.04em' }}>GESTIÓN DE PROYECTOS</div>
        </div>

        <div className="login-anim login-tabs" style={{ animationDelay: '140ms' }}>
          <button className={`login-tab${tab === 'login' ? ' active' : ''}`} onClick={() => switchTab('login')}>
            Iniciar sesión
          </button>
          <button className={`login-tab${tab === 'register' ? ' active' : ''}`} onClick={() => switchTab('register')}>
            Registrarse
          </button>
        </div>

        {error && (
          <div className={`login-error${locked ? ' login-error--locked' : ''}`}>
            {locked && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            )}
            {error}
          </div>
        )}

        <form onSubmit={submit} className="login-anim" style={{ animationDelay: '200ms' }}>
          {tab === 'register' && (
            <div className="form-group">
              <label className="form-label">Nombre completo</label>
              <input className="form-input" type="text" placeholder="Ej. Bleiner Morales" value={form.name} onChange={set('name')} required />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Correo electrónico</label>
            <input className="form-input" type="email" placeholder="correo@americana.edu.co" value={form.email} onChange={set('email')} required />
            {tab === 'register' && (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginTop: 5 }}>
                Solo correos institucionales {ALLOWED_DOMAIN}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Contraseña</label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                type={showPw ? 'text' : 'password'}
                placeholder="••••••••"
                value={form.password}
                onChange={set('password')}
                required
                style={{ paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                style={{
                  position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                  color: 'rgba(255,255,255,.3)',
                }}
              >
                {showPw ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>

            {/* Password strength — only on register */}
            {tab === 'register' && form.password && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', gap: 4, marginBottom: 5 }}>
                  {[1,2,3,4,5].map(i => (
                    <div
                      key={i}
                      style={{
                        flex: 1, height: 3, borderRadius: 2,
                        background: i <= strength ? STR_COLOR[strength] : 'rgba(255,255,255,.1)',
                        transition: 'background .25s',
                      }}
                    />
                  ))}
                </div>
                <div style={{ fontSize: 11, color: STR_COLOR[strength], fontWeight: 600, transition: 'color .25s' }}>
                  {STR_LABEL[strength]}
                </div>
              </div>
            )}
          </div>

          <button
            className="btn btn-primary"
            type="submit"
            disabled={loading || locked}
            style={{ width: '100%', justifyContent: 'center', marginTop: 8, padding: '11px 18px', fontSize: 14 }}
          >
            {loading ? 'Procesando...' : tab === 'login' ? 'Entrar al sistema' : 'Crear cuenta'}
          </button>
        </form>

        {/* Google Sign-In */}
        {googleId && (
          <div className="login-anim" style={{ animationDelay: '260ms' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0 14px' }}>
              <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.1)' }} />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>o continúa con</span>
              <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.1)' }} />
            </div>
            <div ref={gBtnRef} style={{ display: 'flex', justifyContent: 'center' }} />
            <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.25)', textAlign: 'center', marginTop: 8 }}>
              Solo cuentas de Google {ALLOWED_DOMAIN}
            </div>
          </div>
        )}

        {tab === 'login' && (
          <p className="login-anim" style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--text3)', animationDelay: '320ms' }}>
            ¿No tienes cuenta?{' '}
            <button onClick={() => switchTab('register')} style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12, fontFamily: 'var(--font)' }}>
              Regístrate aquí
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
