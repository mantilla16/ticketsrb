/**
 * Validación de tokens de identidad de Microsoft Entra ID (Azure AD).
 *
 * El frontend obtiene un `id_token` con MSAL y lo manda aquí. Este módulo
 * comprueba la firma contra las claves públicas del inquilino y valida emisor,
 * audiencia y vigencia. Nunca se confía en el contenido del token sin esto:
 * un id_token sin verificar es texto que manda el navegador.
 *
 * No usa librerías de JWKS: Node sabe construir una clave pública desde un JWK
 * (`crypto.createPublicKey` con `format: 'jwk'`), así que basta con descargar
 * el juego de claves y elegir la que indica el encabezado.
 */

const { createPublicKey } = require('crypto');
const jwt = require('jsonwebtoken');

const TENANT    = process.env.MS_TENANT_ID || 'organizations';
const CLIENT_ID = process.env.MS_CLIENT_ID || null;

/* Las claves de firma de Microsoft rotan cada pocas semanas. Se cachean para
   no pedirlas en cada inicio de sesión, pero con caducidad para que una
   rotación no deje el login roto hasta el siguiente reinicio. */
const KEYS_TTL_MS = 12 * 60 * 60 * 1000;
let keysCache = { at: 0, keys: null };

async function fetchKeys(force = false) {
  const fresh = Date.now() - keysCache.at < KEYS_TTL_MS;
  if (!force && fresh && keysCache.keys) return keysCache.keys;

  const url = `https://login.microsoftonline.com/${TENANT}/discovery/v2.0/keys`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`No se pudieron obtener las claves de Microsoft (${resp.status})`);

  const { keys } = await resp.json();
  keysCache = { at: Date.now(), keys };
  return keys;
}

async function publicKeyFor(kid, allowRefetch = true) {
  const keys = await fetchKeys();
  const jwk = keys.find(k => k.kid === kid);
  if (!jwk) {
    // `kid` desconocido suele significar que Microsoft rotó las claves:
    // se reintenta una vez con la lista recién descargada.
    if (allowRefetch) {
      await fetchKeys(true);
      return publicKeyFor(kid, false);
    }
    throw new Error('La clave de firma del token no está en el juego de claves del inquilino');
  }
  return createPublicKey({ key: jwk, format: 'jwk' });
}

/** ¿Está configurado el login con Microsoft en este servidor? */
const isConfigured = () => Boolean(CLIENT_ID && process.env.MS_TENANT_ID);

/**
 * Verifica un id_token y devuelve los datos de la persona.
 * Lanza si el token no es válido para este inquilino y esta aplicación.
 */
async function verifyIdToken(idToken) {
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded?.header?.kid) throw new Error('Token de Microsoft con formato inválido');

  const key = await publicKeyFor(decoded.header.kid);

  // Entra emite dos formas de emisor según la configuración del inquilino.
  const issuers = [
    `https://login.microsoftonline.com/${process.env.MS_TENANT_ID}/v2.0`,
    `https://sts.windows.net/${process.env.MS_TENANT_ID}/`,
  ];

  const claims = jwt.verify(idToken, key, {
    algorithms: ['RS256'],
    audience: CLIENT_ID,
    issuer: issuers,
    clockTolerance: 120, // margen por desfase de reloj entre servidores
  });

  // `tid` amarra el token al inquilino de la firma. Sin esta comprobación, una
  // cuenta de cualquier otra organización con un token para nuestra app
  // entraría, aunque la aplicación esté registrada como de inquilino único.
  if (claims.tid !== process.env.MS_TENANT_ID) {
    throw new Error('El token pertenece a otro inquilino de Microsoft');
  }

  // Entra pone el correo en `preferred_username` casi siempre; `email` solo
  // aparece si se añadió como claim opcional, y `upn` en cuentas federadas.
  const email = (claims.email || claims.preferred_username || claims.upn || '').toLowerCase().trim();
  if (!email) throw new Error('El token de Microsoft no trae un correo');

  return {
    email,
    name: claims.name || email.split('@')[0],
    tenantId: claims.tid,
    objectId: claims.oid || null,
  };
}

module.exports = { verifyIdToken, isConfigured, TENANT, CLIENT_ID };
