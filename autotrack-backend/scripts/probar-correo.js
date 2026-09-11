/**
 * Comprueba que el correo saliente funciona, sin tener que mover un ticket.
 *
 *   node scripts/probar-correo.js destinatario@rbcol.co
 *
 * Usa exactamente la misma configuración y el mismo camino que la aplicación
 * —Microsoft Graph si está configurado, SMTP si no—, así que si esto llega,
 * las notificaciones llegan. Traduce los errores típicos de Microsoft 365,
 * que por sí solos no dicen qué hay que tocar.
 */

require('dotenv').config();
const nodemailer = require('nodemailer');
const { enviarPorGraph, graphReady, explicarGraph } = require('../src/utils/graphMail');

const destino = process.argv[2];
if (!destino) {
  console.error('Uso: node scripts/probar-correo.js destinatario@rbcol.co');
  process.exit(1);
}

const { SMTP_HOST = 'smtp.office365.com', SMTP_PORT = '587', SMTP_USER, SMTP_PASS } = process.env;
const remitente = process.env.MAIL_FROM || process.env.SMTP_FROM || SMTP_USER;

const CUERPO = `<p style="font-family:Lato,system-ui,sans-serif;font-size:14px;color:#14171B">
    Si estás leyendo esto, las notificaciones de la Mesa de Servicio ya salen
    correctamente desde <b>${remitente}</b>.
  </p>`;

/** Los errores de Exchange son crípticos; esto dice qué hacer con cada uno. */
function explicarSmtp(err) {
  const t = `${err.message} ${err.response || ''}`;
  if (/SmtpClientAuthentication is disabled/i.test(t)) {
    return ['SMTP AUTH está deshabilitado para este buzón.',
            'Habilítalo en el centro de administración de Microsoft 365:',
            '  Usuarios → el buzón → Correo → Administrar aplicaciones de correo → SMTP autenticado.',
            'Si el inquilino ya no lo permite, usa Microsoft Graph (MS_CLIENT_SECRET).'].join('\n  ');
  }
  if (/5\.7\.57|must issue a STARTTLS|authentication unsuccessful/i.test(t)) {
    return ['Usuario o contraseña rechazados.',
            'Con verificación en dos pasos la contraseña normal no sirve, y las',
            'contraseñas de aplicación suelen estar deshabilitadas: usa Graph.'].join('\n  ');
  }
  if (/Client does not have permissions to send as this sender/i.test(t)) {
    return 'El buzón no puede enviar como remitente indicado. Iguala SMTP_FROM a SMTP_USER o concede «Enviar como».';
  }
  if (/ETIMEDOUT|ECONNREFUSED|ENOTFOUND/i.test(t)) {
    return 'No se pudo conectar al servidor SMTP: revisa el host, el puerto y la salida a internet.';
  }
  return err.message;
}

async function porGraph() {
  console.log('Vía       : Microsoft Graph');
  console.log(`Remitente : ${remitente}`);
  console.log(`Destino   : ${destino}\n`);

  if (!remitente) {
    console.error('Falta MAIL_FROM: no sé desde qué buzón enviar.');
    process.exit(1);
  }
  try {
    await enviarPorGraph({
      from: remitente, to: destino,
      subject: 'Prueba de la Mesa de Servicio', html: CUERPO,
    });
    console.log('✓ Enviado por Graph');
  } catch (err) {
    console.error('✗ No se pudo enviar:\n  ' + explicarGraph(err));
    process.exit(1);
  }
}

async function porSmtp() {
  console.log('Vía       : SMTP');
  console.log(`Servidor  : ${SMTP_HOST}:${SMTP_PORT}`);
  console.log(`Buzón     : ${SMTP_USER}`);
  console.log(`Remitente : ${remitente}`);
  console.log(`Destino   : ${destino}\n`);

  const port = Number(SMTP_PORT);
  const tx = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: true,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  try {
    await tx.verify();
    console.log('✓ Conexión y autenticación correctas');
  } catch (err) {
    console.error('✗ No se pudo autenticar:\n  ' + explicarSmtp(err));
    process.exit(1);
  }

  try {
    const info = await tx.sendMail({
      from: { name: 'Mesa de Servicio', address: remitente },
      to: destino,
      subject: 'Prueba de la Mesa de Servicio',
      html: CUERPO,
    });
    console.log(`✓ Enviado — id ${info.messageId}`);
    if (info.rejected?.length) console.log(`  Rechazados: ${info.rejected.join(', ')}`);
  } catch (err) {
    console.error('✗ No se pudo enviar:\n  ' + explicarSmtp(err));
    process.exit(1);
  }
}

(async () => {
  if (graphReady()) return porGraph();
  if (SMTP_USER && SMTP_PASS) return porSmtp();
  console.error('El correo está sin configurar.');
  console.error('  Para Graph : MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET y MAIL_FROM');
  console.error('  Para SMTP  : SMTP_USER y SMTP_PASS');
  process.exit(1);
})();
