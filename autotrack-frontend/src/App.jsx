import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './context/AuthContext';
import { TicketsProvider, useTickets } from './context/TicketsContext';
import { projectsAPI, usersAPI } from './services/api';
import { ORG, isDesk, isOpen, slaOf, can, teamsOf, roleOf, assignables } from './lib/tickets';
import { asset } from './lib/assets';

import Login from './pages/Login';
import Sidebar, { sectionsFor } from './components/Sidebar';
import { Button, Icon } from './components/ui';
import { SelectorVistaPrevia, AvisoVistaPrevia } from './components/VistaPreviaRol';
import { TicketsView, TicketReports } from './components/tickets';

import GanttView from './components/GanttView';
import ProjectBoard from './components/ProjectBoard';
import ProjectDetailPanel from './components/ProjectDetailPanel';
import AnalyticsReportView from './components/AnalyticsReportView';
import HistorialView from './components/HistorialView';
import UsersView from './components/UsersView';
import UserModal from './components/UserModal';
import ProjectSearch from './components/ProjectSearch';
import NotificationBell from './components/NotificationBell';
import ProjectModal from './components/ProjectModal';
import Toast, { useToast } from './components/Toast';

/* Encabezado de cada sección. El subtítulo dice para qué sirve la pantalla,
   no qué contiene: es la única pista de navegación que mucha gente lee. */
const TITLES = {
  inbox:         { title: 'Bandeja de tickets', sub: 'Todo lo que llega a la mesa de servicio, priorizado por compromiso de atención' },
  mine:          { title: 'Mis tickets',        sub: 'Lo que está a tu nombre' },
  board:         { title: 'Flujo de trabajo',   sub: 'Los tickets abiertos por etapa del proceso' },
  reports:       { title: 'Panorama',          sub: 'Qué hay pendiente, a qué ritmo avanzamos, cuánto tardamos y qué viene' },
  projects:      { title: 'Proyectos',         sub: 'Tablero de todos los trabajos en curso por estado' },
  'analytics-report': { title: 'Reporte Analítica', sub: 'Seguimiento por cliente del equipo de analítica de datos' },
  gantt:         { title: 'Cronograma',         sub: 'Línea de tiempo y avance de los trabajos en curso' },
  historial:     { title: 'Historial',          sub: 'Trabajos finalizados y cerrados' },
  users:         { title: 'Usuarios',           sub: 'Equipo, roles y accesos' },
};

const STATUS_NAMES = {
  backlog: 'Por hacer', progress: 'En proceso', standby: 'En standby',
  testing: 'En testing', done: 'Finalizado', soporte: 'En soporte', cancelado: 'Cancelado',
};

/**
 * Sección inicial: cada quien entra donde está su trabajo. Quien coordina
 * abre la bandeja; quien ejecuta o solo solicita, lo suyo.
 */
function defaultSection(role) {
  const r = roleOf(role);
  if (!r.bandeja) return 'mine';        // auditor solicitante
  if (r.ejecuta)  return 'mine';        // quien ejecuta, a lo suyo
  return r.triage ? 'inbox' : 'reports';    // coordina → bandeja; gerencia → panorama
}

/* Payload completo para PUT /projects/:id — evita que updates parciales
   borren campos que la pantalla no estaba editando. */
function projectPayload(p, overrides = {}) {
  return {
    name: p.name, description: p.description, client: p.client,
    clientIds: (p.clients || (p.clientId != null ? [p.clientId] : [])).map(c => typeof c === 'object' ? c.id : c),
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
        <img src={asset('logo-symbol.svg')} alt="" width={44} height={44} />
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

  /* Vista previa de rol: cambia lo que se muestra, nunca los permisos reales.
     Se guarda en la pestaña para que sobreviva a una recarga, pero no al
     navegador: no debe quedarse puesta sin que nadie se acuerde. */
  const [previewRole, setPreviewRole] = useState(
    () => sessionStorage.getItem('rb-ver-como') || null,
  );
  const vistaUser = previewRole ? { ...user, role: previewRole } : user;

  const [section, setSection]         = useState(() => defaultSection(vistaUser.role));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sectionKey, setSectionKey]   = useState(0);
  const [projects, setProjects]       = useState([]);

  const [projModal, setProjModal]     = useState({ open: false, project: null, defStatus: null, defAssigneeId: null, defClientIds: [], defArea: null });
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
    const allowed = sectionsFor(vistaUser.role).map(s => s.id);
    if (!allowed.includes(section)) setSection(defaultSection(vistaUser.role));
  }, [vistaUser.role, section]);

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
     Quien coordina los dos equipos lo ve todo. Quien trabaja en uno solo ve
     lo suyo, lo compartido y las asignaciones flash que sean realmente de
     alguien de su equipo: una flash puede ser de cualquiera de los dos, así
     que se valida por responsable y no por el tipo. */
  const equipos = teamsOf(vistaUser);
  const soloUnEquipo = equipos.length === 1 ? equipos[0] : null;

  const idsDelEquipo = new Set(
    users.filter(u => teamsOf(u).length === 1 && teamsOf(u)[0] === soloUnEquipo).map(u => u.id),
  );
  const esFlashDelEquipo = (p) => p.tipo === 'asignacion_flash'
    && [...(p.assigneeIds || [p.assigneeId]), p.coAssigneeId, p.generalAssigneeId]
      .filter(Boolean).some(id => idsDelEquipo.has(id));

  const visibleProjects = !soloUnEquipo ? projects : projects.filter(p => {
    const tipo = p.tipo || 'automatizacion';
    return tipo === soloUnEquipo || tipo === 'compartido' || esFlashDelEquipo(p);
  });

  const detailProject = detailModal.projectId
    ? visibleProjects.find(p => p.id === detailModal.projectId)
    : null;

  const isLeader     = can(vistaUser, 'gestionarProyectos');
  const canManage    = can(vistaUser, 'crearProyectos');
  const desk         = isDesk(vistaUser);
  const isTicketView = ['inbox', 'mine', 'board'].includes(section);

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

  const verComo = (rol) => {
    setPreviewRole(rol);
    if (rol) sessionStorage.setItem('rb-ver-como', rol);
    else sessionStorage.removeItem('rb-ver-como');
    // La sección actual puede no existir para ese rol: se entra por su inicio.
    setSection(defaultSection(rol || user.role));
    setSectionKey(k => k + 1);
  };

  const changeSection = (id) => {
    setSection(id);
    setSectionKey(k => k + 1);
    setSidebarOpen(false);
  };

  /* ── Proyectos ─────────────────────────────────────────────────────────── */

  const openNewProject = (defStatus, defAssigneeId = null, defClientIds = [], defArea = null) =>
    setProjModal({ open: true, project: null, defStatus, defAssigneeId, defClientIds, defArea });

  const openEditProject = (id) => {
    const p = projects.find(x => x.id === id);
    if (p) setProjModal({ open: true, project: p, defStatus: null, defAssigneeId: null, defClientIds: [], defArea: null });
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
            title: t.title, dueDate: t.dueDate || null, weight: t.weight, priority: t.priority, clientId: t.clientId, assigneeId: t.assigneeId || null,
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

  /* Marcar la analítica de un cliente entra por la misma cola que las tareas:
     comparte proyecto con ellas y el servidor devuelve el proyecto completo,
     así que dos respuestas cruzadas dejarían el panel mostrando lo anterior. */
  const handleSetClientAnalytics = (id, clientId, cargada) => enqueueTaskOp(id, async () => {
    const updated = await projectsAPI.setClientAnalytics(id, clientId, cargada);
    setProjects(ps => ps.map(p => (p.id === updated.id ? updated : p)));
  });

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

  const showNewProject = canManage && section === 'projects';

  /* ── Render ────────────────────────────────────────────────────────────── */

  return (
    <>
      <div className="rb-shell">
        {sidebarOpen && <div className="rb-scrim" onClick={() => setSidebarOpen(false)} />}
        <Sidebar
          section={section} onSection={changeSection}
          user={user} viewRole={previewRole}
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
              {can(user, 'gestionarUsuarios') && (
                <SelectorVistaPrevia valor={previewRole} onChange={verComo} />
              )}
              {showNewProject && (
                <Button variant="primary" icon="plus" onClick={() => openNewProject('backlog')}>
                  Nuevo proyecto
                </Button>
              )}
            </div>
          </header>

          <AvisoVistaPrevia rol={previewRole} onSalir={() => verComo(null)} />

          <main className="rb-page" key={sectionKey}>
            {isTicketView && (
              <TicketsView
                view={section} user={vistaUser} users={users} showToast={showToast}
                onProjectCreated={(project) => setProjects(ps => [project, ...ps])}
              />
            )}

            {section === 'projects' && (
              <ProjectBoard
                projects={visibleProjects}
                users={users} allUsers={users}
                onCardClick={openDetail}
                onNewProject={() => openNewProject('backlog')}
              />
            )}

            {section === 'reports' && (
              <TicketReports projects={visibleProjects} />
            )}

            {section === 'analytics-report' && can(vistaUser, 'verReporteAnalitica') && (
              <AnalyticsReportView users={users} />
            )}

            {section === 'gantt' && (
              <GanttView
                projects={visibleProjects}
                users={assignables(users)}
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
          defStatus={projModal.defStatus} defAssigneeId={projModal.defAssigneeId} defClientIds={projModal.defClientIds} defArea={projModal.defArea}
          currentUser={user} users={users}
          onSave={handleSaveProject} onDelete={handleDeleteProject} onAddLog={handleAddLog}
          onClose={() => setProjModal(m => ({ ...m, open: false }))}
        />

        <ProjectDetailPanel
          open={detailModal.open} project={detailProject} currentUser={user} users={users}
          onClose={() => setDetailModal({ open: false, projectId: null })}
          onEdit={(id) => {
            setDetailModal({ open: false, projectId: null });
            setTimeout(() => openEditProject(id), 100);
          }}
          onAddLog={handleAddLog}
          onAddTask={handleAddTask} onToggleTask={handleToggleTask}
          onDeleteTask={handleDeleteTask} onUpdateTask={handleUpdateTask}
          onSetClientAnalytics={handleSetClientAnalytics}
        />

        <UserModal
          open={userModal.open} user={userModal.user}
          onSave={handleSaveUser} onClose={() => setUserModal({ open: false, user: null })}
        />

        <Toast toasts={toasts} onRemove={removeToast} />
      </div>
    </>
  );
}
