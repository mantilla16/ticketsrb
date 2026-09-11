/**
 * Inicio de sesión con Microsoft Entra ID.
 *
 * La configuración —id de cliente e id de inquilino— la entrega el backend en
 * `/api/auth/config`, no está escrita aquí: así el mismo bundle sirve para
 * desarrollo y producción, y cambiar de inquilino no obliga a recompilar.
 *
 * MSAL se carga bajo demanda (import dinámico) para que su peso no entre en
 * el bundle inicial de quien ya tiene la sesión abierta.
 */

let instance = null;
let loading  = null;

/** Crea —una sola vez— la instancia de MSAL con la configuración del servidor. */
async function getInstance({ msClientId, msTenantId }) {
  if (instance) return instance;
  if (loading) return loading;

  loading = (async () => {
    const { PublicClientApplication } = await import('@azure/msal-browser');
    const app = new PublicClientApplication({
      auth: {
        clientId: msClientId,
        authority: `https://login.microsoftonline.com/${msTenantId}`,
        redirectUri: window.location.origin,
      },
      cache: {
        // La sesión de la aplicación la gobierna nuestro propio JWT con su
        // límite de inactividad; MSAL solo necesita durar lo que dura la
        // pestaña, así que no deja rastro en localStorage.
        cacheLocation: 'sessionStorage',
        storeAuthStateInCookie: false,
      },
    });
    await app.initialize();
    instance = app;
    return app;
  })();

  return loading;
}

/**
 * Abre la ventana de Microsoft y devuelve el id_token para que el backend lo
 * verifique. `loginHint` con el dominio de la firma hace que Entra proponga
 * directamente la cuenta institucional.
 */
export async function signIn(config) {
  const app = await getInstance(config);
  const result = await app.loginPopup({
    scopes: ['openid', 'profile', 'email'],
    prompt: 'select_account',
    ...(config.allowedDomain ? { domainHint: config.allowedDomain } : {}),
  });
  if (!result?.idToken) throw new Error('Microsoft no devolvió un token de identidad');
  return result.idToken;
}

/** Cierra también la sesión del lado de Microsoft en esta pestaña. */
export async function signOut(config) {
  try {
    if (!instance && !config?.msClientId) return;
    const app = await getInstance(config);
    const account = app.getAllAccounts()[0];
    if (account) await app.clearCache({ account });
  } catch {
    // Que no se pueda limpiar la caché de MSAL no debe impedir cerrar sesión.
  }
}

/**
 * Traduce los errores de MSAL a algo que el usuario pueda accionar.
 * Los códigos vienen de @azure/msal-browser.
 */
export function describeError(err) {
  const code = err?.errorCode || '';
  if (code === 'user_cancelled' || code === 'popup_window_error' && /closed/i.test(err.message || '')) {
    return 'Cancelaste el inicio de sesión.';
  }
  if (code === 'popup_window_error' || code === 'empty_window_error') {
    return 'El navegador bloqueó la ventana de Microsoft. Permite las ventanas emergentes de este sitio y vuelve a intentarlo.';
  }
  if (code === 'interaction_in_progress') {
    return 'Ya hay un inicio de sesión en curso. Espera un momento o recarga la página.';
  }
  if (/AADSTS50011/.test(err?.message || '')) {
    return 'La dirección de esta página no está registrada como URI de redirección en Azure. Agrégala en el registro de la aplicación (plataforma SPA).';
  }
  if (/AADSTS700016|AADSTS90002/.test(err?.message || '')) {
    return 'El registro de la aplicación no existe en este inquilino. Revisa MS_CLIENT_ID y MS_TENANT_ID en el servidor.';
  }
  return err?.message || 'No se pudo iniciar sesión con Microsoft.';
}
