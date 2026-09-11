/**
 * Convocatoria de la reunión de levantamiento, en formato iCalendar (.ics).
 *
 * La versión anterior creaba el evento con la API de Google Calendar, lo que
 * exigía una cuenta de servicio con delegación a nivel de dominio. Con
 * Microsoft 365 el equivalente sería Microsoft Graph, que necesita permisos de
 * aplicación y consentimiento del administrador.
 *
 * Un .ics adjunto al correo evita todo eso: Outlook —y también Gmail, Apple
 * Mail o cualquier cliente— lo reconoce como una invitación y ofrece
 * aceptarla. El evento queda en el calendario de cada quien sin que el
 * servidor necesite ningún permiso sobre los buzones.
 */

const { randomUUID } = require('crypto');

/** Fecha en el formato UTC de iCalendar: 20260911T143000Z */
const stamp = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/**
 * Escapa según RFC 5545: las comas, los punto y coma y las barras invertidas
 * son separadores dentro de una propiedad, y los saltos de línea van como \n
 * literal. Sin esto, una descripción con una coma parte el campo en dos.
 */
const esc = (t = '') => String(t)
  .replace(/\\/g, '\\\\')
  .replace(/;/g, '\\;')
  .replace(/,/g, '\\,')
  .replace(/\r?\n/g, '\\n');

/** Ninguna línea puede pasar de 75 octetos; las siguientes van con un espacio. */
function fold(line) {
  if (line.length <= 75) return line;
  const out = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    out.push(' ' + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest) out.push(' ' + rest);
  return out.join('\r\n');
}

/**
 * Construye la convocatoria. `start` y `end` son Date.
 *
 * Se emiten en UTC (sufijo Z) a propósito: `fecha_reunion` se guarda como hora
 * "de pared" con TZ=UTC en el proceso, así que los dígitos ya son los que el
 * líder eligió y convertirlos otra vez los desplazaría.
 */
function buildMeetingInvite({
  organizerEmail, organizerName, summary, description,
  start, end, attendees = [], location = 'Por confirmar', uid,
}) {
  const invitados = [...new Set(attendees.filter(Boolean))];

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Russell Bedford Barranquilla//Mesa de Servicio//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid || randomUUID()}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    fold(`SUMMARY:${esc(summary)}`),
    fold(`DESCRIPTION:${esc(description)}`),
    fold(`LOCATION:${esc(location)}`),
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    fold(`ORGANIZER;CN=${esc(organizerName || organizerEmail)}:mailto:${organizerEmail}`),
    ...invitados.map(email =>
      fold(`ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${email}`)),
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Recordatorio',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.join('\r\n');
}

/**
 * Devuelve el adjunto listo para nodemailer. `method=REQUEST` es lo que hace
 * que Outlook lo presente como invitación y no como un archivo suelto.
 */
function meetingAttachment(opts) {
  return {
    filename: 'reunion.ics',
    content: buildMeetingInvite(opts),
    contentType: 'text/calendar; charset=utf-8; method=REQUEST',
  };
}

module.exports = { buildMeetingInvite, meetingAttachment };
