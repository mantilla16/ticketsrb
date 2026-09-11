/**
 * Inicio de sesión con Microsoft Entra ID.
 *
 * La configuración —id de cliente e id de inquilino— la entrega el backend en
 * `/api/auth/config`, no está escrita aquí: así el mismo bundle sirve para
 * desarrollo y producción, y cambiar de inquilino no obliga a recompilar.
 *
 * MSAL se carga bajo demanda (import dinámico) para que su peso no entre en
 * el bundle inicial de quien ya tiene la sesión abierta.
 *
 * ── Los cinco estados del flujo ───────────────────────────────────────────
 *
 * Conviene tenerlos juntos, porque los errores de este módulo vienen siempre
 * de atender uno y olvidar otro:
 *
 *   1. Carga normal, sin fragmento en la URL
 *      No hay nada que completar. Se muestra el botón.
 *
 *   2. Clic en el botón
 *      `signIn` redirige a Microsoft. La página se abandona; no retorna.
 *
 *   3. Vuelta con éxito (#code=…)
 *      `completeRedirect` canjea el código, devuelve el id_token y limpia el
 *      fragmento. Solo puede ocurrir UNA vez por carga de página.
 *
 *   4. Vuelta con error (#error=…)
 *      Igual que el 3, pero `handleRedirectPromise` lanza. Se traduce el
 *      error y se limpia el fragmento para que una recarga no lo repita.
 *
 *   5. Cierre de sesión
 *      NO recarga la página, así que este módulo sigue vivo con su estado.
 *      Hay que invalidar la redirección pendiente y borrar la caché, o el
 *      siguiente montaje de la pantalla de acceso vuelve a entrar solo.
 */

let instance = null;
let loading  = null;
let configuracion = null;   // se recuerda para poder cerrar sesión sin recibirla

/* Se mira el fragmento UNA vez, al cargar el módulo, antes de que MSAL o el
   enrutador lo limpien. Sirve para saber si esta carga viene de vuelta de
   Microsoft: sin esta comprobación, `handleRedirectPromise` devuelve el
   resultado cacheado del login anterior y vuelve a iniciar sesión sola,
   justo después de cerrarla. */
const VIENE_DE_MICROSOFT =
  typeof window !== 'undefined' && /[#&](code|error|id_token|state)=/.test(window.location.hash);

/* Una carga de página puede completar como máximo UNA redirección.
   Sin este candado, cerrar sesión —que no recarga— volvía a montar la pantalla
   de acceso, que llamaba otra vez a handleRedirectPromise() y recibía el
   resultado cacheado del inicio anterior: entraba de nuevo al instante. Y
   limpiar la caché no bastaba, porque es asíncrona y la pantalla se monta
   antes de que termine. */
let redireccionConsumida = false;

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
    configuracion = { msClientId, msTenantId };
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
  // Ya se procesó (o se descartó) en esta carga: no se vuelve a intentar.
  if (redireccionConsumida) return null;
  redireccionConsumida = true;
  // Solo hay algo que completar si esta carga trae la respuesta de Microsoft.
  if (!VIENE_DE_MICROSOFT) return null;
  try {
    const app = await getInstance(config);
    const result = await app.handleRedirectPromise();
    return result?.idToken || null;
  } finally {
    // El fragmento se retira siempre, haya salido bien o mal. Si se queda, al
    // cerrar sesión la aplicación vuelve a creer que viene de Microsoft e
    // intenta completar un código ya consumido, y el botón se queda colgado.
    limpiarFragmento();
  }
}

/** Quita el #code=… de la barra de direcciones sin recargar ni navegar. */
export function limpiarFragmento() {
  try {
    if (!window.location.hash) return;
    window.history.replaceState({}, '', window.location.pathname + window.location.search);
  } catch { /* sin history: no es crítico */ }
}

/**
 * Borra lo que MSAL guardó en este navegador.
 *
 * Hace falta al cerrar sesión: si la cuenta y los tokens siguen en la caché,
 * el siguiente inicio de sesión no vuelve a preguntar nada y da la sensación
 * de que cerrar sesión no funciona.
 *
 * No cierra la sesión del lado de Microsoft a propósito —eso sacaría a la
 * persona de Outlook y del resto de aplicaciones de la firma—, solo la de
 * esta aplicación.
 */
export async function signOut(config) {
  // Cerrar sesión invalida cualquier redirección pendiente: si quedara viva,
  // el siguiente montaje de la pantalla de acceso volvería a entrar.
  redireccionConsumida = true;
  const cfg = config?.msClientId ? config : configuracion;
  try {
    if (instance || cfg?.msClientId) {
      const app = await getInstance(cfg);
      await app.clearCache();
    }
  } catch {
    // Que falle la limpieza no debe impedir cerrar sesión.
  }
  // Cerrar sesión no recarga la página, así que un #code= de la entrada
  // anterior seguiría en la barra de direcciones.
  limpiarFragmento();
  // Red de seguridad: si MSAL no llegó a instanciarse, sus claves pueden
  // haber quedado igualmente. Se retiran a mano.
  try {
    for (const k of Object.keys(window.localStorage)) {
      if (k.startsWith('msal.') || k.includes('login.microsoftonline.com')) {
        window.localStorage.removeItem(k);
      }
    }
  } catch { /* almacenamiento bloqueado: nada que limpiar */ }
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
