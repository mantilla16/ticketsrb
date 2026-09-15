/* ProjectBoard — kanban unificado por estado.
   Todos los proyectos (automatización, analítica, compartido, flash) se ven
   en un solo tablero con columnas: Por hacer → En proceso → Testing → Finalizado.
   Click en una tarjeta abre el panel lateral de detalle. */

import { useState } from 'react';
import { colorClass } from '../utils/helpers';

const PR = {
  high: { l: 'Alta',  bg: 'var(--rb-danger-bg)', c: 'var(--rb-danger)' },
  mid:  { l: 'Media', bg: 'var(--rb-navy-tint)', c: 'var(--rb-navy)' },
  low:  { l: 'Baja',  bg: 'var(--rb-success-bg)', c: 'var(--rb-success)' },
};

const STATUS_L = {
  backlog: 'Por hacer', progress: 'En proceso', standby: 'En standby',
  testing: 'Testing', done: 'Finalizado', soporte: 'Soporte', cancelado: 'Cancelado',
};
const STATUS_BG = {
  backlog: 'var(--rb-neutral-bg)', progress: 'var(--rb-navy-tint)', standby: 'var(--rb-n-100)',
  testing: 'var(--rb-warning-bg)', done: 'var(--rb-success-bg)', soporte: '#e0f2fe', cancelado: 'var(--rb-danger-bg)',
};
const STATUS_C = {
  backlog: 'var(--rb-neutral)', progress: 'var(--rb-navy)', standby: 'var(--rb-n-400)',
  testing: 'var(--rb-warning)', done: 'var(--rb-success)', soporte: '#0B6E80', cancelado: 'var(--rb-danger)',
};

const COLUMNS = [
  { key: 'backlog',  label: 'Por hacer' },
  { key: 'progress', label: 'En proceso' },
  { key: 'soporte',  label: 'Soporte' },
  { key: 'testing',  label: 'Testing' },
  { key: 'done',     label: 'Finalizado' },
];

const TABS = [
  { key: 'all',  label: 'Todos' },
  { key: 'auto', label: 'Automatización' },
  { key: 'ana',  label: 'Analítica' },
  { key: 'comp', label: 'Compartidos' },
];

const fmtShort = (d) => {
  if (!d) return null;
  const dt = new Date(d + 'T00:00:00');
  return { day: dt.getDate(), mon: dt.toLocaleDateString('es-CO', { month: 'short' }).replace('.', '') };
};

const isOverdue = (d) => {
  if (!d) return false;
  return new Date(d + 'T00:00:00') < new Date(new Date().toDateString());
};

function ProjectCard({ project: p, onClick }) {
  const pr  = PR[p.priority] || PR.mid;
  const pct = p.progress || 0;
  const dm  = fmtShort(p.dueDate);
  const overdue = isOverdue(p.dueDate);
  const pending = (p.tasks || []).filter(t => !t.done).length;
  const total   = (p.tasks || []).length;
  const people  = p.assignees?.length ? p.assignees : (p.assignee ? [p.assignee] : []);

  return (
    <div className="pb-card" onClick={() => onClick(p.id)}>
      <div className="pb-card-top">
        <span className="pill-mini" style={{ background: pr.bg, color: pr.c }}>{pr.l}</span>
        {p.client && <span className="pb-card-client">{p.client}</span>}
      </div>
      <div className="pb-card-title">{p.name}</div>
      <div className="pb-card-meta">
        {people.length > 0 && (
          <div className="rb-avatar-stack" style={{ marginRight: 6 }}>
            {people.slice(0, 3).map(u => (
              <span key={u.id} className={`rb-avatar rb-avatar--sm`} data-c={(u.colorIndex ?? 0) % 8}
                title={u.name}>{u.initials}</span>
            ))}
          </div>
        )}
        {dm && (
          <span className="pb-card-date" style={overdue ? { color: 'var(--rb-danger)' } : undefined}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            {dm.day} {dm.mon}
          </span>
        )}
        <span className="pb-card-bar">
          <span style={{ width: `${pct}%`, background: pct >= 80 ? 'var(--rb-success)' : 'var(--accent)' }} />
        </span>
        <span className="pb-card-pct" style={{ color: pct >= 80 ? 'var(--rb-success)' : 'var(--accent)' }}>{pct}%</span>
      </div>
      {total > 0 && (
        <div className={`pb-card-tasks${pending === 0 ? ' pb-card-tasks--done' : ''}`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          {pending === 0 ? 'Completado' : `${pending} pendiente${pending !== 1 ? 's' : ''}`}
          <span>{total - pending}/{total}</span>
        </div>
      )}
    </div>
  );
}

export default function ProjectBoard({ projects, users, allUsers, onCardClick, onNewProject }) {
  const [tab, setTab] = useState('all');

  const tipoOf = (p) => p.tipo || 'automatizacion';
  const filtered = projects.filter(p => {
    if (tab === 'all') return true;
    if (tab === 'auto') return tipoOf(p) === 'automatizacion';
    if (tab === 'ana') return tipoOf(p) === 'analitica';
    if (tab === 'comp') return tipoOf(p) === 'compartido';
    return true;
  }).filter(p => !['done', 'cancelado'].includes(p.status));

  const allProjects = projects.filter(p => !['done', 'cancelado'].includes(p.status));
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const today  = new Date(); today.setHours(0, 0, 0, 0);
  const week   = new Date(today.getTime() + weekMs);

  const overdueCount = allProjects.filter(p => isOverdue(p.dueDate)).length;
  const weekCount    = allProjects.filter(p => p.dueDate && new Date(p.dueDate) >= today && new Date(p.dueDate) <= week).length;

  const upcoming = allProjects
    .filter(p => p.dueDate)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 6);

  return (
    <div>
      {/* Tabs */}
      <div className="pb-tabs">
        {TABS.map(t => (
          <button key={t.key} className={`pb-tab${tab === t.key ? ' pb-tab--active' : ''}`}
            onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="pb-layout">
        {/* Columnas */}
        <div className="pb-cols">
          {COLUMNS.map(col => {
            const colProjects = filtered.filter(p => p.status === col.key);
            return (
              <div key={col.key} className="pb-col">
                <div className="pb-col-head">
                  <span className="pb-col-label">{col.label}</span>
                  <span className="pb-col-count">{colProjects.length}</span>
                </div>
                <div className="pb-col-body">
                  {colProjects.map(p => (
                    <ProjectCard key={p.id} project={p} onClick={onCardClick} />
                  ))}
                  {colProjects.length === 0 && (
                    <div className="pb-col-empty">
                      {col.key === 'backlog' && onNewProject ? (
                        <button className="pb-add-btn" onClick={onNewProject}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                          Nuevo proyecto
                        </button>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--rb-text-4)' }}>Sin proyectos</span>
                      )}
                    </div>
                  )}
                  {col.key === 'backlog' && colProjects.length > 0 && onNewProject && (
                    <button className="pb-add-btn" onClick={onNewProject}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Nuevo proyecto
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Sidebar */}
        <aside className="pb-side">
          <div className="pb-side-box">
            <div className="pb-side-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--rb-text-2)" strokeWidth="2" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              Resumen
            </div>
            <div className="pb-sum-row">
              <span className="pb-sum-icon" style={{ background: 'var(--rb-navy-tint)', color: 'var(--rb-navy)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
              </span>
              <div>
                <div className="pb-sum-label">Total activos</div>
                <div className="pb-sum-num">{allProjects.length} <span>proyectos</span></div>
              </div>
            </div>
            {overdueCount > 0 && (
              <div className="pb-sum-row">
                <span className="pb-sum-icon" style={{ background: 'var(--rb-danger-bg)', color: 'var(--rb-danger)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                </span>
                <div>
                  <div className="pb-sum-label">Vencidos</div>
                  <div className="pb-sum-num" style={{ color: 'var(--rb-danger)' }}>{overdueCount} <span>proyectos</span></div>
                </div>
              </div>
            )}
            {weekCount > 0 && (
              <div className="pb-sum-row">
                <span className="pb-sum-icon" style={{ background: 'var(--rb-success-bg)', color: 'var(--rb-success)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><polyline points="8.5 12.5 11 15 15.5 9.5"/></svg>
                </span>
                <div>
                  <div className="pb-sum-label">Próximas entregas</div>
                  <div className="pb-sum-num">{weekCount} <span>esta semana</span></div>
                </div>
              </div>
            )}
          </div>

          <div className="pb-side-box">
            <div className="pb-side-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--rb-text-2)" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Calendario
            </div>
            {upcoming.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--rb-text-4)', padding: '6px 0 10px' }}>Sin entregas programadas</div>
            )}
            {upcoming.map(p => {
              const dm = fmtShort(p.dueDate);
              const pr = PR[p.priority] || PR.mid;
              const overdue = isOverdue(p.dueDate);
              return (
                <div key={p.id} className="pb-due-row" onClick={() => onCardClick(p.id)}>
                  <div className="pb-due-date" style={overdue ? { color: 'var(--rb-danger)' } : undefined}>
                    <b>{dm.day}</b>
                    <span>{dm.mon}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="pb-due-name">{p.name}</div>
                    {p.client && <div className="pb-due-client">{p.client}</div>}
                  </div>
                  <span className="pill-mini" style={{ background: pr.bg, color: pr.c }}>{pr.l}</span>
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}
