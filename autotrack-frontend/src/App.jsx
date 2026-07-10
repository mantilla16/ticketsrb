import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { projectsAPI, usersAPI, solicitudesAPI } from './services/api';
import Login from './pages/Login';
import Sidebar from './components/Sidebar';
import DashboardView from './components/DashboardView';
import KanbanBoard from './components/KanbanBoard';
import TeamKanban from './components/TeamKanban';
import GanttView from './components/GanttView';
import AnalyticsTeamView from './components/AnalyticsTeamView';
const ANALYTICS_NAMES = ['miguel padilla', 'andres holguin'];
import HistorialView from './components/HistorialView';
import UsersView from './components/UsersView';
import UserModal from './components/UserModal';
import SolicitudesView from './components/SolicitudesView';
import ProjectSearch from './components/ProjectSearch';
import ProjectModal from './components/ProjectModal';
import DetailModal from './components/DetailModal';
import Toast, { useToast } from './components/Toast';

const TITLES = {
  'dashboard':    { title: 'Panorama general',         sub: 'Resumen del trabajo de Automatización y Analítica' },
  'my-kanban':    { title: 'Mi Kanban',                sub: 'Vista personal — organiza tus proyectos por estado' },
  'team-kanban':  { title: 'Equipo Automatización',    sub: 'Proyectos asignados por ingeniero' },
  'gantt':        { title: 'Cronograma',               sub: 'Línea de tiempo y progreso de todos los proyectos' },
  'analytics':    { title: 'Equipo Analítica',         sub: 'Proyectos de Miguel Padilla y Andres Holguin' },
  'historial':    { title: 'Historial',                sub: 'Proyectos finalizados y cerrados' },
  'users':        { title: 'Usuarios',                 sub: 'Gestión del equipo — roles, accesos y estadísticas' },
  'solicitudes':  { title: 'Centro de Solicitudes',    sub: 'Gestión de requerimientos entrantes desde otras áreas' },
};

const STATUS_NAMES = {
  backlog: 'Por hacer', progress: 'En proceso',
  standby: 'En standby', testing: 'En testing',
  done: 'Finalizado', soporte: 'En soporte',
};

function defaultSection(role) {
  if (role === 'user')             return 'solicitudes';
  if (role === 'member_analytics') return 'my-kanban';
  return 'dashboard';
}

const LEADER_ROLES = ['admin', 'leader_analytics'];

// Full payload for PUT /projects/:id — evita que updates parciales borren campos
function projectPayload(p, overrides = {}) {
  return {
    name: p.name, description: p.description, client: p.client,
    status: p.status, priority: p.priority || 'mid',
    assigneeId: p.assigneeId, startDate: p.startDate,
    dueDate: p.dueDate, progress: p.progress || 0,
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

export default function App() {
  const { user, loading, logout } = useAuth();
  const { toasts, show: showToast, remove: removeToast } = useToast();

  const [section, setSection]         = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sectionKey, setSectionKey]   = useState(0);
  const [projects, setProjects]       = useState([]);
  const [users, setUsers]             = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);

  const [projModal, setProjModal]     = useState({ open: false, project: null, defStatus: null, defAssigneeId: null });
  const [detailModal, setDetailModal] = useState({ open: false, projectId: null });
  const [userModal, setUserModal]     = useState({ open: false, user: null });

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const canSeeSols = ['admin', 'leader_analytics', 'manager'].includes(user.role);
      const [ps, us, sols] = await Promise.all([
        projectsAPI.getAll(),
        usersAPI.getAll(),
        canSeeSols ? solicitudesAPI.getAll().catch(() => []) : Promise.resolve([]),
      ]);
      setProjects(ps);
      setUsers(us);
      setSolicitudes(sols);
    } catch (e) { console.error(e); }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Set default section based on role after user loads
  useEffect(() => {
    if (user) setSection(defaultSection(user.role));
  }, [user?.role]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text2)', fontFamily: 'var(--font)', gap: 10 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', animation: 'dotPulse 1s ease-in-out infinite' }} />
      Cargando...
    </div>
  );
  if (!user) return <Login />;

  const detailProject = detailModal.projectId ? projects.find(p => p.id === detailModal.projectId) : null;
  const { title, sub } = TITLES[section] || TITLES['dashboard'];

  const changeSection = (id) => {
    setSection(id);
    setSectionKey(k => k + 1);
    setSidebarOpen(false);
  };

  const openNewProject = (defStatus, defAssigneeId = null) =>
    setProjModal({ open: true, project: null, defStatus, defAssigneeId });

  const openEditProject = (id) => {
    const p = projects.find(x => x.id === id);
    if (p) setProjModal({ open: true, project: p, defStatus: null, defAssigneeId: null });
  };

  const openDetail = (id) => setDetailModal({ open: true, projectId: id });

  const handleSaveProject = async (data) => {
    let updated;
    if (projModal.project) {
      updated = await projectsAPI.update(projModal.project.id, data);
      setProjects(ps => ps.map(p => p.id === updated.id ? updated : p));
      showToast(`"${updated.name}" actualizado`, 'success');
    } else {
      updated = await projectsAPI.create(data);
      setProjects(ps => [updated, ...ps]);
      showToast(`Proyecto "${updated.name}" creado`, 'success');
    }
    setProjModal(m => ({ ...m, open: false }));
  };

  const handleDeleteProject = async () => {
    const name = projModal.project.name;
    await projectsAPI.remove(projModal.project.id);
    setProjects(ps => ps.filter(p => p.id !== projModal.project.id));
    setProjModal(m => ({ ...m, open: false }));
    if (detailModal.projectId === projModal.project.id) {
      setDetailModal({ open: false, projectId: null });
    }
    showToast(`"${name}" eliminado`, 'error');
  };

  const handleAddLog = async (id, data) => {
    const { block, ...logData } = data;
    if (block) logData.text = `⚠ BLOQUEO: ${logData.text}`;
    let updated = await projectsAPI.addLog(id, logData);
    if (block && updated.status !== 'standby') {
      updated = await projectsAPI.update(id, projectPayload(updated, { status: 'standby' }));
    }
    setProjects(ps => ps.map(p => p.id === updated.id ? updated : p));
    showToast(block ? 'Bloqueo reportado — proyecto en standby' : 'Avance registrado', block ? 'error' : 'success');
  };

  const handleAddTask = async (id, title) => {
    const updated = await projectsAPI.addTask(id, { title });
    setProjects(ps => ps.map(p => p.id === updated.id ? updated : p));
  };

  const handleToggleTask = async (id, taskId, done) => {
    try {
      const updated = await projectsAPI.updateTask(id, taskId, { done });
      setProjects(ps => ps.map(p => p.id === updated.id ? updated : p));
    } catch {
      showToast('Error al actualizar la tarea', 'error');
    }
  };

  const handleDeleteTask = async (id, taskId) => {
    try {
      const updated = await projectsAPI.removeTask(id, taskId);
      setProjects(ps => ps.map(p => p.id === updated.id ? updated : p));
    } catch {
      showToast('Error al eliminar la tarea', 'error');
    }
  };

  const handleCloseSupport = async (id) => {
    const p = projects.find(x => x.id === id);
    if (!p) return;
    try {
      const updated = await projectsAPI.update(id, projectPayload(p, { status: 'done', supportClosed: true }));
      setProjects(ps => ps.map(x => x.id === updated.id ? updated : x));
      setDetailModal({ open: false, projectId: null });
      showToast(`Soporte de "${p.name}" cerrado`, 'success');
    } catch {
      showToast('Error al cerrar el soporte', 'error');
    }
  };

  const handleMoveCard = async (projectId, newStatus) => {
    const p = projects.find(x => x.id === projectId);
    if (!p || p.status === newStatus) return;
    setProjects(ps => ps.map(x => x.id === projectId ? { ...x, status: newStatus } : x));
    try {
      const updated = await projectsAPI.update(projectId, projectPayload(p, { status: newStatus }));
      setProjects(ps => ps.map(x => x.id === updated.id ? updated : x));
      showToast(`Movido a "${STATUS_NAMES[newStatus]}"`, 'success');
    } catch {
      setProjects(ps => ps.map(x => x.id === projectId ? p : x));
      showToast('Error al mover el proyecto', 'error');
    }
  };

  // User CRUD handlers
  const handleSaveUser = async (data, id) => {
    try {
      if (id) {
        const updated = await usersAPI.update(id, data);
        setUsers(us => us.map(u => u.id === updated.id ? updated : u));
        showToast(`Usuario "${updated.name}" actualizado`, 'success');
      } else {
        const created = await usersAPI.create(data);
        setUsers(us => [...us, created]);
        showToast(`Usuario "${created.name}" creado`, 'success');
      }
      setUserModal({ open: false, user: null });
    } catch (err) {
      throw err; // re-throw so UserModal shows inline error
    }
  };

  const handleDeleteUser = async (id) => {
    const u = users.find(x => x.id === id);
    try {
      await usersAPI.remove(id);
      setUsers(us => us.filter(x => x.id !== id));
      showToast(`"${u?.name}" eliminado`, 'error');
    } catch (err) {
      showToast(err.error || 'Error al eliminar el usuario', 'error');
    }
  };

  const isLeader = LEADER_ROLES.includes(user?.role);
  const showNewProject = isLeader && (section === 'my-kanban' || section === 'team-kanban');

  return (
    <div className="layout">
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
      <Sidebar section={section} onSection={changeSection} user={user} onLogout={logout} isOpen={sidebarOpen} />

      <div className="main-col">
        {/* Topbar */}
        <div className="topbar">
          <div className="topbar-left">
            <button className="hamburger" onClick={() => setSidebarOpen(o => !o)} aria-label="Menú">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <div className="topbar-titles">
              <div className="page-title">{title}</div>
              <div className="page-subtitle">{sub}</div>
            </div>
          </div>
          <div className="topbar-right">
            {user?.role !== 'user' && (
              <ProjectSearch projects={projects} onSelect={openDetail} />
            )}
            {showNewProject && (
              <button className="btn btn-primary" onClick={() => openNewProject('backlog')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Nuevo proyecto
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="content">
          <div key={sectionKey} className="section-enter">

            {section === 'solicitudes' && (
              <SolicitudesView
                user={user}
                showToast={showToast}
                users={users}
                onProjectCreated={(project) => setProjects(ps => [project, ...ps])}
              />
            )}

            {section === 'dashboard' && (
              <DashboardView projects={projects} users={users} solicitudes={solicitudes} onCardClick={openDetail} onNavigate={changeSection} role={user?.role} />
            )}

            {section === 'my-kanban' && (
              <KanbanBoard
                projects={projects}
                onCardClick={openDetail}
                onAddClick={(status) => openNewProject(status)}
                onMoveCard={handleMoveCard}
                onViewHistorial={() => changeSection('historial')}
              />
            )}

            {section === 'team-kanban' && (
              <TeamKanban
                projects={projects}
                users={users.filter(u => u.role === 'engineer')}
                onCardClick={openDetail}
                onAddClick={(assigneeId) => openNewProject('backlog', assigneeId)}
              />
            )}

            {section === 'analytics' && (
              <TeamKanban
                projects={projects}
                users={users.filter(u => u.role === 'member_analytics')}
                onCardClick={openDetail}
                onAddClick={(assigneeId) => openNewProject('backlog', assigneeId)}
              />
            )}

            {section === 'historial' && (
              <HistorialView projects={projects} users={users} onCardClick={openDetail} />
            )}

            {section === 'users' && user?.role === 'admin' && (
              <UsersView
                users={users}
                projects={projects}
                currentUser={user}
                onEdit={(u) => setUserModal({ open: true, user: u })}
                onDelete={handleDeleteUser}
                onAdd={() => setUserModal({ open: true, user: null })}
              />
            )}

            {section === 'gantt' && (
              <>
                <GanttView projects={projects} onRowClick={openDetail} />
                {users.length > 0 && (
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 16 }}>
                    {users.map(u => (
                      <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)' }}>
                        <div style={{ width: 12, height: 12, borderRadius: 3 }} className={`eng-c-${u.colorIndex}`} />
                        {u.name}
                      </div>
                    ))}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--high)' }}>
                      <div style={{ width: 12, height: 2, background: 'var(--high)' }} />
                      Hoy
                    </div>
                  </div>
                )}
              </>
            )}

          </div>
        </div>
      </div>

      <ProjectModal
        open={projModal.open}
        project={projModal.project}
        defStatus={projModal.defStatus}
        currentUser={user}
        defAssigneeId={projModal.defAssigneeId}
        users={users}
        onSave={handleSaveProject}
        onDelete={handleDeleteProject}
        onClose={() => setProjModal(m => ({ ...m, open: false }))}
      />

      <DetailModal
        open={detailModal.open}
        project={detailProject}
        currentUser={user}
        users={users}
        onClose={() => setDetailModal({ open: false, projectId: null })}
        onEdit={(id) => {
          setDetailModal({ open: false, projectId: null });
          setTimeout(() => openEditProject(id), 100);
        }}
        onAddLog={handleAddLog}
        onCloseSupport={handleCloseSupport}
        onAddTask={handleAddTask}
        onToggleTask={handleToggleTask}
        onDeleteTask={handleDeleteTask}
      />

      <UserModal
        open={userModal.open}
        user={userModal.user}
        onSave={handleSaveUser}
        onClose={() => setUserModal({ open: false, user: null })}
      />

      <Toast toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
