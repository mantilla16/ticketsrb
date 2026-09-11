/* Línea de tiempo del ticket: dónde va, qué falta y qué ya pasó.
   Es la única respuesta que el auditor busca al abrir su ticket, así que se
   muestra igual para él y para la mesa — sin lenguaje interno. */

import { STATUS_FLOW, statusOf, fmtDate, fmtMeeting } from '../../lib/tickets';
import { Icon } from '../ui';

export default function TicketTimeline({ ticket, previewStatus }) {
  const status   = previewStatus || ticket.status;
  const current  = statusOf(status);
  const rejected = current.step === -1;

  if (rejected) {
    return (
      <div className="tk-timeline">
        <div className="tk-step" data-state="done">
          <div className="tk-step-rail">
            <span className="tk-step-dot"><Icon name="check" size={11} stroke={3.5} /></span>
            <span className="tk-step-line" />
          </div>
          <div className="tk-step-body">
            <div className="tk-step-label">Recibido</div>
            <div className="tk-step-note">{fmtDate(ticket.created_at)}</div>
          </div>
        </div>
        <div className="tk-step" data-state="rejected">
          <div className="tk-step-rail">
            <span className="tk-step-dot"><Icon name="close" size={11} stroke={3.5} /></span>
          </div>
          <div className="tk-step-body">
            <div className="tk-step-label">No procede</div>
            <div className="tk-step-note">
              {ticket.notes ? 'La razón está en la respuesta de la mesa.' : 'Cerrado sin ejecución.'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tk-timeline">
      {STATUS_FLOW.map((s, i) => {
        const state = i < current.step ? 'done' : i === current.step ? 'current' : 'pending';
        const note =
          s.value === 'recibido' ? fmtDate(ticket.created_at)
          : s.value === 'reunion_agendada' && ticket.fecha_reunion ? fmtMeeting(ticket.fecha_reunion)
          : state === 'current' ? s.hint
          : null;
        return (
          <div className="tk-step" data-state={state} key={s.value}>
            <div className="tk-step-rail">
              <span className="tk-step-dot">
                {state === 'done' ? <Icon name="check" size={11} stroke={3.5} /> : i + 1}
              </span>
              {i < STATUS_FLOW.length - 1 && <span className="tk-step-line" />}
            </div>
            <div className="tk-step-body">
              <div className="tk-step-label">{s.label}</div>
              {note && <div className="tk-step-note">{note}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
