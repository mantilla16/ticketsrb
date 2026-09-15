/* Reporte Analítica — vista operativa de seguimiento por proyecto y cliente.
   Muestra qué se hace, quién lo hace, progreso y estado de carga en plataforma. */

import React, { useState, useEffect, useCallback } from 'react';
import { analyticsReportAPI } from '../services/api';
import { colorClass } from '../utils/helpers';

const STATUS_DEF = {
  backlog:  { l: 'Por hacer',  c: 'var(--rb-neutral)', bg: 'var(--rb-neutral-bg)' },
  progress: { l: 'En proceso', c: 'var(--rb-navy)',    bg: 'var(--rb-navy-tint)' },
  standby:  { l: 'En standby', c: 'var(--rb-warning)', bg: 'var(--rb-warning-bg)' },
  testing:  { l: 'Testing',    c: 'var(--rb-violet)',  bg: 'var(--rb-violet-bg)' },
  done:     { l: 'Finalizado', c: 'var(--rb-success)', bg: 'var(--rb-success-bg)' },
  soporte:  { l: 'Soporte',    c: 'var(--rb-info)',    bg: 'var(--rb-info-bg)' },
  cancelado:{ l: 'Cancelado',  c: 'var(--rb-danger)',  bg: 'var(--rb-danger-bg)' },
};

const PR_BADGE = {
  high: { l: 'Alta',  c: 'var(--rb-danger)',  bg: 'var(--rb-danger-bg)' },
  mid:  { l: 'Media', c: 'var(--rb-navy)',    bg: 'var(--rb-navy-tint)' },
  low:  { l: 'Baja',  c: 'var(--rb-success)', bg: 'var(--rb-success-bg)' },
};

const fmtShort = (d) => {
  if (!d) return null;
  const iso = d.includes('T') ? d.slice(0, 10) : d;
  const dt = new Date(iso + 'T00:00:00');
  return dt.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
};

function SummaryCard({ icon, label, value, unit, color, bg }) {
  return (
    <div className="ar-kpi">
      <div className="ar-kpi-icon" style={{ background: bg, color }}>{icon}</div>
      <div>
        <div className="ar-kpi-label">{label}</div>
        <div className="ar-kpi-value" style={{ color }}>{value} <span className="ar-kpi-unit">{unit}</span></div>
      </div>
    </div>
  );
}

function ProgressBar({ value, color }) {
  return (
    <div className="ar-bar">
      <div className="ar-bar-fill" style={{ width: `${value}%`, background: color || (value >= 80 ? 'var(--rb-success)' : 'var(--rb-navy)') }} />
    </div>
  );
}

function ProjectRow({ project, users, onClickProject }) {
  const [expanded, setExpanded] = useState(false);
  const st = STATUS_DEF[project.status] || STATUS_DEF.backlog;
  const pr = PR_BADGE[project.priority] || PR_BADGE.mid;
  const tasks = project.tasks || [];
  const done = tasks.filter(t => t.done).length;
  const uploaded = tasks.filter(t => t.platformUploaded).length;
  const total = tasks.length;
  const pct = project.progress || 0;

  const assigneeNames = (project.assignees || []).map(a => a.name).join(', ') || 'Sin asignar';
  const nextTask = tasks.find(t => !t.done && t.dueDate);
  const overdue = nextTask?.dueDate && new Date(nextTask.dueDate + 'T00:00:00') < new Date(new Date().toDateString());

  return (
    <div className="ar-project">
      <button className="ar-project-head" onClick={() => setExpanded(e => !e)}>
        <div className="ar-project-main">
          <div className="ar-project-name">{project.name}</div>
          <div className="ar-project-meta">
            <span className="pill-mini" style={{ background: st.bg, color: st.c }}>{st.l}</span>
            <span className="pill-mini" style={{ background: pr.bg, color: pr.c }}>{pr.l}</span>
            <span className="ar-project-assignee">{assigneeNames}</span>
          </div>
        </div>
        <div className="ar-project-stats">
          <div className="ar-project-stat">
            <span className="ar-project-stat-val">{pct}%</span>
            <span className="ar-project-stat-lbl">Avance</span>
          </div>
          <div className="ar-project-stat">
            <span className="ar-project-stat-val">{done}/{total}</span>
            <span className="ar-project-stat-lbl">Tareas</span>
          </div>
          <div className="ar-project-stat">
            <span className={`ar-project-stat-val${uploaded === total && total > 0 ? ' ar-project-stat-val--success' : ''}`}>{uploaded}/{total}</span>
            <span className="ar-project-stat-lbl">Cargadas</span>
          </div>
          {nextTask && (
            <div className="ar-project-stat">
              <span className={`ar-project-stat-val${overdue ? ' ar-project-stat-val--danger' : ''}`}>
                {fmtShort(nextTask.dueDate)}
              </span>
              <span className="ar-project-stat-lbl">Próxima</span>
            </div>
          )}
        </div>
        <svg className="ar-project-chevron" style={{ transform: expanded ? 'rotate(90deg)' : 'none' }}
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>

      {/* Barra de avance */}
      <div style={{ padding: '0 16px 8px' }}>
        <ProgressBar value={pct} />
      </div>

      {expanded && tasks.length > 0 && (
        <div className="ar-project-tasks">
          <table className="ar-task-table">
            <thead>
              <tr>
                <th>Tarea</th>
                <th>Responsable</th>
                <th>Prioridad</th>
                <th>Vence</th>
                <th>Estado</th>
                <th style={{ textAlign: 'center' }}>Plataforma</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(t => {
                const assignee = t.assigneeId ? users.find(u => Number(u.id) === t.assigneeId) : null;
                const tOverdue = t.dueDate && !t.done && new Date(t.dueDate + 'T00:00:00') < new Date(new Date().toDateString());
                const tp = PR_BADGE[t.priority] || PR_BADGE.mid;
                return (
                  <tr key={t.id} className={t.done ? 'ar-task-row--done' : ''}>
                    <td>
                      <span className={`ar-task-title${t.done ? ' ar-task-title--done' : ''}`}>{t.title}</span>
                    </td>
                    <td>
                      {assignee ? (
                        <span className="ar-task-assignee">
                          <span className={`rb-avatar rb-avatar--xs`} data-c={(assignee.colorIndex ?? 0) % 8}>{assignee.initials}</span>
                          {assignee.name}
                        </span>
                      ) : <span className="ar-task-none">—</span>}
                    </td>
                    <td><span className="pill-mini" style={{ background: tp.bg, color: tp.c, fontSize: 10 }}>{tp.l}</span></td>
                    <td>
                      {t.dueDate ? (
                        <span className={`ar-task-due${tOverdue ? ' ar-task-due--overdue' : ''}`}>
                          {fmtShort(t.dueDate)}
                        </span>
                      ) : <span className="ar-task-none">—</span>}
                    </td>
                    <td>
                      <span className={`ar-task-check${t.done ? ' ar-task-check--done' : ''}`}>
                        {t.done ? 'Completada' : 'Pendiente'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`ar-task-platform${t.platformUploaded ? ' ar-task-platform--done' : ''}`}>
                        {t.platformUploaded ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/></svg>
                        )}
                        {t.platformUploaded ? 'Sí' : 'No'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AnalyticsReportView({ users }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await analyticsReportAPI.getReport();
      /* Aplanar: extraer proyectos únicos de todos los clientes */
      const seen = new Map();
      (data.clients || []).forEach(c => {
        (c.projects || []).forEach(p => {
          if (!seen.has(p.id)) seen.set(p.id, p);
        });
      });
      setReport({ clients: data.clients || [], projects: Array.from(seen.values()) });
      setError(null);
    } catch (e) {
      setError(e.error || 'Error al cargar el reporte');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading && !report) {
    return <div className="ar-loading">Cargando reporte…</div>;
  }

  if (error) {
    return <div className="ar-error">{error}</div>;
  }

  if (!report) return null;

  const projects = report.projects || [];
  const clients = report.clients || [];

  /* Calcular KPIs globales */
  let totalTasks = 0, doneTasks = 0, uploadedTasks = 0, overdueTasks = 0;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  projects.forEach(p => {
    (p.tasks || []).forEach(t => {
      totalTasks++;
      if (t.done) doneTasks++;
      if (t.platformUploaded) uploadedTasks++;
      if (!t.done && t.dueDate && new Date(t.dueDate + 'T00:00:00') < today) overdueTasks++;
    });
  });

  const activeProjects = projects.filter(p => !['done', 'cancelado'].includes(p.status));
  const doneProjects = projects.filter(p => p.status === 'done');

  return (
    <div className="ar-root">
      <div className="ar-header">
        <div>
          <h2 className="ar-title">Reporte Analítica</h2>
          <p className="ar-subtitle">Seguimiento operativo de proyectos, tareas y carga en plataforma</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="ar-kpis">
        <SummaryCard icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></svg>}
          label="Proyectos activos" value={activeProjects.length} unit="proyectos" color="var(--rb-navy)" bg="var(--rb-navy-tint)" />
        <SummaryCard icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l10 6.5v7L12 22 2 15.5v-7z"/></svg>}
          label="Total tareas" value={totalTasks} unit="tareas" color="var(--rb-navy)" bg="var(--rb-navy-tint)" />
        <SummaryCard icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>}
          label="Completadas" value={doneTasks} unit="tareas" color="var(--rb-success)" bg="var(--rb-success-bg)" />
        <SummaryCard icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>}
          label="Cargadas en plataforma" value={uploadedTasks} unit={`de ${totalTasks}`} color="var(--rb-teal)" bg="var(--rb-teal-tint)" />
        <SummaryCard icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
          label="Vencidas" value={overdueTasks} unit="tareas" color="overdueTasks > 0 ? 'var(--rb-danger)' : 'var(--rb-text3)'" bg="var(--rb-danger-bg)" />
      </div>

      {/* Barra de progreso global de plataforma */}
      {totalTasks > 0 && (
        <div className="ar-platform-bar">
          <div className="ar-platform-bar-header">
            <span>Carga en plataforma</span>
            <span className="ar-platform-bar-pct">{Math.round((uploadedTasks / totalTasks) * 100)}%</span>
          </div>
          <div className="ar-platform-bar-track">
            <div className="ar-platform-bar-fill" style={{ width: `${(uploadedTasks / totalTasks) * 100}%` }} />
          </div>
          <div className="ar-platform-bar-detail">{uploadedTasks} de {totalTasks} tareas con información cargada</div>
        </div>
      )}

      {/* Lista de proyectos */}
      <div className="ar-section-header">
        <span className="ar-section-title">Proyectos</span>
        <span className="ar-section-count">{projects.length}</span>
      </div>
      <div className="ar-projects">
        {projects.length === 0 ? (
          <div className="ar-empty">No hay proyectos registrados</div>
        ) : (
          projects.map(p => (
            <ProjectRow key={p.id} project={p} users={users} />
          ))
        )}
      </div>
    </div>
  );
}
