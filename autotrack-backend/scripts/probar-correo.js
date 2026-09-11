/**
 * Comprueba que el correo saliente funciona, sin tener que mover un ticket.
 *
 *   node scripts/probar-correo.js destinatario@rbcol.co
 *
 * Usa exactamente la misma configuración y el mismo camino que la aplicación
 * —Graph delegado, Graph de aplicación o SMTP, en ese orden—, así que si esto
 * llega, las notificaciones llegan. Traduce los errores de Microsoft 365, que
 * por sí solos no dicen qué hay que tocar.
 *
 * Nota: el token de la autorización delegada se guarda con permisos 600, así
 * que hay que ejecutar esto con el mismo usuario que autorizó (normalmente
 * `sudo`).
 */

require('dotenv').config();
const nodemailer = require('nodemailer');
const {
  enviarPorGraph, graphReady, explicarGraph, modo, estadoToken, rutaToken,
} = require('../src/utils/graphMail');

const destino = process.argv[2];
if (!destino) {
  console.error('Uso: node scripts/probar-correo.js destinatario@rbcol.co');
  process.exit(1);
}

const { SMTP_HOST = 'smtp.office365.com', SMTP_PORT = '587', SMTP_USER, SMTP_PASS } = process.env;
const remitente = process.env.MAIL_FROM || process.env.SMTP_FROM || SMTP_USER;

const CUERPO = `<p style="font-family:Lato,system-ui,sans-serif;font-size:14px;color:#14171B">
    Si estás leyendo esto, las notificaciones de la Mesa de Servicio ya salen
    correctamente.
  </p>`;

/** Los errores de Exchange son crípticos; esto dice qué hacer con cada uno. */
function explicarSmtp(err) {
  const t = `${err.message} ${err.response || ''}`;
  if (/SmtpClientAuthentication is disabled/i.test(t)) {
    return ['SMTP AUTH está deshabilitado para este buzón.',
      'Habilítalo en el centro de administración de Microsoft 365:',
      '  Usuarios → el buzón → Correo → Administrar aplicaciones de correo → SMTP autenticado.',
      'Si el inquilino ya no lo permite, usa la autorización delegada de Graph.'].join('\n  ');
  }
  if (/5\.7\.57|must issue a STARTTLS|authentication unsuccessful/i.test(t)) {
    return ['Usuario o contraseña rechazados.',
      'Con verificación en dos pasos la contraseña normal no sirve, y las',
      'contraseñas de aplicación suelen estar deshabilitadas: usa Graph.'].join('\n  ');
  }
  if (/Client does not have permissions to send as this sender/i.test(t)) {
    return 'El buzón no puede enviar como el remitente indicado. Iguala SMTP_FROM a SMTP_USER o concede «Enviar como».';
  }
  if (/ETIMEDOUT|ECONNREFUSED|ENOTFOUND/i.test(t)) {
    return 'No se pudo conectar al servidor SMTP: revisa el host, el puerto y la salida a internet.';
  }
  return err.message;
}

async function porGraph() {
  const m = modo();
  const delegado = m === 'DELEGADO';

  console.log(`Vía       : Microsoft Graph (${delegado ? 'permiso delegado' : 'permiso de aplicación'})`);
  console.log(`Remitente : ${delegado ? (remitente || 'la cuenta que autorizó') : remitente}`);
  console.log(`Destino   : ${destino}`);
  console.log('');

  // Con permiso delegado se envía por /me, así que el remitente es quien
  // autorizó y MAIL_FROM es solo informativo.
  if (!remitente && !delegado) {
    console.error('Falta MAIL_FROM: no sé desde qué buzón enviar.');
    process.exit(1);
  }

  try {
    await enviarPorGraph({
      from: remitente,
      to: destino,
      subject: 'Prueba de la Mesa de Servicio',
      html: CUERPO,
    });
    console.log('✓ Enviado por Graph');
  } catch (err) {
    console.error('✗ No se pudo enviar:');
    console.error('  ' + explicarGraph(err));
    process.exit(1);
  }
}

async function porSmtp() {
  console.log('Vía       : SMTP');
  console.log(`Servidor  : ${SMTP_HOST}:${SMTP_PORT}`);
  console.log(`Buzón     : ${SMTP_USER}`);
  console.log(`Remitente : ${remitente}`);
  console.log(`Destino   : ${destino}`);
  console.log('');

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
    console.error('✗ No se pudo autenticar:');
    console.error('  ' + explicarSmtp(err));
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
    console.error('✗ No se pudo enviar:');
    console.error('  ' + explicarSmtp(err));
    process.exit(1);
  }
}

/** Sin nada configurado, decir exactamente qué falta y no un menú genérico. */
function explicarFaltante() {
  console.error('El correo está sin configurar.');
  console.error('');

  if (!process.env.MS_TENANT_ID || !process.env.MS_CLIENT_ID) {
    console.error('  Faltan MS_TENANT_ID y MS_CLIENT_ID en el .env.');
    return;
  }

  const estado = estadoToken();
  if (estado === 'inaccesible') {
    console.error(`  La autorización existe en ${rutaToken()} pero este proceso`);
    console.error('  no puede leerla: se guardó con permisos 600. Ejecuta con el');
    console.error('  mismo usuario que autorizó, normalmente con sudo.');
    return;
  }

  console.error('  No hay autorización guardada. Ejecuta:');
  console.error('    sudo node scripts/autorizar-correo.js');
  console.error('');
  console.error(`  (se espera el token en ${rutaToken()})`);
  console.error('');
  console.error('  Alternativas: MS_CLIENT_SECRET para el permiso de aplicación,');
  console.error('  o SMTP_USER y SMTP_PASS para SMTP.');
}

(async () => {
  if (graphReady()) return porGraph();
  if (SMTP_USER && SMTP_PASS) return porSmtp();
  explicarFaltante();
  process.exit(1);
})();
