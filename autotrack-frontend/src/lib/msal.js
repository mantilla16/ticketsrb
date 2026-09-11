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
        // Tiene que incluir la ruta base: con la aplicación bajo /mesa, el
        // `origin` a secas devolvería a la raíz —donde vive otra aplicación—
        // y además no coincidiría con la URI registrada en Entra.
        // BASE_URL ya termina en «/», así que la URI a registrar es ésta tal cual.
        redirectUri: window.location.origin + import.meta.env.BASE_URL,
      },
      cache: {
        // El estado del intercambio tiene que sobrevivir a la ida y vuelta a
        // Microsoft. sessionStorage se pierde si el navegador restaura la
        // pestaña en otro contexto; con localStorage el flujo aguanta.
        // La sesión de la aplicación sigue gobernada por nuestro propio JWT y
        // su límite de inactividad — esto solo guarda el estado de MSAL.
        cacheLocation: 'localStorage',
        storeAuthStateInCookie: false,
      },
    });
    await app.initialize();
    instance = app;
    return app;
  })();

  return loading;
}

const REQUEST = (config) => ({
  scopes: ['openid', 'profile', 'email'],
  prompt: 'select_account',
  // Propone directamente la cuenta institucional en vez de preguntar primero
  // de qué organización es.
  ...(config.allowedDomain ? { domainHint: config.allowedDomain } : {}),
});

/**
 * Lleva a la página de Microsoft. No retorna: la pestaña navega y el flujo lo
 * termina `completeRedirect` al volver.
 *
 * Se usa redirección y no ventana emergente a propósito. Con `loginPopup` la
 * aplicación se cargaba dentro del popup, que es un contexto distinto: no ve
 * el `sessionStorage` donde MSAL dejó el verificador PKCE, así que al intentar
 * canjear el código fallaba con `no_token_request_cache_error`. Además las
 * políticas de los equipos corporativos suelen bloquear las ventanas
 * emergentes. La redirección no tiene ninguno de los dos problemas.
 */
export async function signIn(config) {
  const app = await getInstance(config);
  await app.loginRedirect(REQUEST(config));
  return null;
}

/**
 * Termina el inicio de sesión al volver de Microsoft. Se llama al cargar la
 * pantalla de acceso: devuelve el id_token si venimos de vuelta, y null en una
 * carga normal.
 */
export async function completeRedirect(config) {
  if (!config?.msClientId || !config?.msTenantId) return null;
  const app = await getInstance(config);
  const result = await app.handleRedirectPromise();
  return result?.idToken || null;
}

/** Limpia la caché de MSAL en este navegador. */
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
  if (code === 'user_cancelled') return 'Cancelaste el inicio de sesión.';
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
