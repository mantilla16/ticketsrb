import { useState } from 'react';
import { sortByPriority, colorClass } from '../utils/helpers';
import KanbanCard from './KanbanCard';

const ENG_COLORS = ['#4F5FE8','#6D7AE8','#3A4A9E','#8B91C4','#2D3578'];

const TEAM_PREVIEW = 4;

export default function TeamKanban({ projects, users, onCardClick, onAddClick }) {
  const [expanded, setExpanded] = useState(new Set());

  if (!users.length) {
    return <div className="empty">Sin ingenieros registrados aún.</div>;
  }

  const toggle = (id) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  return (
    <div className="team-board">
      {users.map((eng) => {
        const allCards   = projects.filter(p => p.assigneeId === eng.id).sort(sortByPriority);
        const isExpanded = expanded.has(eng.id);
        const cards      = isExpanded ? allCards : allCards.slice(0, TEAM_PREVIEW);
        const hidden     = allCards.length - TEAM_PREVIEW;

        const active  = allCards.filter(p => ['progress','testing'].includes(p.status)).length;
        const standby = allCards.filter(p => p.status === 'standby').length;
        const done    = allCards.filter(p => p.status === 'done').length;

        return (
          <div className="engineer-col" key={eng.id}>
            <div className="engineer-header" style={{ '--eng-accent': ENG_COLORS[eng.colorIndex ?? 0] }}>
              <div className={`avatar ${colorClass(eng.colorIndex)}`}>{eng.initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="eng-name">{eng.name}</div>
                <div className="eng-count">{allCards.length} proyecto{allCards.length !== 1 ? 's' : ''}</div>
                {allCards.length > 0 && (
                  <div className="eng-mini-stats">
                    {active  > 0 && <span className="eng-ms eng-ms--active"><span className="eng-ms-dot"/>{active} activos</span>}
                    {standby > 0 && <span className="eng-ms eng-ms--standby"><span className="eng-ms-dot"/>{standby} standby</span>}
                    {done    > 0 && <span className="eng-ms eng-ms--done"><span className="eng-ms-dot"/>{done} finalizados</span>}
                  </div>
                )}
              </div>
              <button
                className="eng-add-btn"
                onClick={() => onAddClick(eng.id)}
                title="Asignar proyecto"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
            </div>

            <div className="kanban-cards">
              {cards.length
                ? cards.map(p => <KanbanCard key={p.id} project={p} onClick={onCardClick} compact />)
                : (
                  <div className="eng-empty">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className="eng-empty-icon">
                      <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/>
                    </svg>
                    <span>Sin proyectos asignados</span>
                  </div>
                )}
            </div>

            {hidden > 0 && (
              <button
                className={`team-expand-btn${isExpanded ? ' team-expand-btn--open' : ''}`}
                onClick={() => toggle(eng.id)}
              >
                <svg
                  width="11" height="11" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ transition: 'transform .2s', transform: isExpanded ? 'rotate(180deg)' : 'none' }}
                >
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
                {isExpanded ? 'Contraer' : `Ver todos · ${hidden} más`}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
