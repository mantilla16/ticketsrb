/* Tablero de proyectos: kanban por estado.
 *
 * Rediseño con jerarquía:
 *   - Barra de pulso arriba (reemplaza el panel «Resumen/Calendario» aislado)
 *   - Columnas de ancho flexible: las llenas respiran, las vacías se
 *     comprimen a un mensaje discreto en cursiva
 *   - Un solo botón «Nuevo proyecto» (el que viene de arriba); en Backlog
 *     un «+» pequeño en la cabecera
 *   - Tarjetas con borde-izquierdo por urgencia (rojo vencida · naranja
 *     alta · gris normal), pastilla de cliente coloreada por tipo, y
 *     barra de progreso solo cuando aporta información (progreso > 0)
 *   - Tira inferior «Próximas entregas» con fecha, urgencia y color
 *
 * Y las tarjetas se arrastran entre columnas: el estado cambia al soltar,
 * respetando el flujo permitido a ejecutores (progress → testing → done).
 * Las columnas a las que un usuario no puede mover un proyecto no ofrecen
 * indicador de drop y rechazan el suelto sin ruido: no queremos «no
 * puedes hacer eso» por sorpresa a mitad del gesto.
 */

import { useState } from 'react';
import { can, roleOf } from '../lib/tickets';

const PR = {
  high: { l: 'Alta',  bg: 'var(--rb-danger-bg)',  c: 'var(--rb-danger)',   rail: 'var(--rb-danger)' },
  mid:  { l: 'Media', bg: 'var(--rb-orange-tint)',c: 'var(--rb-orange-ink)', rail: 'var(--rb-orange)' },
  low:  { l: 'Baja',  bg: 'var(--rb-n-100)',      c: 'var(--rb-text-3)',    rail: 'var(--rb-n-300)' },
};

/* Cada estado tiene su color propio en el punto de la cabecera. Estos son
   los mismos tonos del manual RB (navy/cyan/teal/orange/gray). */
const STATUS = {
  backlog:  { l: 'Por hacer',  dot: 'var(--rb-n-400)', chip: 'var(--rb-n-100)',   chipC: 'var(--rb-text-3)' },
  progress: { l: 'En proceso', dot: 'var(--rb-navy)',  chip: 'var(--rb-navy-tint)', chipC: 'var(--rb-navy)' },
  standby:  { l: 'En standby', dot: 'var(--rb-n-400)', chip: 'var(--rb-n-100)',   chipC: 'var(--rb-text-3)' },
  soporte:  { l: 'En soporte', dot: 'var(--rb-cyan)',  chip: '#E0F2FE',            chipC: '#0B6E80' },
  testing:  { l: 'En testing', dot: 'var(--rb-orange)',chip: 'var(--rb-orange-tint)', chipC: 'var(--rb-orange-ink)' },
  done:     { l: 'Finalizado', dot: 'var(--rb-teal)',  chip: 'var(--rb-teal-tint)', chipC: 'var(--rb-teal-ink)' },
};

/* Toda situación en la que puede estar un trabajo vivo necesita su columna:
   un estado sin columna hace desaparecer el proyecto sin aviso. `cancelado`
   es la excepción y por eso no está: se descarta antes. */
const COLUMNS = [
  { key: 'backlog' },
  { key: 'progress' },
  { key: 'standby' },
  { key: 'soporte' },
  { key: 'testing' },
  { key: 'done' },
];

const TABS = [
  { key: 'all',  label: 'Todos' },
  { key: 'auto', label: 'Automatización', tipo: 'automatizacion' },
  { key: 'ana',  label: 'Analítica',      tipo: 'analitica' },
  { key: 'comp', label: 'Compartidos',    tipo: 'compartido' },
];

/* Flujo permitido a quien ejecuta (no líder): En proceso → Testing → Finalizado/Soporte.
   Coincide con la regla del handler en App.jsx; se replica aquí para poder
   dar feedback visual antes de intentar la petición. */
const ENGINEER_FLOW = { progress: ['testing'], testing: ['done', 'soporte'] };

const fmtShort = (d) => {
  if (!d) return null;
  const dt = new Date(d + 'T00:00:00');
  return { day: dt.getDate(), mon: dt.toLocaleDateString('es-CO', { month: 'short' }).replace('.', '') };
};

const isOverdue = (d) => {
  if (!d) return false;
  return new Date(d + 'T00:00:00') < new Date(new Date().toDateString());
};

/* Un cliente se colorea por tipo de proyecto: los de analítica van en
   magenta (identidad de esa línea), los de RB en cyan, el resto en navy. */
const clientChip = (p) => {
  if (p.tipo === 'analitica')  return { bg: 'var(--rb-magenta-tint)', c: 'var(--rb-magenta-ink)' };
  if (p.tipo === 'compartido') return { bg: '#E0F2FE',                c: '#0B6E80' };
  return { bg: 'var(--rb-navy-tint)', c: 'var(--rb-navy)' };
};


/* ── Tarjeta ─────────────────────────────────────────────────────────── */

function ProjectCard({ project: p, onClick, onDragStart, onDragEnd, dragging }) {
  const dm       = fmtShort(p.dueDate);
  const overdue  = isOverdue(p.dueDate);
  const pending  = (p.tasks || []).filter(t => !t.done).length;
  const total    = (p.tasks || []).length;
  const overdueTareas = (p.tasks || []).filter(t => !t.done && isOverdue(t.dueDate)).length;
  const people   = p.assignees?.length ? p.assignees : (p.assignee ? [p.assignee] : []);
  const pct      = p.progress || 0;
  const cli      = clientChip(p);
  const pr       = PR[p.priority] || PR.mid;

  /* El borde izquierdo cuenta la urgencia de un vistazo: rojo si algo
     está vencido (proyecto o tarea), naranja si es prioridad alta, gris
     si va normal. Es la señal que antes había que buscar en las pastillas. */
  const rail = (overdue || overdueTareas > 0) ? 'var(--rb-danger)'
             : p.priority === 'high' ? 'var(--rb-orange)'
             : 'var(--rb-n-300)';

  return (
    <article
      className={`pb-card${dragging ? ' pb-card--dragging' : ''}`}
      style={{ borderLeftColor: rail }}
      draggable
      onDragStart={(e) => onDragStart(e, p)}
      onDragEnd={onDragEnd}
      onClick={() => onClick(p.id)}
    >
      {/* Fila superior: alarma primero si aplica, después cliente y prioridad. */}
      <div className="pb-card-top">
        {(overdue || overdueTareas > 0) && (
          <span className="pb-card-tag pb-card-tag--danger">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            {overdue ? 'Vencido' : `${overdueTareas} vencida${overdueTareas > 1 ? 's' : ''}`}
          </span>
        )}
        {p.priority === 'high' && !(overdue || overdueTareas > 0) && (
          <span className="pb-card-tag" style={{ background: pr.bg, color: pr.c }}>Alta</span>
        )}
        {p.client && (
          <span className="pb-card-chip rb-truncate" style={{ background: cli.bg, color: cli.c }}>{p.client}</span>
        )}
      </div>

      <div className="pb-card-title">{p.name}</div>

      {/* Progreso solo si > 0 — al 0% ocupa espacio sin decir nada. */}
      {pct > 0 && (
        <div className="pb-card-progress">
          <span className="pb-card-progress-track">
            <span className="pb-card-progress-fill" style={{
              width: `${pct}%`,
              background: pct >= 100 ? 'var(--rb-teal)' : 'var(--rb-navy)',
            }} />
          </span>
          <span className="pb-card-progress-pct">{pct}%</span>
        </div>
      )}

      <div className="pb-card-foot">
        {people.length > 0 && (
          <div className="pb-card-people">
            {people.slice(0, 3).map(u => (
              <span key={u.id} className="pb-card-avatar" data-c={(u.colorIndex ?? 0) % 8} title={u.name}>{u.initials}</span>
            ))}
            {people.length > 3 && <span className="pb-card-avatar pb-card-avatar--more">+{people.length - 3}</span>}
          </div>
        )}
        <div className="pb-card-meta">
          {dm ? (
            <span className={`pb-card-date${overdue ? ' pb-card-date--overdue' : ''}`}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              {dm.day} {dm.mon}
            </span>
          ) : (
            <span className="pb-card-date pb-card-date--none">Sin fecha</span>
          )}
          {total > 0 && (
            <span className="pb-card-tasks" title={`${total - pending} de ${total} tareas`}>
              {total - pending}<span>/{total}</span>
            </span>
          )}
        </div>
      </div>
    </article>
  );
}


/* ── Tablero ─────────────────────────────────────────────────────────── */

export default function ProjectBoard({ projects, users, allUsers, onCardClick, onNewProject, onMoveCard, currentUser }) {
  const [tab, setTab] = useState('all');
  const [dragging, setDragging] = useState(null);  // proyecto siendo arrastrado
  const [dragOver, setDragOver] = useState(null);  // columna que responde al hover

  const isLeader = can(currentUser, 'gestionarProyectos');

  /* Reglas de drop: qué estados puede aceptar cada usuario cuando arrastra
     un proyecto que hoy está en `from`. Un líder puede mover a cualquier
     otro estado; un ejecutor solo dentro de su flujo, y solo si el proyecto
     es suyo. */
  const puedeSoltar = (proj, hacia) => {
    if (!proj || proj.status === hacia) return false;
    if (isLeader) return true;
    const owns = [...(proj.assigneeIds || [proj.assigneeId]), proj.coAssigneeId, proj.generalAssigneeId]
      .filter(v => v != null).map(Number).includes(Number(currentUser?.id));
    if (!owns) return false;
    return (ENGINEER_FLOW[proj.status] || []).includes(hacia);
  };

  const tipoOf = (p) => p.tipo || 'automatizacion';
  const porTab = (p) => tab === 'all'
    || (tab === 'auto' && tipoOf(p) === 'automatizacion')
    || (tab === 'ana'  && tipoOf(p) === 'analitica')
    || (tab === 'comp' && tipoOf(p) === 'compartido');

  const filtered = projects.filter(porTab).filter(p => !['cancelado'].includes(p.status));
  const activos  = projects.filter(p => !['done', 'cancelado'].includes(p.status));

  /* Conteos por tab, mostrados junto a cada pestaña. */
  const conteo = (t) => (t.tipo
    ? projects.filter(p => !['done', 'cancelado'].includes(p.status) && tipoOf(p) === t.tipo).length
    : activos.length);

  /* Pulso: se prefiere sobre el panel «Resumen» aislado que teníamos.
     Cuatro cifras accionables en una línea, no un cuadro flotante a la
     derecha. */
  const enProceso  = activos.filter(p => p.status === 'progress').length;
  const enSoporte  = activos.filter(p => p.status === 'soporte').length;
  const tareasVencidas = activos.reduce(
    (s, p) => s + (p.tasks || []).filter(t => !t.done && isOverdue(t.dueDate)).length, 0);

  const proxima = activos
    .filter(p => p.dueDate && !isOverdue(p.dueDate))
    .map(p => p.dueDate).sort()[0] || null;

  /* Próximas entregas (barra inferior): las cinco más urgentes de todo
     lo activo, vencidas primero. */
  const upcoming = activos
    .filter(p => p.dueDate)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5);

  /* ── Drag & drop ───────────────────────────────────────────────────── */

  const handleDragStart = (e, p) => {
    setDragging(p);
    e.dataTransfer.effectAllowed = 'move';
    // Firefox exige que se ponga algo en el dataTransfer para que el drag arranque.
    e.dataTransfer.setData('text/plain', String(p.id));
  };

  const handleDragEnd = () => { setDragging(null); setDragOver(null); };

  const handleColDragOver = (e, colKey) => {
    if (!dragging || !puedeSoltar(dragging, colKey)) return;
    e.preventDefault();  // permitir el drop
    e.dataTransfer.dropEffect = 'move';
    if (dragOver !== colKey) setDragOver(colKey);
  };

  const handleColDragLeave = (colKey) => {
    if (dragOver === colKey) setDragOver(null);
  };

  const handleColDrop = (e, colKey) => {
    e.preventDefault();
    if (dragging && puedeSoltar(dragging, colKey) && onMoveCard) {
      onMoveCard(dragging.id, colKey);
    }
    setDragging(null); setDragOver(null);
  };

  return (
    <div className="pb-root">

      {/* ── Filtros + pulso ───────────────────────────────────────────── */}
      <section className="pb-toolbar">
        <div className="pb-tabs" role="tablist">
          {TABS.map(t => (
            <button key={t.key} role="tab" aria-selected={tab === t.key}
              className={`pb-tab${tab === t.key ? ' pb-tab--active' : ''}`}
              onClick={() => setTab(t.key)}>
              {t.label}
              <span className="pb-tab-count">{conteo(t)}</span>
            </button>
          ))}
        </div>

        <div className="pb-pulse">
          <span className="pb-pulse-item">
            <i className="pb-dot" style={{ background: 'var(--rb-navy)' }} />
            <b>{enProceso}</b> en proceso
          </span>
          <span className="pb-pulse-item">
            <i className="pb-dot" style={{ background: 'var(--rb-cyan)' }} />
            <b>{enSoporte}</b> en soporte
          </span>
          {tareasVencidas > 0 && (
            <>
              <span className="pb-pulse-sep" />
              <span className="pb-pulse-item pb-pulse-item--danger">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/></svg>
                <b>{tareasVencidas}</b> tarea{tareasVencidas !== 1 ? 's' : ''} vencida{tareasVencidas !== 1 ? 's' : ''}
              </span>
            </>
          )}
          {proxima && (
            <span className="pb-pulse-item">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Próxima entrega <b>{fmtShort(proxima).day} {fmtShort(proxima).mon}</b>
            </span>
          )}
        </div>
      </section>


      {/* ── Kanban ────────────────────────────────────────────────────── */}
      <div className="pb-cols">
        {COLUMNS.map(({ key: colKey }) => {
          const st = STATUS[colKey];
          const colProjects = filtered.filter(p => p.status === colKey);
          const puede = dragging ? puedeSoltar(dragging, colKey) : false;
          const isDragOver = dragOver === colKey;
          const dimmed = dragging && !puede && dragging.status !== colKey;

          return (
            <div
              key={colKey}
              className={`pb-col${colProjects.length === 0 ? ' pb-col--empty' : ''}${isDragOver ? ' pb-col--dropping' : ''}${dimmed ? ' pb-col--dimmed' : ''}`}
              onDragOver={(e) => handleColDragOver(e, colKey)}
              onDragLeave={() => handleColDragLeave(colKey)}
              onDrop={(e) => handleColDrop(e, colKey)}
            >
              <header className="pb-col-head">
                <span className="pb-col-dot" style={{ background: st.dot }} />
                <span className="pb-col-label">{st.l}</span>
                <span className="pb-col-count" style={{ background: st.chip, color: st.chipC }}>
                  {colProjects.length}
                </span>
                <span style={{ flex: 1 }} />
                {colKey === 'backlog' && onNewProject && (
                  <button className="pb-col-add" aria-label="Nuevo proyecto en Por hacer"
                    onClick={onNewProject}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>
                )}
              </header>

              <div className="pb-col-body">
                {colProjects.length === 0 ? (
                  <div className="pb-col-empty-msg">
                    {colKey === 'backlog'  && 'Sin trabajos en el backlog'}
                    {colKey === 'progress' && 'Nada en curso'}
                    {colKey === 'standby'  && 'Nada en pausa'}
                    {colKey === 'soporte'  && 'Nada en soporte'}
                    {colKey === 'testing'  && 'Nada en pruebas'}
                    {colKey === 'done'     && (
                      <>
                        Nada finalizado
                        <a href="#" onClick={(e) => e.preventDefault()} className="pb-col-empty-link">Ver historial →</a>
                      </>
                    )}
                  </div>
                ) : (
                  colProjects.map(p => (
                    <ProjectCard
                      key={p.id} project={p} onClick={onCardClick}
                      onDragStart={handleDragStart} onDragEnd={handleDragEnd}
                      dragging={dragging?.id === p.id}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>


      {/* ── Próximas entregas ─────────────────────────────────────────── */}
      {upcoming.length > 0 && (
        <section className="pb-upcoming">
          <div className="pb-upcoming-head">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span>Próximas entregas</span>
            <span className="pb-upcoming-hint">— ordenadas por urgencia</span>
          </div>
          <div className="pb-upcoming-grid">
            {upcoming.map(p => {
              const dm = fmtShort(p.dueDate);
              const overdue = isOverdue(p.dueDate);
              const dias = Math.round((new Date(p.dueDate + 'T00:00:00') - new Date(new Date().toDateString())) / 86400000);
              return (
                <button key={p.id} className={`pb-upcoming-item${overdue ? ' pb-upcoming-item--overdue' : dias <= 7 ? ' pb-upcoming-item--soon' : ''}`}
                  onClick={() => onCardClick(p.id)}>
                  <div className="pb-upcoming-date">
                    <b>{dm.day}</b>
                    <span>{dm.mon}</span>
                  </div>
                  <div className="pb-upcoming-body">
                    <div className="pb-upcoming-name rb-truncate">{p.name}</div>
                    <div className="pb-upcoming-when">
                      {overdue ? `Vencida hace ${Math.abs(dias)} día${Math.abs(dias) !== 1 ? 's' : ''}` :
                       dias === 0 ? 'Hoy' :
                       dias === 1 ? 'Mañana' :
                       dias <= 7 ? `En ${dias} días` :
                       `En ${Math.round(dias / 7)} semana${Math.round(dias / 7) !== 1 ? 's' : ''}`}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
