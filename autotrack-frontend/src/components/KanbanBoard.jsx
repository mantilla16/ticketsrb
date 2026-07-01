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

export default function KanbanBoard({ projects, onCardClick, onAddClick, onMoveCard }) {
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
        const cards = projects.filter(p => p.status === key).sort(sortByPriority);
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
                <span className="col-count">{cards.length}</span>
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

              <button className="add-card-btn" onClick={() => onAddClick(key)}>
                + Agregar
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
