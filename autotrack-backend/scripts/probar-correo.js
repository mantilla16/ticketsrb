/**
 * Comprueba que el correo saliente funciona, sin tener que mover un ticket.
 *
 *   node scripts/probar-correo.js destinatario@rbcol.co
 *
 * Usa exactamente la misma configuración que la aplicación, así que si esto
 * llega, las notificaciones llegan. Traduce los errores típicos de Microsoft
 * 365, que por sí solos no dicen qué hay que tocar.
 */

require('dotenv').config();
const nodemailer = require('nodemailer');

const destino = process.argv[2];
if (!destino) {
  console.error('Uso: node scripts/probar-correo.js destinatario@rbcol.co');
  process.exit(1);
}

const { SMTP_HOST = 'smtp.office365.com', SMTP_PORT = '587', SMTP_USER, SMTP_PASS } = process.env;
const remitente = process.env.SMTP_FROM || SMTP_USER;

if (!SMTP_USER || !SMTP_PASS) {
  console.error('Faltan SMTP_USER y SMTP_PASS en el .env — el correo está sin configurar.');
  process.exit(1);
}

console.log(`Servidor  : ${SMTP_HOST}:${SMTP_PORT}`);
console.log(`Buzón     : ${SMTP_USER}`);
console.log(`Remitente : ${remitente}`);
console.log(`Destino   : ${destino}\n`);

/** Los errores de Exchange son crípticos; esto dice qué hacer con cada uno. */
function explicar(err) {
  const t = `${err.message} ${err.response || ''}`;
  if (/SmtpClientAuthentication is disabled/i.test(t)) {
    return ['SMTP AUTH está deshabilitado para este buzón.',
            'Habilítalo en el centro de administración de Microsoft 365:',
            '  Usuarios → el buzón → Correo → Administrar aplicaciones de correo → SMTP autenticado.',
            'Puede tardar hasta una hora en aplicarse.'].join('\n  ');
  }
  if (/5\.7\.57|must issue a STARTTLS|authentication unsuccessful/i.test(t)) {
    return ['Usuario o contraseña rechazados.',
            'Si la cuenta tiene verificación en dos pasos, la contraseña normal no sirve:',
            'hay que generar una contraseña de aplicación y usar ésa.'].join('\n  ');
  }
  if (/Client does not have permissions to send as this sender/i.test(t)) {
    return ['El buzón no puede enviar como SMTP_FROM.',
            'Deja SMTP_FROM igual a SMTP_USER, o concédele el permiso «Enviar como».'].join('\n  ');
  }
  if (/ETIMEDOUT|ECONNREFUSED|ENOTFOUND/i.test(t)) {
    return 'No se pudo conectar al servidor SMTP: revisa el host, el puerto y la salida a internet.';
  }
  return err.message;
}

(async () => {
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
    console.error('✗ No se pudo autenticar:\n  ' + explicar(err));
    process.exit(1);
  }

  try {
    const info = await tx.sendMail({
      from: { name: 'Mesa de Servicio', address: remitente },
      to: destino,
      subject: 'Prueba de la Mesa de Servicio',
      html: `<p style="font-family:Lato,system-ui,sans-serif;font-size:14px;color:#14171B">
               Si estás leyendo esto, las notificaciones de la Mesa de Servicio
               ya salen correctamente desde <b>${remitente}</b>.
             </p>`,
    });
    console.log(`✓ Enviado — id ${info.messageId}`);
    if (info.rejected?.length) console.log(`  Rechazados: ${info.rejected.join(', ')}`);
  } catch (err) {
    console.error('✗ No se pudo enviar:\n  ' + explicar(err));
    process.exit(1);
  }
})();
