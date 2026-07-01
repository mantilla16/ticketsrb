import { sortByPriority, colorClass } from '../utils/helpers';
import KanbanCard from './KanbanCard';

const ANALYTICS = ['miguel padilla', 'andres holguin'];

export default function TeamKanban({ projects, users, onCardClick, onAddClick }) {
  const visibleUsers = users.filter(u => !ANALYTICS.includes(u.name.toLowerCase()));
  if (!visibleUsers.length) {
    return <div className="empty">Sin ingenieros registrados aún. Pide a tu equipo que se registre.</div>;
  }
  return (
    <div className="team-board">
      {visibleUsers.map((eng) => {
        const cards = projects.filter(p => p.assigneeId === eng.id).sort(sortByPriority);
        return (
          <div className="engineer-col" key={eng.id}>
            <div className="engineer-header">
              <div className={`avatar ${colorClass(eng.colorIndex)}`}>{eng.initials}</div>
              <div>
                <div className="eng-name">{eng.name.split(' ')[0]}</div>
                <div className="eng-count">{cards.length} proyecto{cards.length !== 1 ? 's' : ''}</div>
              </div>
            </div>
            <div className="kanban-cards">
              {cards.length
                ? cards.map(p => <KanbanCard key={p.id} project={p} onClick={onCardClick} compact />)
                : <div className="empty" style={{ fontSize: 12, padding: 16 }}>Sin asignaciones</div>}
            </div>
            <button className="add-card-btn" onClick={() => onAddClick(eng.id)}>+ Asignar</button>
          </div>
        );
      })}
    </div>
  );
}
