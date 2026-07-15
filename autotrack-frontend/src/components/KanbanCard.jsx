import { useRef } from 'react';
import { dateStatus, colorClass } from '../utils/helpers';

const PR = {
  high: { l: 'Alta',  bg: '#FEF2F2', c: '#EF4444' },
  mid:  { l: 'Media', bg: '#FFF3E8', c: '#F97316' },
  low:  { l: 'Baja',  bg: '#ECFDF3', c: '#22C55E' },
};

const TIPO_LABEL = { automatizacion: 'Auto', analitica: 'Analítica', compartido: 'Compartido', asignacion_flash: 'Flash' };
const TIPO_CLS   = { automatizacion: 'tipo-auto', analitica: 'tipo-analitica', compartido: 'tipo-compartido', asignacion_flash: 'tipo-flash' };

const fmtDM = (d) => {
  if (!d) return null;
  const dt = new Date(d + 'T00:00:00');
  return `${dt.getDate()} ${dt.toLocaleDateString('es-CO', { month: 'short' }).replace('.', '')}`;
};

export default function KanbanCard({ project, onClick, compact = false, index = 0, isDragging = false, onDragStart, onDragEnd }) {
  const cardRef = useRef(null);
  const pct  = project.progress || 0;
  const dSt  = dateStatus(project.dueDate);
  const eng  = project.assignee;
  const pr   = project.priority || 'mid';
  const tipo = project.tipo || 'automatizacion';

  /* ── 3D tilt — direct DOM, zero re-renders ── */
  const handleMouseMove = (e) => {
    if (isDragging || !cardRef.current) return;
    const el = cardRef.current;
    const r  = el.getBoundingClientRect();
    const x  = (e.clientX - r.left) / r.width;   // 0→1
    const y  = (e.clientY - r.top)  / r.height;  // 0→1
    const rX = (y - 0.5) * -14;
    const rY = (x - 0.5) *  14;
    el.style.transition = 'box-shadow .08s, border-color .08s';
    el.style.transform  = `perspective(800px) rotateX(${rX}deg) rotateY(${rY}deg) translateY(-6px) scale(1.02)`;
    el.style.boxShadow  = `${rY * 1.2}px ${Math.abs(rX) * 2 + 10}px 40px rgba(249,146,77,.22), 0 4px 12px rgba(0,0,0,.08)`;
    el.style.borderColor = 'rgba(249,146,77,.35)';
    el.style.setProperty('--mx', `${x * 100}%`);
    el.style.setProperty('--my', `${y * 100}%`);
  };

  const handleMouseLeave = () => {
    if (!cardRef.current) return;
    const el = cardRef.current;
    el.style.transition  = 'transform .5s cubic-bezier(.34,1.56,.64,1), box-shadow .4s ease, border-color .4s ease';
    el.style.transform   = '';
    el.style.boxShadow   = '';
    el.style.borderColor = '';
  };

  const handleDragStart = (e) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', project.id);
    if (onDragStart) onDragStart(project);
  };

  return (
    <div
      ref={cardRef}
      className={`card${isDragging ? ' card-dragging' : ''}`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onClick={() => !isDragging && onClick(project.id)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ animationDelay: `${index * 55}ms`, padding: '12px 14px' }}
    >
      {/* Pills: prioridad + tipo + área */}
      <div className="at-card-top">
        <span className="pill-mini" style={{ background: PR[pr].bg, color: PR[pr].c }}>{PR[pr].l}</span>
        <span className={`tipo-badge ${TIPO_CLS[tipo]}`}>{TIPO_LABEL[tipo]}</span>
        {project.client && <span className="at-card-client" style={{ marginLeft: 'auto', maxWidth: 96, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.client}</span>}
      </div>

      {/* Cuerpo estilo Equipo Analítica */}
      <div className="at-card-main">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="at-card-title">{project.name}</div>
          <div className="at-card-meta">
            {eng
              ? <span className={`avatar-xs ${colorClass(eng.colorIndex)}`} title={eng.name}>{eng.initials}</span>
              : <span style={{ fontSize: 10.5, color: 'var(--text4)', whiteSpace: 'nowrap' }}>Sin asignar</span>}
            <span className="at-card-bar">
              <span style={{ width: `${pct}%`, background: pct >= 80 ? '#22C55E' : 'var(--accent)' }} />
            </span>
            <span className="at-card-pct" style={{ color: pct >= 80 ? '#22C55E' : 'var(--accent)' }}>{pct}%</span>
          </div>
        </div>
        <div className="at-card-side">
          {project.docUrl && (
            <a href={project.docUrl} target="_blank" rel="noopener noreferrer" title="Abrir documentación"
              onClick={e => e.stopPropagation()} className="at-card-doc">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
            </a>
          )}
          {project.dueDate && (
            <span className="at-card-date" style={dSt === 'overdue' ? { color: 'var(--high)', fontWeight: 700 } : undefined}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              {fmtDM(project.dueDate)}
            </span>
          )}
        </div>
      </div>

      {/* Chip de compartido */}
      {tipo === 'compartido' && (
        <div className="at-card-shared" style={{ marginTop: 8 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          Compartido Auto + Analítica
        </div>
      )}
    </div>
  );
}
