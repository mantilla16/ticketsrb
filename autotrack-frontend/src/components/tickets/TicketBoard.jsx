/* Tablero por estado — la misma bandeja vista como flujo.
   Sirve para la reunión diaria de la mesa: dónde se está acumulando el trabajo
   y qué lleva demasiado tiempo en la misma columna. */

import { STATUS_FLOW, ticketRef, slaOf, fmtAgo, byUrgency } from '../../lib/tickets';
import { Avatar, Badge, Icon } from '../ui';

export default function TicketBoard({ tickets, onOpen }) {
  /* Los estados legacy se pintan en la columna que les corresponde hoy. */
  const LEGACY = { recibido: 'nueva', en_revision: 'en_proceso', cerrado: 'completada' };

  const columns = STATUS_FLOW.map(s => ({
    ...s,
    items: tickets
      .filter(t => t.status === s.value || t.status === LEGACY[s.value])
      .sort(byUrgency),
  }))
    /* Las columnas terminales solo aparecen si tienen algo: con el filtro en
       «Abiertos» estarían siempre vacías y solo añadirían ruido. */
    .filter(c => c.value !== 'cerrado' || c.items.length);

  const rejected = tickets.filter(t => t.status === 'rechazado' || t.status === 'rechazada');
  if (rejected.length) {
    columns.push({ value: 'rechazado', label: 'No procede', items: rejected.sort(byUrgency) });
  }

  return (
    <div className="tk-board">
      {columns.map(col => (
        <section className="tk-col" key={col.value}>
          <header className="tk-col-head">
            {col.label}
            <span className="tk-col-count">{col.items.length}</span>
          </header>
          <div className="tk-col-body">
            {col.items.length === 0
              ? <div className="tk-col-empty">Sin tickets</div>
              : col.items.map(t => {
                  const sla = slaOf(t);
                  const urgent = sla && (sla.state === 'breached' || sla.state === 'today');
                  return (
                    <button key={t.id} className="tk-card"
                      data-priority={t.urgencia || t.priority || 'media'}
                      onClick={() => onOpen(t)}>
                      <span className="tk-card-title rb-clamp-2">{t.title}</span>
                      {urgent && <Badge tone={sla.tone}><Icon name="alert" size={10} />{sla.label}</Badge>}
                      <span className="tk-card-meta">
                        <span className="rb-ref">{ticketRef(t)}</span>
                        <span style={{ color: 'var(--rb-n-300)' }}>·</span>
                        <span className="rb-truncate">{fmtAgo(t.created_at)}</span>
                        <span style={{ flex: 1 }} />
                        <Avatar name={t.assignee_name} initials={t.assignee_initials}
                          colorIndex={t.assignee_color_index} size="sm" />
                      </span>
                    </button>
                  );
                })}
          </div>
        </section>
      ))}
    </div>
  );
}
