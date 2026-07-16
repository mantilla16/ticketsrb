const { JWT } = require('google-auth-library');
const MailComposer = require('nodemailer/lib/mail-composer');

const APP_URL = process.env.FRONTEND_URL_PUBLIC || 'https://ambarc.americana.edu.co';
const SENDER  = process.env.REPORT_FROM_EMAIL;

let jwtClient = null;
function getClient() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY || !SENDER) return null;
  if (!jwtClient) {
    jwtClient = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/gmail.send'],
      subject: SENDER, // impersona a este buzón vía Domain-Wide Delegation
    });
  }
  return jwtClient;
}

function template({ message, actorName }) {
  return `
  <div style="background:#F4F1EC;padding:32px 16px;font-family:Segoe UI,Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #ECE7E2;">
      <div style="background:#2A160D;padding:22px 26px;">
        <span style="color:#fff;font-size:17px;font-weight:800;letter-spacing:-.3px;">AMBAR<span style="color:#F97316;">C</span></span>
      </div>
      <div style="padding:28px 26px 8px;">
        <div style="font-size:15px;color:#1F2937;line-height:1.6;">
          ${actorName ? `<b>${actorName}</b> ` : ''}${message}
        </div>
      </div>
      <div style="padding:8px 26px 30px;">
        <a href="${APP_URL}" style="display:inline-block;background:#F97316;color:#fff;text-decoration:none;font-weight:700;font-size:13.5px;padding:11px 22px;border-radius:10px;">
          Ver en AMBARC
        </a>
      </div>
      <div style="padding:14px 26px;border-top:1px solid #ECE7E2;color:#9CA3AF;font-size:11px;">
        Notificación automática de AMBARC — Gestión de Proyectos
      </div>
    </div>
  </div>`;
}

function buildRawMessage({ to, subject, html }) {
  const mail = new MailComposer({ from: `"AMBARC" <${SENDER}>`, to, subject, html });
  return new Promise((resolve, reject) => {
    mail.compile().build((err, message) => {
      if (err) return reject(err);
      resolve(message.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''));
    });
  });
}

/** Envía un correo de notificación vía Gmail API (cuenta de servicio + DWD). Nunca lanza. */
async function sendNotificationEmail({ to, title, message, actorName }) {
  try {
    const client = getClient();
    if (!client || !to) return;
    const { token } = await client.getAccessToken();
    const raw = await buildRawMessage({ to, subject: title, html: template({ message, actorName }) });
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
