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
      .map(u => ({
        name:   u.name.split(' ')[0],
        full:   u.name,
        value:  Math.max(projects.filter(p => p.assigneeId === u.id).length, 1),
        total:  projects.filter(p => p.assigneeId === u.id).length,
        active: projects.filter(p => p.assigneeId === u.id && (p.status === 'progress' || p.status === 'testing')).length,
        done:   projects.filter(p => p.assigneeId === u.id && p.status === 'done').length,
        color:  ENG_HEX[u.colorIndex % 5],
      }))
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

/* ── KPI card — quiet surface, color carried by dot + sparkline ── */
function KpiCard({ label, value, color, spark, alert }) {
  const animated = useCountUp(value);
  return (
    <div className="kpi-card">
      <div className="kpi-head">
        <span className="kpi-dot" style={{ background: color }} />
        <span className="kpi-label">{label}</span>
      </div>
      <div className="kpi-num" style={alert && value > 0 ? { color } : undefined}>
        <span className="dash-num-inner" key={value}>{animated}</span>
      </div>
      <Sparkline values={spark} color={color} />
    </div>
  );
}

/* ── Engineer workload with expandable active projects ── */
function EngWorkload({ projects, users, onCardClick }) {
  const [openId, setOpenId] = useState(null);

  return (
    <div>
      {users.map((eng, i) => {
        const assigned    = projects.filter(p => p.assigneeId === eng.id);
        const activeProjs = assigned.filter(p => p.status === 'progress' || p.status === 'testing');
        const active      = activeProjs.length;
        const pct         = assigned.length ? Math.round(active / assigned.length * 100) : 0;
        const isOpen      = openId === eng.id;

        return (
          <div key={eng.id} className="eng-block" style={{ animationDelay: `${i * 80}ms` }}>
            {/* Row header — clickable */}
            <div
              className={`eng-row${active > 0 ? ' eng-row--clickable' : ''}`}
              onClick={() => active > 0 && setOpenId(isOpen ? null : eng.id)}
            >
              <div className={`avatar-sm ${colorClass(eng.colorIndex)}`}>{eng.initials}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{eng.name}</span>
                  <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text2)' }}>{assigned.length} proyectos</span>
                </div>
                <div style={{ height: 6, background: 'var(--bg)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, transition: 'width .6s var(--ease-out)' }}
                    className={`eng-c-${eng.colorIndex}`} />
                </div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>
                  {active} activo{active !== 1 ? 's' : ''}
                </div>
              </div>
              <div className="eng-proj-count">{assigned.length}</div>
              {active > 0 && (
                <div className={`eng-chevron${isOpen ? ' eng-chevron--open' : ''}`}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>
              )}
            </div>

            {/* Expanded active projects */}
            {isOpen && (
              <div className="eng-expand">
                {activeProjs.map((p, j) => (
                  <div
                    key={p.id}
                    className="eng-expand-item"
                    style={{ animationDelay: `${j * 35}ms` }}
                    onClick={() => onCardClick && onCardClick(p.id)}
                  >
                    <span className="eng-expand-dot" style={{ background: STATUS_COLOR[p.status] }} />
                    <div className="eng-expand-info">
                      <span className="eng-expand-name">{p.name}</span>
                      {p.client && <span className="eng-expand-client">{p.client}</span>}
                    </div>
                    <span className="eng-expand-status" style={{ color: STATUS_COLOR[p.status] }}>
                      {STATUS_LABEL[p.status]}
                    </span>
                    <span className="eng-expand-pct">{p.progress || 0}%</span>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text4)" strokeWidth="2" strokeLinecap="round">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const TIPO_INFO = {
  automatizacion:  { label: 'Automatización', color: '#f9924d', bg: 'rgba(249,146,77,.12)' },
  analitica:       { label: 'Analítica',       color: '#7c3aed', bg: 'rgba(124,58,237,.10)' },
  compartido:      { label: 'Compartido',      color: '#0891b2', bg: 'rgba(8,145,178,.10)'  },
  asignacion_flash:{ label: 'Flash',           color: '#d97706', bg: 'rgba(217,119,6,.10)'  },
};

export default function DashboardView({ projects, users, onCardClick }) {
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

  // Carga por equipo — proyectos activos por área (compartidos cuentan en ambas)
  const ACTIVE = ['backlog', 'progress', 'standby', 'testing'];
  const teamLoad = { auto: { active: 0, total: 0 }, analitica: { active: 0, total: 0 } };
  projects.forEach(p => {
    const t = p.tipo || 'automatizacion';
    const isActive = ACTIVE.includes(p.status);
    if (t === 'automatizacion' || t === 'asignacion_flash' || t === 'compartido') {
      teamLoad.auto.total++;
      if (isActive) teamLoad.auto.active++;
    }
    if (t === 'analitica' || t === 'compartido') {
      teamLoad.analitica.total++;
      if (isActive) teamLoad.analitica.active++;
    }
  });
  const maxTeam = Math.max(1, teamLoad.auto.active, teamLoad.analitica.active);

  const spark = {
    progress: [cnt.progress * 0.4, cnt.progress * 0.55, cnt.progress * 0.65, cnt.progress * 0.75, cnt.progress * 0.85, cnt.progress * 0.92, cnt.progress],
    standby:  [cnt.standby, cnt.standby * 1.2, cnt.standby * 0.9, cnt.standby * 1.1, cnt.standby, cnt.standby * 0.85, cnt.standby],
    done:     [0, cnt.done * 0.2, cnt.done * 0.4, cnt.done * 0.6, cnt.done * 0.78, cnt.done * 0.9, cnt.done],
    total:    [total * 0.5, total * 0.6, total * 0.7, total * 0.8, total * 0.86, total * 0.92, total],
  };

  return (
    <>
      {/* Export actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 8 }} className="no-print">
        <a className="btn btn-ghost btn-sm" style={{ gap: 6, textDecoration: 'none' }}
          target="_blank" rel="noopener noreferrer"
          href={`https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent('Dashboard ejecutivo — AMBARC')}&body=${encodeURIComponent(`Hola,\n\nComparto el enlace al dashboard ejecutivo de proyectos:\n${window.location.origin}${window.location.pathname}\n\nSaludos.`)}`}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          Compartir por correo
        </a>
        <button className="btn btn-ghost btn-sm" onClick={() => window.print()} style={{ gap: 6 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
            <rect x="6" y="14" width="12" height="8"/>
          </svg>
          Exportar / Imprimir
        </button>
      </div>

      {/* KPI row — quiet cards, semantic dot color */}
      <div className="dash-grid">
        <KpiCard label="Por hacer"   value={cnt.backlog}  color="#a86040" spark={[cnt.backlog,cnt.backlog,cnt.backlog,cnt.backlog,cnt.backlog,cnt.backlog,cnt.backlog]} />
        <KpiCard label="En proceso"  value={cnt.progress} color="#f9924d" spark={spark.progress} />
        <KpiCard label="En testing"  value={cnt.testing}  color="#e87d3a" spark={[0,cnt.testing,cnt.testing,cnt.testing,cnt.testing,cnt.testing,cnt.testing]} />
        <KpiCard label="En standby"  value={cnt.standby}  color="#78716C" spark={spark.standby} />
        <KpiCard label="Finalizados" value={cnt.done}     color="#16A34A" spark={spark.done} />
        <KpiCard label="Vencidos"    value={overdueCount} color="#DC2626" alert spark={[0,overdueCount,overdueCount,overdueCount,overdueCount,overdueCount,overdueCount]} />
        <KpiCard label="En soporte"  value={cnt.soporte}  color="#0891b2" spark={[0,cnt.soporte,cnt.soporte,cnt.soporte,cnt.soporte,cnt.soporte,cnt.soporte]} />
        <KpiCard label="Total"       value={total}        color="#5a2807" spark={spark.total} />
      </div>

      {/* Tipo breakdown — quiet strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginTop: 12 }}>
        {Object.entries(TIPO_INFO).map(([key, info]) => (
          <div key={key} className="tipo-mini">
            <div className="tipo-mini-bar" style={{ background: info.color }} />
            <div>
              <div className="tipo-mini-num">{tipoCnt[key]}</div>
              <div className="tipo-mini-lbl">{info.label}</div>
            </div>
          </div>
        ))}
        {upcomingCount > 0 && (
          <div className="tipo-mini">
            <div className="tipo-mini-bar" style={{ background: '#d97706' }} />
            <div>
              <div className="tipo-mini-num" style={{ color: '#d97706' }}>{upcomingCount}</div>
              <div className="tipo-mini-lbl">Entregas próx.</div>
            </div>
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="chart-row">
        <div className="chart-box">
          <div className="chart-title">Carga por persona</div>
          <div className="chart-subtitle">Tamaño = total proyectos · intensidad = % activos</div>
          <TreemapChart projects={projects} users={users.filter(u => ['engineer','member_analytics'].includes(u.role))} />
        </div>

        <div className="chart-box">
          <div className="chart-title">Distribución del portafolio</div>
          <div className="chart-subtitle">Por prioridad y estado actual</div>
          <div style={{ marginTop: 20 }}>
            {[['high','Alta','#DC2626'],['mid','Media','#f9924d'],['low','Baja','#16A34A']].map(([k, l, c]) => (
              <div className="bar-h" key={k}>
                <div className="bar-h-label" style={{ width: 58 }}>{l}</div>
                <div className="bar-h-track">
                  <div className="bar-h-fill" style={{ width: `${Math.round(prCnt[k] / maxPr * 100)}%`, background: c }} />
                </div>
                <div className="bar-h-val">{prCnt[k]}</div>
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 16, paddingTop: 16 }}>
              {Object.entries(STATUS_LABEL).map(([k, l]) => (
                <div className="bar-h" key={k}>
                  <div className="bar-h-label" style={{ width: 78, fontSize: 11 }}>{l}</div>
                  <div className="bar-h-track">
                    <div className="bar-h-fill" style={{ width: `${Math.round(cnt[k] / maxCnt * 100)}%`, background: STATUS_BAR[k] }} />
                  </div>
                  <div className="bar-h-val">{cnt[k]}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Área solicitante + carga por equipo */}
      <div className="chart-row" style={{ marginTop: 16 }}>
        <div className="chart-box">
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

        <div className="chart-box">
          <div className="chart-title">Carga por equipo</div>
          <div className="chart-subtitle">Proyectos activos — los compartidos cuentan en ambos equipos</div>
          {[
            { key: 'auto',      label: 'Automatización', color: '#f9924d', data: teamLoad.auto },
            { key: 'analitica', label: 'Analítica',       color: '#7c3aed', data: teamLoad.analitica },
          ].map(({ key, label, color, data }) => (
            <div key={key} style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{label}</span>
                <span style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text2)' }}>
                  <b style={{ color, fontSize: 16 }}>{data.active}</b> activos · {data.total} en total
                </span>
              </div>
              <div className="bar-h-track" style={{ height: 26 }}>
                <div className="bar-h-fill" style={{ width: `${(data.active / maxTeam) * 100}%`, background: color }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Team workload */}
      <div className="chart-box" style={{ marginTop: 16 }}>
        <div className="chart-title">Carga del equipo</div>
        <div className="chart-subtitle" style={{ marginBottom: 18 }}>Proyectos activos por ingeniero — clic para expandir</div>
        {users.length === 0 && <div className="empty">Sin ingenieros registrados</div>}
        <EngWorkload projects={projects} users={users.filter(u => ['engineer','member_analytics'].includes(u.role))} onCardClick={onCardClick} />
      </div>
    </>
  );
}
