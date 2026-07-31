import { useState } from 'react';
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
  backlog: '#D9CFC7', progress: '#F97316',
  standby: '#C9BBAD', testing: '#F59E0B', done: '#22C55E', soporte: '#0891b2', cancelado: '#DC2626',
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
  const areas = [...new Set(activeAll.map(p => (p.client || '').trim()).filter(Boolean))].sort();

  const active = activeAll.filter(p =>
    (fArea === 'all' || (p.client || '').trim() === fArea) &&
    (fResp === 'all' || (p.assigneeIds || [p.assigneeId]).map(String).includes(fResp)) &&
    (fStat === 'all' || p.status === fStat) &&
    (fPer === 'all' || (p.dueDate && new Date(p.dueDate) >= monthStart && new Date(p.dueDate) <= monthEnd))
  );

  // Stats
  const overdueN  = active.filter(p => p.dueDate && new Date(p.dueDate) < today).length;
  const weekN     = active.filter(p => p.dueDate && new Date(p.dueDate) >= today && new Date(p.dueDate) <= week).length;
  const sharedN   = active.filter(p => p.tipo === 'compartido').length;

  const withDates    = active.filter(p => p.startDate && p.dueDate).sort((a, b) => a.startDate.localeCompare(b.startDate));
  const withoutDates = active.filter(p => !p.startDate || !p.dueDate).sort((a, b) => a.name.localeCompare(b.name));
  const all          = [...withDates, ...withoutDates];

  let todayPct = 50, minDate, totalDays;
  if (withDates.length) {
    const allDates = withDates.flatMap(p => [new Date(p.startDate), new Date(p.dueDate)]);
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
          <span className="gv-stat-icon" style={{ background: '#FEF2F2', color: '#EF4444' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </span>
          <div>
            <div className="gv-stat-label">Entregas vencidas</div>
            <div className="gv-stat-num" style={overdueN > 0 ? { color: '#EF4444' } : undefined}>{overdueN}</div>
            <div className="gv-stat-sub">requieren atención</div>
          </div>
        </div>
        <div className="gv-stat">
          <span className="gv-stat-icon" style={{ background: '#FFF3E8', color: '#F97316' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </span>
          <div>
            <div className="gv-stat-label">Próximas esta semana</div>
            <div className="gv-stat-num">{weekN}</div>
            <div className="gv-stat-sub">entregas programadas</div>
          </div>
        </div>
        <div className="gv-stat" style={{ borderRight: 'none' }}>
          <span className="gv-stat-icon" style={{ background: '#FFF3E8', color: '#F97316' }}>
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
                  const hasDates = Boolean(p.startDate && p.dueDate);
                  const eng  = p.assignee;
                  const pct  = p.progress || 0;
                  const overdue = hasDates && p.dueDate && new Date(p.dueDate) < today;

                  let left = 0, width = 0;
                  if (hasDates && minDate) {
                    const sD = new Date(p.startDate);
                    const dD = new Date(p.dueDate);
                    left  = Math.max(0, (sD - minDate) / 86400000 / totalDays * 100);
                    width = Math.max(2, (dD - sD) / 86400000 / totalDays * 100);
                  }

                  const isFirstNoDates = !hasDates && withDates.length > 0 && i === withDates.length;

                  return (
                    <>
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
                          {p.startDate ? fmtDMY(p.startDate) : <span style={{ color: 'var(--text3)' }}>—</span>}
                        </td>
                        <td style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                          {p.dueDate ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: overdue ? '#EF4444' : 'var(--text2)', fontWeight: overdue ? 700 : 400 }}>
                              {fmtDMY(p.dueDate)}
                              {overdue && (
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="#EF4444" stroke="#EF4444" strokeWidth="0"><circle cx="12" cy="12" r="10" fill="#FEE2E2"/><rect x="11" y="6" width="2" height="8" rx="1" fill="#EF4444"/><rect x="11" y="16" width="2" height="2" rx="1" fill="#EF4444"/></svg>
                              )}
                            </span>
                          ) : <span style={{ color: 'var(--text3)' }}>—</span>}
                        </td>
                        <td className="gantt-bar-cell">
                          {hasDates ? (
                            <div className="gv-timeline">
                              <span className="gv-tl-date">{fmtShort(p.startDate)}</span>
                              <div className="gantt-bar-wrap">
                                <div className="gv-today-line" style={{ left: `${todayPct}%` }} />
                                <div className="gv-bar" style={{ left: `${left}%`, width: `${width}%`, background: BAR_COLOR[p.status] || 'var(--accent)' }} />
                              </div>
                              <span className="gv-tl-date" style={overdue ? { color: '#EF4444', fontWeight: 700 } : undefined}>{fmtShort(p.dueDate)}</span>
                            </div>
                          ) : (
                            <span style={{ fontSize: 11.5, color: 'var(--text3)', fontStyle: 'italic' }}>Sin fecha de inicio / entrega</span>
                          )}
                        </td>
                      </tr>
                    </>
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
