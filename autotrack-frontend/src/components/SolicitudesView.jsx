export default function SolicitudesView({ user }) {
  return (
    <div className="sol-root">
      <div className="sol-hero">
        <div className="sol-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <line x1="9" y1="15" x2="15" y2="15"/>
          </svg>
        </div>
        <h2 className="sol-title">Solicitudes de Automatización</h2>
        <p className="sol-sub">
          Desde aquí podrás enviar requerimientos de automatización al equipo de Ingeniería,
          hacer seguimiento a tus solicitudes y ver el estado de cada una.
        </p>
        <div className="sol-soon-badge">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          Próximamente disponible
        </div>
      </div>

      <div className="sol-features">
        {[
          { icon: '📋', title: 'Enviar solicitud', desc: 'Describe el proceso que deseas automatizar y el equipo lo evaluará.' },
          { icon: '🔍', title: 'Hacer seguimiento', desc: 'Consulta el estado de tus solicitudes en tiempo real.' },
          { icon: '💬', title: 'Comunicación directa', desc: 'Recibe actualizaciones y comentarios del equipo asignado.' },
        ].map((f, i) => (
          <div key={i} className="sol-feature-card">
            <div className="sol-feature-icon">{f.icon}</div>
            <div className="sol-feature-title">{f.title}</div>
            <div className="sol-feature-desc">{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
