import { useRef, useEffect, useState } from 'react';
import { colorClass } from '../utils/helpers';

/* ════════════════════════════════════════════════════════════════════════════
   Centro de Control — Dashboard Gerencial AMBARC
   Guía: bento grid, cards blancas radio 8px borde #ECE7E2, sin sombras fuertes.
   Solo 6 bloques: KPIs · Carga del equipo · Portafolio · Embudo · Demanda · Tendencias
════════════════════════════════════════════════════════════════════════════ */

const INK2 = '#7A736C';

const STATUS_PILL = {
  backlog:  { l: 'Por iniciar',   bg: '#F3F4F6', c: '#6B7280' },
  progress: { l: 'En curso',      bg: '#FFF3E8', c: '#F9924D' },
  standby:  { l: 'En pausa',      bg: '#F5EFE9', c: '#A8907C' },
  testing:  { l: 'En validación', bg: '#FEF3C7', c: '#D97706' },
  done:     { l: 'Finalizado',    bg: '#ECFDF3', c: '#16A34A' },
  soporte:  { l: 'Soporte',       bg: '#E0F2FE', c: '#0891b2' },
};
const RISK_PILL = { l: 'En riesgo', bg: '#FEF2F2', c: '#DC2626' };

const PR_PILL = {
  high: { l: 'Alta',  bg: '#FEF2F2', c: '#DC2626' },
  mid:  { l: 'Media', bg: '#FEF3C7', c: '#D97706' },
  low:  { l: 'Baja',  bg: '#ECFDF3', c: '#16A34A' },
};

const CAPACITY = 4; // proyectos activos que se consideran ocupación plena por persona

const fmtShort = (d) => d ? new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtDM    = (d) => d ? new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }).replace('.', '') : '—';

/* ── Contador animado ── */
function useCountUp(end, duration = 700) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!end) { setVal(0); return; }
    let frame;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      setVal(Math.round(end * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [end, duration]);
  return val;
}

/* ── Sparkline ── */
function Sparkline({ values, color, height = 34 }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth, H = canvas.offsetHeight;
    if (!W) return;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    const max = Math.max(...values, 1);
    const pts = values.map((v, i) => ({
      x: 2 + ((W - 4) / (values.length - 1)) * i,
      y: H - (v / max) * H * 0.78 - H * 0.11,
    }));
    ctx.beginPath();
    ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.lineJoin = 'round';
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.stroke();
    pts.forEach(p => {
      ctx.beginPath(); ctx.fillStyle = color; ctx.arc(p.x, p.y, 1.9, 0, Math.PI * 2); ctx.fill();
    });
  }, [values, color]);
  return <canvas ref={ref} style={{ width: '100%', height, display: 'block' }} />;
}

/* ── KPI card — compacta: nombre + valor ── */
function Kpi({ icon, label, value, suffix = '' }) {
  const animated = useCountUp(value);
  return (
    <div className="dx-card dx-kpi">
      <div className="dx-kpi-head">
        <span className="dx-kpi-icon">{icon}</span>
        <span className="dx-kpi-label">{label}</span>
      </div>
      <div className="dx-kpi-num">{animated}{suffix}</div>
    </div>
  );
}

const IC = (path) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{path}</svg>
);

const ICONS = {
  activos:   IC(<><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></>),
  riesgo:    IC(<><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>),
  entregas:  IC(<><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/></>),
  evaluar:   IC(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></>),
  capacidad: IC(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>),
  done:      IC(<><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></>),
  equipo:    IC(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>),
  portafolio:IC(<><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 9h20"/></>),
  embudo:    IC(<><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></>),
  demanda:   IC(<><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></>),
  tendencia: IC(<><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>),
  proceso:   IC(<><path d="M21 12a9 9 0 1 1-6.2-8.56"/><polyline points="21 3 21 9 15 9"/></>),
  standby:   IC(<><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></>),
  testing:   IC(<><path d="M9 3h6M10 3v6l-5.5 9.5a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9V3"/></>),
  backlog:   IC(<><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></>),
  soporte:   IC(<><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></>),
  check:     IC(<><circle cx="12" cy="12" r="9"/><polyline points="8.5 12.5 11 15 15.5 9.5"/></>),
};

function BlockHead({ icon, title, right }) {
  return (
    <div className="dx-block-head">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: INK2, display: 'flex' }}>{icon}</span>
        <span className="dx-block-title">{title}</span>
      </div>
      {right}
    </div>
  );
}

function More({ label, onClick }) {
  if (!onClick) return null;
  return (
    <button className="dx-more" onClick={onClick}>
      {label}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
    </button>
  );
}

/* ════ Componente principal ════ */

export default function DashboardView({ projects: allProjects, users, solicitudes = [], onCardClick, onNavigate, role, period = 'all', onPeriodChange }) {
  const [exporting, setExporting] = useState(false);
  const [fTeam, setFTeam] = useState('all');
  const [fArea, setFArea] = useState('all');
  const [fStat, setFStat] = useState('all');

  const exportPDF = async () => {
    const src = document.querySelector('.print-report');
    if (!src || exporting) { if (!src) window.print(); return; }
    setExporting(true);
    const overlay = document.createElement('div');
    overlay.className = 'rp-overlay';
    overlay.innerHTML = '<div class="rp-overlay-msg"><span class="rp-overlay-spin"></span>Generando informe PDF…</div>';
    const clone = src.cloneNode(true);
    clone.classList.add('rp-capture');
    document.body.appendChild(clone);
    document.body.appendChild(overlay);
    const prevScroll = window.scrollY;
    window.scrollTo(0, 0);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      await document.fonts.ready;
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const pages = clone.querySelectorAll('.rp-page');
      if (!pages.length) throw new Error('Report pages not found');
      const pdf = new jsPDF({ unit: 'px', format: [794, 1123], orientation: 'portrait', hotfixes: ['px_scaling'] });
      for (let i = 0; i < pages.length; i++) {
        const canvas = await html2canvas(pages[i], { scale: 2, backgroundColor: '#ffffff', logging: false, windowWidth: 794 });
        if (i > 0) pdf.addPage([794, 1123], 'portrait');
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 794, 1123);
      }
      pdf.save(`Informe_AMBARC_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
      window.print();
    } finally {
      clone.remove();
      overlay.remove();
      window.scrollTo(0, prevScroll);
      setExporting(false);
    }
  };

  /* ── Alcance por rol: cada equipo solo ve sus propios valores ── */
  const teamScope = role === 'engineer' ? 'auto' : role === 'member_analytics' ? 'ana' : 'all';

  /* ── Filtros ── */
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

  const areasAll = [...new Set(allProjects.map(p => (p.client || '').trim()).filter(Boolean))].sort();

  const byTeam = (p) => {
    const t = p.tipo || 'automatizacion';
    if (fTeam === 'auto') return t === 'automatizacion' || t === 'asignacion_flash' || t === 'compartido';
    if (fTeam === 'ana')  return t === 'analitica' || t === 'compartido';
    return true;
  };

  const projects = allProjects
    .filter(p => period !== 'month' || (p.createdAt && new Date(p.createdAt) >= monthStart))
    .filter(byTeam)
    .filter(p => fArea === 'all' || (p.client || '').trim() === fArea)
    .filter(p => fStat === 'all' || p.status === fStat);

  /* ── KPIs por estado ── */
  const isOverdue = (p) => p.dueDate && p.status !== 'done' && new Date(p.dueDate) < today;

  const cnt = { backlog: 0, progress: 0, standby: 0, testing: 0, done: 0, soporte: 0 };
  projects.forEach(p => { if (cnt[p.status] !== undefined) cnt[p.status]++; });
  const total = projects.length;

  const team = users
    .filter(u => ['engineer', 'member_analytics', 'leader_analytics'].includes(u.role))
    .filter(u => teamScope === 'all'
      || (teamScope === 'auto' ? u.role === 'engineer' : ['member_analytics', 'leader_analytics'].includes(u.role)));

  // Distribución por área (tipo de proyecto)
  const tipoCnt = { automatizacion: 0, analitica: 0, compartido: 0, asignacion_flash: 0 };
  projects.forEach(p => { const t = p.tipo || 'automatizacion'; if (tipoCnt[t] !== undefined) tipoCnt[t]++; });
  const distArea = [
    { l: 'Automatización', n: tipoCnt.automatizacion + tipoCnt.asignacion_flash },
    { l: 'Analítica',      n: tipoCnt.analitica },
    { l: 'Compartidos',    n: tipoCnt.compartido },
  ].filter(d => teamScope === 'all'
    || d.l === 'Compartidos'
    || (teamScope === 'auto' ? d.l === 'Automatización' : d.l === 'Analítica'));
  const distMax = Math.max(1, ...distArea.map(d => d.n));

  /* ── Carga del equipo ── */
  const teamRows = team.map(u => {
    const mine    = projects.filter(p => p.assigneeId === u.id || p.coAssigneeId === u.id);
    const active  = mine.filter(p => ['progress', 'testing'].includes(p.status));
    const riesgos = mine.filter(isOverdue).length;
    const bloqueos = mine.filter(p => p.status === 'standby').length;
    const next    = mine.filter(p => p.dueDate && p.status !== 'done')
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0];
    const ocup    = Math.round(active.length / CAPACITY * 100);
    const estado  = ocup > 100 ? { l: 'Sobrecarga', bg: '#FEF2F2', c: '#DC2626' }
      : ocup >= 75 ? { l: 'Alta carga', bg: '#FEF3C7', c: '#D97706' }
      : { l: 'Saludable', bg: '#ECFDF3', c: '#16A34A' };
    const equipo  = u.role === 'engineer' ? 'Automatización' : 'Analítica de Datos';
    return { u, equipo, total: mine.length, ocup, riesgos, bloqueos, next, estado };
  }).sort((a, b) => b.ocup - a.ocup);

  /* ── Portafolio ── */
  const portafolio = [...projects]
    .filter(p => p.status !== 'done')
    .sort((a, b) => {
      const ra = isOverdue(a) ? 0 : 1, rb = isOverdue(b) ? 0 : 1;
      if (ra !== rb) return ra - rb;
      return (a.dueDate || '9999') < (b.dueDate || '9999') ? -1 : 1;
    })
    .slice(0, 5);

  /* ── Embudo ── */
  const solTotal = solicitudes.length;
  const reach = (keys) => solicitudes.filter(x => keys.includes(x.status)).length;
  const funnel = [
    { l: 'Solicitudes recibidas', n: solTotal },
    { l: 'En revisión',           n: reach(['en_revision', 'reunion_agendada', 'aceptado', 'convertido', 'en_proceso', 'completada']) },
    { l: 'Reunión agendada',      n: reach(['reunion_agendada', 'aceptado', 'convertido', 'completada']) },
    { l: 'Aceptadas',             n: reach(['aceptado', 'convertido', 'completada']) },
    { l: 'Convertidas',           n: reach(['convertido', 'completada']) },
  ];

  /* ── Demanda por área ── */
  const demandaSrc = solTotal > 0
    ? solicitudes.map(s => (s.area || '').trim() || 'Sin área')
    : allProjects.map(p => (p.client || '').trim() || 'Sin área');
  const demandaMap = {};
  demandaSrc.forEach(a => { demandaMap[a] = (demandaMap[a] || 0) + 1; });
  const demanda = Object.entries(demandaMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const demandaTotal = demandaSrc.length || 1;
  const demandaMax = Math.max(1, ...demanda.map(([, n]) => n));

  const isLeaderish = ['admin', 'leader_analytics'].includes(role);

  return (
    <div className="dx-root">

      {/* ══ 1. KPIs por estado ══ */}
      <div className="dx-kpis">
        <Kpi icon={ICONS.activos} label="Total" value={total} />
        <Kpi icon={ICONS.proceso} label="En proceso" value={cnt.progress} />
        <Kpi icon={ICONS.standby} label="En standby" value={cnt.standby} />
        <Kpi icon={ICONS.testing} label="En testing" value={cnt.testing} />
        <Kpi icon={ICONS.check} label="Finalizados" value={cnt.done} />
        <Kpi icon={ICONS.backlog} label="Por hacer" value={cnt.backlog} />
        <Kpi icon={ICONS.soporte} label="Soporte" value={cnt.soporte} />
      </div>

      {/* Filtros + exportar */}
      <div className="dx-filters no-print">
        <div className="dx-select">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <select value={period} onChange={e => onPeriodChange?.(e.target.value)}>
            <option value="all">Todo el portafolio</option>
            <option value="month">Este mes</option>
          </select>
        </div>
        {teamScope === 'all' && (
          <div className="dx-select">
            <select value={fTeam} onChange={e => setFTeam(e.target.value)}>
              <option value="all">Todos los equipos</option>
              <option value="auto">Automatización</option>
              <option value="ana">Analítica</option>
            </select>
          </div>
        )}
        <div className="dx-select">
          <select value={fArea} onChange={e => setFArea(e.target.value)}>
            <option value="all">Todas las áreas</option>
            {areasAll.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="dx-select">
          <select value={fStat} onChange={e => setFStat(e.target.value)}>
            <option value="all">Todos los estados</option>
            {Object.entries(STATUS_PILL).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}
          </select>
        </div>
        <button className="dx-export" onClick={exportPDF} disabled={exporting}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          {exporting ? 'Generando…' : 'Exportar'}
        </button>
      </div>

      {/* ══ Fila 2: Carga del equipo + Portafolio ══ */}
      <div className="dx-row2">
        {/* 2. Carga y situación del equipo */}
        <div className="dx-card">
          <BlockHead icon={ICONS.equipo} title="Carga y situación del equipo" />
          <div style={{ overflowX: 'auto' }}>
            <table className="dx-table">
              <thead>
                <tr>
                  <th>Colaborador</th><th>Equipo</th>
                  <th style={{ textAlign: 'center' }}>Proyectos</th>
                  <th>Ocupación</th>
                  <th style={{ textAlign: 'center' }}>Riesgos</th>
                  <th style={{ textAlign: 'center' }}>Bloqueos</th>
                  <th>Próxima entrega</th><th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {teamRows.map(({ u, equipo, total, ocup, riesgos, bloqueos, next, estado }) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className={`avatar-xs ${colorClass(u.colorIndex)}`}>{u.initials}</span>
                        <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{u.name}</span>
                      </div>
                    </td>
                    <td style={{ color: INK2, whiteSpace: 'nowrap' }}>{equipo}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{total}</td>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: 12, color: ocup > 100 ? '#DC2626' : ocup >= 75 ? '#D97706' : 'inherit' }}>{ocup}%</div>
                      <div className="dx-bar" style={{ width: 74, marginTop: 3 }}>
                        <span style={{ width: `${Math.min(100, ocup)}%`, background: ocup > 100 ? '#DC2626' : ocup >= 75 ? '#F9924D' : '#F9924D' }} />
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: riesgos > 0 ? '#DC2626' : INK2 }}>{riesgos}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: bloqueos > 0 ? '#D97706' : INK2 }}>{bloqueos}</td>
                    <td style={{ whiteSpace: 'nowrap', color: INK2 }}>{next ? fmtDM(next.dueDate) : '—'}</td>
                    <td><span className="dx-pill" style={{ background: estado.bg, color: estado.c }}>{estado.l}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <More label="Ver capacidad detallada del equipo" onClick={onNavigate ? () => onNavigate('team-kanban') : null} />
        </div>

        {/* 3. Portafolio de proyectos */}
        <div className="dx-card">
          <BlockHead icon={ICONS.portafolio} title="Portafolio de proyectos"
            right={<More label="Ver todos" onClick={onNavigate ? () => onNavigate('gantt') : null} />} />
          <div style={{ overflowX: 'auto' }}>
            <table className="dx-table">
              <thead>
                <tr>
                  <th>Proyecto</th><th>Área solicitante</th><th>Prioridad</th>
                  <th>Avance</th><th>Fecha compromiso</th><th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {portafolio.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: INK2, padding: 18 }}>Sin proyectos activos</td></tr>
                )}
                {portafolio.map(p => {
                  const pr = PR_PILL[p.priority] || PR_PILL.mid;
                  const st = isOverdue(p) ? RISK_PILL : (STATUS_PILL[p.status] || STATUS_PILL.backlog);
                  return (
                    <tr key={p.id} onClick={() => onCardClick(p.id)} style={{ cursor: 'pointer' }}>
                      <td style={{ fontWeight: 600, maxWidth: 180 }}>{p.name}</td>
                      <td style={{ color: INK2, whiteSpace: 'nowrap' }}>{p.client || '—'}</td>
                      <td><span className="dx-pill" style={{ background: pr.bg, color: pr.c }}>{pr.l}</span></td>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: 12 }}>{p.progress || 0}%</div>
                        <div className="dx-bar" style={{ width: 70, marginTop: 3 }}>
                          <span style={{ width: `${p.progress || 0}%`, background: '#F9924D' }} />
                        </div>
                      </td>
                      <td style={{ whiteSpace: 'nowrap', color: INK2 }}>{fmtShort(p.dueDate)}</td>
                      <td><span className="dx-pill" style={{ background: st.bg, color: st.c }}>{st.l}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ══ Fila 3: Embudo + Demanda + Tendencias ══ */}
      <div className="dx-row3">
        {/* 4. Flujo de solicitudes y proyectos */}
        <div className="dx-card">
          <BlockHead icon={ICONS.embudo} title="Flujo de solicitudes y proyectos" />
          {solTotal === 0 ? (
            <div style={{ color: INK2, fontSize: 12.5, padding: '30px 0', textAlign: 'center' }}>Sin solicitudes registradas</div>
          ) : (
            <div className="funnel" style={{ marginTop: 6 }}>
              {funnel.map((st, i) => {
                const ratio = solTotal ? st.n / solTotal : 0;
                const h = Math.max(30, Math.round(ratio * 100));
                return (
                  <div key={st.l} className="funnel-stage">
                    <div className="funnel-label">{st.l}</div>
                    <div className="funnel-track" style={{ height: 104 }}>
                      <div className="funnel-block"
                        style={{ height: h, background: `rgba(249,146,77,${(0.5 - i * 0.075).toFixed(2)})` }}>
                        {st.n}
                      </div>
                    </div>
                    <div className="funnel-pct">{Math.round(ratio * 100)}%</div>
                  </div>
                );
              })}
            </div>
          )}
          <More label="Ver detalle del flujo" onClick={onNavigate && isLeaderish ? () => onNavigate('solicitudes') : null} />
        </div>

        {/* 5. Demanda por área */}
        <div className="dx-card">
          <BlockHead icon={ICONS.demanda} title="Demanda por área solicitante" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 4 }}>
            {demanda.map(([area, n]) => (
              <div key={area} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 92, fontSize: 12, color: '#5A2807', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={area}>{area}</span>
                <div className="dx-bar" style={{ flex: 1, height: 10 }}>
                  <span style={{ width: `${(n / demandaMax) * 100}%`, background: `rgba(249,146,77,${(0.35 + (n / demandaMax) * 0.65).toFixed(2)})` }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                  {n} <span style={{ color: INK2, fontWeight: 500 }}>({Math.round(n / demandaTotal * 100)}%)</span>
                </span>
              </div>
            ))}
          </div>
          <More label="Ver análisis por área" onClick={onNavigate ? () => onNavigate('historial') : null} />
        </div>

        {/* 6. Distribución por área */}
        <div className="dx-card">
          <BlockHead icon={ICONS.tendencia} title="Distribución por área" />
          <div className="dx-dist">
            {distArea.map(({ l, n }) => {
              const pct = total ? Math.round(n / total * 100) : 0;
              const h = Math.max(16, Math.round((n / distMax) * 150));
              return (
                <div key={l} className="dx-dist-col">
                  <div className="dx-dist-num">{n}</div>
                  <div className="dx-dist-barwrap">
                    <div className="dx-dist-bar" style={{ height: h }}>
                      {h > 34 && <span>{pct}%</span>}
                    </div>
                  </div>
                  <div className="dx-dist-label">{l}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
