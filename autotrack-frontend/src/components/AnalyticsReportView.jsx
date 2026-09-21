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

function ProjectRow({ project, users, allClients }) {
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
                <th>Cliente</th>
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
                      {t.clientId ? (
                        <span className="ar-task-client">{allClients?.find(c => String(c.id) === String(t.clientId))?.name || `#${t.clientId}`}</span>
                      ) : <span className="ar-task-none">General</span>}
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

/**
 * Una fila por cliente: es el eje por el que se sigue este proyecto.
 *
 * El reporte se organizaba solo por proyecto, pero un proyecto de analítica
 * atiende a veinte clientes a la vez, así que «cómo va el proyecto» no dice
 * gran cosa: lo que se pregunta es cómo va cada cliente.
 */
function ClientRow({ cliente, users }) {
  const [abierto, setAbierto] = useState(false);
  const { nombre, cargada, quien, cuando, tareas, hechas, vencidas, proxima, responsables, proyectos } = cliente;
  const pct = tareas.length ? Math.round((hechas / tareas.length) * 100) : 0;
  const sinTrabajo = tareas.length === 0;

  return (
    <div className={`ar-cliente${cargada ? ' ar-cliente--ok' : ''}`}>
      <button className="ar-cliente-head" onClick={() => setAbierto(a => !a)}>
        <span className="ar-cliente-dot"
          style={{ background: cargada ? 'var(--rb-teal)' : sinTrabajo ? 'var(--rb-neutral)' : 'var(--rb-orange)' }} />

        <span className="ar-cliente-main">
          <span className="ar-cliente-nombre">{nombre}</span>
          <span className="ar-cliente-sub">
            {cargada
              ? `Analítica cargada${quien ? ` · ${quien}` : ''}${cuando ? ` · ${fmtShort(cuando)}` : ''}`
              : sinTrabajo ? 'Sin tareas registradas' : 'Analítica pendiente'}
          </span>
        </span>

        <span className="ar-cliente-cifras">
          <span className="ar-cliente-cifra">
            <b>{tareas.length ? `${hechas}/${tareas.length}` : '—'}</b>
            <i>Tareas</i>
          </span>
          <span className="ar-cliente-cifra">
            <b style={{ color: vencidas ? 'var(--rb-danger)' : undefined }}>{vencidas || '—'}</b>
            <i>Vencidas</i>
          </span>
          <span className="ar-cliente-cifra ar-cliente-cifra--ancha">
            <b style={{ color: proxima?.vencida ? 'var(--rb-danger)' : undefined }}>
              {proxima ? fmtShort(proxima.fecha) : '—'}
            </b>
            <i>Próxima</i>
          </span>
          <span className="ar-cliente-cifra">
            <b>{pct}%</b>
            <i>Avance</i>
          </span>
        </span>

        <svg className="ar-cliente-caret" width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          style={{ transform: abierto ? 'rotate(90deg)' : 'none' }}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      <div style={{ padding: '0 16px 10px' }}>
        <ProgressBar value={pct} color={cargada ? 'var(--rb-teal)' : undefined} />
      </div>

      {abierto && (
        <div className="ar-cliente-detalle">
          <div className="ar-cliente-meta">
            <span><b>Proyecto{proyectos.length > 1 ? 's' : ''}:</b> {proyectos.join(' · ') || '—'}</span>
            <span><b>Responsable{responsables.length > 1 ? 's' : ''}:</b> {responsables.join(', ') || 'Sin asignar'}</span>
          </div>

          {tareas.length === 0 ? (
            <div className="ar-empty" style={{ padding: 14 }}>
              Este cliente todavía no tiene tareas. Se le asignan desde la ficha del proyecto.
            </div>
          ) : (
            <table className="ar-task-table">
              <thead>
                <tr>
                  <th>Tarea</th><th>Responsable</th><th>Prioridad</th>
                  <th>Vence</th><th>Estado</th><th style={{ textAlign: 'center' }}>Plataforma</th>
                </tr>
              </thead>
              <tbody>
                {tareas.map(t => {
                  const a = t.assigneeId ? users.find(u => Number(u.id) === t.assigneeId) : null;
                  const tp = PR_BADGE[t.priority] || PR_BADGE.mid;
                  return (
                    <tr key={t.id} className={t.done ? 'ar-task-row--done' : ''}>
                      <td><span className={`ar-task-title${t.done ? ' ar-task-title--done' : ''}`}>{t.title}</span></td>
                      <td>{a
                        ? <span className="ar-task-assignee">
                            <span className="rb-avatar rb-avatar--xs" data-c={(a.colorIndex ?? 0) % 8}>{a.initials}</span>{a.name}
                          </span>
                        : <span className="ar-task-none">—</span>}</td>
                      <td><span className="pill-mini" style={{ background: tp.bg, color: tp.c, fontSize: 10 }}>{tp.l}</span></td>
                      <td>{t.dueDate
                        ? <span className={`ar-task-due${t._vencida ? ' ar-task-due--overdue' : ''}`}>{fmtShort(t.dueDate)}</span>
                        : <span className="ar-task-none">—</span>}</td>
                      <td><span className={`ar-task-check${t.done ? ' ar-task-check--done' : ''}`}>{t.done ? 'Completada' : 'Pendiente'}</span></td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`ar-task-platform${t.platformUploaded ? ' ar-task-platform--done' : ''}`}>
                          {t.platformUploaded ? 'Sí' : 'No'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Reorganiza la respuesta del servidor alrededor del cliente.
 *
 * Una tarea pertenece a un cliente concreto (`clientId`); las que no lo
 * declaran son del proyecto entero y no se pueden atribuir a nadie, así que
 * quedan fuera de las cifras por cliente — contarlas en todos inflaría a cada
 * uno y el avance dejaría de significar nada.
 */
function porCliente(clientes) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const estaVencida = (t) => !t.done && t.dueDate && new Date(`${t.dueDate}T00:00:00`) < hoy;

  return (clientes || []).map(c => {
    const tareas = [];
    const responsables = new Set();
    const proyectos = [];

    (c.projects || []).forEach(p => {
      proyectos.push(p.name);
      (p.tasks || [])
        .filter(t => t.clientId === c.id)
        .forEach(t => tareas.push({ ...t, _vencida: estaVencida(t) }));
      (p.assignees || []).forEach(a => { if (a?.name) responsables.add(a.name); });
    });

    const pendientesConFecha = tareas
      .filter(t => !t.done && t.dueDate)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    return {
      id: c.id,
      nombre: c.name,
      cargada: Boolean(c.analyticsLoaded),
      quien: c.analyticsLoadedBy || null,
      cuando: c.analyticsLoadedAt || null,
      tareas,
      hechas: tareas.filter(t => t.done).length,
      vencidas: tareas.filter(t => t._vencida).length,
      proxima: pendientesConFecha[0]
        ? { fecha: pendientesConFecha[0].dueDate, vencida: pendientesConFecha[0]._vencida }
        : null,
      responsables: [...responsables],
      proyectos: [...new Set(proyectos)],
    };
  })
  /* Arriba lo que reclama atención —pendientes con trabajo en marcha—, después
     los que ni han empezado, y al final lo ya cargado, que no hay que mirar. */
  .sort((a, b) => {
    const rango = (x) => (x.cargada ? 2 : x.tareas.length ? 0 : 1);
    return rango(a) - rango(b)
      || b.vencidas - a.vencidas
      || a.nombre.localeCompare(b.nombre, 'es');
  });
}

export default function AnalyticsReportView({ users }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  /* El cliente manda; el eje de proyecto se conserva porque para quien ejecuta
     sigue siendo la forma natural de mirar su propio trabajo. */
  const [eje, setEje] = useState('cliente');

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

  if (loading && !report) return <div className="ar-loading">Cargando reporte…</div>;
  if (error) return <div className="ar-error">{error}</div>;
  if (!report) return null;

  const projects = report.projects || [];
  const clients = report.clients || [];

  /* Solo los clientes que este equipo tiene entre manos. Los del catálogo que
     nadie ha tomado no son trabajo pendiente —son trabajo sin asignar— y
     contarlos haría que el porcentaje no significara nada.

     Y solo los del catálogo: el servidor devuelve también las áreas que los
     proyectos viejos guardaban como texto libre («Contabilidad», «Admisiones»),
     que llegan sin id. No son clientes de analítica, y además, al no tener id,
     se habrían quedado con todas las tareas que no declaran cliente. */
  const enCurso = porCliente(
    clients.filter(c => c.id != null && (c.projects || []).length > 0));
  const cargados = enCurso.filter(c => c.cargada);
  const pendientes = enCurso.filter(c => !c.cargada);
  const sinEmpezar = pendientes.filter(c => c.tareas.length === 0);
  const conVencidas = enCurso.filter(c => c.vencidas > 0);
  const pctCobertura = enCurso.length ? Math.round((cargados.length / enCurso.length) * 100) : 0;

  /* Cifras globales de tarea, para el eje de proyecto. */
  let totalTasks = 0, doneTasks = 0, uploadedTasks = 0, overdueTasks = 0;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  projects.forEach(p => {
    (p.tasks || []).forEach(t => {
      totalTasks++;
      if (t.done) doneTasks++;
      if (t.platformUploaded) uploadedTasks++;
      if (!t.done && t.dueDate && new Date(`${t.dueDate}T00:00:00`) < hoy) overdueTasks++;
    });
  });

  const activeProjects = projects.filter(p => !['done', 'cancelado'].includes(p.status));

  const ICO = {
    clientes: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>,
    ok: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>,
    reloj: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>,
    alerta: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    caja: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></svg>,
    subir: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  };

  return (
    <div className="ar-root">
      {/* Sin título: la barra superior de la aplicación ya dice en qué pantalla
          estamos, y repetirlo dos veces seguidas solo ocupa sitio. */}
      <div className="ar-header">
        <p className="ar-subtitle">
          {eje === 'cliente'
            ? 'A qué clientes se les cargó la analítica, qué falta y quién lo lleva'
            : 'Seguimiento operativo de proyectos, tareas y carga en plataforma'}
        </p>
        <div className="ar-eje">
          <button className={`ar-eje-btn${eje === 'cliente' ? ' is-active' : ''}`}
            onClick={() => setEje('cliente')}>Por cliente</button>
          <button className={`ar-eje-btn${eje === 'proyecto' ? ' is-active' : ''}`}
            onClick={() => setEje('proyecto')}>Por proyecto</button>
        </div>
      </div>

      {eje === 'cliente' ? (
        <>
          <div className="ar-kpis">
            <SummaryCard icon={ICO.clientes} label="Clientes en curso" value={enCurso.length} unit="clientes"
              color="var(--rb-navy)" bg="var(--rb-navy-tint)" />
            <SummaryCard icon={ICO.ok} label="Analítica cargada" value={cargados.length} unit={`de ${enCurso.length}`}
              color="var(--rb-teal-ink)" bg="var(--rb-teal-tint)" />
            <SummaryCard icon={ICO.reloj} label="Pendientes" value={pendientes.length} unit="clientes"
              color={pendientes.length ? 'var(--rb-orange-ink)' : 'var(--rb-text-3)'}
              bg={pendientes.length ? 'var(--rb-orange-tint)' : 'var(--rb-neutral-bg)'} />
            <SummaryCard icon={ICO.caja} label="Sin empezar" value={sinEmpezar.length} unit="sin tareas"
              color="var(--rb-text-3)" bg="var(--rb-neutral-bg)" />
            <SummaryCard icon={ICO.alerta} label="Con tareas vencidas" value={conVencidas.length} unit="clientes"
              color={conVencidas.length ? 'var(--rb-danger)' : 'var(--rb-text-3)'}
              bg={conVencidas.length ? 'var(--rb-danger-bg)' : 'var(--rb-neutral-bg)'} />
          </div>

          {enCurso.length > 0 && (
            <div className="ar-platform-bar">
              <div className="ar-platform-bar-header">
                <span>Cobertura de analítica</span>
                <span className="ar-platform-bar-pct">{pctCobertura}%</span>
              </div>
              <div className="ar-platform-bar-track">
                <div className="ar-platform-bar-fill" style={{ width: `${pctCobertura}%` }} />
              </div>
              <div className="ar-platform-bar-detail">
                {cargados.length} de {enCurso.length} clientes con la analítica cargada
                {sinEmpezar.length > 0 && ` · ${sinEmpezar.length} todavía sin ninguna tarea`}
              </div>
            </div>
          )}

          <div className="ar-section-header">
            <span className="ar-section-title">Clientes</span>
            <span className="ar-section-count">{enCurso.length}</span>
            <span className="ar-section-nota">Primero lo pendiente; lo ya cargado, al final</span>
          </div>
          <div className="ar-projects">
            {enCurso.length === 0 ? (
              <div className="ar-empty">
                Ningún cliente tiene trabajo asignado todavía. Asígnalos a un proyecto para seguirlos aquí.
              </div>
            ) : enCurso.map(c => <ClientRow key={c.id} cliente={c} users={users} />)}
          </div>
        </>
      ) : (
        <>
          <div className="ar-kpis">
            <SummaryCard icon={ICO.caja} label="Proyectos activos" value={activeProjects.length} unit="proyectos"
              color="var(--rb-navy)" bg="var(--rb-navy-tint)" />
            <SummaryCard icon={ICO.clientes} label="Total tareas" value={totalTasks} unit="tareas"
              color="var(--rb-navy)" bg="var(--rb-navy-tint)" />
            <SummaryCard icon={ICO.ok} label="Completadas" value={doneTasks} unit="tareas"
              color="var(--rb-success)" bg="var(--rb-success-bg)" />
            {/* «Subidas a plataforma» es por tarea y no es lo mismo que la
                analítica cargada de un cliente; el nombre lo dice para que no
                se lean como la misma cifra. */}
            <SummaryCard icon={ICO.subir} label="Tareas subidas a plataforma" value={uploadedTasks} unit={`de ${totalTasks}`}
              color="var(--rb-teal)" bg="var(--rb-teal-tint)" />
            <SummaryCard icon={ICO.alerta} label="Vencidas" value={overdueTasks} unit="tareas"
              color={overdueTasks > 0 ? 'var(--rb-danger)' : 'var(--rb-text-3)'}
              bg={overdueTasks > 0 ? 'var(--rb-danger-bg)' : 'var(--rb-neutral-bg)'} />
          </div>

          {totalTasks > 0 && (
            <div className="ar-platform-bar">
              <div className="ar-platform-bar-header">
                <span>Tareas subidas a plataforma</span>
                <span className="ar-platform-bar-pct">{Math.round((uploadedTasks / totalTasks) * 100)}%</span>
              </div>
              <div className="ar-platform-bar-track">
                <div className="ar-platform-bar-fill" style={{ width: `${(uploadedTasks / totalTasks) * 100}%` }} />
              </div>
              <div className="ar-platform-bar-detail">{uploadedTasks} de {totalTasks} tareas con información cargada</div>
            </div>
          )}

          <div className="ar-section-header">
            <span className="ar-section-title">Proyectos</span>
            <span className="ar-section-count">{projects.length}</span>
          </div>
          <div className="ar-projects">
            {projects.length === 0
              ? <div className="ar-empty">No hay proyectos registrados</div>
              : projects.map(p => <ProjectRow key={p.id} project={p} users={users} allClients={clients} />)}
          </div>
        </>
      )}
    </div>
  );
}
