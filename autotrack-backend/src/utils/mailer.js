const { JWT } = require('google-auth-library');
const MailComposer = require('nodemailer/lib/mail-composer');
const escapeHtml = require('./escapeHtml');

const APP_URL   = process.env.FRONTEND_URL_PUBLIC || process.env.FRONTEND_URL || 'http://localhost:5173';
const FALLBACK_SENDER = process.env.REPORT_FROM_EMAIL;

const TYPE_BADGE = {
  assign:    { label: 'Nueva asignación',  color: '#7C3AED', bg: '#F5F3FF' },
  status:    { label: 'Cambio de estado',  color: '#1B5183', bg: '#DCE8F3' },
  update:    { label: 'Actualización',     color: '#175CD3', bg: '#EFF6FF' },
  log:       { label: 'Avance registrado', color: '#0B6E80', bg: '#E4F5F8' },
  task:      { label: 'Tarea',             color: '#16A34A', bg: '#ECFDF3' },
  solicitud: { label: 'Solicitud',         color: '#B45309', bg: '#FEF3C7' },
};

const STATUS_META = {
  backlog:  { label: 'Por hacer',  color: '#6B7280', bg: '#F3F4F6' },
  progress: { label: 'En proceso', color: '#1B5183', bg: '#DCE8F3' },
  standby:  { label: 'En standby', color: '#A8907C', bg: '#F5EFE9' },
  testing:  { label: 'En testing', color: '#F59E0B', bg: '#FEF3C7' },
  done:     { label: 'Finalizado', color: '#22C55E', bg: '#ECFDF3' },
  soporte:  { label: 'Soporte',    color: '#0B6E80', bg: '#E4F5F8' },
};

const PRIORITY_META = {
  high: { label: 'Prioridad alta',  color: '#EF4444', bg: '#FEF2F2' },
  mid:  { label: 'Prioridad media', color: '#1B5183', bg: '#DCE8F3' },
  low:  { label: 'Prioridad baja',  color: '#22C55E', bg: '#ECFDF3' },
};

function fmtDueDate(d) {
  if (!d) return null;
  try {
    return new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  } catch { return null; }
}

function chip({ label, color, bg }) {
  return `<span style="display:inline-block;background:${bg};color:${color};font-size:11.5px;font-weight:600;padding:5px 11px;border-radius:7px;margin:0 6px 6px 0;">${label}</span>`;
}

function badgeChip({ label, color, bg }) {
  return `<span style="display:inline-block;background:${bg};color:${color};font-size:11px;font-weight:700;letter-spacing:.3px;padding:4px 10px;border-radius:999px;margin:0 0 14px;">${label.toUpperCase()}</span>`;
}

const clients = new Map(); // un JWT client por buzón impersonado (el autor de cada cambio)
function getClient(email) {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY || !email) return null;
  if (!clients.has(email)) {
    clients.set(email, new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/gmail.send'],
      subject: email, // impersona este buzón vía Domain-Wide Delegation
    }));
  }
  return clients.get(email);
}

function template({ message, actorName, type, projectId, meta = {} }) {
  const badge = TYPE_BADGE[type] || null;
  const badgeHtml = badge ? badgeChip(badge) : '';

  const headline = meta.projectName
    ? `<div style="font-size:19px;font-weight:800;color:#1F2937;line-height:1.3;margin-bottom:10px;">${escapeHtml(meta.projectName)}</div>`
    : '';

  const statusFromMeta = STATUS_META[meta.statusFrom];
  const statusToMeta   = STATUS_META[meta.statusTo];
  const statusChange = (statusFromMeta && statusToMeta && meta.statusFrom !== meta.statusTo)
    ? `<div style="margin:2px 0 16px;">
        ${chip(statusFromMeta)}
        <span style="display:inline-block;color:#C4B8AE;font-size:14px;margin:0 4px;vertical-align:middle;">&#8594;</span>
        ${chip(statusToMeta)}
      </div>`
    : '';

  const chips = [
    PRIORITY_META[meta.priority] ? chip(PRIORITY_META[meta.priority]) : '',
    meta.client ? chip({ label: escapeHtml(meta.client), color: '#6B7280', bg: '#F3F4F6' }) : '',
    fmtDueDate(meta.dueDate) ? chip({ label: `Vence ${fmtDueDate(meta.dueDate)}`, color: '#6B7280', bg: '#F3F4F6' }) : '',
  ].join('');
  const chipsHtml = chips ? `<div>${chips}</div>` : '';

  const link = projectId ? `${APP_URL}/?project=${encodeURIComponent(projectId)}` : APP_URL;
  const cta = projectId ? 'Ver el trabajo en la Mesa de Servicio' : 'Abrir en la Mesa de Servicio';

  return `
  <div style="background:#F4F1EC;padding:32px 16px;font-family:Segoe UI,Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #ECE7E2;">
      <div style="background:#0A2340;padding:22px 26px;">
        <span style="color:#fff;font-size:17px;font-weight:800;letter-spacing:-.3px;">AMBAR<span style="color:#1B5183;">C</span></span>
      </div>
      <div style="padding:26px 26px 6px;">
        ${badgeHtml}
        ${headline}
        <div style="font-size:14.5px;color:#4B5563;line-height:1.6;margin-bottom:${(statusChange || chipsHtml) ? '16' : '2'}px;">
          ${actorName ? `<b style="color:#1F2937;">${escapeHtml(actorName)}</b> ` : ''}${message}
        </div>
        ${statusChange}
        ${chipsHtml}
      </div>
      <div style="padding:14px 26px 30px;">
        <a href="${link}" style="display:inline-block;background:#1B5183;color:#fff;text-decoration:none;font-weight:700;font-size:13.5px;padding:11px 22px;border-radius:10px;">
          ${cta}
        </a>
      </div>
      <div style="padding:14px 26px;border-top:1px solid #ECE7E2;color:#9CA3AF;font-size:11px;">
        Notificación automática · Mesa de Servicio — Russell Bedford Barranquilla
      </div>
    </div>
  </div>`;
}

function buildRawMessage({ to, subject, html, fromEmail, fromName }) {
  const from = fromName ? `"${fromName}" <${fromEmail}>` : fromEmail;
  const mail = new MailComposer({ from, to, subject, html });
  return new Promise((resolve, reject) => {
    mail.compile().build((err, message) => {
      if (err) return reject(err);
      resolve(message.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''));
    });
  });
}

/**
 * Envía un correo de notificación vía Gmail API (cuenta de servicio + DWD).
 * Sale desde el buzón de quien hizo el cambio (actorEmail) — así las respuestas
 * le llegan directo a esa persona, no a una cuenta genérica. Nunca lanza.
 */
async function sendNotificationEmail({ to, title, message, actorName, actorEmail, type, projectId, meta }) {
  try {
    const senderEmail = actorEmail || FALLBACK_SENDER;
    const client = getClient(senderEmail);
    if (!client || !to) return;
    const { token } = await client.getAccessToken();
    const raw = await buildRawMessage({
      to, subject: title, html: template({ message, actorName, type, projectId, meta }),
      fromEmail: senderEmail, fromName: actorName,
    });
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    });
    if (!res.ok) console.error('Gmail API send failed:', res.status, await res.text());
  } catch (err) {
    console.error('sendNotificationEmail failed:', err.message);
  }
}

module.exports = { sendNotificationEmail };
