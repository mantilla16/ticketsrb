import { fmtDate, colorClass } from '../utils/helpers';

const STATUS_CLS = {
  backlog: 'status-backlog', progress: 'status-progress',
  standby: 'status-standby', testing: 'status-testing', done: 'status-done',
};
const STATUS_L = {
  backlog: 'Por hacer', progress: 'En proceso',
  standby: 'En standby', testing: 'En testing', done: 'Finalizado',
};

export default function GanttView({ projects, onRowClick }) {
  const withDates = [...projects]
    .filter(p => p.startDate && p.dueDate)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const withoutDates = projects.filter(p => !p.startDate || !p.dueDate);

  if (!withDates.length && !withoutDates.length) {
    return <div className="empty" style={{ padding: 60 }}>No hay proyectos registrados</div>;
  }

  let todayPct = 50, minDate, totalDays;
  if (withDates.length) {
    const allDates = withDates.flatMap(p => [new Date(p.startDate), new Date(p.dueDate)]);
    minDate = new Date(Math.min(...allDates));
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
            {withDates.map(p => {
              const eng = p.assignee;
              const ci  = eng?.colorIndex ?? -1;
              const sD  = new Date(p.startDate);
              const dD  = new Date(p.dueDate);
              const left  = Math.max(0, (sD - minDate) / 86400000 / totalDays * 100);
              const width = Math.max(2, (dD - sD) / 86400000 / totalDays * 100);
              const pct   = p.progress || 0;

              // bar color based on status
              const barColors = {
                backlog: '#C8D5F0', progress: '#4361EE',
                standby: '#FFB020', testing: '#9B59B6', done: '#00C48C',
              };
              const barColor = barColors[p.status] || '#4361EE';

              return (
                <tr className="gantt-row" key={p.id} onClick={() => onRowClick(p.id)} style={{ cursor: 'pointer' }}>
                  <td>
                    <div className="gantt-name">{p.name}</div>
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
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>{pct}%</td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text2)' }}>{fmtDate(p.startDate)}</td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text2)' }}>{fmtDate(p.dueDate)}</td>
                  <td className="gantt-bar-cell">
                    <div className="gantt-bar-wrap">
                      {/* Today line */}
                      <div style={{ position: 'absolute', left: `${todayPct}%`, top: 0, width: 2, height: '100%', background: 'var(--high)', opacity: .7, zIndex: 2, borderRadius: 1 }} />
                      {/* Bar */}
                      <div
                        className="gantt-bar"
                        style={{ left: `${left}%`, width: `${width}%`, background: barColor }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
            {withoutDates.length > 0 && (
              <tr>
                <td colSpan={7} style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text3)', background: 'var(--bg)' }}>
                  {withoutDates.length} proyecto(s) sin fechas no se muestran en el Gantt
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
