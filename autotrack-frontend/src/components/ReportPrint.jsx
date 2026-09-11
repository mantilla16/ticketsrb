/* Informe PDF — se muestra únicamente al imprimir (Exportar → guardar como PDF) */

const TIPO_INFO = {
  automatizacion:  { label: 'Automatización', color: 'var(--rb-navy)', bg: 'var(--rb-navy-tint)' },
  analitica:       { label: 'Analítica',       color: '#7c3aed', bg: 'var(--rb-violet-bg)' },
  compartido:      { label: 'Compartidos',     color: '#0B6E80', bg: '#E4F5F8' },
  asignacion_flash:{ label: 'Flash',           color: 'var(--rb-warning)', bg: 'var(--rb-warning-bg)' },
};

const fmtShort = (d) => d ? new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

function Spark({ values, color }) {
  const max = Math.max(...values, 1);
  const W = 120, H = 26, n = values.length;
  const pts = values.map((v, i) => `${(W / (n - 1)) * i},${(H - (v / max) * H * 0.8 - H * 0.1).toFixed(1)}`).join(' ');
  const last = pts.split(' ').pop().split(',');
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="2.6" fill={color} />
    </svg>
  );
}

function PageShell({ title, periodLabel, page, children }) {
  return (
    <div className="rp-page">
      <div className="rp-head">
        <div className="rp-brand">
          <img src="/logo-russell-bedford.svg" alt="Russell Bedford" className="rp-brand-icon" />
        </div>
        <span className="rp-period">{periodLabel}</span>
      </div>
      <h1 className="rp-title">{title}</h1>
      <div className="rp-sub">Mesa de Servicio · Russell Bedford Barranquilla</div>
      <hr className="rp-rule" />
      <div className="rp-body">{children}</div>
      <div className="rp-foot">Página {page}</div>
    </div>
  );
}

const RP_ICON = {
  total:    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  progress: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.2-8.56"/><polyline points="21 3 21 9 15 9"/></svg>,
  standby:  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>,
  testing:  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6M10 3v6l-5.5 9.5a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9V3"/></svg>,
  done:     <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="8.5 12.5 11 15 15.5 9.5"/></svg>,
  backlog:  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>,
  soporte:  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>,
  cancelado:<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
  inbox:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>,
  clock:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>,
  cal:      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  check:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="8.5 12.5 11 15 15.5 9.5"/></svg>,
  person:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
};

export default function ReportPrint({ projects, users, solicitudes = [], periodLabel = 'Todo el portafolio' }) {
  const cnt = { backlog: 0, progress: 0, standby: 0, testing: 0, done: 0, soporte: 0, cancelado: 0 };
  const prCnt = { high: 0, mid: 0, low: 0 };
  const tipoCnt = { automatizacion: 0, analitica: 0, compartido: 0, asignacion_flash: 0 };
  const today = new Date(); today.setHours(0, 0, 0, 0);

  projects.forEach(p => {
    if (cnt[p.status] !== undefined) cnt[p.status]++;
    if (prCnt[p.priority || 'mid'] !== undefined) prCnt[p.priority || 'mid']++;
    const t = p.tipo || 'automatizacion';
    if (tipoCnt[t] !== undefined) tipoCnt[t]++;
  });
  const total = projects.length;
  const maxPr = Math.max(1, ...Object.values(prCnt));

  const flat = (v) => [v * .5, v * .7, v * .55, v * .8, v * .7, v * .9, v];

  const kpis = [
    { l: 'Total',       v: total,        c: 'var(--rb-navy)', ic: 'total' },
    { l: 'En proceso',  v: cnt.progress, c: 'var(--rb-navy)', ic: 'progress' },
    { l: 'En standby',  v: cnt.standby,  c: 'var(--rb-n-400)', ic: 'standby' },
    { l: 'En testing',  v: cnt.testing,  c: 'var(--rb-warning)', ic: 'testing' },
    { l: 'Finalizados', v: cnt.done,     c: 'var(--rb-success)', ic: 'done' },
    { l: 'Por hacer',   v: cnt.backlog,  c: 'var(--rb-neutral)', ic: 'backlog' },
    { l: 'Soporte',     v: cnt.soporte,  c: 'var(--rb-danger)', ic: 'soporte' },
    { l: 'Cancelados',  v: cnt.cancelado,c: 'var(--rb-danger)', ic: 'cancelado' },
  ];

  // Carga por persona
  const team = users
    .filter(u => ['engineer', 'member_analytics'].includes(u.role))
    .map(u => {
      const assigned = projects.filter(p => (p.assigneeIds || [p.assigneeId]).includes(u.id));
      const active   = assigned.filter(p => ['progress', 'testing'].includes(p.status)).length;
      const pct      = assigned.length ? Math.round(active / assigned.length * 100) : 0;
      return { u, total: assigned.length, pct };
    })
    .sort((a, b) => b.total - a.total);

  // Entregas próximas
  const upcoming = projects
    .filter(p => p.dueDate && p.status !== 'done')
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 6);

  const solStats = {
    recibidas:   solicitudes.filter(s => ['recibido', 'nueva'].includes(s.status)).length,
    revision:    solicitudes.filter(s => s.status === 'en_revision').length,
    reunion:     solicitudes.filter(s => s.status === 'reunion_agendada').length,
    convertidas: solicitudes.filter(s => ['convertido', 'completada'].includes(s.status)).length,
  };
  const solTotal = solicitudes.length;
  const convRate = solTotal ? Math.round(solStats.convertidas / solTotal * 100) : 0;

  const PR_BADGE = {
    high: { l: 'Alta',  c: 'var(--rb-danger)', bg: 'var(--rb-danger-bg)' },
    mid:  { l: 'Media', c: 'var(--rb-navy)', bg: 'var(--rb-navy-tint)' },
    low:  { l: 'Baja',  c: 'var(--rb-success)', bg: 'var(--rb-success-bg)' },
  };

  return (
    <div className="print-report">

      {/* ══ Página 1 — Informe de seguimiento ══ */}
      <PageShell title="Informe de seguimiento" periodLabel={periodLabel} page={1}>
        <div className="rp-section-title">Resumen ejecutivo</div>
        <div className="rp-kpis">
          {kpis.map(({ l, v, c, ic }) => (
            <div key={l} className="rp-kpi">
              <span className="rp-kpi-icon" style={{ background: `${c}16`, color: c }}>{RP_ICON[ic]}</span>
              <div className="rp-kpi-label">{l}</div>
              <div className="rp-kpi-num">{v}</div>
              <div className="rp-kpi-unit">{v === 1 ? 'proyecto' : 'proyectos'}</div>
              <Spark values={flat(Math.max(v, 1))} color={c} />
            </div>
          ))}
        </div>

        <div className="rp-section-title">Áreas del equipo</div>
        <div className="rp-chips">
          {Object.entries(TIPO_INFO).map(([k, info]) => (
            tipoCnt[k] > 0 || k !== 'asignacion_flash' ? (
              <span key={k} className="rp-chip" style={{ background: info.bg, color: info.color }}>
                {info.label} <b>{tipoCnt[k]}</b>
              </span>
            ) : null
          ))}
        </div>

        <div className="rp-card">
          <div className="rp-card-title">Distribución de proyectos</div>
          <div className="rp-mini-label">Por prioridad</div>
          {[['high', 'Alta', 'var(--rb-danger)'], ['mid', 'Media', 'var(--rb-navy)'], ['low', 'Baja', 'var(--rb-success)']].map(([k, l, c]) => (
            <div key={k} className="rp-bar-row">
              <span className="rp-bar-label">{l}</span>
              <span className="rp-bar-track"><span className="rp-bar-fill" style={{ width: `${Math.round(prCnt[k] / maxPr * 100)}%`, background: c }} /></span>
              <span className="rp-bar-val">{prCnt[k]} ({total ? Math.round(prCnt[k] / total * 100) : 0}%)</span>
            </div>
          ))}
        </div>
      </PageShell>

      {/* ══ Página 2 — Detalle del equipo ══ */}
      <PageShell title="Detalle del equipo" periodLabel={periodLabel} page={2}>
        <div className="rp-section-head">
          <span className="rp-section-icon">{RP_ICON.person}</span>
          <span className="rp-section-title" style={{ margin: 0 }}>Carga por persona</span>
        </div>
        <div className="rp-mini-label" style={{ marginBottom: 14 }}>Tamaño = proyectos activos &nbsp;·&nbsp; % = intensidad de carga</div>

        <div className="rp-people">
          {team.map(({ u, total: t, pct }) => (
            <div key={u.id} className="rp-person">
              <div className="rp-person-name">{u.name.split(' ')[0]}</div>
              <div className="rp-person-num">{t}</div>
              <div className="rp-person-pct">{pct}%</div>
              <div className="rp-person-bar"><span style={{ width: `${pct}%` }} /></div>
            </div>
          ))}
        </div>

        <div className="rp-legend">
          <span><i style={{ background: 'var(--rb-danger)' }} /> Alta carga (&gt;70%)</span>
          <span><i style={{ background: 'var(--rb-navy)' }} /> Media (40–70%)</span>
          <span><i style={{ background: 'var(--rb-success)' }} /> Baja (&lt;40%)</span>
          <span><i style={{ background: '#B8B0A8' }} /> Sin carga</span>
        </div>
      </PageShell>

      {/* ══ Página 3 — Entregas y solicitudes ══ */}
      <PageShell title="Entregas y solicitudes" periodLabel={periodLabel} page={3}>
        <div className="rp-section-title">Entregas próximas</div>
        <table className="rp-table">
          <thead>
            <tr><th>Proyecto</th><th>Prioridad</th><th>Fecha</th><th>Responsable</th></tr>
          </thead>
          <tbody>
            {upcoming.length === 0
              ? <tr><td colSpan={4} style={{ textAlign: 'center', color: '#9CA3AF' }}>Sin entregas programadas</td></tr>
              : upcoming.map(p => {
                  const pr = PR_BADGE[p.priority] || PR_BADGE.mid;
                  return (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td><span className="rp-badge" style={{ background: pr.bg, color: pr.c }}>{pr.l}</span></td>
                      <td>{fmtShort(p.dueDate)}</td>
                      <td>{p.assignee?.name || 'Sin asignar'}</td>
                    </tr>
                  );
                })
            }
          </tbody>
        </table>

        {solTotal > 0 && (
          <>
            <div className="rp-section-title" style={{ marginTop: 26 }}>Solicitudes internas</div>
            <div className="rp-sols">
              {[
                { l: 'Recibidas',              v: solStats.recibidas,   c: 'var(--rb-navy)', bg: 'var(--rb-navy-tint)', ic: 'inbox' },
                { l: 'En revisión',            v: solStats.revision,    c: 'var(--rb-warning)', bg: 'var(--rb-warning-bg)', ic: 'clock' },
                { l: 'Reunión agendada',       v: solStats.reunion,     c: 'var(--rb-danger)', bg: 'var(--rb-danger-bg)', ic: 'cal' },
                { l: 'Convertidas en proyecto', v: solStats.convertidas, c: 'var(--rb-success)', bg: 'var(--rb-success-bg)', ic: 'check' },
              ].map(({ l, v, c, bg, ic }) => (
                <div key={l} className="rp-sol" style={{ background: bg }}>
                  <span style={{ color: c }}>{RP_ICON[ic]}</span>
                  <div className="rp-sol-label">{l}</div>
                  <div className="rp-sol-num">{v}</div>
                </div>
              ))}
            </div>
            <div className="rp-conv">
              <span className="rp-conv-label">Tasa de conversión</span>
              <span className="rp-conv-pct">{convRate}%</span>
              <span className="rp-bar-track" style={{ flex: 1 }}>
                <span className="rp-bar-fill" style={{ width: `${convRate}%`, background: 'var(--rb-navy)' }} />
              </span>
              <span className="rp-conv-note">{solStats.convertidas} de {solTotal} solicitudes</span>
            </div>
          </>
        )}
      </PageShell>
    </div>
  );
}
