/**
 * Autoriza el envío de correo UNA vez, con permiso delegado.
 *
 *   node scripts/autorizar-correo.js
 *
 * Imprime un código, lo escribes en microsoft.com/devicelogin desde cualquier
 * navegador, inicias sesión y aceptas. El servidor guarda un refresh token y
 * renueva su acceso solo: no hay que repetirlo.
 *
 * Por qué este camino y no un permiso de aplicación: `Mail.Send` de aplicación
 * deja enviar como cualquiera del inquilino, y por eso exige consentimiento de
 * un administrador global. El delegado solo deja enviar como tú, y por eso lo
 * puedes consentir tú mismo. Menos poder, menos permisos que pedir.
 *
 * Se usa el flujo de código de dispositivo porque el servidor no tiene
 * navegador ni URI de redirección. En el registro de la aplicación hacen falta
 * dos cosas:
 *
 *   · Autenticación → Configuración avanzada →
 *     «Permitir flujos de cliente público» = Sí
 *   · Permisos de API → Microsoft Graph → Permisos DELEGADOS → Mail.Send
 */

require('dotenv').config();
const G = require('../src/utils/graphMail');

const espera = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  for (const v of ['MS_TENANT_ID', 'MS_CLIENT_ID']) {
    if (!process.env[v]) {
      console.error(`Falta ${v} en el .env.`);
      process.exit(1);
    }
  }

  let d;
  try {
    d = await G.iniciarDispositivo();
  } catch (err) {
    console.error(`\nNo se pudo iniciar la autorización: ${err.message}\n`);
    console.error('Si menciona «public client», falta activar en el registro:');
    console.error('  Autenticación → Configuración avanzada →');
    console.error('  «Permitir flujos de cliente público» = Sí');
    process.exit(1);
  }

  const quien = process.env.MAIL_FROM || 'tu cuenta institucional';
  console.log('\n' + '='.repeat(62));
  console.log(`  1. Abre    ${d.verification_uri}`);
  console.log(`  2. Escribe el código   ${d.user_code}`);
  console.log(`  3. Inicia sesión con ${quien}`);
  console.log('     y acepta el permiso de enviar correo en tu nombre.');
  console.log('='.repeat(62));
  console.log(`\nEl código vence en ${Math.floor((d.expires_in || 900) / 60)} minutos.\nEsperando…`);

  let intervalo = (d.interval || 5) * 1000;
  const limite = Date.now() + (d.expires_in || 900) * 1000;

  while (Date.now() < limite) {
    await espera(intervalo);
    let estado, datos;
    try {
      [estado, datos] = await G.consultarDispositivo(d.device_code);
    } catch (err) {
      console.error(`\nFALLO: ${err.message}`);
      process.exit(1);
    }

    if (estado === 'pendiente') { process.stdout.write('.'); continue; }
    if (estado === 'lento')     { intervalo += 5000; continue; }

    if (estado === 'listo') {
      G.guardarRefresh(datos.refresh_token);
      console.log('\n\nAutorizado.');
      console.log(`El token quedó en ${G.rutaToken()}`);
      console.log('\nComprueba con:');
      console.log(`  node scripts/probar-correo.js ${process.env.MAIL_FROM || 'tu-correo@rbcol.co'}`);
      console.log('\nY reinicia el servicio:  sudo systemctl restart mesa-servicio');
      process.exit(0);
    }

    console.error(`\n\nRECHAZADO: ${datos.error} — ${(datos.error_description || '').slice(0, 300)}`);
    process.exit(1);
  }

  console.error('\n\nSe agotó el tiempo sin que nadie aprobara el código.');
  process.exit(1);
})();
