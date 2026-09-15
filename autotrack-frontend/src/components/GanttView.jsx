import React, { useState } from 'react';
import { colorClass } from '../utils/helpers';

const STATUS_CLS = {
  backlog: 'status-backlog', progress: 'status-progress',
  standby: 'status-standby', testing: 'status-testing',
  done: 'status-done', soporte: 'status-soporte', cancelado: 'status-cancelado',
};
const STATUS_L = {
  backlog: 'Por hacer', progress: 'En proceso',
  standby: 'En standby', testing: 'En testing',
  done: 'Finalizado', soporte: 'En soporte', cancelado: 'Cancelado',
};
const BAR_COLOR = {
  backlog: 'var(--rb-n-300)', progress: 'var(--rb-navy)',
  standby: '#C9BBAD', testing: 'var(--rb-warning)', done: 'var(--rb-success)', soporte: '#0B6E80', cancelado: 'var(--rb-danger)',
};

const fmtDMY   = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const fmtShort = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }).replace('.', '') : '';

export default function GanttView({ projects, users = [], onRowClick }) {
  const [fArea, setFArea] = useState('all');
  const [fResp, setFResp] = useState('all');
  const [fStat, setFStat] = useState('all');
  const [fPer,  setFPer]  = useState('all');

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const week  = new Date(today); week.setDate(week.getDate() + 7);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd   = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const activeAll = projects.filter(p => !['done', 'cancelado'].includes(p.status));
  const areas = [...new Set(activeAll.flatMap(p => (p.clients || []).map(c => c.name)))].sort();

  /* Los proyectos ya no tienen fechas propias: el cronograma se deriva de las
     tareas. Inicio ≈ creación más temprana; entrega ≈ vencimiento más lejano
     (de pendientes si las hay, si no de cualquier tarea). */
  const effOf = (p) => {
    const tasks = p.tasks || [];
    const starts = tasks.map(t => (t.createdAt || '').slice(0, 10)).filter(Boolean).sort();
    const start = p.startDate || starts[0] || (p.createdAt || '').slice(0, 10) || null;
    const dues = tasks.filter(t => t.dueDate).map(t => t.dueDate).sort();
    const pendDues = tasks.filter(t => !t.done && t.dueDate).map(t => t.dueDate).sort();
    const due = p.dueDate || (pendDues.length ? pendDues[pendDues.length - 1]
      : dues.length ? dues[dues.length - 1] : null);
    return { start, due };
  };

  const active = activeAll.filter(p =>
    (fArea === 'all' || (p.clients || []).some(c => c.name === fArea)) &&
    (fResp === 'all' || (p.assigneeIds || [p.assigneeId]).map(String).includes(fResp)) &&
    (fStat === 'all' || p.status === fStat) &&
    (fPer === 'all' || (effOf(p).due && new Date(effOf(p).due) >= monthStart && new Date(effOf(p).due) <= monthEnd))
  );

  // Stats
  const overdueN  = active.filter(p => effOf(p).due && new Date(effOf(p).due) < today).length;
  const weekN     = active.filter(p => effOf(p).due && new Date(effOf(p).due) >= today && new Date(effOf(p).due) <= week).length;
  const sharedN   = active.filter(p => p.tipo === 'compartido').length;

  const withDates    = active.filter(p => effOf(p).start && effOf(p).due)
    .sort((a, b) => effOf(a).start.localeCompare(effOf(b).start));
  const withoutDates = active.filter(p => !effOf(p).start || !effOf(p).due).sort((a, b) => a.name.localeCompare(b.name));
  const all          = [...withDates, ...withoutDates];

  let todayPct = 50, minDate, totalDays;
  if (withDates.length) {
    const allDates = withDates.flatMap(p => [new Date(effOf(p).start), new Date(effOf(p).due)]);
    minDate  = new Date(Math.min(...allDates));
    const maxDate = new Date(Math.max(...allDates));
    minDate.setDate(minDate.getDate() - 5);
    maxDate.setDate(maxDate.getDate() + 10);
    totalDays = Math.ceil((maxDate - minDate) / 86400000) || 1;
    todayPct = Math.min(100, Math.max(0, ((today - minDate) / 86400000) / totalDays * 100));
  }

  const FILTERS = [
    { label: 'Área',        value: fArea, set: setFArea, opts: [['all', 'Todas'], ...areas.map(a => [a, a])] },
    { label: 'Responsable', value: fResp, set: setFResp, opts: [['all', 'Todos'], ...users.map(u => [String(u.id), u.name])] },
    { label: 'Estado',      value: fStat, set: setFStat, opts: [['all', 'Todos'], ...Object.entries(STATUS_L).filter(([k]) => !['done', 'cancelado'].includes(k))] },
    { label: 'Periodo',     value: fPer,  set: setFPer,  opts: [['all', 'Todo'], ['month', 'Este mes']] },
  ];

  return (
    <div>
      {/* Filtros */}
      <div className="kb-filters no-print">
        {FILTERS.map(f => (
          <div className="kb-filter" key={f.label}>
            <span className="kb-filter-label">{f.label}</span>
            <select value={f.value} onChange={e => f.set(e.target.value)}>
              {f.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="gv-stats">
        <div className="gv-stat">
          <span className="gv-stat-icon" style={{ background: 'var(--rb-danger-bg)', color: 'var(--rb-danger)' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </span>
          <div>
            <div className="gv-stat-label">Entregas vencidas</div>
            <div className="gv-stat-num" style={overdueN > 0 ? { color: 'var(--rb-danger)' } : undefined}>{overdueN}</div>
            <div className="gv-stat-sub">requieren atención</div>
          </div>
        </div>
        <div className="gv-stat">
          <span className="gv-stat-icon" style={{ background: 'var(--rb-navy-tint)', color: 'var(--rb-navy)' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </span>
          <div>
            <div className="gv-stat-label">Próximas esta semana</div>
            <div className="gv-stat-num">{weekN}</div>
            <div className="gv-stat-sub">entregas programadas</div>
          </div>
        </div>
        <div className="gv-stat" style={{ borderRight: 'none' }}>
          <span className="gv-stat-icon" style={{ background: 'var(--rb-navy-tint)', color: 'var(--rb-navy)' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </span>
          <div>
            <div className="gv-stat-label">Compartidos</div>
            <div className="gv-stat-num">{sharedN}</div>
            <div className="gv-stat-sub">proyectos compartidos</div>
          </div>
        </div>
      </div>

      {/* Tabla */}
      {all.length === 0 ? (
        <div className="empty" style={{ padding: 60, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          No hay proyectos que coincidan con los filtros
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          <div className="gantt-wrap">
            <table className="gantt-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 200 }}>Proyecto</th>
                  <th style={{ minWidth: 140 }}>Responsable</th>
                  <th style={{ minWidth: 100 }}>Estado</th>
                  <th style={{ minWidth: 65 }}>Avance</th>
                  <th style={{ minWidth: 95 }}>Inicio</th>
                  <th style={{ minWidth: 105 }}>Entrega</th>
                  <th className="gantt-bar-cell" style={{ position: 'relative' }}>
                    Línea de tiempo
                    {withDates.length > 0 && (
                      <span className="gv-today-flag" style={{ left: `calc(56px + (100% - 112px) * ${todayPct / 100})` }}>Hoy</span>
                    )}
                  </th>
                </tr>
              </thead>
              <tbody>
                {all.map((p, i) => {
                  const eff = effOf(p);
                  const hasDates = Boolean(eff.start && eff.due);
                  const eng  = p.assignee;
                  const pct  = p.progress || 0;
                  const overdue = hasDates && eff.due && new Date(eff.due) < today;

                  let left = 0, width = 0;
                  if (hasDates && minDate) {
                    const sD = new Date(eff.start);
                    const dD = new Date(eff.due);
                    left  = Math.max(0, (sD - minDate) / 86400000 / totalDays * 100);
                    width = Math.max(2, (dD - sD) / 86400000 / totalDays * 100);
                  }

                  const isFirstNoDates = !hasDates && withDates.length > 0 && i === withDates.length;

                  return (
                    <React.Fragment key={p.id}>
                      {isFirstNoDates && (
                        <tr key={`divider-${p.id}`}>
                          <td colSpan={7} style={{ padding: '6px 14px 4px', fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--text3)', background: 'var(--bg)', borderTop: '1px solid var(--border)' }}>
                            Sin fechas — {withoutDates.length} proyecto{withoutDates.length !== 1 ? 's' : ''}
                          </td>
                        </tr>
                      )}
                      <tr className="gantt-row" key={p.id} onClick={() => onRowClick(p.id)} style={{ cursor: 'pointer' }}>
                        <td>
                          <div className="gantt-name">{p.name}</div>
                          {p.tipo === 'compartido' && (
                            <span className="gv-shared">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                              Compartido
                            </span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {eng ? (
                              <>
                                <div className={`avatar-xs ${colorClass(eng.colorIndex)}`}>{eng.initials}</div>
                                <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500, whiteSpace: 'nowrap' }}>{eng.name}</span>
                              </>
                            ) : (
                              <>
                                <div className="avatar-xs" style={{ background: 'var(--text4)' }}>—</div>
                                <span style={{ fontSize: 12, color: 'var(--text3)' }}>Sin asignar</span>
                              </>
                            )}
                          </div>
                        </td>
                        <td><span className={`badge ${STATUS_CLS[p.status]}`}>{STATUS_L[p.status]}</span></td>
                        <td style={{ fontSize: 12.5, fontWeight: 700, color: pct > 0 ? 'var(--accent)' : 'var(--text3)', fontVariantNumeric: 'tabular-nums' }}>
                          {pct > 0 ? `${pct}%` : '—'}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text2)', fontVariantNumeric: 'tabular-nums' }}>
                          {eff.start ? fmtDMY(eff.start) : <span style={{ color: 'var(--text3)' }}>—</span>}
                        </td>
                        <td style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                          {eff.due ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: overdue ? 'var(--rb-danger)' : 'var(--text2)', fontWeight: overdue ? 700 : 400 }}>
                              {fmtDMY(eff.due)}
                              {overdue && (
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--rb-danger)" stroke="var(--rb-danger)" strokeWidth="0"><circle cx="12" cy="12" r="10" fill="var(--rb-danger-bg)"/><rect x="11" y="6" width="2" height="8" rx="1" fill="var(--rb-danger)"/><rect x="11" y="16" width="2" height="2" rx="1" fill="var(--rb-danger)"/></svg>
                              )}
                            </span>
                          ) : <span style={{ color: 'var(--text3)' }}>—</span>}
                        </td>
                        <td className="gantt-bar-cell">
                          {hasDates ? (
                            <div className="gv-timeline">
                              <span className="gv-tl-date">{fmtShort(eff.start)}</span>
                              <div className="gantt-bar-wrap">
                                <div className="gv-today-line" style={{ left: `${todayPct}%` }} />
                                <div className="gv-bar" style={{ left: `${left}%`, width: `${width}%`, background: BAR_COLOR[p.status] || 'var(--accent)' }} />
                              </div>
                              <span className="gv-tl-date" style={overdue ? { color: 'var(--rb-danger)', fontWeight: 700 } : undefined}>{fmtShort(eff.due)}</span>
                            </div>
                          ) : (
                            <span style={{ fontSize: 11.5, color: 'var(--text3)', fontStyle: 'italic' }}>Sin fechas de tareas</span>
                          )}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

        </div>
      )}
    </div>
  );
}
