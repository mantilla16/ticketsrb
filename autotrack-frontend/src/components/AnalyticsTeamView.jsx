import { useState } from 'react';
import { colorClass } from '../utils/helpers';

const PR = {
  high: { l: 'Alta',  bg: '#FEF2F2', c: '#EF4444' },
  mid:  { l: 'Media', bg: '#FFF3E8', c: '#F97316' },
  low:  { l: 'Baja',  bg: '#ECFDF3', c: '#22C55E' },
};

const STATUS_L = {
  backlog: 'Por hacer', progress: 'En proceso', standby: 'En standby',
  testing: 'En testing', done: 'Finalizado', soporte: 'En soporte',
};
const STATUS_BG = {
  backlog: '#F3F4F6', progress: '#FFF3E8', standby: '#F5EFE9',
  testing: '#FEF3C7', done: '#ECFDF3', soporte: '#e0f2fe',
};
const STATUS_C = {
  backlog: '#6B7280', progress: '#F97316', standby: '#A8907C',
  testing: '#D97706', done: '#22C55E', soporte: '#0891b2',
};

const PREVIEW = 5;

const fmtDM = (d) => {
  if (!d) return null;
  const dt = new Date(d + 'T00:00:00');
  return { day: dt.getDate(), mon: dt.toLocaleDateString('es-CO', { month: 'short' }).replace('.', '') };
};

export default function AnalyticsTeamView({ projects, users, onCardClick, onNavigate, variant = 'ana' }) {
  const [tab, setTab] = useState('all');
  const [expanded, setExpanded] = useState(new Set());

  const isAuto = variant === 'auto';
  const ownTipos = [isAuto ? 'automatizacion' : 'analitica', 'asignacion_flash'];
  const tipoOf = (p) => p.tipo || 'automatizacion';
  const anaProjects = projects.filter(p => [...ownTipos, 'compartido'].includes(tipoOf(p)));
  const byTab = p => tab === 'all' ? true : tab === 'ana' ? ownTipos.includes(tipoOf(p)) : tipoOf(p) === 'compartido';

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const week  = new Date(today); week.setDate(week.getDate() + 7);

  const totalAna    = anaProjects.filter(p => ownTipos.includes(tipoOf(p))).length;
  const totalComp   = anaProjects.filter(p => tipoOf(p) === 'compartido').length;
  const weekCount   = anaProjects.filter(p => p.dueDate && p.status !== 'done'
    && new Date(p.dueDate) >= today && new Date(p.dueDate) <= week).length;

  const upcoming = anaProjects
    .filter(p => p.dueDate && p.status !== 'done')
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 5);

  const toggleExpand = (id) => setExpanded(s => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const TABS = [
    { key: 'all',  label: 'Todos', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> },
    { key: 'ana',  label: isAuto ? 'Solo Automatización' : 'Solo Analítica', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
    { key: 'comp', label: 'Compartidos', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
  ];

  return (
    <div>
      {/* Tabs */}
      <div className="at-tabs no-print">
        {TABS.map(t => (
          <button key={t.key} className={`at-tab${tab === t.key ? ' at-tab--active' : ''}`} onClick={() => setTab(t.key)}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      <div className="at-layout">
        {/* Columnas por persona */}
        <div className="at-cols">
          {users.map(u => {
            const allForUser = anaProjects
              .filter(byTab)
              .filter(p => (p.assigneeIds || [p.assigneeId]).includes(u.id) || p.coAssigneeId === u.id);
            // Los finalizados quedan solo en Historial — aquí no se listan como tarjetas
            const list   = allForUser.filter(p => p.status !== 'done');
            const active = list.filter(p => ['progress', 'testing'].includes(p.status)).length;
            const done   = allForUser.filter(p => p.status === 'done').length;
            const isOpen = expanded.has(u.id);
            const shown  = isOpen ? list : list.slice(0, PREVIEW);
            const hidden = list.length - PREVIEW;

            return (
              <div key={u.id} className="at-col">
                <div className="at-col-head">
                  <div className={`avatar ${colorClass(u.colorIndex)}`}>{u.initials}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="at-col-name">{u.name}</div>
                    <div className="at-col-count">{list.length} proyecto{list.length !== 1 ? 's' : ''}</div>
                  </div>
                  <div className="at-col-stats">
                    <span><i style={{ background: '#F97316' }} />{active} activos</span>
                    <span><i style={{ background: '#22C55E' }} />{done} finalizados</span>
                  </div>
                </div>

                {list.length === 0 ? (
                  <div className="at-empty">
                    <div className="at-empty-icon">
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                        <line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>
                      </svg>
                    </div>
                    <div className="at-empty-title">{done > 0 ? 'Sin proyectos activos' : 'Sin proyectos asignados'}</div>
                    <div className="at-empty-sub">
                      {done > 0 ? `Tiene ${done} finalizado${done !== 1 ? 's' : ''} — puedes verlos en Historial.` : 'Cuando se asignen proyectos, aparecerán aquí.'}
                    </div>
                  </div>
                ) : (
                  <>
                    {shown.map(p => {
                      const pr  = PR[p.priority] || PR.mid;
                      const pct = p.progress || 0;
                      const dm  = fmtDM(p.dueDate);
                      return (
                        <div key={p.id} className="at-card" onClick={() => onCardClick(p.id)}>
                          <div className="at-card-top">
                            <span className="pill-mini" style={{ background: pr.bg, color: pr.c }}>{pr.l}</span>
                            {p.status !== 'progress' && (
                              <span className="pill-mini" style={{ background: STATUS_BG[p.status], color: STATUS_C[p.status] }}>{STATUS_L[p.status]}</span>
                            )}
                            {p.client && <span className="at-card-client">{p.client}</span>}
                          </div>
                          <div className="at-card-main">
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="at-card-title">{p.name}</div>
                              <div className="at-card-meta">
                                <span className={`avatar-xs ${colorClass(u.colorIndex)}`}>{u.initials}</span>
                                <span className="at-card-bar">
                                  <span style={{ width: `${pct}%`, background: pct >= 80 ? '#22C55E' : 'var(--accent)' }} />
                                </span>
                                <span className="at-card-pct" style={{ color: pct >= 80 ? '#22C55E' : 'var(--accent)' }}>{pct}%</span>
                              </div>
                            </div>
                            <div className="at-card-side">
                              {p.docUrl && (
                                <a href={p.docUrl} target="_blank" rel="noopener noreferrer" title="Abrir documentación"
                                  onClick={e => e.stopPropagation()} className="at-card-doc">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                                  </svg>
                                </a>
                              )}
                              {dm && (
                                <span className="at-card-date">
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                  {dm.day} {dm.mon}
                                </span>
                              )}
                            </div>
                          </div>
                          {p.tasks?.length > 0 && (() => {
                            const doneCount = p.tasks.filter(t => t.done).length;
                            const pending = p.tasks.length - doneCount;
                            const allDone = pending === 0;
                            return (
                              <div className={`at-card-tasks-summary${allDone ? ' at-card-tasks-summary--done' : ''}`}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12"/>
                                </svg>
                                {allDone ? 'Todas las tareas completadas' : `${pending} tarea${pending !== 1 ? 's' : ''} pendiente${pending !== 1 ? 's' : ''}`}
                                <span>{doneCount}/{p.tasks.length}</span>
                              </div>
                            );
                          })()}
                          {tipoOf(p) === 'compartido' && (
                            <div className="at-card-shared">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                              Compartido con {isAuto ? 'Analítica' : 'Automatización'}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {hidden > 0 && (
                      <button className="at-more" onClick={() => toggleExpand(u.id)}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                          style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                        {isOpen ? 'Ver menos' : `Ver todos · ${hidden} más`}
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Panel lateral */}
        <aside className="at-side">
          <div className="chart-box" style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              <span className="chart-title" style={{ marginBottom: 0 }}>Resumen del equipo</span>
            </div>
            {[
              { n: totalAna,  l: isAuto ? 'Totales de Automatización' : 'Totales de Analítica', u: 'proyectos', c: '#F97316', bg: '#FFF3E8',
                ic: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg> },
              { n: totalComp, l: 'Compartidos', u: 'proyectos', c: '#F97316', bg: '#FFF3E8',
                ic: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
              { n: weekCount, l: 'Próximas entregas', u: 'esta semana', c: '#22C55E', bg: '#ECFDF3',
                ic: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="8.5 12.5 11 15 15.5 9.5"/></svg> },
            ].map(({ n, l, u: unit, c, bg, ic }) => (
              <div key={l} className="at-sum-row">
                <span className="at-sum-icon" style={{ background: bg, color: c }}>{ic}</span>
                <div>
                  <div className="at-sum-label">{l}</div>
                  <div className="at-sum-num">{n} <span>{unit}</span></div>
                </div>
              </div>
            ))}
          </div>

          <div className="chart-box">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span className="chart-title" style={{ marginBottom: 0 }}>Próximas entregas</span>
            </div>
            {upcoming.length === 0 && <div style={{ fontSize: 12, color: 'var(--text3)', padding: '6px 0 10px' }}>Sin entregas programadas</div>}
            {upcoming.map(p => {
              const dm = fmtDM(p.dueDate);
              const pr = PR[p.priority] || PR.mid;
              const overdue = new Date(p.dueDate) < today;
              return (
                <div key={p.id} className="at-due-row" onClick={() => onCardClick(p.id)}>
                  <div className="at-due-date" style={overdue ? { color: 'var(--high)' } : undefined}>
                    <b>{dm.day}</b>
                    <span>{dm.mon}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="at-due-name">{p.name}</div>
                    {p.client && <div className="at-due-client">{p.client}</div>}
                  </div>
                  <span className="pill-mini" style={{ background: pr.bg, color: pr.c }}>{pr.l}</span>
                </div>
              );
            })}
            {onNavigate && (
              <button className="at-cal-btn" onClick={() => onNavigate('gantt')}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                Ver calendario completo
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
