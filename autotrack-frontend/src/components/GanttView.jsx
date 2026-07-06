import { fmtDate, colorClass } from '../utils/helpers';

const STATUS_CLS = {
  backlog: 'status-backlog', progress: 'status-progress',
  standby: 'status-standby', testing: 'status-testing', done: 'status-done',
};
const STATUS_L = {
  backlog: 'Por hacer', progress: 'En proceso',
  standby: 'En standby', testing: 'En testing', done: 'Finalizado',
};
const BAR_COLOR = {
  backlog: '#C4C9D4', progress: '#4F5FE8',
  standby: '#A8A29E', testing: '#6D7AE8', done: '#16A34A',
};

export default function GanttView({ projects, onRowClick }) {
  const active = projects.filter(p => p.status !== 'done');

  if (!active.length) {
    return <div className="empty" style={{ padding: 60 }}>No hay proyectos activos</div>;
  }

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
    const today = new Date(); today.setHours(0, 0, 0, 0);
    todayPct = Math.min(100, Math.max(0, ((today - minDate) / 86400000) / totalDays * 100));
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', boxShadow: 'var(--sh)' }}>
      <div className="gantt-wrap">
        <table className="gantt-table">
          <thead>
            <tr>
              <th style={{ minWidth: 190 }}>Proyecto</th>
              <th style={{ minWidth: 130 }}>Responsable</th>
              <th style={{ minWidth: 100 }}>Estado</th>
              <th style={{ minWidth: 65 }}>Avance</th>
              <th style={{ minWidth: 90 }}>Inicio</th>
              <th style={{ minWidth: 90 }}>Entrega</th>
              <th className="gantt-bar-cell">Línea de tiempo</th>
            </tr>
          </thead>
          <tbody>
            {all.map((p, i) => {
              const hasDates = Boolean(p.startDate && p.dueDate);
              const eng = p.assignee;
              const ci  = eng?.colorIndex ?? -1;
              const pct = p.progress || 0;

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
                  <tr
                    className="gantt-row"
                    key={p.id}
                    onClick={() => onRowClick(p.id)}
                    style={{ cursor: 'pointer', opacity: hasDates ? 1 : 0.6 }}
                  >
                    <td>
                      <div className="gantt-name" style={{ color: hasDates ? undefined : 'var(--text2)' }}>{p.name}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {eng ? (
                          <>
                            <div className={`avatar-xs ${colorClass(ci)}`}>{eng.initials}</div>
                            <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500 }}>{eng.name.split(' ')[0]}</span>
                          </>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--text3)' }}>Sin asignar</span>
                        )}
                      </div>
                    </td>
                    <td><span className={`badge ${STATUS_CLS[p.status]}`}>{STATUS_L[p.status]}</span></td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: hasDates ? 'var(--accent)' : 'var(--text3)' }}>
                      {hasDates ? `${pct}%` : '—'}
                    </td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text2)' }}>
                      {hasDates ? fmtDate(p.startDate) : <span style={{ color: 'var(--text3)' }}>—</span>}
                    </td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text2)' }}>
                      {hasDates ? fmtDate(p.dueDate) : <span style={{ color: 'var(--text3)' }}>—</span>}
                    </td>
                    <td className="gantt-bar-cell">
                      {hasDates ? (
                        <div className="gantt-bar-wrap">
                          <div style={{ position: 'absolute', left: `${todayPct}%`, top: 0, width: 2, height: '100%', background: 'var(--high)', opacity: .7, zIndex: 2, borderRadius: 1 }} />
                          <div className="gantt-bar" style={{ left: `${left}%`, width: `${width}%`, background: BAR_COLOR[p.status] || '#4F5FE8' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', height: '100%', padding: '0 10px' }}>
                          <span style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>Sin fecha de inicio / entrega</span>
                        </div>
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
  );
}
