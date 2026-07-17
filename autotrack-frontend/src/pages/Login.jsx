import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';

const ALLOWED_DOMAIN = '@americana.edu.co';

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

const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

export default function Login() {
  const { loginGoogle } = useAuth();
  const [error, setError]   = useState('');
  const [locked, setLocked] = useState(false);
  const [googleId, setGoogleId] = useState(null);
  const [googleReady, setGoogleReady] = useState(false);
  const gBtnRef = useRef(null);

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
          setError(''); setLocked(false);
          try { await loginGoogle(resp.credential); }
          catch (err) {
            setError(err.error || 'No se pudo iniciar sesión con Google');
            if (err.locked) setLocked(true);
          }
        },
      });
      window.google.accounts.id.renderButton(gBtnRef.current, {
        theme: 'outline', size: 'large', width: 360, text: 'continue_with', locale: 'es', shape: 'pill',
      });
      setGoogleReady(true);
    };
    if (window.google?.accounts?.id) { init(); return; }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = init;
    document.body.appendChild(s);
  }, [googleId]);

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
            <div className="login-eyebrow">Bienvenido</div>
            <div className="login-card-title">Inicia sesión en AMBARC</div>
            <div className="login-card-rule" />

            {error && (
              <div className={`login-error${locked ? ' login-error--locked' : ''}`}>
                {locked && <LockIcon />}
                {error}
              </div>
            )}

            <div style={{ marginTop: 8 }}>
              {googleId ? (
                <>
                  <div ref={gBtnRef} style={{ display: 'flex', justifyContent: 'center', minHeight: 44 }} />
                  {!googleReady && (
                    <div style={{ textAlign: 'center', fontSize: 12.5, color: 'rgba(255,255,255,.35)', padding: '10px 0' }}>
                      Cargando inicio de sesión con Google…
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', textAlign: 'center', marginTop: 14 }}>
                    Usa tu cuenta institucional {ALLOWED_DOMAIN}
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,.45)', padding: '18px 0' }}>
                  El inicio de sesión con Google no está configurado en el servidor. Contacta al administrador.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
