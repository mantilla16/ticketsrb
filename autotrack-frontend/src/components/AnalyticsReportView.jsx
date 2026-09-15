/* Reporte Especial de Analítica — seguimiento por cliente del equipo de
   analítica de datos. Visible solo para gerencia y coordinación. */

import { useState, useEffect, useCallback } from 'react';
import { analyticsReportAPI } from '../services/api';
import { colorClass } from '../utils/helpers';
import { Button } from './ui';

const STATUS_DEF = {
  backlog:  { l: 'Por hacer',  c: 'var(--rb-neutral)', bg: 'var(--rb-neutral-bg)' },
  progress: { l: 'En proceso', c: 'var(--rb-navy)',    bg: 'var(--rb-navy-tint)' },
  standby:  { l: 'En standby', c: 'var(--rb-warning)', bg: 'var(--rb-warning-bg)' },
  testing:  { l: 'En testing', c: 'var(--rb-violet)',  bg: 'var(--rb-violet-bg)' },
  done:     { l: 'Finalizado', c: 'var(--rb-success)', bg: 'var(--rb-success-bg)' },
  soporte:  { l: 'Soporte',    c: 'var(--rb-info)',    bg: 'var(--rb-info-bg)' },
  cancelado:{ l: 'Cancelado',  c: 'var(--rb-danger)',  bg: 'var(--rb-danger-bg)' },
};

const PR_BADGE = {
  high: { l: 'Alta',  c: 'var(--rb-danger)',  bg: 'var(--rb-danger-bg)' },
  mid:  { l: 'Media', c: 'var(--rb-navy)',    bg: 'var(--rb-navy-tint)' },
  low:  { l: 'Baja',  c: 'var(--rb-success)', bg: 'var(--rb-success-bg)' },
};

const fmtDM = (d) => {
  if (!d) return null;
  const dt = new Date(d + 'T00:00:00');
  return { day: dt.getDate(), mon: dt.toLocaleDateString('es-CO', { month: 'short' }).replace('.', '') };
};

const fmtShort = (d) => {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
};

/* Mini-gráfica de tendencia (SVG): progreso promedio por cliente en el tiempo */
function TrendChart({ data, height = 60 }) {
  if (!data || data.length < 2) {
    return (
      <div style={{ fontSize: 12, color: 'var(--rb-text-4)', padding: '10px 0', fontStyle: 'italic' }}>
        Aún no hay historial — toma un snapshot para comenzar a registrar avances
      </div>
    );
  }
  const W = 220, H = height, pad = 4;
  const max = Math.max(100, ...data.map(d => d.avgProgress));
  const min = Math.min(0, ...data.map(d => d.avgProgress));
  const range = Math.max(1, max - min);
  const n = data.length;
  const pts = data.map((d, i) => {
    const x = pad + (i / (n - 1)) * (W - pad * 2);
    const y = H - pad - ((d.avgProgress - min) / range) * (H - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="var(--rb-line)" strokeWidth="1" />
      <polyline points={pts} fill="none" stroke="var(--rb-navy)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => {
        const x = pad + (i / (n - 1)) * (W - pad * 2);
        const y = H - pad - ((d.avgProgress - min) / range) * (H - pad * 2);
        return i === n - 1 ? (
          <circle key={i} cx={x} cy={y} r="3" fill="var(--rb-navy)" />
        ) : (
          <circle key={i} cx={x} cy={y} r="1.8" fill="var(--rb-n-400)" />
        );
      })}
    </svg>
  );
}

/* Mini-mapa de avance por estado (barras apiladas) */
function StatusStrip({ client }) {
  const labels = [
    ['progress', 'var(--rb-navy)'],
    ['testing', 'var(--rb-violet)'],
    ['standby', 'var(--rb-warning)'],
    ['backlog', 'var(--rb-neutral)'],
    ['done', 'var(--rb-success)'],
    ['soporte', 'var(--rb-info)'],
    ['cancelado', 'var(--rb-danger)'],
  ];
  const total = Math.max(1, client.totalProjects);
  return (
    <div style={{ display: 'flex', gap: 2, height: 8 }}>
      {labels.map(([k, color]) => {
        const n = client[`${k}Projects`] ?? 0;
        if (!n) return null;
        return <span key={k} title={`${STATUS_DEF[k].l}: ${n}`} style={{ width: `${(n / total) * 100}%`, background: color, borderRadius: 2 }} />;
      })}
    </div>
  );
}

/* Filas resumen del estado de un cliente */
function ClientCard({ client, users, index }) {
  const [expanded, setExpanded] = useState(false);
  const dm = fmtDM(client.nextDelivery);
  const overdue = client.nextDelivery && new Date(client.nextDelivery + 'T00:00:00') < new Date(new Date().toDateString());

  const proyectosActivos = client.projects.filter(p => ['progress', 'testing'].includes(p.status)).length;
  const doneCount = client.completedProjects;
  const showInactive = client.active === false;

  const userName = (id) => users.find(u => Number(u.id) === Number(id))?.name || null;

  return (
    <div className="ar-client" style={{
      border: '1px solid var(--rb-line)',
      borderRadius: 'var(--rb-r-lg)',
      background: 'var(--rb-surface)',
      overflow: 'hidden',
    }}>
      {/* Encabezado del cliente */}
      <button
        className="ar-client-head"
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
          background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span className={`avatar ${colorClass(index % 8)}`} style={{ fontSize: 12 }}>
          {client.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 'var(--rb-w-bold)', fontSize: 'var(--rb-fs-md)', color: 'var(--rb-text)' }}>
              {client.name}
            </span>
            {showInactive && (
              <span className="pill-mini" style={{ background: 'var(--rb-neutral-bg)', color: 'var(--rb-neutral)' }}>
                No activo
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 6 }} className="ar-client-pills">
            <span style={{ fontSize: 12, color: 'var(--rb-text-3)' }}>
              <b style={{ color: 'var(--rb-text)' }}>{client.totalProjects}</b> proyectos
            </span>
            <span style={{ fontSize: 12, color: 'var(--rb-text-3)' }}>
              <b style={{ color: 'var(--rb-navy)' }}>{proyectosActivos}</b> activos
            </span>
            <span style={{ fontSize: 12, color: 'var(--rb-text-3)' }}>
              <b style={{ color: 'var(--rb-success)' }}>{doneCount}</b> finalizados
            </span>
            <span style={{ fontSize: 12, color: 'var(--rb-text-3)' }}>
              <b style={{ color: 'var(--rb-navy)' }}>{client.avgProgress}%</b> progreso prom.
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          {client.nextDelivery ? (
            <span className="pill-mini" style={{
              background: overdue ? 'var(--rb-danger-bg)' : 'var(--rb-success-bg)',
              color: overdue ? 'var(--rb-danger)' : 'var(--rb-success)',
            }}>
              {overdue ? 'Vencida' : 'Entrega'} · {fmtShort(client.nextDelivery)}
            </span>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--rb-text-4)' }}>Sin entregas</span>
          )}
          <span className="pill-mini" style={{ background: 'var(--rb-n-100)', color: 'var(--rb-text-3)' }}>
            {expanded ? 'Ocultar proyectos' : `Ver proyectos (${client.projects.length})`}
          </span>
        </div>
      </button>

      {/* Strip de estados */}
      <div style={{ padding: '0 16px' }}>
        <StatusStrip client={client} />
      </div>

      {/* Detalle expandido */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--rb-line-soft)', marginTop: 12 }}>
          <table className="ar-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left' }}>
                <th style={{ padding: '10px 16px', fontSize: 12, color: 'var(--rb-text-3)', fontWeight: 400 }}>Proyecto</th>
                <th style={{ padding: '10px 8px', fontSize: 12, color: 'var(--rb-text-3)', fontWeight: 400 }}>Estado</th>
                <th style={{ padding: '10px 8px', fontSize: 12, color: 'var(--rb-text-3)', fontWeight: 400 }}>Prioridad</th>
                <th style={{ padding: '10px 8px', fontSize: 12, color: 'var(--rb-text-3)', fontWeight: 400 }}>Avance</th>
                <th style={{ padding: '10px 8px', fontSize: 12, color: 'var(--rb-text-3)', fontWeight: 400 }}>Responsable</th>
                <th style={{ padding: '10px 16px', fontSize: 12, color: 'var(--rb-text-3)', fontWeight: 400 }}>Entrega</th>
              </tr>
            </thead>
            <tbody>
              {client.projects.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '14px 16px', color: 'var(--rb-text-4)', fontSize: 13 }}>
                    {showInactive
                      ? 'Cliente marcado como no activo — sin proyectos registrados.'
                      : 'Sin proyectos de analítica registrados para este cliente yet.'}
                  </td>
                </tr>
              )}
              {client.projects.map(p => {
                const st = STATUS_DEF[p.status] || STATUS_DEF.backlog;
                const pr = PR_BADGE[p.priority] || PR_BADGE.mid;
                const pdm = fmtDM(p.dueDate);
                const dueOverdue = p.dueDate && new Date(p.dueDate + 'T00:00:00') < new Date(new Date().toDateString());
                const responsables = [
                  p.assignee ? userName(p.assignee.id) : null,
                  p.coAssignee ? userName(p.coAssignee.id) : null,
                  ...(p.extraAssignees || []).map(a => userName(a.id)),
                ].filter(Boolean);
                return (
                  <tr key={p.id} style={{ borderTop: '1px solid var(--rb-line-soft)' }}>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--rb-text)' }}>
                      {p.name}
                      {p.participationAnalitica && (
                        <div style={{ fontSize: 11, color: 'var(--rb-text-4)', marginTop: 2 }}>{p.participationAnalitica}</div>
                      )}
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      <span className="pill-mini" style={{ background: st.bg, color: st.c }}>{st.l}</span>
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      <span className="pill-mini" style={{ background: pr.bg, color: pr.c }}>{pr.l}</span>
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="at-card-bar" style={{ width: 56 }}>
                          <span style={{ width: `${p.progress}%`, background: p.progress >= 80 ? 'var(--rb-success)' : 'var(--rb-navy)' }} />
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--rb-text-3)' }}>{p.progress}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 8px', fontSize: 12, color: 'var(--rb-text-3)' }}>
                      {responsables.length
                        ? responsables.join(', ')
                        : <span style={{ color: 'var(--rb-text-4)', fontStyle: 'italic' }}>Sin asignar</span>}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 12 }}>
                      {pdm ? (
                        <span style={{ color: dueOverdue ? 'var(--rb-danger)' : 'var(--rb-text-2)', fontWeight: dueOverdue ? 700 : 400 }}>
                          {pdm.day} {pdm.mon}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--rb-text-4)' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Histórico de avance del cliente */}
          {client.history && client.history.length > 1 && (
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--rb-line-soft)', background: 'var(--rb-surface-2)' }}>
              <div style={{ fontSize: 12, color: 'var(--rb-text-3)', marginBottom: 8 }}>Histórico de progreso promedio</div>
              <TrendChart data={client.history} height={44} />
              <div style={{ fontSize: 11, color: 'var(--rb-text-4)', marginTop: 6 }}>
                {fmtShort(client.history[client.history.length - 1].snapshot_date)} · snapshot más reciente
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AnalyticsReportView({ users }) {
  const [clients, setClients] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [snapshotting, setSnapshotting] = useState(false);
  const [snapshotMsg, setSnapshotMsg] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [report, hist] = await Promise.all([
        analyticsReportAPI.getReport(),
        analyticsReportAPI.getHistory(),
      ]);
      setClients(report.clients);
      setHistory(hist);

      // Enriquecer cada cliente con su historial específico
      const histByClient = {};
      hist.forEach(s => {
        if (!histByClient[s.client_name]) histByClient[s.client_name] = [];
        histByClient[s.client_name].push(s);
      });
      Object.keys(histByClient).forEach(k =>
        histByClient[k].sort((a, b) => new Date(a.snapshot_date) - new Date(b.snapshot_date)));

      setClients(prev => prev.map(c => ({
        ...c,
        history: (histByClient[c.name] || []).slice(-8),
      })));
      setError(null);
    } catch (e) {
      setError(e.error || 'Error al cargar el reporte');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSnapshot = async () => {
    try {
      setSnapshotting(true);
      setSnapshotMsg('');
      await analyticsReportAPI.takeSnapshot();
      setSnapshotMsg('Snapshot guardado correctamente');
      await loadData();
    } catch (e) {
      setSnapshotMsg(e.error || 'Error al tomar el snapshot');
    } finally {
      setSnapshotting(false);
    }
  };

  const activeClients = clients.filter(c => c.active);
  const inactiveClients = clients.filter(c => !c.active);

  const totalProjects = clients.reduce((s, c) => s + c.totalProjects, 0);
  const totalActive = clients.reduce((s, c) => s + c.activeProjects, 0);
  const totalDone = clients.reduce((s, c) => s + c.completedProjects, 0);
  const projectsWithDue = clients.flatMap(c => c.projects)
    .filter(p => p.dueDate && !['done', 'cancelado'].includes(p.status));

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const week = new Date(today); week.setDate(week.getDate() + 7);
  const dueThisWeek = projectsWithDue.filter(p =>
    new Date(p.dueDate + 'T00:00:00') >= today && new Date(p.dueDate + 'T00:00:00') <= week).length;
  const overdueProjects = projectsWithDue.filter(p =>
    new Date(p.dueDate + 'T00:00:00') < today);

  /* KPIs resumen */
  const summaryCards = [
    { l: 'Clientes activos', v: activeClients.length, u: 'clientes', c: 'var(--rb-navy)', bg: 'var(--rb-navy-tint)', ic: 'folder' },
    { l: 'Proyectos analítica', v: totalProjects, u: 'proyectos', c: 'var(--rb-navy)', bg: 'var(--rb-navy-tint)', ic: 'briefcase' },
    { l: 'En ejecución', v: totalActive, u: 'activos', c: 'var(--rb-teal)', bg: 'var(--rb-teal-tint)', ic: 'progress' },
    { l: 'Finalizados', v: totalDone, u: 'proyectos', c: 'var(--rb-success)', bg: 'var(--rb-success-bg)', ic: 'done' },
    { l: 'Entregas esta semana', v: dueThisWeek, u: 'entregas', c: 'var(--rb-warning)', bg: 'var(--rb-warning-bg)', ic: 'calendar' },
    { l: 'Vencidas', v: overdueProjects.length, u: 'entregas', c: 'var(--rb-danger)', bg: 'var(--rb-danger-bg)', ic: 'alert' },
  ];

  const ICONS = {
    folder:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
    briefcase: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>,
    progress:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.2-8.56"/><polyline points="21 3 21 9 15 9"/></svg>,
    done:      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="8.5 12.5 11 15 15.5 9.5"/></svg>,
    calendar:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    alert:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  };

  if (loading && !clients.length) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', padding: 48 }}>
        <span style={{ color: 'var(--rb-text-3)' }}>Cargando reporte…</span>
      </div>
    );
  }

  return (
    <div className="ar-root">
      {/* Encabezado con acciones */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, color: 'var(--rb-text-3)' }}>
          Seguimiento del proyecto de analítica por cliente. {totalProjects} proyectos · {clients.length} clientes configurados.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {snapshotMsg && (
            <span style={{
              fontSize: 12, padding: '4px 10px', borderRadius: 'var(--rb-r-pill)',
              background: snapshotMsg.startsWith('Error') ? 'var(--rb-danger-bg)' : 'var(--rb-success-bg)',
              color: snapshotMsg.startsWith('Error') ? 'var(--rb-danger)' : 'var(--rb-success)',
            }}>
              {snapshotMsg}
            </span>
          )}
          <Button variant="primary" icon="clock" onClick={handleSnapshot} disabled={snapshotting}>
            {snapshotting ? 'Guardando…' : 'Tomar snapshot'}
          </Button>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '12px 16px', borderRadius: 'var(--rb-r-md)', marginBottom: 16,
          background: 'var(--rb-danger-bg)', color: 'var(--rb-danger)', fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {/* KPIs */}
      <div className="ar-kpis" style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 12, marginBottom: 20,
      }}>
        {summaryCards.map(({ l, v, u, c, bg, ic }) => (
          <div key={l} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 16px', borderRadius: 'var(--rb-r-lg)',
            background: 'var(--rb-surface)', border: '1px solid var(--rb-line)',
          }}>
            <span style={{
              width: 34, height: 34, borderRadius: 'var(--rb-r-md)',
              display: 'grid', placeItems: 'center', background: bg, color: c,
            }}>
              {ICONS[ic]}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, color: 'var(--rb-text-3)' }}>{l}</div>
              <div style={{ fontSize: 19, fontWeight: 'var(--rb-w-black)', color: 'var(--rb-text)', lineHeight: 1.1 }}>
                {v} <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--rb-text-4)' }}>{u}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Clientes activos */}
      <div style={{ fontSize: 14, fontWeight: 'var(--rb-w-bold)', color: 'var(--rb-text)', margin: '20px 0 10px' }}>
        Clientes activos
        <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--rb-text-4)', marginLeft: 8 }}>
          ({activeClients.length})
        </span>
      </div>
      <div className="ar-clients" style={{ display: 'grid', gap: 10 }}>
        {activeClients.map((c, i) => (
          <ClientCard key={c.name} client={c} users={users} index={i} />
        ))}
      </div>

      {/* Clientes no activos */}
      {inactiveClients.length > 0 && (
        <>
          <div style={{ fontSize: 14, fontWeight: 'var(--rb-w-bold)', color: 'var(--rb-text)', margin: '24px 0 10px' }}>
            Clientes no activos
            <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--rb-text-4)', marginLeft: 8 }}>
              ({inactiveClients.length}) · marcados para seguimiento, sin proyectos en curso
            </span>
          </div>
          <div className="ar-clients" style={{ display: 'grid', gap: 10, opacity: 0.82 }}>
            {inactiveClients.map((c, i) => (
              <ClientCard key={c.name} client={c} users={users} index={i} />
            ))}
          </div>
        </>
      )}

      {/* Histórico global */}
      {history.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <div style={{ fontSize: 14, fontWeight: 'var(--rb-w-bold)', color: 'var(--rb-text)', marginBottom: 8 }}>
            Histórico global de avance
          </div>
          <div style={{
            background: 'var(--rb-surface)', border: '1px solid var(--rb-line)',
            borderRadius: 'var(--rb-r-lg)', padding: 16,
          }}>
            <div style={{ fontSize: 12, color: 'var(--rb-text-3)', marginBottom: 8 }}>
              Promedio de progreso de todos los clientes por snapshot
            </div>
            <_GlobalTrend history={history} />
          </div>
        </div>
      )}
    </div>
  );
}

/* Tendencia global — agrega todos los clientes por fecha */
function _GlobalTrend({ history }) {
  const byDate = {};
  history.forEach(s => {
    if (!byDate[s.snapshot_date]) byDate[s.snapshot_date] = { total: 0, sum: 0, count: 0 };
    byDate[s.snapshot_date].sum += s.avg_progress;
    byDate[s.snapshot_date].count++;
  });
  const series = Object.entries(byDate)
    .map(([d, v]) => ({ date: d, avgProgress: v.count ? Math.round(v.sum / v.count) : 0 }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (series.length < 2) {
    return (
      <div style={{ fontSize: 12, color: 'var(--rb-text-4)', fontStyle: 'italic' }}>
        Se necesitan al menos dos snapshots para ver la tendencia.
      </div>
    );
  }

  const countByDate = {};
  history.forEach(s => { countByDate[s.snapshot_date] = (countByDate[s.snapshot_date] || 0) + 1; });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span className="pill-mini" style={{ background: 'var(--rb-n-100)', color: 'var(--rb-text-3)' }}>
          {series.length} snapshots registrados
        </span>
        <span className="pill-mini" style={{ background: 'var(--rb-n-100)', color: 'var(--rb-text-3)' }}>
          Desde {fmtShort(series[0].date)} hasta {fmtShort(series[series.length - 1].date)}
        </span>
      </div>
      <div style={{ marginTop: 10 }}>
        <TrendChartFilled data={series} labels={countByDate} />
      </div>
    </div>
  );
}

/* Gráfica de tendencia global con etiquetas en el eje */
function TrendChartFilled({ data }) {
  const W = 480, H = 160, padL = 30, padR = 10, padT = 10, padB = 22;
  const max = Math.max(100, ...data.map(d => d.avgProgress));
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const n = data.length;
  const pts = data.map((d, i) => {
    const x = padL + (i / (n - 1)) * plotW;
    const y = padT + plotH - (d.avgProgress / max) * plotH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const last = data[n - 1];

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      {/* Líneas guía */}
      {[0, 25, 50, 75, 100].map(p => {
        const y = padT + plotH - (p / 100) * plotH;
        return (
          <g key={p}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--rb-line-soft)" strokeWidth="1" strokeDasharray="3 3" />
            <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="9" fill="var(--rb-text-4)">{p}%</text>
          </g>
        );
      })}
      <polyline points={pts} fill="none" stroke="var(--rb-navy)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => {
        const x = padL + (i / (n - 1)) * plotW;
        const y = padT + plotH - (d.avgProgress / max) * plotH;
        return (
          <circle key={i} cx={x} cy={y} r="2.4" fill={i === n - 1 ? 'var(--rb-navy)' : 'var(--rb-n-400)'} />
        );
      })}
      {/* Etiquetas de eje X */}
      {data.filter((_, i) => i === 0 || i === n - 1 || i === Math.floor(n / 2)).map((d, j) => {
        const i = data.indexOf(d);
        const x = padL + (i / (n - 1)) * plotW;
        return (
          <text key={j} x={x} y={H - 6} textAnchor="middle" fontSize="9" fill="var(--rb-text-4)">
            {new Date(d.date + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
          </text>
        );
      })}
      {/* Último valor */}
      <text x={padL + plotW} y={last.avgProgress >= 50 ? -2 + padT + plotH - (last.avgProgress / max) * plotH - 6 : padT + plotH - (last.avgProgress / max) * plotH + 14}
        textAnchor="end" fontSize="10" fontWeight="700" fill="var(--rb-navy)">
        {last.avgProgress}%
      </text>
    </svg>
  );
}