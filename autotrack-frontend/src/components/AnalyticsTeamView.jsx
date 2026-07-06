import { useRef } from 'react';
import { colorClass } from '../utils/helpers';

const STATUSES = [
  { id: 'progress', label: 'En proceso', dot: '#4F5FE8' },
  { id: 'standby',  label: 'Standby',    dot: '#78716C' },
  { id: 'testing',  label: 'Testing',    dot: '#6D7AE8' },
  { id: 'backlog',  label: 'Por hacer',  dot: '#8F95A3' },
  { id: 'done',     label: 'Finalizado', dot: '#16A34A' },
];

const PR_ORDER = { high: 0, mid: 1, low: 2 };

const MEMBER_ORDER = ['miguel padilla', 'andres holguin'];

function MiniCard({ project, onClick, index }) {
  const ref = useRef(null);
  const pct = project.progress || 0;

  const handleMouseMove = (e) => {
    if (!ref.current) return;
    const el = ref.current;
    const r  = el.getBoundingClientRect();
    const x  = (e.clientX - r.left) / r.width;
    const y  = (e.clientY - r.top)  / r.height;
    const rX = (y - 0.5) * -10;
    const rY = (x - 0.5) *  10;
    el.style.transition  = 'box-shadow .08s';
    el.style.transform   = `perspective(600px) rotateX(${rX}deg) rotateY(${rY}deg) translateY(-4px) scale(1.02)`;
    el.style.boxShadow   = `${rY * 1.1}px ${Math.abs(rX) * 2 + 8}px 28px rgba(91,79,233,.2), 0 2px 6px rgba(0,0,0,.06)`;
    el.style.borderColor = 'rgba(91,79,233,.28)';
    el.style.setProperty('--mx', `${x * 100}%`);
    el.style.setProperty('--my', `${y * 100}%`);
  };

  const handleMouseLeave = () => {
    if (!ref.current) return;
    const el = ref.current;
    el.style.transition  = 'transform .5s cubic-bezier(.34,1.56,.64,1), box-shadow .4s, border-color .4s';
    el.style.transform   = '';
    el.style.boxShadow   = '';
    el.style.borderColor = '';
  };

  return (
    <div
      ref={ref}
      className="at-mini-card"
      onClick={() => onClick(project.id)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ animationDelay: `${index * 45}ms` }}
    >
      <div className="at-mini-name">{project.name}</div>
      {project.client && <div className="at-mini-client">{project.client}</div>}
      <div className="at-mini-footer">
        <div className={`at-mini-pr at-mini-pr--${project.priority || 'mid'}`}>
          {project.priority === 'high' ? 'Alta' : project.priority === 'low' ? 'Baja' : 'Media'}
        </div>
        {pct > 0 && (
          <span className="at-mini-pct">{pct}%</span>
        )}
      </div>
      <div className="at-mini-bar">
        <div className="at-mini-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function AnalyticsTeamView({ projects, users, onCardClick }) {
  const teamMembers = MEMBER_ORDER
    .map(n => users.find(u => u.name.toLowerCase() === n))
    .filter(Boolean);

  if (teamMembers.length === 0) {
    return <div className="empty">No se encontraron los miembros del equipo de analítica.</div>;
  }

  return (
    <div className="at-root">

      {/* ── Tarjetas de perfil ── */}
      <div className="at-profiles">
        {teamMembers.map(u => {
          const myProjects = projects.filter(p => p.assigneeId === u.id);
          const active  = myProjects.filter(p => ['progress', 'testing'].includes(p.status)).length;
          const done    = myProjects.filter(p => p.status === 'done').length;
          const standby = myProjects.filter(p => p.status === 'standby').length;
          const backlog = myProjects.filter(p => p.status === 'backlog').length;
          return (
            <div key={u.id} className="at-profile-card">
              <div className="at-profile-left">
                <div className={`at-profile-avatar ${colorClass(u.colorIndex)}`}>{u.initials}</div>
                <div>
                  <div className="at-profile-name">{u.name}</div>
                  <div className="at-profile-role">Analítica de Datos</div>
                </div>
              </div>
              <div className="at-profile-stats">
                <div className="at-pstat">
                  <div className="at-pstat-val">{myProjects.length}</div>
                  <div className="at-pstat-lbl">Total</div>
                </div>
                <div className="at-pstat">
                  <div className="at-pstat-val" style={{ color: '#4F5FE8' }}>{active}</div>
                  <div className="at-pstat-lbl">Activos</div>
                </div>
                <div className="at-pstat at-pstat-sep">
                  <div className="at-pstat-val" style={{ color: '#78716C' }}>{standby}</div>
                  <div className="at-pstat-lbl">Standby</div>
                </div>
                <div className="at-pstat">
                  <div className="at-pstat-val" style={{ color: '#8F95A3' }}>{backlog}</div>
                  <div className="at-pstat-lbl">Backlog</div>
                </div>
                <div className="at-pstat">
                  <div className="at-pstat-val" style={{ color: '#16A34A' }}>{done}</div>
                  <div className="at-pstat-lbl">Listos</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Swimlanes ── */}
      {teamMembers.map(u => {
        const myProjects = projects.filter(p => p.assigneeId === u.id);
        return (
          <div key={u.id} className="at-swimlane">
            <div className="at-lane-header">
              <div className={`avatar-xs ${colorClass(u.colorIndex)}`}>{u.initials}</div>
              <span className="at-lane-name">{u.name}</span>
              <span className="at-lane-count">{myProjects.length} proyectos</span>
            </div>
            <div className="at-lane-cols">
              {STATUSES.map(st => {
                const cols = myProjects
                  .filter(p => p.status === st.id)
                  .sort((a, b) => (PR_ORDER[a.priority] || 1) - (PR_ORDER[b.priority] || 1));
                return (
                  <div key={st.id} className="at-col">
                    <div className="at-col-head">
                      <span className="at-col-dot" style={{ background: st.dot }} />
                      <span className="at-col-label">{st.label}</span>
                      <span className="at-col-n">{cols.length}</span>
                    </div>
                    <div className="at-col-body">
                      {cols.length === 0 && <div className="at-col-empty">—</div>}
                      {cols.map((p, i) => (
                        <MiniCard key={p.id} project={p} onClick={onCardClick} index={i} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
