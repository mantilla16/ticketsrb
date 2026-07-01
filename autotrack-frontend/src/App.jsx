import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { projectsAPI, usersAPI } from './services/api';
import Login from './pages/Login';
import Sidebar from './components/Sidebar';
import DashboardView from './components/DashboardView';
import KanbanBoard from './components/KanbanBoard';
import TeamKanban from './components/TeamKanban';
import GanttView from './components/GanttView';
import AnalyticsTeamView from './components/AnalyticsTeamView';
import ProjectModal from './components/ProjectModal';
import DetailModal from './components/DetailModal';
import Toast, { useToast } from './components/Toast';

const TITLES = {
  'dashboard':   { title: 'Dashboard ejecutivo',   sub: 'Resumen general del portafolio de automatización' },
  'my-kanban':   { title: 'Mi Kanban',              sub: 'Vista personal — organiza tus proyectos por estado' },
  'team-kanban': { title: 'Kanban del equipo',      sub: 'Proyectos asignados por ingeniero' },
  'gantt':       { title: 'Diagrama de Gantt',      sub: 'Línea de tiempo y progreso de todos los proyectos' },
  'analytics':   { title: 'Equipo Analítica',       sub: 'Proyectos de Miguel Padilla y Andres Holguin' },
};

const STATUS_NAMES = {
  backlog: 'Por hacer', progress: 'En proceso',
  standby: 'En standby', testing: 'En testing', done: 'Finalizado',
};

export default function App() {
  const { user, loading, logout } = useAuth();
  const { toasts, show: showToast, remove: removeToast } = useToast();

  const [section, setSection]       = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sectionKey, setSectionKey] = useState(0);
  const [projects, setProjects]     = useState([]);
  const [users, setUsers]           = useState([]);

  const [projModal, setProjModal]     = useState({ open: false, project: null, defStatus: null, defAssigneeId: null });
  const [detailModal, setDetailModal] = useState({ open: false, projectId: null });

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const [ps, us] = await Promise.all([projectsAPI.getAll(), usersAPI.getAll()]);
      setProjects(ps);
      setUsers(us);
    } catch (e) { console.error(e); }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

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
    const updated = await projectsAPI.addLog(id, data);
    setProjects(ps => ps.map(p => p.id === updated.id ? updated : p));
    showToast('Avance registrado', 'success');
  };

  const handleMoveCard = async (projectId, newStatus) => {
    const p = projects.find(x => x.id === projectId);
    if (!p || p.status === newStatus) return;
    // Optimistic update
    setProjects(ps => ps.map(x => x.id === projectId ? { ...x, status: newStatus } : x));
    try {
      const updated = await projectsAPI.update(projectId, {
        name:        p.name,
        description: p.description,
        client:      p.client,
        status:      newStatus,
        priority:    p.priority || 'mid',
        assigneeId:  p.assigneeId,
        startDate:   p.startDate,
        dueDate:     p.dueDate,
        progress:    p.progress || 0,
      });
      setProjects(ps => ps.map(x => x.id === updated.id ? updated : x));
      showToast(`Movido a "${STATUS_NAMES[newStatus]}"`, 'success');
    } catch {
      setProjects(ps => ps.map(x => x.id === projectId ? p : x));
      showToast('Error al mover el proyecto', 'error');
    }
  };

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
            {(section === 'my-kanban' || section === 'team-kanban') && (
              <button className="btn btn-primary" onClick={() => openNewProject('backlog')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Nuevo proyecto
              </button>
            )}
          </div>
        </div>

        {/* Content with section enter animation */}
        <div className="content">
          <div key={sectionKey} className="section-enter">
            {section === 'dashboard' && (
              <DashboardView projects={projects} users={users} onCardClick={openDetail} />
            )}

            {section === 'my-kanban' && (
              <KanbanBoard
                projects={projects}
                onCardClick={openDetail}
                onAddClick={(status) => openNewProject(status)}
                onMoveCard={handleMoveCard}
              />
            )}

            {section === 'team-kanban' && (
              <TeamKanban
                projects={projects}
                users={users}
                onCardClick={openDetail}
                onAddClick={(assigneeId) => openNewProject('backlog', assigneeId)}
              />
            )}

            {section === 'analytics' && (
              <AnalyticsTeamView
                projects={projects}
                users={users}
                onCardClick={openDetail}
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
        defAssigneeId={projModal.defAssigneeId}
        users={users}
        onSave={handleSaveProject}
        onDelete={handleDeleteProject}
        onClose={() => setProjModal(m => ({ ...m, open: false }))}
      />

      <DetailModal
        open={detailModal.open}
        project={detailProject}
        onClose={() => setDetailModal({ open: false, projectId: null })}
        onEdit={(id) => {
          setDetailModal({ open: false, projectId: null });
          setTimeout(() => openEditProject(id), 100);
        }}
        onAddLog={handleAddLog}
      />

      <Toast toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
