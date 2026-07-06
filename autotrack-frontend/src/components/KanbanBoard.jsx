import { useState } from 'react';
import { sortByPriority } from '../utils/helpers';
import KanbanCard from './KanbanCard';

const COLS = [
  { key: 'backlog',  label: 'Por hacer',  dot: 'var(--c-backlog)'  },
  { key: 'progress', label: 'En proceso', dot: 'var(--c-progress)' },
  { key: 'standby',  label: 'En standby', dot: 'var(--c-standby)'  },
  { key: 'testing',  label: 'En testing', dot: 'var(--c-testing)'  },
  { key: 'done',     label: 'Finalizado', dot: 'var(--c-done)'     },
];

const DONE_PREVIEW = 5;

export default function KanbanBoard({ projects, onCardClick, onAddClick, onMoveCard, onViewHistorial }) {
  const [draggingProject, setDraggingProject] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);

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
    <div className="kanban-board">
      {COLS.map(({ key, label, dot }) => {
        const allCards = projects.filter(p => p.status === key).sort(sortByPriority);
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
              ) : (
                <button className="add-card-btn" onClick={() => onAddClick(key)}>
                  + Agregar
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
