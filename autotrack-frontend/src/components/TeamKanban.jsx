import { useState } from 'react';
import { sortByPriority, colorClass } from '../utils/helpers';
import KanbanCard from './KanbanCard';

const ANALYTICS    = ['miguel padilla', 'andres holguin'];
const TEAM_PREVIEW = 4;

export default function TeamKanban({ projects, users, onCardClick, onAddClick }) {
  const [expanded, setExpanded] = useState(new Set());

  const visibleUsers = users.filter(u => !ANALYTICS.includes(u.name.toLowerCase()));

  if (!visibleUsers.length) {
    return <div className="empty">Sin ingenieros registrados aún. Pide a tu equipo que se registre.</div>;
  }

  const toggle = (id) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  return (
    <div className="team-board">
      {visibleUsers.map((eng) => {
        const allCards   = projects.filter(p => p.assigneeId === eng.id).sort(sortByPriority);
        const isExpanded = expanded.has(eng.id);
        const cards      = isExpanded ? allCards : allCards.slice(0, TEAM_PREVIEW);
        const hidden     = allCards.length - TEAM_PREVIEW;

        return (
          <div className="engineer-col" key={eng.id}>
            <div className="engineer-header">
              <div className={`avatar ${colorClass(eng.colorIndex)}`}>{eng.initials}</div>
              <div style={{ flex: 1 }}>
                <div className="eng-name">{eng.name.split(' ')[0]}</div>
                <div className="eng-count">{allCards.length} proyecto{allCards.length !== 1 ? 's' : ''}</div>
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
                : <div className="empty" style={{ fontSize: 12, padding: 16 }}>Sin asignaciones</div>}
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
