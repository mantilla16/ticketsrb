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

const IC = (path) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{path}</svg>
);
const FEATURES = [
  {
    icon: IC(<><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></>),
    title: 'Seguimiento en tiempo real',
    desc: 'Monitorea el progreso de tus proyectos al instante.',
  },
  {
    icon: IC(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>),
    title: 'Colaboración',
    desc: 'Trabaja con tu equipo de forma integrada y segura.',
  },
  {
    icon: IC(<><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></>),
    title: 'Reportes',
    desc: 'Toma decisiones con datos claros y confiables.',
  },
];

const MailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/>
  </svg>
);
const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

export default function Login() {
  const { login, register, loginGoogle } = useAuth();
  const [tab, setTab]       = useState('login');
  const [form, setForm]     = useState({ name: '', email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError]   = useState('');
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleId, setGoogleId] = useState(null);
  const gBtnRef = useRef(null);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const switchTab = (t) => { setTab(t); setError(''); setLocked(false); };

  const handleForgot = () => {
    setLocked(false);
    setError('Para restablecer tu contraseña, contacta al administrador del sistema.');
  };

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
        theme: 'outline', size: 'large', width: 360, text: 'continue_with', locale: 'es', shape: 'pill',
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
    <div className="login-page login-page--split">
      <div className="login-split">
        {/* ── Columna izquierda: branding ── */}
        <div className="login-left">
          <span className="login-dots" aria-hidden="true" />
          <svg className="login-wave" viewBox="0 0 600 300" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="waveGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#F97316" stopOpacity=".55" />
                <stop offset="100%" stopColor="#F97316" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0,180 C120,120 180,220 320,160 C420,120 480,200 600,140 L600,300 L0,300 Z" fill="url(#waveGrad)" />
          </svg>

          <div className="login-anim" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', position: 'relative', marginBottom: 34 }}>
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <span className="login-logo-glow" />
              <img src="/logo-symbol-192.png" alt="" className="login-logo-float" style={{ width: 64, height: 64, objectFit: 'contain' }} />
            </div>
            <div className="login-logo" style={{ fontSize: 26 }}>AMBAR<span>C</span></div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>Gestión de Proyectos</div>
          </div>

          <h1 className="login-anim login-hero-title" style={{ animationDelay: '70ms' }}>
            Gestiona tus proyectos<br />con <span>claridad</span>.
          </h1>
          <p className="login-anim login-hero-sub" style={{ animationDelay: '130ms' }}>
            Planifica, colabora y da seguimiento a cada detalle desde un solo lugar.
          </p>

          <div className="login-features">
            {FEATURES.map((f, i) => (
              <div key={f.title} className="login-anim login-feature" style={{ animationDelay: `${190 + i * 70}ms` }}>
                <div className="login-feature-icon">{f.icon}</div>
                <div className="login-feature-title">{f.title}</div>
                <div className="login-feature-desc">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Columna derecha: formulario ── */}
        <div className="login-right">
          <div className="login-box">
            <div className="login-eyebrow">{tab === 'login' ? 'Bienvenido' : 'Únete a AMBARC'}</div>
            <div className="login-card-title">{tab === 'login' ? 'Inicia sesión en AMBARC' : 'Crea tu cuenta en AMBARC'}</div>
            <div className="login-card-rule" />

            {error && (
              <div className={`login-error${locked ? ' login-error--locked' : ''}`}>
                {locked && <LockIcon />}
                {error}
              </div>
            )}

            <form onSubmit={submit}>
              {tab === 'register' && (
                <div className="form-group">
                  <label className="form-label">Nombre completo</label>
                  <input className="form-input" type="text" placeholder="Ej. Bleiner Morales" value={form.name} onChange={set('name')} required />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Correo electrónico</label>
                <div className="login-input-wrap">
                  <span className="login-input-icon"><MailIcon /></span>
                  <input className="form-input has-icon" type="email" placeholder="correo@americana.edu.co" value={form.email} onChange={set('email')} required />
                </div>
                {tab === 'register' && (
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginTop: 5 }}>
                    Solo correos institucionales {ALLOWED_DOMAIN}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Contraseña</label>
                <div className="login-input-wrap">
                  <span className="login-input-icon"><LockIcon /></span>
                  <input
                    className="form-input has-icon"
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

                {tab === 'login' && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'rgba(255,255,255,.5)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                        style={{ accentColor: 'var(--accent)', width: 14, height: 14, cursor: 'pointer' }} />
                      Recordarme
                    </label>
                    <button type="button" onClick={handleForgot}
                      style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                )}
              </div>

              <button
                className="btn btn-primary"
                type="submit"
                disabled={loading || locked}
                style={{ width: '100%', justifyContent: 'center', marginTop: 8, padding: '11px 18px', fontSize: 14 }}
              >
                {loading ? 'Procesando...' : tab === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
              </button>
            </form>

            {/* Google Sign-In */}
            {googleId && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0 14px' }}>
                  <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.1)' }} />
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,.3)' }}>o</span>
                  <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.1)' }} />
                </div>
                <div ref={gBtnRef} style={{ display: 'flex', justifyContent: 'center' }} />
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.25)', textAlign: 'center', marginTop: 8 }}>
                  Solo cuentas de Google {ALLOWED_DOMAIN}
                </div>
              </div>
            )}

            {tab === 'login' ? (
              <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--text3)' }}>
                ¿No tienes cuenta?{' '}
                <button onClick={() => switchTab('register')} style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12, fontFamily: 'var(--font)' }}>
                  Regístrate aquí
                </button>
              </p>
            ) : (
              <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--text3)' }}>
                ¿Ya tienes cuenta?{' '}
                <button onClick={() => switchTab('login')} style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12, fontFamily: 'var(--font)' }}>
                  Inicia sesión
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
