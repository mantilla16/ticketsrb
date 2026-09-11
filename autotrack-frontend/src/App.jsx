import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './context/AuthContext';
import { TicketsProvider, useTickets } from './context/TicketsContext';
import { projectsAPI, usersAPI } from './services/api';
import { ORG, isDesk, isOpen, slaOf } from './lib/tickets';

import Login from './pages/Login';
import Sidebar, { sectionsFor } from './components/Sidebar';
import { Button, Icon } from './components/ui';
import { TicketsView, TicketReports } from './components/tickets';

import DashboardView from './components/DashboardView';
import PersonalDashboardView from './components/PersonalDashboardView';
import GanttView from './components/GanttView';
import AnalyticsTeamView from './components/AnalyticsTeamView';
import HistorialView from './components/HistorialView';
import UsersView from './components/UsersView';
import UserModal from './components/UserModal';
import ProjectSearch from './components/ProjectSearch';
import NotificationBell from './components/NotificationBell';
import ReportPrint from './components/ReportPrint';
import ProjectModal from './components/ProjectModal';
import DetailModal from './components/DetailModal';
import Toast, { useToast } from './components/Toast';

/* Encabezado de cada sección. El subtítulo dice para qué sirve la pantalla,
   no qué contiene: es la única pista de navegación que mucha gente lee. */
const TITLES = {
  inbox:         { title: 'Bandeja de tickets', sub: 'Todo lo que llega a la mesa de servicio, priorizado por compromiso de atención' },
  mine:          { title: 'Mis tickets',        sub: 'Lo que está a tu nombre' },
  board:         { title: 'Flujo de trabajo',   sub: 'Los tickets abiertos por etapa del proceso' },
  reports:       { title: 'Reportes',           sub: 'Cumplimiento, tiempos de atención y origen de la demanda' },
  dashboard:     { title: 'Panel de ejecución', sub: 'Estado del portafolio de trabajos en curso' },
  'team-kanban': { title: 'Proyectos',          sub: 'Trabajos en ejecución del equipo de automatización' },
  analytics:     { title: 'Equipo Analítica',   sub: 'Trabajos en ejecución del equipo de analítica de datos' },
  gantt:         { title: 'Cronograma',         sub: 'Línea de tiempo y avance de los trabajos en curso' },
  historial:     { title: 'Historial',          sub: 'Trabajos finalizados y cerrados' },
  users:         { title: 'Usuarios',           sub: 'Equipo, roles y accesos' },
};

const STATUS_NAMES = {
  backlog: 'Por hacer', progress: 'En proceso', standby: 'En standby',
  testing: 'En testing', done: 'Finalizado', soporte: 'En soporte', cancelado: 'Cancelado',
};

const LEADER_ROLES = ['admin', 'leader_analytics'];

/** Sección inicial según el rol: cada quien entra donde está su trabajo. */
function defaultSection(role) {
  if (role === 'user')             return 'mine';
  if (role === 'engineer')         return 'mine';
  if (role === 'member_analytics') return 'mine';
  return 'inbox';
}

/* Payload completo para PUT /projects/:id — evita que updates parciales
   borren campos que la pantalla no estaba editando. */
function projectPayload(p, overrides = {}) {
  return {
    name: p.name, description: p.description, client: p.client,
    status: p.status, priority: p.priority || 'mid',
    assigneeIds: p.assigneeIds || (p.assigneeId ? [p.assigneeId] : []),
    startDate: p.startDate, dueDate: p.dueDate, progress: p.progress || 0,
    tipo: p.tipo || 'automatizacion', docUrl: p.docUrl || null,
    coAssigneeId: p.coAssigneeId || null,
    generalAssigneeId: p.generalAssigneeId || null,
    participationAuto: p.participationAuto || null,
    participationAnalitica: p.participationAnalitica || null,
    progressAuto: p.progressAuto || 0,
    progressAnalitica: p.progressAnalitica || 0,
    ...overrides,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Raíz — resuelve la sesión y monta el proveedor de tickets
   ══════════════════════════════════════════════════════════════════════════ */

export default function App() {
  const { user, loading, logout } = useAuth();
  const { toasts, show: showToast, remove: removeToast } = useToast();
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (!user) return;
    usersAPI.getAll().then(setUsers).catch(() => {});
  }, [user]);

  if (loading) {
    return (
      <div style={{
        display: 'grid', placeItems: 'center', height: '100vh',
        gap: 12, color: 'var(--rb-text-3)', fontFamily: 'var(--rb-font)',
      }}>
        <img src="/logo-symbol.svg" alt="" width={44} height={44} />
        <span style={{ fontSize: 'var(--rb-fs-sm)' }}>Cargando {ORG.product}…</span>
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <TicketsProvider user={user} users={users} showToast={showToast}>
      <Workspace
        user={user} users={users} setUsers={setUsers}
        logout={logout} showToast={showToast}
        toasts={toasts} removeToast={removeToast}
      />
    </TicketsProvider>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Espacio de trabajo — estructura, navegación y módulo de proyectos
   ══════════════════════════════════════════════════════════════════════════ */

function Workspace({ user, users, setUsers, logout, showToast, toasts, removeToast }) {
  const { tickets } = useTickets();

  const [section, setSection]         = useState(() => defaultSection(user.role));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sectionKey, setSectionKey]   = useState(0);
  const [projects, setProjects]       = useState([]);
  const [dashPeriod, setDashPeriod]   = useState('all');

  const [projModal, setProjModal]     = useState({ open: false, project: null, defStatus: null, defAssigneeId: null });
  const [detailModal, setDetailModal] = useState({ open: false, projectId: null });
  const [userModal, setUserModal]     = useState({ open: false, user: null });

  /* Serializa las mutaciones de tareas por proyecto: sin esto, dos peticiones
     en vuelo para el mismo proyecto resuelven en desorden y una respuesta
     vieja pisa a una nueva (era lo que hacía "desaparecer" tareas). */
  const taskQueueRef = useRef({});
  const enqueueTaskOp = (projectId, op) => {
    const prev = taskQueueRef.current[projectId] || Promise.resolve();
    const next = prev.then(op, op);
    taskQueueRef.current[projectId] = next;
    return next;
  };

  const fetchProjects = useCallback(async () => {
    try { setProjects(await projectsAPI.getAll()); }
    catch (e) { console.error(e); }
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  /* La sección activa siempre tiene que existir para el rol: si alguien cambia
     de rol o llega con un estado viejo, se cae a la sección por defecto. */
  useEffect(() => {
    const allowed = sectionsFor(user.role).map(s => s.id);
    if (!allowed.includes(section)) setSection(defaultSection(user.role));
  }, [user.role, section]);

  /* Enlace directo desde un correo de notificación (?project=<id>). */
  useEffect(() => {
    if (!projects.length) return;
    const params = new URLSearchParams(window.location.search);
    const pid = params.get('project');
    if (pid && projects.some(p => p.id === pid)) {
      setDetailModal({ open: true, projectId: pid });
      params.delete('project');
      const rest = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (rest ? `?${rest}` : ''));
    }
  }, [projects]);

  /* ── Visibilidad por equipo ────────────────────────────────────────────
     Ingeniería no ve Analítica; Analítica ve lo suyo, lo compartido y las
     asignaciones flash que realmente sean de alguien de su equipo (una flash
     puede ser de cualquiera de los dos, así que se valida por responsable). */
  const analyticsIds = new Set(
    users.filter(u => ['member_analytics', 'leader_analytics'].includes(u.role)).map(u => u.id),
  );
  const isAnalyticsFlash = (p) => p.tipo === 'asignacion_flash'
    && [...(p.assigneeIds || [p.assigneeId]), p.coAssigneeId, p.generalAssigneeId]
      .filter(Boolean).some(id => analyticsIds.has(id));

  const visibleProjects = user.role === 'engineer'
    ? projects.filter(p => (p.tipo || 'automatizacion') !== 'analitica')
    : ['member_analytics', 'leader_analytics'].includes(user.role)
      ? projects.filter(p => ['analitica', 'compartido'].includes(p.tipo || 'automatizacion') || isAnalyticsFlash(p))
      : projects;

  const detailProject = detailModal.projectId
    ? visibleProjects.find(p => p.id === detailModal.projectId)
    : null;

  const isLeader     = LEADER_ROLES.includes(user.role);
  const canManage    = ['admin', 'leader_analytics', 'member_analytics'].includes(user.role);
  const desk         = isDesk(user);
  const isTicketView = ['inbox', 'mine', 'board', 'reports'].includes(section);

  /* Contadores del menú — dicen dónde hay trabajo esperando. */
  const openTickets = tickets.filter(isOpen);
  const badges = {
    unassigned: {
      count: desk ? openTickets.filter(t => !t.assignee_id).length : 0,
      alert: openTickets.some(t => slaOf(t)?.state === 'breached'),
      title: 'Tickets abiertos sin responsable',
    },
    mine: {
      count: desk
        ? openTickets.filter(t => t.assignee_id === user.id).length
        : openTickets.filter(t => t.user_id === user.id).length,
      title: 'Tickets abiertos a tu nombre',
    },
  };

  let { title, sub } = TITLES[section] || TITLES.inbox;
  if (section === 'mine' && !desk) sub = 'Tus solicitudes a la mesa de servicio y en qué va cada una';
  if (section === 'dashboard' && ['engineer', 'member_analytics'].includes(user.role)) {
    title = 'Mi panel';
    sub   = 'Tus tareas pendientes y tus trabajos en curso';
  }

  const changeSection = (id) => {
    setSection(id);
    setSectionKey(k => k + 1);
    setSidebarOpen(false);
  };

  /* ── Proyectos ─────────────────────────────────────────────────────────── */

  const openNewProject = (defStatus, defAssigneeId = null) =>
    setProjModal({ open: true, project: null, defStatus, defAssigneeId });

  const openEditProject = (id) => {
    const p = projects.find(x => x.id === id);
    if (p) setProjModal({ open: true, project: p, defStatus: null, defAssigneeId: null });
  };

  const openDetail = (id) => setDetailModal({ open: true, projectId: id });

  const handleSaveProject = async (data, tasksDelta) => {
    const isEdit = Boolean(projModal.project);
    let updated = isEdit
      ? await projectsAPI.update(projModal.project.id, data)
      : await projectsAPI.create(data);

    if (tasksDelta) {
      try {
        for (const t of tasksDelta.added) {
          updated = await projectsAPI.addTask(updated.id, {
            title: t.title, dueDate: t.dueDate || null, weight: t.weight, assigneeId: t.assigneeId || null,
          });
          if (t.done) {
            const created = updated.tasks[updated.tasks.length - 1];
            if (created) updated = await projectsAPI.updateTask(updated.id, created.id, { done: true });
          }
        }
        for (const id of tasksDelta.removed)  updated = await projectsAPI.removeTask(updated.id, id);
        for (const t of tasksDelta.toggled)   updated = await projectsAPI.updateTask(updated.id, t.id, { done: t.done });
        for (const t of tasksDelta.reassigned || []) updated = await projectsAPI.updateTask(updated.id, t.id, { assigneeId: t.assigneeId });
      } catch (err) {
        console.error('Task sync failed:', err);
        showToast('Proyecto guardado, pero hubo un error con las tareas', 'error');
      }
    }

    if (isEdit) {
      setProjects(ps => ps.map(p => (p.id === updated.id ? updated : p)));
      showToast(`«${updated.name}» actualizado`, 'success');
    } else {
      setProjects(ps => [updated, ...ps]);
      showToast(`Proyecto «${updated.name}» creado`, 'success');
    }
    setProjModal(m => ({ ...m, open: false }));
  };

  const handleDeleteProject = async () => {
    const { id, name } = projModal.project;
    await projectsAPI.remove(id);
    setProjects(ps => ps.filter(p => p.id !== id));
    setProjModal(m => ({ ...m, open: false }));
    if (detailModal.projectId === id) setDetailModal({ open: false, projectId: null });
    showToast(`«${name}» eliminado`, 'error');
  };

  const handleAddLog = async (id, data) => {
    const { block, ...logData } = data;
    if (block) logData.text = `⚠ BLOQUEO: ${logData.text}`;
    let updated = await projectsAPI.addLog(id, logData);
    if (block && updated.status !== 'standby') {
      updated = await projectsAPI.update(id, projectPayload(updated, { status: 'standby' }));
    }
    setProjects(ps => ps.map(p => (p.id === updated.id ? updated : p)));
    showToast(block ? 'Bloqueo reportado — trabajo en standby' : 'Avance registrado', block ? 'error' : 'success');
    return updated;
  };

  const handleAddTask = (id, title, extra = {}) => enqueueTaskOp(id, async () => {
    const updated = await projectsAPI.addTask(id, { title, ...extra });
    setProjects(ps => ps.map(p => (p.id === updated.id ? updated : p)));
  });

  const taskOp = (label) => (id, taskId, arg) => enqueueTaskOp(id, async () => {
    try {
      const updated = label === 'remove'
        ? await projectsAPI.removeTask(id, taskId)
        : await projectsAPI.updateTask(id, taskId, arg);
      setProjects(ps => ps.map(p => (p.id === updated.id ? updated : p)));
    } catch {
      showToast(label === 'remove' ? 'Error al eliminar la tarea' : 'Error al actualizar la tarea', 'error');
    }
  });

  const handleToggleTask = (id, taskId, done) => taskOp('update')(id, taskId, { done });
  const handleDeleteTask = (id, taskId)       => taskOp('remove')(id, taskId);
  const handleUpdateTask = (id, taskId, data) => taskOp('update')(id, taskId, data);

  const handleCloseSupport = async (id) => {
    const p = projects.find(x => x.id === id);
    if (!p) return;
    try {
      const updated = await projectsAPI.update(id, projectPayload(p, { status: 'done', supportClosed: true }));
      setProjects(ps => ps.map(x => (x.id === updated.id ? updated : x)));
      setDetailModal({ open: false, projectId: null });
      showToast(`Soporte de «${p.name}» cerrado`, 'success');
    } catch {
      showToast('Error al cerrar el soporte', 'error');
    }
  };

  /* Flujo permitido a quien ejecuta: En proceso → Testing → Finalizado/Soporte. */
  const ENGINEER_FLOW = { progress: ['testing'], testing: ['done', 'soporte'] };

  const handleMoveCard = async (projectId, newStatus) => {
    const p = projects.find(x => x.id === projectId);
    if (!p || p.status === newStatus) return;
    if (!isLeader) {
      const owns = [...(p.assigneeIds || [p.assigneeId]), p.coAssigneeId, p.generalAssigneeId]
        .filter(v => v != null).map(Number).includes(Number(user.id));
      if (!owns) return showToast('Solo el responsable de este trabajo puede modificarlo', 'error');
      if (!(ENGINEER_FLOW[p.status] || []).includes(newStatus)) {
        return showToast('Solo el líder puede realizar este cambio de estado', 'error');
      }
    }
    setProjects(ps => ps.map(x => (x.id === projectId ? { ...x, status: newStatus } : x)));
    try {
      const updated = await projectsAPI.update(projectId, projectPayload(p, { status: newStatus }));
      setProjects(ps => ps.map(x => (x.id === updated.id ? updated : x)));
      showToast(`Movido a «${STATUS_NAMES[newStatus]}»`, 'success');
    } catch {
      setProjects(ps => ps.map(x => (x.id === projectId ? p : x)));
      showToast('Error al mover el trabajo', 'error');
    }
  };

  /* ── Usuarios ──────────────────────────────────────────────────────────── */

  const handleSaveUser = async (data, id) => {
    if (id) {
      const updated = await usersAPI.update(id, data);
      setUsers(us => us.map(u => (u.id === updated.id ? updated : u)));
      showToast(`Usuario «${updated.name}» actualizado`, 'success');
    } else {
      const created = await usersAPI.create(data);
      setUsers(us => [...us, created]);
      showToast(`Usuario «${created.name}» creado`, 'success');
    }
    setUserModal({ open: false, user: null });
  };

  const handleUnlockUser = async (id) => {
    const u = users.find(x => x.id === id);
    try {
      await usersAPI.unlock(id);
      setUsers(us => us.map(x => (x.id === id ? { ...x, locked: false } : x)));
      showToast(`Cuenta de «${u?.name}» desbloqueada`, 'success');
    } catch (err) {
      showToast(err.error || 'Error al desbloquear', 'error');
    }
  };

  const handleDeleteUser = async (id) => {
    const u = users.find(x => x.id === id);
    try {
      await usersAPI.remove(id);
      setUsers(us => us.filter(x => x.id !== id));
      showToast(`«${u?.name}» eliminado`, 'error');
    } catch (err) {
      showToast(err.error || 'Error al eliminar el usuario', 'error');
    }
  };

  const showNewProject = canManage && ['team-kanban', 'analytics'].includes(section);

  /* ── Render ────────────────────────────────────────────────────────────── */

  return (
    <>
      <div className="rb-shell">
        {sidebarOpen && <div className="rb-scrim" onClick={() => setSidebarOpen(false)} />}
        <Sidebar
          section={section} onSection={changeSection} user={user}
          onLogout={logout} isOpen={sidebarOpen} badges={badges}
        />

        <div className="rb-main">
          <header className="rb-topbar">
            <button className="rb-burger" onClick={() => setSidebarOpen(o => !o)} aria-label="Abrir menú">
              <Icon name="menu" size={18} />
            </button>
            <div style={{ minWidth: 0 }}>
              <h1 className="rb-topbar-title">{title}</h1>
              <p className="rb-topbar-sub rb-truncate">{sub}</p>
            </div>

            <div className="rb-topbar-actions">
              {desk && !isTicketView && <ProjectSearch projects={visibleProjects} onSelect={openDetail} />}
              {desk && <NotificationBell onOpenProject={openDetail} />}
              {showNewProject && (
                <Button variant="primary" icon="plus" onClick={() => openNewProject('backlog')}>
                  Nuevo proyecto
                </Button>
              )}
            </div>
          </header>

          <main className="rb-page" key={sectionKey}>
            {isTicketView && (
              section === 'reports'
                ? <TicketReports />
                : <TicketsView
                    view={section} user={user} users={users} showToast={showToast}
                    onProjectCreated={(project) => setProjects(ps => [project, ...ps])}
                  />
            )}

            {section === 'dashboard' && (
              ['engineer', 'member_analytics'].includes(user.role)
                ? <PersonalDashboardView projects={visibleProjects} users={users} currentUser={user}
                    onCardClick={openDetail} onNavigate={changeSection} />
                : <DashboardView projects={visibleProjects} users={users} solicitudes={tickets}
                    onCardClick={openDetail} onNavigate={changeSection} role={user.role}
                    period={dashPeriod} onPeriodChange={setDashPeriod} />
            )}

            {section === 'team-kanban' && (
              <AnalyticsTeamView
                variant="auto" projects={visibleProjects}
                users={users.filter(u => u.role === 'engineer')}
                onCardClick={openDetail} onNavigate={changeSection}
              />
            )}

            {section === 'analytics' && (
              <AnalyticsTeamView
                projects={projects}
                users={users.filter(u => u.role === 'member_analytics')}
                onCardClick={openDetail} onNavigate={changeSection}
              />
            )}

            {section === 'gantt' && (
              <GanttView
                projects={visibleProjects}
                users={users.filter(u => ['engineer', 'member_analytics', 'leader_analytics', 'admin'].includes(u.role))}
                onRowClick={openDetail}
              />
            )}

            {section === 'historial' && (
              <HistorialView projects={visibleProjects} users={users} onCardClick={openDetail} />
            )}

            {section === 'users' && user.role === 'admin' && (
              <UsersView
                users={users} projects={projects} currentUser={user}
                onEdit={(u) => setUserModal({ open: true, user: u })}
                onDelete={handleDeleteUser}
                onUnlock={handleUnlockUser}
                onAdd={() => setUserModal({ open: true, user: null })}
              />
            )}
          </main>
        </div>

        <ProjectModal
          open={projModal.open} project={projModal.project}
          defStatus={projModal.defStatus} defAssigneeId={projModal.defAssigneeId}
          currentUser={user} users={users}
          onSave={handleSaveProject} onDelete={handleDeleteProject} onAddLog={handleAddLog}
          onClose={() => setProjModal(m => ({ ...m, open: false }))}
        />

        <DetailModal
          open={detailModal.open} project={detailProject} currentUser={user} users={users}
          onClose={() => setDetailModal({ open: false, projectId: null })}
          onEdit={(id) => {
            setDetailModal({ open: false, projectId: null });
            setTimeout(() => openEditProject(id), 100);
          }}
          onAddLog={handleAddLog} onCloseSupport={handleCloseSupport}
          onAddTask={handleAddTask} onToggleTask={handleToggleTask}
          onDeleteTask={handleDeleteTask} onUpdateTask={handleUpdateTask}
        />

        <UserModal
          open={userModal.open} user={userModal.user}
          onSave={handleSaveUser} onClose={() => setUserModal({ open: false, user: null })}
        />

        <Toast toasts={toasts} onRemove={removeToast} />
      </div>

      {/* Informe PDF — solo se materializa al imprimir desde el panel */}
      {section === 'dashboard' && (
        <ReportPrint
          projects={dashPeriod === 'month'
            ? projects.filter(p => {
                const ms = new Date(); ms.setDate(1); ms.setHours(0, 0, 0, 0);
                return p.createdAt && new Date(p.createdAt) >= ms;
              })
            : projects}
          users={users} solicitudes={tickets}
          periodLabel={dashPeriod === 'month' ? 'Este mes' : 'Todo el portafolio'}
        />
      )}
    </>
  );
}
