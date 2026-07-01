import { useRef } from 'react';
import { fmtDate, dateStatus, colorClass } from '../utils/helpers';

const PR_PILL  = { high: 'pp-high', mid: 'pp-mid', low: 'pp-low' };
const PR_LABEL = { high: 'Alta',   mid: 'Media',  low: 'Baja'   };

export default function KanbanCard({ project, onClick, compact = false, index = 0, isDragging = false, onDragStart, onDragEnd }) {
  const cardRef = useRef(null);
  const pct = project.progress || 0;
  const dSt = dateStatus(project.dueDate);
  const eng = project.assignee;
  const pr  = project.priority || 'mid';

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
    el.style.boxShadow  = `${rY * 1.2}px ${Math.abs(rX) * 2 + 10}px 40px rgba(91,79,233,.22), 0 4px 12px rgba(0,0,0,.08)`;
    el.style.borderColor = 'rgba(91,79,233,.35)';
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
      style={{ animationDelay: `${index * 55}ms` }}
    >
      {/* Priority + client */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
        <span className={`priority-pill ${PR_PILL[pr]}`}>{PR_LABEL[pr]}</span>
        {project.client && (
          <span style={{ fontSize:11, color:'var(--text3)', maxWidth:100, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {project.client}
          </span>
        )}
      </div>

      {/* Title */}
      <div className="card-title" style={{ marginBottom:10 }}>{project.name}</div>

      {/* Footer */}
      <div className="card-footer">
        {eng ? (
          <div className="card-assignee">
            <div className={`avatar-xs ${colorClass(eng.colorIndex)}`}>{eng.initials}</div>
            {!compact && <span className="card-assignee-name">{eng.name.split(' ')[0]}</span>}
          </div>
        ) : (
          <span style={{ fontSize:11, color:'var(--text4)' }}>Sin asignar</span>
        )}
        {project.dueDate && (
          <div className={`card-date ${dSt}`}>
            {dSt === 'overdue' ? '⚑ ' : ''}{fmtDate(project.dueDate)}
          </div>
        )}
      </div>

      {/* Progress — flush bottom */}
      <div className="card-progress">
        <div className={`card-progress-fill${pct >= 100 ? ' done' : ''}`} style={{ width:`${pct}%` }} />
      </div>
    </div>
  );
}
