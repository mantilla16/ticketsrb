import { useState } from 'react';
import { sortByPriority } from '../utils/helpers';
import KanbanCard from './KanbanCard';

const COLS = [
  { key: 'backlog',  label: 'Por hacer',  dot: 'var(--c-backlog)'  },
  { key: 'progress', label: 'En proceso', dot: 'var(--c-progress)' },
  { key: 'standby',  label: 'En standby', dot: 'var(--c-standby)'  },
  { key: 'testing',  label: 'En testing', dot: 'var(--c-testing)'  },
  { key: 'done',     label: 'Finalizado', dot: 'var(--c-done)'     },
  { key: 'soporte',  label: 'En soporte', dot: 'var(--c-soporte)'  },
];

const DONE_PREVIEW = 5;

export default function KanbanBoard({ projects, users = [], onCardClick, onAddClick, onMoveCard, onViewHistorial }) {
  const [draggingProject, setDraggingProject] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [fArea, setFArea] = useState('all');
  const [fPrio, setFPrio] = useState('all');
  const [fResp, setFResp] = useState('all');

  const areas = [...new Set(projects.map(p => (p.client || '').trim()).filter(Boolean))].sort();
  const assignees = users.length
    ? users
    : [...new Map(projects.filter(p => p.assignee).map(p => [p.assignee.id, p.assignee])).values()];

  const filtered = projects.filter(p =>
    (fArea === 'all' || (p.client || '').trim() === fArea) &&
    (fPrio === 'all' || (p.priority || 'mid') === fPrio) &&
    (fResp === 'all' || (p.assigneeIds || [p.assigneeId]).map(String).includes(fResp))
  );

  const handleDragStart = (project) => {
    setDraggingProject(project);
  };

  const handleDragEnd = () => {
    setDraggingProject(null);
    setDragOverCol(null);
  };

  const handleDragOver = (e, colKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverCol !== colKey) setDragOverCol(colKey);
  };

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverCol(null);
    }
  };

  const handleDrop = (e, targetStatus) => {
    e.preventDefault();
    if (draggingProject && draggingProject.status !== targetStatus && onMoveCard) {
      onMoveCard(draggingProject.id, targetStatus);
    }
    setDraggingProject(null);
    setDragOverCol(null);
  };

  return (
    <>
    {/* Filtros */}
    <div className="kb-filters no-print">
      <div className="kb-filter">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        <span className="kb-filter-label">Área</span>
        <select value={fArea} onChange={e => setFArea(e.target.value)}>
          <option value="all">Todas las áreas</option>
          {areas.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <div className="kb-filter">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        <span className="kb-filter-label">Prioridad</span>
        <select value={fPrio} onChange={e => setFPrio(e.target.value)}>
          <option value="all">Todas las prioridades</option>
          <option value="high">Alta</option>
          <option value="mid">Media</option>
          <option value="low">Baja</option>
        </select>
      </div>
      <div className="kb-filter">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
        <span className="kb-filter-label">Responsable</span>
        <select value={fResp} onChange={e => setFResp(e.target.value)}>
          <option value="all">Todos</option>
          {assignees.map(u => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
        </select>
      </div>
      {(fArea !== 'all' || fPrio !== 'all' || fResp !== 'all') && (
        <button className="kb-filter-clear" onClick={() => { setFArea('all'); setFPrio('all'); setFResp('all'); }}>
          ✕ Limpiar filtros
        </button>
      )}
    </div>

    <div className="kanban-board">
      {COLS.map(({ key, label, dot }) => {
        const allCards = filtered.filter(p => p.status === key).sort(sortByPriority);
        const isDone = key === 'done';
        const sorted = isDone
          ? [...allCards].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
          : allCards;
        const cards = isDone ? sorted.slice(0, DONE_PREVIEW) : sorted;
        const hiddenCount = isDone ? sorted.length - DONE_PREVIEW : 0;
        const isOver = dragOverCol === key && draggingProject?.status !== key;

        return (
          <div className="kanban-col" key={key}>
            <div
              className={`kanban-col-bg${isOver ? ' drag-over' : ''}`}
              onDragOver={(e) => handleDragOver(e, key)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, key)}
            >
              <div className="kanban-col-header">
                <div className="col-label">
                  <span className="col-dot" style={{ background: dot }} />
                  {label}
                </div>
                <span className="col-count">{allCards.length}</span>
              </div>

              <div className="kanban-cards">
                {isOver && draggingProject && (
                  <div className="drop-ghost" />
                )}
                {cards.length ? (
                  cards.map((p, i) => (
                    <KanbanCard
                      key={p.id}
                      project={p}
                      onClick={onCardClick}
                      index={i}
                      isDragging={draggingProject?.id === p.id}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                    />
                  ))
                ) : (
                  !isOver && (
                    <div className="empty" style={{ padding: '20px 8px', fontSize: 12 }}>
                      Sin proyectos
                    </div>
                  )
                )}
              </div>

              {isDone && hiddenCount > 0 ? (
                <button className="historial-btn" onClick={onViewHistorial}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 3h6l3 9 3-9h6"/><path d="M3 21h18"/><path d="M12 12v9"/>
                  </svg>
                  Historial · {hiddenCount} más
                </button>
              ) : onAddClick ? (
                <button className="add-card-btn" onClick={() => onAddClick(key)}>
                  + Agregar
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
    </>
  );
}
