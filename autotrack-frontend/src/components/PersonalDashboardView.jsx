/* ════════════════════════════════════════════════════════════════════════════
   Dashboard personal — lo que ve un ingeniero/analista al entrar a "Dashboard".
   A diferencia del Dashboard Ejecutivo (portafolio de toda la compañía), esta
   vista está acotada a una sola persona: sus propias tareas pendientes y sus
   propios proyectos. Mismo lenguaje visual (bento grid, dx-*) que DashboardView.
════════════════════════════════════════════════════════════════════════════ */

const INK2 = 'var(--rb-n-500)';

function isMine(p, userId) {
  return (p.assigneeIds || [p.assigneeId]).includes(userId)
    || p.coAssigneeId === userId
    || p.generalAssigneeId === userId;
}

// Si la tarea tiene un responsable propio, solo es "mía" si soy yo; si no tiene
// (vieja o sin asignar), es de cualquier responsable del proyecto.
function tasksFor(p, userId) {
  return (p.tasks || []).filter(t => t.assigneeId ? t.assigneeId === userId : true);
}

// Misma fórmula que el Dashboard Ejecutivo (DashboardView.jsx): una tarea que vence
// pronto pesa más que una lejana, y 100% = tan cargado como el promedio del equipo ahora.
function urgencyMultiplier(dueDate) {
  if (!dueDate) return 1;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const soon = new Date(today); soon.setDate(soon.getDate() + 7);
  const d = new Date(dueDate);
  if (d < today) return 2.5;
  if (d <= soon) return 1.5;
  return 0.5;
}

function personUrgencyLoad(projects, userId) {
  return projects
    .filter(p => !['done', 'cancelado'].includes(p.status))
    .flatMap(p => tasksFor(p, userId))
    .filter(t => !t.done)
    .reduce((sum, t) => sum + (t.weight ?? 2) * urgencyMultiplier(t.dueDate), 0);
}

const fmtShort = (d) => d ? new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

function urgency(dueDate) {
  if (!dueDate) return { l: 'Sin fecha', bg: 'var(--rb-neutral-bg)', c: 'var(--rb-neutral)' };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const soon = new Date(today); soon.setDate(soon.getDate() + 3);
  const d = new Date(dueDate);
  if (d < today) return { l: 'Vencida', bg: 'var(--rb-danger-bg)', c: 'var(--rb-danger)' };
  if (d <= soon) return { l: 'Por vencer', bg: 'var(--rb-warning-bg)', c: 'var(--rb-warning)' };
  return { l: 'A tiempo', bg: 'var(--rb-success-bg)', c: 'var(--rb-success)' };
}

const PR_PILL = {
  high: { l: 'Alta',  bg: 'var(--rb-danger-bg)', c: 'var(--rb-danger)' },
  mid:  { l: 'Media', bg: 'var(--rb-warning-bg)', c: 'var(--rb-warning)' },
  low:  { l: 'Baja',  bg: 'var(--rb-success-bg)', c: 'var(--rb-success)' },
};

const IC = (path) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{path}</svg>
);
const ICONS = {
  tareas:     IC(<><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></>),
  portafolio: IC(<><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 9h20"/></>),
  carga:      IC(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>),
};

function BlockHead({ icon, title, right }) {
  return (
    <div className="dx-block-head">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: INK2, display: 'flex' }}>{icon}</span>
        <span className="dx-block-title">{title}</span>
      </div>
      {right}
    </div>
  );
}

export default function PersonalDashboardView({ projects, users = [], currentUser, onCardClick, onNavigate }) {
  const userId = currentUser?.id;
  const mine = projects.filter(p => isMine(p, userId));
  const activeMine = mine.filter(p => !['done', 'cancelado'].includes(p.status));

  const allMyTasks = activeMine.flatMap(p =>
    tasksFor(p, userId).map(t => ({ ...t, projectId: p.id, projectName: p.name, projectProgress: p.progress || 0 }))
  );
  const myTasks = allMyTasks.filter(t => !t.done).sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate) - new Date(b.dueDate);
  });

  const tasksTotal = allMyTasks.length;

  // 100% = tan cargada como el promedio de tus compañeros de equipo ahora mismo,
  // no un umbral fijo — así el indicador se ajusta solo al tamaño real del backlog.
  const teammates = users.filter(u => u.role === currentUser?.role);
  const teamLoads = teammates.map(u => personUrgencyLoad(projects.filter(p => isMine(p, u.id)), u.id));
  const avgLoad = teamLoads.length ? teamLoads.reduce((a, b) => a + b, 0) / teamLoads.length : 0;
  const myLoad = personUrgencyLoad(mine, userId);
  const ocup = avgLoad > 0 ? Math.round(myLoad / avgLoad * 100) : 0;
  const estado = ocup > 150 ? { l: 'Sobrecarga', bg: 'var(--rb-danger-bg)', c: 'var(--rb-danger)' }
    : ocup >= 110 ? { l: 'Alta carga', bg: 'var(--rb-warning-bg)', c: 'var(--rb-warning)' }
    : { l: 'Saludable', bg: 'var(--rb-success-bg)', c: 'var(--rb-success)' };

  const portafolio = [...activeMine].sort((a, b) => (a.dueDate || '9999') < (b.dueDate || '9999') ? -1 : 1);

  return (
    <div className="dx-root">
      {/* Ocupación propia */}
      <div className="dx-card" style={{ marginBottom: 16, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <span style={{ color: INK2, display: 'flex' }}>{ICONS.carga}</span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="dx-block-title" style={{ marginBottom: 6 }}>Tu ocupación</div>
          <div className="dx-bar" style={{ maxWidth: 320 }}>
            <span style={{ width: `${Math.min(100, ocup)}%`, background: ocup > 100 ? 'var(--rb-danger)' : 'var(--rb-navy-soft)' }} />
          </div>
          <div style={{ fontSize: 11.5, color: INK2, marginTop: 5 }}>{myTasks.length} pendientes / {tasksTotal} tareas</div>
        </div>
        <div style={{ fontWeight: 700, fontSize: 20, color: estado.c }}>{ocup}%</div>
        <span className="dx-pill" style={{ background: estado.bg, color: estado.c }}>{estado.l}</span>
      </div>

      <div className="dx-row2">
        {/* Carga y situación — mis tareas pendientes */}
        <div className="dx-card">
          <BlockHead icon={ICONS.tareas} title="Carga y situación" />
          <div style={{ overflowX: 'auto' }}>
            <table className="dx-table">
              <thead>
                <tr>
                  <th>Tarea</th><th>Avance del proyecto</th><th>Entrega estimada</th><th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {myTasks.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: INK2, padding: 18 }}>Sin tareas pendientes — al día</td></tr>
                )}
                {myTasks.map(t => {
                  const u = urgency(t.dueDate);
                  return (
                    <tr key={t.id} onClick={() => onCardClick(t.projectId)} style={{ cursor: 'pointer' }}>
                      <td style={{ fontWeight: 600, maxWidth: 220 }}>{t.title}</td>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: 12 }}>{t.projectProgress}%</div>
                        <div className="dx-bar" style={{ width: 70, marginTop: 3 }}>
                          <span style={{ width: `${t.projectProgress}%`, background: 'var(--rb-navy-soft)' }} />
                        </div>
                      </td>
                      <td style={{ whiteSpace: 'nowrap', color: INK2 }}>{fmtShort(t.dueDate)}</td>
                      <td><span className="dx-pill" style={{ background: u.bg, color: u.c }}>{u.l}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Portafolio de proyectos — solo los míos */}
        <div className="dx-card">
          <BlockHead icon={ICONS.portafolio} title="Portafolio de proyectos"
            right={<>{onNavigate && (
              <button className="dx-more" onClick={() => onNavigate('gantt')}>
                Ver todos
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </button>
            )}</>} />
          <div style={{ overflowX: 'auto' }}>
            <table className="dx-table">
              <thead>
                <tr>
                  <th>Proyecto</th><th>Área/cliente</th><th>Prioridad</th><th>Avance</th><th>Fecha compromiso</th>
                </tr>
              </thead>
              <tbody>
                {portafolio.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: INK2, padding: 18 }}>Sin proyectos activos</td></tr>
                )}
                {portafolio.map(p => {
                  const pr = PR_PILL[p.priority] || PR_PILL.mid;
                  return (
                    <tr key={p.id} onClick={() => onCardClick(p.id)} style={{ cursor: 'pointer' }}>
                      <td style={{ fontWeight: 600, maxWidth: 180 }}>{p.name}</td>
                      <td style={{ color: INK2, whiteSpace: 'nowrap' }}>{p.client || '—'}</td>
                      <td><span className="dx-pill" style={{ background: pr.bg, color: pr.c }}>{pr.l}</span></td>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: 12 }}>{p.progress || 0}%</div>
                        <div className="dx-bar" style={{ width: 70, marginTop: 3 }}>
                          <span style={{ width: `${p.progress || 0}%`, background: 'var(--rb-navy-soft)' }} />
                        </div>
                      </td>
                      <td style={{ whiteSpace: 'nowrap', color: INK2 }}>{fmtShort(p.dueDate)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
