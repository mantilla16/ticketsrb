const nodemailer = require('nodemailer');

const APP_URL = process.env.FRONTEND_URL_PUBLIC || 'https://ambarc.americana.edu.co';

let transporter = null;
function getTransporter() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD,
      },
    });
  }
  return transporter;
}

function template({ title, message, actorName }) {
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

/** Envía un correo de notificación. Nunca lanza — falla en silencio si no hay SMTP configurado. */
async function sendNotificationEmail({ to, title, message, actorName }) {
  try {
    const t = getTransporter();
    if (!t || !to) return;
    await t.sendMail({
      from: `"AMBARC" <${process.env.EMAIL_USER}>`,
      to,
      subject: title,
      html: template({ title, message, actorName }),
    });
  } catch (err) {
    console.error('sendNotificationEmail failed:', err.message);
  }
}

module.exports = { sendNotificationEmail };
