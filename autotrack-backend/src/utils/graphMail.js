/**
 * Envío de correo por Microsoft Graph.
 *
 * Dos modos, en orden de preferencia:
 *
 *   DELEGADO  — envía como la persona que autorizó una vez con
 *               `node scripts/autorizar-correo.js`. Lo consiente ella misma:
 *               `Mail.Send` delegado no necesita administrador global. Solo
 *               puede enviar como esa persona, y lo que queda en el servidor
 *               es un refresh token que se revoca desde la propia cuenta sin
 *               tocar nada más.
 *
 *   APLICACIÓN — usa un secreto de aplicación. No depende de ninguna persona,
 *               pero `Mail.Send` de aplicación permite enviar COMO CUALQUIER
 *               buzón del inquilino, así que exige consentimiento de
 *               administrador y conviene acotarlo con una directiva de acceso
 *               (New-ApplicationAccessPolicy). Es el plan B.
 *
 * Este módulo es lo único que sabe de Microsoft: si mañana la firma cambia de
 * proveedor, se cambia aquí y nada más.
 */

const fs = require('fs');
const path = require('path');

const AUTORIDAD = 'https://login.microsoftonline.com';
const GRAPH     = 'https://graph.microsoft.com/v1.0';

/* `offline_access` es lo que hace que Microsoft entregue un refresh token; sin
   él habría que iniciar sesión cada hora, que es justo lo que un servidor no
   puede hacer. */
const ALCANCE_DELEGADO = 'offline_access https://graph.microsoft.com/Mail.Send';

const TENANT = () => process.env.MS_TENANT_ID;
const CLIENT = () => process.env.MS_CLIENT_ID;
const SECRET = () => process.env.MS_CLIENT_SECRET;

/** Dónde vive el refresh token. Es una credencial viva, no va al repositorio. */
const rutaToken = () =>
  process.env.MAIL_TOKEN_FILE || path.join(__dirname, '../../correo-token.json');

function leerRefresh() {
  try {
    return JSON.parse(fs.readFileSync(rutaToken(), 'utf8')).refresh_token || null;
  } catch {
    return null;
  }
}

/**
 * Guarda el refresh token con permisos restringidos. Se escribe en un temporal
 * y se renombra: un reemplazo a medias dejaría el archivo truncado y el correo
 * caído hasta volver a autorizar. El renombrado es atómico.
 */
function guardarRefresh(token) {
  const ruta = rutaToken();
  const tmp = `${ruta}.nuevo`;
  fs.writeFileSync(tmp, JSON.stringify({ refresh_token: token, guardado: new Date().toISOString() }), { mode: 0o600 });
  fs.renameSync(tmp, ruta);
}

/** Modo efectivo según lo que haya configurado. */
function modo() {
  if (!TENANT() || !CLIENT()) return null;
  if (leerRefresh()) return 'DELEGADO';
  if (SECRET())      return 'APLICACION';
  return null;
}

const graphReady = () => modo() !== null;

/* El token de acceso dura una hora. Se reutiliza hasta un minuto antes de
   caducar: pedir uno por cada correo funcionaría, pero Microsoft limita la
   tasa de peticiones al endpoint de tokens. */
let cache = { valor: null, vence: 0 };
const olvidarToken = () => { cache = { valor: null, vence: 0 }; };

async function pedirToken() {
  if (cache.valor && Date.now() < cache.vence) return cache.valor;

  const campos = modo() === 'DELEGADO'
    ? {
        client_id: CLIENT(),
        scope: ALCANCE_DELEGADO,
        grant_type: 'refresh_token',
        refresh_token: leerRefresh(),
      }
    : {
        client_id: CLIENT(),
        client_secret: SECRET(),
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      };

  const resp = await fetch(`${AUTORIDAD}/${TENANT()}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(campos),
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.error_description?.split('\n')[0] || `No se pudo obtener el token (${resp.status})`);
  }

  // Microsoft rota el refresh token en cada uso: si no se guarda el nuevo, el
  // viejo acaba caducando y el correo se cae semanas después sin motivo claro.
  if (data.refresh_token) guardarRefresh(data.refresh_token);

  cache = { valor: data.access_token, vence: Date.now() + (data.expires_in - 60) * 1000 };
  return cache.valor;
}

/** Direcciones separadas por coma → el formato de destinatarios de Graph. */
const aDestinatarios = (lista) =>
  String(lista || '').split(',').map(d => d.trim()).filter(Boolean)
    .map(address => ({ emailAddress: { address } }));

async function enviarPorGraph({ from, to, subject, html, replyTo, attachments = [] }) {
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

  // Con permiso delegado el único buzón accesible es el de quien autorizó, y
  // se llega por /me. Pedir /users/{alguien} daría 403 aunque sea esa misma
  // persona.
  const url = modo() === 'DELEGADO'
    ? `${GRAPH}/me/sendMail`
    : `${GRAPH}/users/${encodeURIComponent(from)}/sendMail`;

  const mandar = async () => {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await pedirToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, saveToSentItems: true }),
    });
    if (!resp.ok) throw new Error(`Graph respondió ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  };

  try {
    await mandar();
  } catch (err) {
    // Si el permiso se concede mientras había un token cacheado, ese token
    // sigue sin traerlo y todo seguiría fallando aunque en Azure ya esté bien.
    // Se tira el token y se reintenta una vez.
    if (!/403/.test(err.message)) throw err;
    olvidarToken();
    await mandar();
  }
}

/* ── Autorización delegada: flujo de código de dispositivo ──────────────────
   Se usa este flujo porque el servidor no tiene navegador ni URI de
   redirección. En el registro hace falta «Permitir flujos de cliente público»
   activado y el permiso DELEGADO Mail.Send. */

async function iniciarDispositivo() {
  const resp = await fetch(`${AUTORIDAD}/${TENANT()}/oauth2/v2.0/devicecode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT(), scope: ALCANCE_DELEGADO }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error_description || `Error ${resp.status}`);
  return data;
}

/**
 * Devuelve [estado, datos] mientras se espera la aprobación.
 * `authorization_pending` y `slow_down` no son errores: son la forma en que
 * Microsoft dice «todavía no» y «pregunta más despacio».
 */
async function consultarDispositivo(deviceCode) {
  const resp = await fetch(`${AUTORIDAD}/${TENANT()}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT(),
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      device_code: deviceCode,
    }),
  });
  const data = await resp.json();
  if (resp.ok) return ['listo', data];
  if (data.error === 'authorization_pending') return ['pendiente', {}];
  if (data.error === 'slow_down')             return ['lento', {}];
  return ['rechazado', data];
}

/** Traduce los errores típicos de Graph a qué hay que tocar en Azure. */
function explicarGraph(err) {
  const t = err.message || '';
  if (/AADSTS7000218|public client/i.test(t)) {
    return 'Falta activar «Permitir flujos de cliente público» en el registro de la aplicación (Autenticación → Configuración avanzada).';
  }
  if (/AADSTS7000215|invalid_client/i.test(t)) {
    return 'El secreto de cliente no es válido o caducó. Genera uno nuevo en Certificados y secretos y actualiza MS_CLIENT_SECRET.';
  }
  if (/invalid_grant|AADSTS70008|AADSTS50173/i.test(t)) {
    return 'La autorización caducó o se revocó. Vuelve a ejecutar: node scripts/autorizar-correo.js';
  }
  if (/ErrorAccessDenied|Access is denied|403/i.test(t)) {
    return 'Falta el permiso Mail.Send, o el consentimiento no se ha concedido, o una directiva de acceso bloquea este buzón.';
  }
  if (/ResourceNotFound|404/i.test(t)) {
    return 'El buzón remitente no existe en el inquilino. Revisa MAIL_FROM.';
  }
  if (/AADSTS900023|AADSTS90002/i.test(t)) {
    return 'El identificador de inquilino no es correcto. Revisa MS_TENANT_ID.';
  }
  return t;
}

module.exports = {
  enviarPorGraph, graphReady, explicarGraph, modo,
  iniciarDispositivo, consultarDispositivo, guardarRefresh, rutaToken,
};
