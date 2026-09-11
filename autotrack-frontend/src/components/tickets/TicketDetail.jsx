/* Detalle del ticket en panel lateral.

   Una sola pantalla para los dos públicos: el auditor ve el estado y la
   respuesta de la mesa; quien hace triage ve además el bloque de gestión.
   No hay dos modales distintos como antes — la diferencia es qué se muestra,
   no a qué pantalla te lleva la aplicación. */

import { useEffect, useMemo, useState } from 'react';
import {
  STATUS_FLOW, statusOf, categoryOf, ticketRef, slaOf, isClosed,
  fmtDate, fmtDateTime, fmtMeeting, dateOnly, timeOnly, canTriage, canManage,
} from '../../lib/tickets';
import {
  Alert, Avatar, Badge, Button, ConfirmDialog, Field, Icon,
  PriorityBadge, StatusBadge, Drawer,
} from '../ui';
import TicketTimeline from './TicketTimeline';

const API_BASE  = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const REPLY_MAX = 800;

/* A qué equipo se enruta el trabajo. Se guarda en `equipo` y decide, al
   convertirlo en proyecto, quién puede quedar como responsable. */
const TEAMS = [
  { value: 'automatizacion', label: 'Automatización' },
  { value: 'analitica',      label: 'Analítica de datos' },
  { value: 'compartido',     label: 'Ambos equipos' },
];

const TEAM_ROLES = {
  analitica:      ['member_analytics', 'leader_analytics'],
  compartido:     ['engineer', 'admin', 'member_analytics', 'leader_analytics'],
  automatizacion: ['engineer', 'admin'],
};

function Fact({ k, children }) {
  return (
    <div className="tk-fact">
      <div className="tk-fact-k">{k}</div>
      <div className="tk-fact-v">{children ?? '—'}</div>
    </div>
  );
}

export default function TicketDetail({
  ticket, open, onClose, user, users = [],
  onSaveStatus, onSaveInfo, onDelete,
}) {
  const triage = canTriage(user);
  const owner  = ticket && user && ticket.user_id === user.id;

  /* Borrador de gestión — vive aquí y solo se persiste al guardar. */
  const [status,   setStatus]   = useState('recibido');
  const [reply,    setReply]    = useState('');
  const [assignee, setAssignee] = useState('');
  const [team,     setTeam]     = useState('automatizacion');
  const [mDate,    setMDate]    = useState('');
  const [mTime,    setMTime]    = useState('');
  const [guests,   setGuests]   = useState('');
  const [extra,    setExtra]    = useState('');
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!ticket) return;
    setStatus(ticket.status || 'recibido');
    setReply(ticket.notes || '');
    setAssignee(ticket.assignee_id ? String(ticket.assignee_id) : '');
    setTeam(TEAMS.some(t => t.value === ticket.equipo) ? ticket.equipo : 'automatizacion');
    setMDate(dateOnly(ticket.fecha_reunion));
    setMTime(timeOnly(ticket.fecha_reunion));
    setGuests(''); setExtra(''); setError(''); setBusy(false); setConfirmDelete(false);
  }, [ticket]);

  const assignables = useMemo(
    () => users.filter(u => (TEAM_ROLES[team] || TEAM_ROLES.automatizacion).includes(u.role)),
    [users, team],
  );

  if (!ticket) return null;

  const sla = slaOf(ticket);
  const cat = categoryOf(ticket.type);
  const requester = ticket.nombre_solicitante || ticket.user_name;

  const save = async (finalStatus) => {
    if (finalStatus === 'convertido' && !assignee) {
      return setError('Asigna un responsable antes de poner el ticket en ejecución.');
    }
    if (finalStatus === 'reunion_agendada' && (!mDate || !mTime)) {
      return setError('Selecciona la fecha y la hora de la reunión de levantamiento.');
    }
    setBusy(true); setError('');
    try {
      await onSaveStatus(ticket.id, {
        status: finalStatus,
        notes: reply,
        assigneeId: assignee || null,
        equipo: team,
        tipoProyecto: team,
        fechaReunion: mDate ? `${mDate}T${mTime || '09:00'}:00` : null,
        invitados: guests.trim() || null,
      });
    } catch (e) {
      setError(e?.error || 'No se pudo guardar el cambio.');
    } finally {
      setBusy(false);
    }
  };

  const saveExtra = async () => {
    if (!extra.trim()) return;
    setBusy(true);
    try { await onSaveInfo(ticket.id, extra.trim()); setExtra(''); }
    catch (e) { setError(e?.error || 'No se pudo guardar.'); }
    finally { setBusy(false); }
  };

  return (
    <Drawer open={open} onClose={onClose} label={`Ticket ${ticketRef(ticket)}`}>
      {/* ── Cabecera ── */}
      <header className="tk-detail-head">
        <div className="tk-detail-top">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="rb-row" style={{ gap: 8, marginBottom: 5 }}>
              <span className="rb-ref">{ticketRef(ticket)}</span>
              <span className="rb-divider--v" />
              <span style={{ fontSize: 'var(--rb-fs-xs)', color: 'var(--rb-text-4)' }}>{cat.label}</span>
            </div>
            <h2 className="tk-detail-title">{ticket.title}</h2>
          </div>
          <Button variant="ghost" icon="close" onClick={onClose} aria-label="Cerrar" />
        </div>
        <div className="tk-detail-tags">
          <StatusBadge value={ticket.status} />
          <PriorityBadge value={ticket.urgencia || ticket.priority} />
          {sla && sla.state !== 'answered' && sla.state !== 'ok' && (
            <Badge tone={sla.tone}><Icon name="clock" size={11} />{sla.label}</Badge>
          )}
          {ticket.project_created && <Badge tone="brand"><Icon name="play" size={11} />En ejecución</Badge>}
        </div>
      </header>

      {/* ── Cuerpo ── */}
      <div className="tk-detail-body">
        {error && <Alert tone="danger">{error}</Alert>}

        <section>
          <div className="tk-section-title">Solicitud</div>
          <p className="tk-prose">{ticket.description || 'Sin descripción.'}</p>
        </section>

        <section>
          <div className="tk-section-title">Datos del caso</div>
          <div className="tk-facts">
            <Fact k="Solicitante">
              <Avatar name={requester} initials={ticket.user_initials}
                colorIndex={ticket.user_color_index} size="sm" />
              {requester}
            </Fact>
            <Fact k="Línea de servicio">{ticket.area}</Fact>
            <Fact k="Contacto">{ticket.correo_solicitante}</Fact>
            <Fact k="Frecuencia">{ticket.frecuencia}</Fact>
            <Fact k="Fuentes / herramientas">{ticket.herramientas}</Fact>
            <Fact k="Impacto esperado">{ticket.impacto}</Fact>
            <Fact k="Radicado">{fmtDateTime(ticket.created_at)}</Fact>
            <Fact k="Fecha requerida">{ticket.due_date ? fmtDate(ticket.due_date) : 'Sin fecha'}</Fact>
            <Fact k="Responsable">
              {ticket.assignee_name
                ? <><Avatar name={ticket.assignee_name} initials={ticket.assignee_initials}
                      colorIndex={ticket.assignee_color_index} size="sm" />{ticket.assignee_name}</>
                : <span style={{ color: 'var(--rb-text-4)' }}>Sin asignar</span>}
            </Fact>
            {sla && sla.state !== 'answered' && (
              <Fact k="Compromiso de respuesta">{fmtDate(sla.due)}</Fact>
            )}
          </div>

          {ticket.file_name && ticket.file_path && (
            <a
              className="tk-attach" style={{ marginTop: 12 }}
              href={`${API_BASE}/uploads/solicitudes/${ticket.file_path}?token=${localStorage.getItem('at-token')}`}
              target="_blank" rel="noopener noreferrer"
            >
              <Icon name="file" size={15} />
              <span className="rb-truncate" style={{ flex: 1 }}>{ticket.file_name}</span>
              <Icon name="download" size={14} />
            </a>
          )}
        </section>

        {ticket.info_adicional && (
          <section>
            <div className="tk-section-title">Información añadida por el solicitante</div>
            <p className="tk-prose">{ticket.info_adicional}</p>
          </section>
        )}

        <section>
          <div className="tk-section-title">Seguimiento</div>
          <TicketTimeline ticket={ticket} previewStatus={triage ? status : undefined} />
          {ticket.fecha_reunion && (
            <div className="rb-row" style={{ marginTop: 12, fontSize: 'var(--rb-fs-sm)', color: 'var(--rb-text-2)' }}>
              <Icon name="calendar" size={14} />
              Reunión de levantamiento: <strong>{fmtMeeting(ticket.fecha_reunion)}</strong>
            </div>
          )}
        </section>

        {/* Respuesta de la mesa — lo primero que el auditor quiere leer. */}
        {ticket.notes && !triage && (
          <section>
            <div className="tk-section-title">Respuesta de la mesa</div>
            <div className="tk-reply">{ticket.notes}</div>
          </section>
        )}

        {/* El dueño puede aportar contexto sin abrir otro ticket. */}
        {owner && !triage && (
          <section>
            <div className="tk-section-title">Agregar información</div>
            <Field hint="Se suma al ticket y la mesa recibe el aviso. Útil si te piden un dato o cambia el alcance.">
              <textarea className="rb-textarea" rows={3} value={extra} maxLength={REPLY_MAX}
                placeholder="Ej: adjunto el formato de cédula que usamos en el encargo de…"
                onChange={e => setExtra(e.target.value)} />
            </Field>
            <div style={{ marginTop: 8 }}>
              <Button variant="secondary" size="sm" icon="send"
                onClick={saveExtra} disabled={!extra.trim()} loading={busy}>
                Enviar información
              </Button>
            </div>
          </section>
        )}

        {/* ── Gestión (solo triage) ── */}
        {triage && (
          <section>
            <div className="tk-section-title">Gestión de la mesa</div>

            <Field label="Estado">
              <div className="rb-choice">
                {STATUS_FLOW.map(s => (
                  <button key={s.value} type="button" className="rb-choice-btn"
                    aria-pressed={status === s.value} title={s.hint}
                    onClick={() => { setStatus(s.value); setError(''); }}>
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="rb-hint" style={{ marginTop: 6 }}>{statusOf(status).hint}</div>
            </Field>

            <div className="tk-form-grid" style={{ marginTop: 16 }}>
              <Field label="Equipo que atiende">
                <select className="rb-select" value={team}
                  onChange={e => { setTeam(e.target.value); setAssignee(''); }}>
                  {TEAMS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
              <Field label="Responsable"
                hint={ticket.project_created ? 'El ticket ya tiene proyecto abierto.' : 'Al ponerlo en ejecución se crea el proyecto con este responsable.'}>
                <select className="rb-select" value={assignee} onChange={e => setAssignee(e.target.value)}>
                  <option value="">Sin asignar</option>
                  {assignables.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </Field>
            </div>

            <div className="tk-form-grid" style={{ marginTop: 16 }}>
              <Field label="Fecha de la reunión" required={status === 'reunion_agendada'}>
                <input className="rb-input" type="date" value={mDate} onChange={e => setMDate(e.target.value)} />
              </Field>
              <Field label="Hora" required={status === 'reunion_agendada'}>
                <input className="rb-input" type="time" value={mTime} onChange={e => setMTime(e.target.value)} />
              </Field>
            </div>

            {status === 'reunion_agendada' && (
              <div style={{ marginTop: 12 }}>
                <Field label="Invitados adicionales" optional
                  hint="Al guardar se avisa al solicitante y se crea el evento en el calendario. Separa varios correos con coma.">
                  <input className="rb-input" value={guests} onChange={e => setGuests(e.target.value)}
                    placeholder="socio@russellbedford.com.co, gerente@…" />
                </Field>
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <Field label="Respuesta para el solicitante"
                hint={`Se le envía por correo y queda visible en su ticket. ${REPLY_MAX - reply.length} caracteres restantes.`}>
                <textarea className="rb-textarea" rows={4} maxLength={REPLY_MAX} value={reply}
                  placeholder="Ej: revisamos el caso, es viable automatizar la conciliación. Agendamos levantamiento para el martes."
                  onChange={e => setReply(e.target.value)} />
              </Field>
            </div>

            {canManage(user) && (
              <div style={{ marginTop: 18 }}>
                <button className="rb-btn rb-btn--ghost rb-btn--sm"
                  style={{ color: 'var(--rb-text-4)' }}
                  onClick={() => setConfirmDelete(true)}>
                  <Icon name="trash" size={13} /> Eliminar ticket
                </button>
              </div>
            )}
          </section>
        )}
      </div>

      {/* ── Acciones ──
          La acción principal es la siguiente del flujo: poner en ejecución
          mientras el trabajo no ha arrancado, y cerrar una vez entregado. */}
      {triage && (
        <footer className="tk-detail-foot">
          {!isClosed(ticket) && (
            <Button variant="danger-soft" onClick={() => save('rechazado')} disabled={busy}>
              No procede
            </Button>
          )}
          <span style={{ flex: 1 }} />
          <Button variant="secondary" onClick={() => save(status)} loading={busy}>
            Guardar cambios
          </Button>
          {ticket.status === 'convertido' ? (
            <Button variant="success" icon="check" onClick={() => save('cerrado')} disabled={busy}>
              Cerrar ticket
            </Button>
          ) : !isClosed(ticket) ? (
            <Button variant="primary" icon="play" onClick={() => save('convertido')} disabled={busy}>
              Poner en ejecución
            </Button>
          ) : (
            <Button variant="primary" icon="refresh" onClick={() => save('convertido')} disabled={busy}>
              Reabrir
            </Button>
          )}
        </footer>
      )}

      <ConfirmDialog
        open={confirmDelete} busy={busy}
        title={`Eliminar ${ticketRef(ticket)}`}
        confirmLabel="Sí, eliminar"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => { setBusy(true); try { await onDelete(ticket.id); } finally { setBusy(false); } }}
      >
        Se borra el ticket y su historial. El solicitante deja de verlo y la acción no se puede deshacer.
      </ConfirmDialog>
    </Drawer>
  );
}
