/* Una fila de la bandeja.

   Prioridades de lectura, de izquierda a derecha: franja de prioridad → estado
   y título → de quién viene y desde cuándo → responsable. Todo lo demás vive
   en el detalle: una bandeja se escanea, no se lee. */

import {
  ticketRef, categoryOf, isClosed, fmtAgo, slaOf,
} from '../../lib/tickets';
import { Avatar, Badge, Icon, StatusBadge } from '../ui';

export default function TicketRow({ ticket, onOpen, showRequester = true }) {
  const sla = slaOf(ticket);
  const urgent = sla && (sla.state === 'breached' || sla.state === 'today');

  return (
    <button
      className="tk-row"
      data-priority={ticket.urgencia || ticket.priority || 'media'}
      data-closed={isClosed(ticket)}
      onClick={() => onOpen(ticket)}
    >
      <span className="tk-row-rail" aria-hidden="true" />

      <span className="tk-row-main">
        <span className="tk-row-top">
          <StatusBadge value={ticket.status} />
          <span className="tk-row-title rb-truncate">{ticket.title}</span>
          {urgent && <Badge tone={sla.tone}><Icon name="alert" size={10} />{sla.label}</Badge>}
        </span>

        <span className="tk-row-meta">
          <span className="rb-ref">{ticketRef(ticket)}</span>
          <span className="sep">·</span>
          <span>{categoryOf(ticket.type).label}</span>
          {ticket.area && <><span className="sep">·</span><span className="rb-truncate">{ticket.area}</span></>}
          {showRequester && (ticket.nombre_solicitante || ticket.user_name) && (
            <><span className="sep">·</span><span className="rb-truncate">{ticket.nombre_solicitante || ticket.user_name}</span></>
          )}
          {ticket.file_name && <><span className="sep">·</span><Icon name="paperclip" size={11} /></>}
        </span>
      </span>

      <span className="tk-row-side">
        <span className="tk-row-when">{fmtAgo(ticket.created_at)}</span>
        <Avatar
          name={ticket.assignee_name} initials={ticket.assignee_initials}
          colorIndex={ticket.assignee_color_index} size="sm"
          title={ticket.assignee_name ? `Responsable: ${ticket.assignee_name}` : 'Sin asignar'}
        />
      </span>
    </button>
  );
}
