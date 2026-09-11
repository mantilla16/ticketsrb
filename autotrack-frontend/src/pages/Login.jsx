/* Pantalla de acceso.

   Dos columnas: a la izquierda quién es el sistema y qué resuelve; a la
   derecha una sola acción. El dominio institucional lo dicta el servidor
   (`AUTH_ALLOWED_DOMAIN`), así que aquí no hay ningún dominio escrito a mano. */

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import { ORG } from '../lib/tickets';
import { signIn, describeError } from '../lib/msal';
import Icon from '../components/ui/Icon';

const PILLARS = [
  { icon: 'send',   title: 'Radica en dos minutos',  desc: 'Un formulario corto y guiado, pensado para el trabajo de auditoría.' },
  { icon: 'clock',  title: 'Compromiso de atención', desc: 'Cada ticket nace con una fecha de respuesta según su prioridad.' },
  { icon: 'target', title: 'Trazabilidad completa',  desc: 'Del radicado a la entrega, con evidencia de cada paso.' },
];

export default function Login() {
  const { loginMicrosoft, loginDev } = useAuth();
  const [error,   setError]   = useState('');
  const [locked,  setLocked]  = useState(false);
  const [config,  setConfig]  = useState(null);
  const [signing, setSigning] = useState(false);

  /* Atajo de desarrollo: doble condición — build de dev y backend con
     ALLOW_DEV_LOGIN=true. En el bundle de producción no existe. */
  const [devUsers, setDevUsers] = useState(null);
  const [devEmail, setDevEmail] = useState('');

  useEffect(() => {
    authAPI.config()
      .then(c => {
        setConfig(c);
        if (import.meta.env.DEV && c.devLogin) {
          authAPI.devUsers()
            .then(us => { setDevUsers(us); setDevEmail(us[0]?.email || ''); })
            .catch(() => setDevUsers([]));
        }
      })
      .catch(() => setConfig({}));

    if (localStorage.getItem('at-idle-logout')) {
      localStorage.removeItem('at-idle-logout');
      setError('Tu sesión se cerró por inactividad. Vuelve a iniciar sesión.');
    }
  }, []);

  const msReady = Boolean(config?.msClientId && config?.msTenantId);
  const domain  = config?.allowedDomain;

  const entrar = async () => {
    setError(''); setLocked(false); setSigning(true);
    try {
      const idToken = await signIn(config);
      await loginMicrosoft(idToken);
    } catch (err) {
      // Los errores del backend traen `error`; los de MSAL, un código propio.
      setError(err?.error || describeError(err));
      if (err?.locked) setLocked(true);
      setSigning(false);
    }
  };

  return (
    <div className="lg-page">
      {/* ── Presentación ── */}
      <section className="lg-aside">
        <div className="lg-aside-inner">
          <div className="lg-brand">
            <img src="/logo-russell-bedford-white.svg" alt={`${ORG.name} ${ORG.city}`} />
            <div className="lg-brand-city">{ORG.city}</div>
          </div>

          <h1 className="lg-headline">
            La mesa de servicio<br />de nuestros <em>auditores</em>.
          </h1>
          <p className="lg-lede">
            Un solo lugar para pedir apoyo en papeles de trabajo, analítica de datos y
            automatización — y para saber, en todo momento, en qué va cada solicitud.
          </p>

          <ul className="lg-pillars">
            {PILLARS.map(p => (
              <li key={p.title}>
                <span className="lg-pillar-icon"><Icon name={p.icon} size={16} /></span>
                <div>
                  <strong>{p.title}</strong>
                  <span>{p.desc}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <footer className="lg-aside-foot">
          {ORG.name} {ORG.city} · Uso interno
        </footer>
      </section>

      {/* ── Acceso ── */}
      <section className="lg-panel">
        <div className="lg-card">
          <h2 className="lg-card-title">Iniciar sesión</h2>
          <p className="lg-card-sub">
            {domain
              ? <>Accede con tu cuenta institucional <strong>@{domain}</strong>. Si es tu primera vez, la cuenta se crea sola.</>
              : <>Accede con tu cuenta institucional. Si es tu primera vez, la cuenta se crea sola.</>}
          </p>

          {error && (
            <div className="rb-alert" data-tone="danger" role="alert" style={{ marginBottom: 16 }}>
              <Icon name={locked ? 'shield' : 'alert'} size={15} />
              <div>{error}</div>
            </div>
          )}

          {config === null ? (
            <div className="rb-skeleton" style={{ height: 44 }} />
          ) : msReady ? (
            <button type="button" className="lg-ms-btn" onClick={entrar} disabled={signing}>
              {signing
                ? <span className="rb-spinner" />
                : <svg width="18" height="18" viewBox="0 0 23 23" aria-hidden="true">
                    <rect x="1"  y="1"  width="10" height="10" fill="#F25022" />
                    <rect x="12" y="1"  width="10" height="10" fill="#7FBA00" />
                    <rect x="1"  y="12" width="10" height="10" fill="#00A4EF" />
                    <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
                  </svg>}
              {signing ? 'Conectando con Microsoft…' : 'Iniciar sesión con Microsoft'}
            </button>
          ) : (
            <div className="rb-alert" data-tone="warning">
              <Icon name="alert" size={15} />
              <div>El inicio de sesión con Microsoft no está configurado en el servidor. Contacta al administrador de la mesa.</div>
            </div>
          )}

          {/* ── Acceso local de desarrollo ──
              El `import.meta.env.DEV &&` va aquí a propósito: Vite lo reemplaza
              por `false` al compilar y Rollup elimina todo el bloque del bundle. */}
          {import.meta.env.DEV && devUsers && (
            <div className="lg-dev">
              <div className="lg-dev-title">Acceso local de desarrollo</div>
              {devUsers.length === 0 ? (
                <p className="rb-hint">
                  No hay usuarios en la base. Corre <code>npm run seed:local</code> en{' '}
                  <code>autotrack-backend</code> y recarga.
                </p>
              ) : (
                <>
                  <select className="rb-select" value={devEmail} onChange={e => setDevEmail(e.target.value)}>
                    {devUsers.map(u => <option key={u.email} value={u.email}>{u.name} — {u.role}</option>)}
                  </select>
                  <button
                    type="button" className="rb-btn rb-btn--secondary rb-btn--block"
                    style={{ marginTop: 8 }}
                    onClick={async () => {
                      setError(''); setLocked(false);
                      try { await loginDev(devEmail); }
                      catch (err) { setError(err.error || 'No se pudo entrar con el atajo local'); }
                    }}
                  >
                    Entrar sin Microsoft
                  </button>
                </>
              )}
            </div>
          )}

          <p className="lg-legal">
            El acceso queda registrado. Al continuar aceptas las políticas internas
            de tratamiento de información de {ORG.name} {ORG.city}.
          </p>
        </div>
      </section>
    </div>
  );
}
