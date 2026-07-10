import { useRef, useEffect, useState, useCallback } from 'react';
import { colorClass } from '../utils/helpers';

const STATUS_COLOR = { progress: '#f9924d', testing: '#e87d3a', standby: '#78716C', backlog: '#a86040', done: '#16A34A', soporte: '#0891b2' };

const STATUS_DOT   = { backlog:'#a86040', progress:'#f9924d', standby:'#78716C', testing:'#e87d3a', done:'#16A34A', soporte:'#0891b2' };
const STATUS_LABEL = { backlog:'Por hacer', progress:'En proceso', standby:'En standby', testing:'En testing', done:'Finalizado', soporte:'En soporte' };
const STATUS_BAR   = { backlog:'#a86040', progress:'#f9924d', standby:'#78716C', testing:'#e87d3a', done:'#16A34A', soporte:'#0891b2' };

/* ── Animated counter hook ── */
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

/* ── Mini sparkline ── */
function Sparkline({ values, color }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth, H = canvas.offsetHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    const max = Math.max(...values, 1);
    const pts = values.map((v, i) => ({
      x: (W / (values.length - 1)) * i,
      y: H - (v / max) * H * 0.85 - H * 0.05,
    }));
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    const fillHigh = color.startsWith('rgba') ? color.replace(/[\d.]+\)$/, '.35)') : color + '40';
    const fillLow  = color.startsWith('rgba') ? color.replace(/[\d.]+\)$/, '.0)')  : color + '00';
    grad.addColorStop(0, fillHigh);
    grad.addColorStop(1, fillLow);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, H);
    pts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length - 1].x, H);
    ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();
    ctx.beginPath();
    ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.lineJoin = 'round';
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.stroke();
    // endpoint dot
    const last = pts[pts.length - 1];
    ctx.beginPath(); ctx.fillStyle = '#fff'; ctx.arc(last.x, last.y, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.fillStyle = color;  ctx.arc(last.x, last.y, 2.5, 0, Math.PI * 2); ctx.fill();
  }, [values, color]);
  return <canvas ref={ref} style={{ width: '100%', height: 40, display: 'block' }} />;
}

/* ── Treemap: carga por persona ── */
const ENG_HEX = ['#f9924d', '#d4763a', '#5a2807', '#c4622d', '#8a3a10'];

function tmLayout(items, x, y, w, h) {
  if (!items.length) return [];
  if (items.length === 1) return [{ ...items[0], x, y, w, h }];
  const total = items.reduce((s, d) => s + d.value, 0);
  let sum = 0, split = 1;
  for (let i = 0; i < items.length - 1; i++) {
    sum += items[i].value;
    if (sum / total >= 0.5) { split = i + 1; break; }
  }
  const left  = items.slice(0, split);
  const right = items.slice(split);
  const ratio = left.reduce((s, d) => s + d.value, 0) / total;
  if (w >= h) {
    const lw = w * ratio;
    return [...tmLayout(left, x, y, lw, h), ...tmLayout(right, x + lw, y, w - lw, h)];
  } else {
    const lh = h * ratio;
    return [...tmLayout(left, x, y, w, lh), ...tmLayout(right, x, y + lh, w, h - lh)];
  }
}

function drawRR(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

function TreemapChart({ projects, users }) {
  const canvasRef = useRef(null);
  const rectsRef  = useRef([]);
  const [tip, setTip] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth, H = canvas.offsetHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const items = users
      .map(u => {
        const assigned = projects.filter(p => p.assigneeId === u.id);
        const total    = assigned.length;
        const active   = assigned.filter(p => p.status === 'progress' || p.status === 'testing').length;
        const ratio    = total > 0 ? active / total : 0;
        const color    = total === 0 ? '#a9a29b'
          : ratio > 0.7  ? '#DC2626'
          : ratio >= 0.4 ? '#f9924d'
          : '#16A34A';
        return {
          name:  u.name.split(' ')[0],
          full:  u.name,
          value: Math.max(total, 1),
          total, active,
          done:  assigned.filter(p => p.status === 'done').length,
          color,
        };
      })
      .sort((a, b) => b.value - a.value);

    const gap = 4;
    const rects = tmLayout(items, 0, 0, W, H);

    const stored = [];
    rects.forEach(r => {
      const rx = r.x + gap, ry = r.y + gap;
      const rw = r.w - gap * 2, rh = r.h - gap * 2;
      if (rw < 6 || rh < 6) return;

      const actRatio = r.total > 0 ? r.active / r.total : 0;
      const alpha = 0.12 + actRatio * 0.52;

      // Background
      drawRR(ctx, rx, ry, rw, rh, 7);
      ctx.fillStyle = r.color;
      ctx.globalAlpha = alpha;
      ctx.fill();
      ctx.globalAlpha = 1;

      // Border
      drawRR(ctx, rx, ry, rw, rh, 7);
      ctx.strokeStyle = 'rgba(255,255,255,.85)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Active indicator bar at bottom
      if (rw > 20 && rh > 20) {
        const bh = 3, bpad = 6;
        ctx.fillStyle = 'rgba(0,0,0,.06)';
        ctx.beginPath(); ctx.rect(rx + bpad, ry + rh - bh - bpad, rw - bpad * 2, bh); ctx.fill();
        ctx.fillStyle = r.color;
        ctx.globalAlpha = 0.9;
        ctx.beginPath(); ctx.rect(rx + bpad, ry + rh - bh - bpad, (rw - bpad * 2) * actRatio, bh); ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Text
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const mid = { x: rx + rw / 2, y: ry + rh / 2 };

      if (rw > 38 && rh > 28) {
        const fName = Math.min(13, Math.max(9, rw / 8));
        ctx.fillStyle = r.color;
        ctx.font = `700 ${fName}px system-ui`;
        const label = rw < 55 ? r.name.slice(0, 4) : r.name;
        const offsetY = rh > 48 ? -8 : 0;
        ctx.fillText(label, mid.x, mid.y + offsetY);

        if (rh > 44) {
          const fNum = Math.min(20, Math.max(12, rw / 5));
          ctx.font = `800 ${fNum}px 'JetBrains Mono', monospace`;
          ctx.globalAlpha = 0.75;
          ctx.fillText(r.total, mid.x, mid.y + fName + 4);
          ctx.globalAlpha = 1;
        }
      }

      stored.push({ rx, ry, rw, rh, ...r });
    });

    rectsRef.current = stored;
  }, [projects, users]);

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const hit = rectsRef.current.find(r => mx >= r.rx && mx <= r.rx + r.rw && my >= r.ry && my <= r.ry + r.rh);
    setTip(hit ? { x: mx, y: my, d: hit } : null);
  };

  return (
    <div style={{ position: 'relative' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: 195, display: 'block', cursor: tip ? 'pointer' : 'default' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTip(null)}
      />
      {tip && (
        <div className="sc-tip" style={{ left: tip.x + 14, top: Math.max(4, tip.y - 36) }}>
          <div className="sc-tip-name">{tip.d.full}</div>
          <div className="sc-tip-row">
            <span className="sc-tip-dot" style={{ background: tip.d.color }} />
            <span style={{ fontWeight: 600 }}>{tip.d.total} proyectos</span>
          </div>
          <div className="sc-tip-row" style={{ marginTop: 2 }}>
            <span style={{ color: '#f9924d' }}>{tip.d.active} activos</span>
            <span className="sc-tip-pct">{tip.d.done} listos</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── KPI icons ── */
const KPI_ICON = {
  total:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  progress: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.2-8.56"/><polyline points="21 3 21 9 15 9"/></svg>,
  standby:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>,
  testing:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6M10 3v6l-5.5 9.5a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9V3"/></svg>,
  done:     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="8.5 12.5 11 15 15.5 9.5"/></svg>,
  backlog:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>,
  soporte:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>,
  overdue:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="7" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
};

/* ── KPI card — icon chip, big number + unit, sparkline ── */
function KpiCard({ label, value, color, spark, icon, alert }) {
  const animated = useCountUp(value);
  const hot = alert && value > 0;
  return (
    <div className="kpi-card">
      <div className="kpi-head">
        <span className="kpi-icon" style={{ background: `${color}1a`, color }}>{KPI_ICON[icon] || KPI_ICON.total}</span>
        <span className="kpi-label">{label}</span>
      </div>
      <div className="kpi-numrow">
        <span className="kpi-num" style={hot ? { color } : undefined}>
          <span className="dash-num-inner" key={value}>{animated}</span>
        </span>
        <span className="kpi-unit">{value === 1 ? 'proyecto' : 'proyectos'}</span>
      </div>
      <Sparkline values={spark} color={color} />
    </div>
  );
}

/* ── Carga del equipo — flat table per mockup ── */
const INTENSITY = (ratio, total) => {
  if (total === 0)   return { label: 'Sin carga', color: '#78716C', bg: 'var(--grey-bg, #F5F5F4)' };
  if (ratio > 0.7)   return { label: 'Alta',  color: '#DC2626', bg: '#FEE2E2' };
  if (ratio >= 0.4)  return { label: 'Media', color: '#D97706', bg: '#FEF3C7' };
  return               { label: 'Baja',  color: '#16A34A', bg: '#DCFCE7' };
};

function TeamTable({ projects, users }) {
  const rows = users.map(u => {
    const assigned = projects.filter(p => p.assigneeId === u.id || p.coAssigneeId === u.id);
    const active   = assigned.filter(p => ['progress', 'testing'].includes(p.status));
    const done     = assigned.filter(p => p.status === 'done').length;
    const open     = assigned.filter(p => p.status !== 'done');
    const avg      = open.length ? Math.round(open.reduce((s, p) => s + (p.progress || 0), 0) / open.length) : 0;
    const ratio    = assigned.length ? active.length / assigned.length : 0;
    return { u, total: assigned.length, active: active.length, done, avg, ratio };
  }).sort((a, b) => b.active - a.active || b.total - a.total);

  const maxActive = Math.max(1, ...rows.map(r => r.active));

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="team-table">
        <thead>
          <tr>
            <th>Ingeniero</th>
            <th style={{ textAlign: 'center' }}>Activos</th>
            <th style={{ textAlign: 'center' }}>Finalizados</th>
            <th>Intensidad</th>
            <th style={{ width: '30%' }}></th>
            <th style={{ textAlign: 'right' }}>Avance promedio</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ u, total, active, done, avg, ratio }) => {
            const inten = INTENSITY(ratio, total);
            return (
              <tr key={u.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <div className={`avatar-xs ${colorClass(u.colorIndex)}`}>{u.initials}</div>
                    <span style={{ fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>{u.name}</span>
                  </div>
                </td>
                <td style={{ textAlign: 'center', fontFamily: 'var(--mono)', fontWeight: 700 }}>{active}</td>
                <td style={{ textAlign: 'center', fontFamily: 'var(--mono)', color: 'var(--text2)' }}>{done}</td>
                <td>
                  <span className="pill-mini" style={{ background: inten.bg, color: inten.color }}>{inten.label}</span>
                </td>
                <td>
                  <div className="bar-h-track" style={{ height: 8, minWidth: 120 }}>
                    <div className="bar-h-fill" style={{ width: `${(active / maxActive) * 100}%`, background: 'var(--accent)' }} />
                  </div>
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--accent)' }}>{avg}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const TIPO_INFO = {
  automatizacion:  { label: 'Automatización', color: '#f9924d', bg: 'rgba(249,146,77,.12)' },
  analitica:       { label: 'Analítica',       color: '#7c3aed', bg: 'rgba(124,58,237,.10)' },
  compartido:      { label: 'Compartido',      color: '#0891b2', bg: 'rgba(8,145,178,.10)'  },
  asignacion_flash:{ label: 'Flash',           color: '#d97706', bg: 'rgba(217,119,6,.10)'  },
};

const fmtShort = (d) => d ? new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

/* Panel header: icon + title (+ optional "Ver todas") */
function PanelHead({ icon, title, sub, onMore }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--text2)', display: 'flex' }}>{icon}</span>
        <span className="chart-title" style={{ marginBottom: 0 }}>{title}</span>
        {onMore && (
          <button onClick={onMore}
            style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textDecoration: 'underline', fontFamily: 'var(--font)', padding: 0 }}>
            Ver todas
          </button>
        )}
      </div>
      {sub && <div className="chart-subtitle" style={{ marginBottom: 0, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

const PANEL_ICON = {
  cal:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  inbox: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>,
  clock: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>,
  team:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
};

const SOL_MINI_ICON = {
  recibidas: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  revision:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  reunion:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  convertidas: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><polyline points="8.5 12.5 11 15 15.5 9.5"/></svg>,
};

export default function DashboardView({ projects, users, solicitudes = [], onCardClick, onNavigate, role }) {
  const cnt   = { backlog: 0, progress: 0, standby: 0, testing: 0, done: 0, soporte: 0 };
  const prCnt = { high: 0, mid: 0, low: 0 };
  const tipoCnt = { automatizacion: 0, analitica: 0, compartido: 0, asignacion_flash: 0 };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let overdueCount = 0, upcomingCount = 0;

  projects.forEach(p => {
    if (cnt[p.status] !== undefined) cnt[p.status]++;
    if (prCnt[p.priority || 'mid'] !== undefined) prCnt[p.priority || 'mid']++;
    const t = p.tipo || 'automatizacion';
    if (tipoCnt[t] !== undefined) tipoCnt[t]++;
    if (p.dueDate && p.status !== 'done') {
      const d = new Date(p.dueDate);
      const diff = (d - today) / 86400000;
      if (diff < 0) overdueCount++;
      else if (diff <= 7) upcomingCount++;
    }
  });
  const total  = projects.length;
  const maxCnt = Math.max(1, ...Object.values(cnt));
  const maxPr  = Math.max(1, ...Object.values(prCnt));

  // Proyectos por área solicitante (top 8, resto agrupado)
  const areaMap = {};
  projects.forEach(p => {
    const a = (p.client || '').trim() || 'Sin área';
    areaMap[a] = (areaMap[a] || 0) + 1;
  });
  const areaSorted = Object.entries(areaMap).sort((a, b) => b[1] - a[1]);
  const areaTop    = areaSorted.slice(0, 8);
  const areaRest   = areaSorted.slice(8).reduce((s, [, n]) => s + n, 0);
  if (areaRest > 0) areaTop.push(['Otras áreas', areaRest]);
  const maxArea = Math.max(1, ...areaTop.map(([, n]) => n));

  // Entregas próximas — no finalizados con fecha, ordenados por cercanía
  const upcoming = projects
    .filter(p => p.dueDate && p.status !== 'done')
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 5);

  // Solicitudes internas
  const solStats = {
    recibidas:  solicitudes.filter(s => ['recibido', 'nueva'].includes(s.status)).length,
    revision:   solicitudes.filter(s => s.status === 'en_revision').length,
    reunion:    solicitudes.filter(s => s.status === 'reunion_agendada').length,
    convertidas: solicitudes.filter(s => ['convertido', 'completada'].includes(s.status)).length,
  };
  const solTotal = solicitudes.length;
  const convRate = solTotal ? Math.round(solStats.convertidas / solTotal * 100) : 0;

  const spark = {
    progress: [cnt.progress * 0.4, cnt.progress * 0.55, cnt.progress * 0.65, cnt.progress * 0.75, cnt.progress * 0.85, cnt.progress * 0.92, cnt.progress],
    standby:  [cnt.standby, cnt.standby * 1.2, cnt.standby * 0.9, cnt.standby * 1.1, cnt.standby, cnt.standby * 0.85, cnt.standby],
    done:     [0, cnt.done * 0.2, cnt.done * 0.4, cnt.done * 0.6, cnt.done * 0.78, cnt.done * 0.9, cnt.done],
    total:    [total * 0.5, total * 0.6, total * 0.7, total * 0.8, total * 0.86, total * 0.92, total],
  };

  const team = users.filter(u => ['engineer', 'member_analytics'].includes(u.role));

  return (
    <>
      {/* Export */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }} className="no-print">
        <button className="btn btn-ghost btn-sm" onClick={() => window.print()} style={{ gap: 6 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Exportar
        </button>
      </div>

      {/* KPI row */}
      <div className="dash-grid">
        <KpiCard label="Total"       value={total}        color="#5a2807" icon="total"    spark={spark.total} />
        <KpiCard label="En proceso"  value={cnt.progress} color="#f9924d" icon="progress" spark={spark.progress} />
        <KpiCard label="En standby"  value={cnt.standby}  color="#78716C" icon="standby"  spark={spark.standby} />
        <KpiCard label="En testing"  value={cnt.testing}  color="#e87d3a" icon="testing"  spark={[0,cnt.testing,cnt.testing,cnt.testing,cnt.testing,cnt.testing,cnt.testing]} />
        <KpiCard label="Finalizados" value={cnt.done}     color="#16A34A" icon="done"     spark={spark.done} />
        <KpiCard label="Por hacer"   value={cnt.backlog}  color="#a86040" icon="backlog"  spark={[cnt.backlog,cnt.backlog,cnt.backlog,cnt.backlog,cnt.backlog,cnt.backlog,cnt.backlog]} />
        <KpiCard label="Soporte"     value={cnt.soporte}  color="#0891b2" icon="soporte"  spark={[0,cnt.soporte,cnt.soporte,cnt.soporte,cnt.soporte,cnt.soporte,cnt.soporte]} />
        <KpiCard label="Vencidos"    value={overdueCount} color="#DC2626" icon="overdue"  alert spark={[0,overdueCount,overdueCount,overdueCount,overdueCount,overdueCount,overdueCount]} />
      </div>

      {/* Áreas del equipo — chips */}
      <div className="area-chips">
        <span className="area-chips-label">Áreas del equipo</span>
        {Object.entries(TIPO_INFO).map(([key, info]) => (
          <span key={key} className="area-chip" style={{ background: info.bg, color: info.color, borderColor: `${info.color}30` }}>
            {info.label}
            <b>{tipoCnt[key]}</b>
          </span>
        ))}
        {upcomingCount > 0 && (
          <span className="area-chip" style={{ background: 'rgba(217,119,6,.10)', color: '#d97706', borderColor: 'rgba(217,119,6,.3)', marginLeft: 'auto' }}>
            ⏰ Entregas próximas
            <b>{upcomingCount}</b>
          </span>
        )}
      </div>

      {/* Carga por persona + Distribución */}
      <div className="chart-row">
        <div className="chart-box">
          <div className="chart-title">Carga por persona</div>
          <div className="chart-subtitle">Tamaño = proyectos asignados · intensidad = % activos</div>
          <TreemapChart projects={projects} users={team} />
          <div className="tm-legend">
            <span><i style={{ background: '#DC2626' }} /> Alta carga (&gt;70%)</span>
            <span><i style={{ background: '#f9924d' }} /> Media (40–70%)</span>
            <span><i style={{ background: '#16A34A' }} /> Baja (&lt;40%)</span>
            <span><i style={{ background: '#c9c3bd' }} /> Sin carga</span>
          </div>
        </div>

        <div className="chart-box">
          <div className="chart-title">Distribución de proyectos</div>
          <div className="chart-subtitle">Por prioridad y estado actual</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 16 }}>
            <div>
              <div className="dist-col-label">Por prioridad</div>
              {[['high','Alta','#DC2626'],['mid','Media','#f9924d'],['low','Baja','#16A34A']].map(([k, l, c]) => (
                <div className="bar-h" key={k}>
                  <div className="bar-h-label" style={{ width: 44, fontSize: 11 }}>{l}</div>
                  <div className="bar-h-track" style={{ height: 12 }}>
                    <div className="bar-h-fill" style={{ width: `${Math.round(prCnt[k] / maxPr * 100)}%`, background: c }} />
                  </div>
                  <div className="bar-h-val" style={{ minWidth: 48, fontSize: 11 }}>
                    {prCnt[k]} <span style={{ color: 'var(--text3)', fontWeight: 500 }}>({total ? Math.round(prCnt[k] / total * 100) : 0}%)</span>
                  </div>
                </div>
              ))}
            </div>
            <div>
              <div className="dist-col-label">Por estado</div>
              {Object.entries(STATUS_LABEL).map(([k, l]) => (
                <div className="bar-h" key={k} style={{ marginBottom: 6 }}>
                  <div className="bar-h-label" style={{ width: 68, fontSize: 11 }}>{l}</div>
                  <div className="bar-h-track" style={{ height: 12 }}>
                    <div className="bar-h-fill" style={{ width: `${Math.round(cnt[k] / maxCnt * 100)}%`, background: STATUS_BAR[k] }} />
                  </div>
                  <div className="bar-h-val" style={{ minWidth: 48, fontSize: 11 }}>
                    {cnt[k]} <span style={{ color: 'var(--text3)', fontWeight: 500 }}>({total ? Math.round(cnt[k] / total * 100) : 0}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Entregas próximas + Solicitudes + Proyectos por área */}
      <div className="dash-panels">
        <div className="chart-box">
          <PanelHead icon={PANEL_ICON.cal} title="Entregas próximas"
            onMore={onNavigate ? () => onNavigate('gantt') : undefined} />
          {upcoming.length === 0
            ? <div className="empty" style={{ padding: 20, fontSize: 12 }}>Sin entregas programadas</div>
            : upcoming.map(p => {
                const overdue = new Date(p.dueDate) < today;
                return (
                  <div key={p.id} className="due-row" onClick={() => onCardClick(p.id)}>
                    <span className="due-name" title={p.name}>{p.name}</span>
                    <span className="pill-mini" style={{
                      background: p.priority === 'high' ? '#FEE2E2' : p.priority === 'low' ? '#DCFCE7' : '#FEF3C7',
                      color:      p.priority === 'high' ? '#DC2626' : p.priority === 'low' ? '#16A34A' : '#D97706',
                    }}>
                      {p.priority === 'high' ? 'Alta' : p.priority === 'low' ? 'Baja' : 'Media'}
                    </span>
                    <span className="due-date" style={overdue ? { color: 'var(--high)', fontWeight: 700 } : undefined}>
                      {fmtShort(p.dueDate)}
                    </span>
                    {p.assignee && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                        <span className={`avatar-xs ${colorClass(p.assignee.colorIndex)}`}>{p.assignee.initials}</span>
                        <span style={{ fontSize: 11, color: 'var(--text2)', whiteSpace: 'nowrap' }}>{p.assignee.name.split(' ')[0]} {p.assignee.name.split(' ')[1]?.[0] || ''}.</span>
                      </span>
                    )}
                  </div>
                );
              })
          }
        </div>

        {solTotal > 0 && (
          <div className="chart-box">
            <PanelHead icon={PANEL_ICON.inbox} title="Solicitudes internas"
              onMore={onNavigate && ['admin', 'leader_analytics'].includes(role) ? () => onNavigate('solicitudes') : undefined} />
            <div className="sol-grid-mini">
              {[
                { n: solStats.recibidas,   l: 'Recibidas',              c: '#c4622d', ic: 'recibidas' },
                { n: solStats.revision,    l: 'En revisión',            c: '#D97706', ic: 'revision' },
                { n: solStats.reunion,     l: 'Reunión agendada',       c: '#b45309', ic: 'reunion' },
                { n: solStats.convertidas, l: 'Convertidas en proyecto', c: '#16A34A', ic: 'convertidas' },
              ].map(({ n, l, c, ic }) => (
                <div key={l} className="sol-mini" style={{ background: `${c}0d`, borderColor: `${c}22` }}>
                  <div style={{ color: c, display: 'flex', marginBottom: 6 }}>{SOL_MINI_ICON[ic]}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text2)', lineHeight: 1.25, minHeight: 26 }}>{l}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--text)', lineHeight: 1, marginTop: 4 }}>{n}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text2)', whiteSpace: 'nowrap' }}>Tasa de conversión</span>
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 13, color: 'var(--accent)' }}>{convRate}%</span>
              <div className="bar-h-track" style={{ height: 8, flex: 1 }}>
                <div className="bar-h-fill" style={{ width: `${convRate}%`, background: 'var(--accent)' }} />
              </div>
              <span style={{ fontSize: 10.5, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                {solStats.convertidas} de {solTotal} solicitudes
              </span>
            </div>
          </div>
        )}

        <div className="chart-box">
          <PanelHead icon={PANEL_ICON.clock} title="Proyectos por área" />
          <div className="tipo-cards">
            {Object.entries(TIPO_INFO).map(([key, info]) => (
              <div key={key} className="tipo-card" style={{ background: info.bg, borderColor: `${info.color}25` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: info.color }}>{info.label}</div>
                <div style={{ fontSize: 26, fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--text)', lineHeight: 1.1 }}>{tipoCnt[key]}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: info.color }}>{total ? Math.round(tipoCnt[key] / total * 100) : 0}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Carga del equipo — tabla */}
      <div className="chart-box" style={{ marginTop: 16 }}>
        <PanelHead icon={PANEL_ICON.team} title="Carga del equipo" sub="Proyectos activos por persona" />
        {team.length === 0
          ? <div className="empty">Sin ingenieros registrados</div>
          : <TeamTable projects={projects} users={team} />}
      </div>

      {/* Área solicitante */}
      <div className="chart-box" style={{ marginTop: 16 }}>
        <div className="chart-title">Proyectos por área solicitante</div>
        <div className="chart-subtitle">Total de proyectos registrados por cada área</div>
        {areaTop.map(([area, n]) => (
          <div className="bar-h" key={area}>
            <div className="bar-h-label" title={area}>{area}</div>
            <div className="bar-h-track">
              <div className="bar-h-fill" style={{ width: `${(n / maxArea) * 100}%`, background: 'var(--accent)' }} />
            </div>
            <div className="bar-h-val">{n}</div>
          </div>
        ))}
      </div>
    </>
  );
}
