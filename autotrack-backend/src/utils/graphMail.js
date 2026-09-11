/**
 * Envío de correo por Microsoft Graph.
 *
 * Es la alternativa a SMTP cuando el inquilino tiene verificación en dos pasos:
 * ahí la contraseña del buzón no sirve y las contraseñas de aplicación están
 * deshabilitadas. La aplicación se autentica con su propio registro —flujo de
 * credenciales de cliente— así que en el servidor no hay ninguna credencial
 * personal, solo un secreto que se puede rotar y revocar sin tocar cuentas.
 *
 * Requiere en el registro de Entra:
 *   · Permiso de APLICACIÓN (no delegado) `Mail.Send`, con consentimiento
 *     del administrador concedido.
 *   · Un secreto de cliente en MS_CLIENT_SECRET.
 *
 * Conviene acotar desde qué buzones puede enviar con una directiva de acceso
 * a aplicaciones (New-ApplicationAccessPolicy); sin ella, el permiso alcanza
 * a todos los buzones del inquilino.
 */

const TENANT = () => process.env.MS_TENANT_ID;
const CLIENT = () => process.env.MS_CLIENT_ID;
const SECRET = () => process.env.MS_CLIENT_SECRET;

/** ¿Está configurado el envío por Graph? */
const graphReady = () => Boolean(TENANT() && CLIENT() && SECRET());

/* El token dura una hora; se reutiliza hasta un minuto antes de caducar para
   no pedir uno nuevo en cada notificación. */
let cache = { token: null, expira: 0 };

async function getToken() {
  if (cache.token && Date.now() < cache.expira) return cache.token;

  const resp = await fetch(`https://login.microsoftonline.com/${TENANT()}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT(),
      client_secret: SECRET(),
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.error_description?.split('\n')[0] || `No se pudo obtener el token (${resp.status})`);
  }

  cache = { token: data.access_token, expira: Date.now() + (data.expires_in - 60) * 1000 };
  return cache.token;
}

/** Direcciones separadas por coma → el formato de destinatarios de Graph. */
const aDestinatarios = (lista) =>
  String(lista || '')
    .split(',')
    .map(d => d.trim())
    .filter(Boolean)
    .map(address => ({ emailAddress: { address } }));

/**
 * Envía un correo como `from`. Lanza si falla — quien llama decide si eso
 * debe interrumpir la operación o solo registrarse.
 */
async function enviarPorGraph({ from, to, subject, html, replyTo, attachments = [] }) {
  const token = await getToken();

  const message = {
    subject,
    body: { contentType: 'HTML', content: html },
    toRecipients: aDestinatarios(to),
    ...(replyTo ? { replyTo: aDestinatarios(replyTo) } : {}),
    ...(attachments.length ? {
      attachments: attachments.map(a => ({
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: a.filename,
        contentType: a.contentType || 'application/octet-stream',
        contentBytes: Buffer.from(a.content).toString('base64'),
      })),
    } : {}),
  };

  const resp = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(from)}/sendMail`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, saveToSentItems: true }),
    },
  );

  if (!resp.ok) {
    const texto = await resp.text();
    throw new Error(`Graph respondió ${resp.status}: ${texto.slice(0, 300)}`);
  }
}

/** Traduce los errores típicos de Graph a qué hay que tocar en Azure. */
function explicarGraph(err) {
  const t = err.message || '';
  if (/AADSTS7000215|invalid_client/i.test(t)) {
    return 'El secreto de cliente no es válido o caducó. Genera uno nuevo en el registro de la aplicación (Certificados y secretos) y actualiza MS_CLIENT_SECRET.';
  }
  if (/ErrorAccessDenied|Access is denied|403/i.test(t)) {
    return 'Falta el permiso de APLICACIÓN Mail.Send con consentimiento del administrador, o una directiva de acceso está bloqueando este buzón.';
  }
  if (/ResourceNotFound|404/i.test(t)) {
    return 'El buzón remitente no existe en el inquilino. Revisa MAIL_FROM.';
  }
  if (/AADSTS900023|AADSTS90002/i.test(t)) {
    return 'El identificador de inquilino no es correcto. Revisa MS_TENANT_ID.';
  }
  return t;
}

module.exports = { enviarPorGraph, graphReady, explicarGraph };
