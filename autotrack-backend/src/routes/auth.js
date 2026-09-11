const router = require('express').Router();
const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const auth = require('../middleware/auth');
const entraId = require('../utils/entraId');

// Red de seguridad por IP — amplia, solo frena ataques masivos desde una misma red
const ipLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones desde esta red. Intenta de nuevo en unos minutos.' },
});

const LOCK_MINUTES = 30;
// Dominio institucional permitido. Configurable por entorno para que la misma
// base sirva a distintas firmas sin tocar código (Russell Bedford por defecto).
const ALLOWED_DOMAIN = '@' + (process.env.AUTH_ALLOWED_DOMAIN || 'rbcol.co')
  .replace(/^@/, '')
  .toLowerCase();

// Atajo de login para desarrollo local. Doble candado: nunca en producción, y
// además hay que pedirlo explícitamente con ALLOW_DEV_LOGIN=true.
const DEV_LOGIN_ENABLED =
  process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEV_LOGIN === 'true';

function genInitials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');
}

function makeToken(user) {
  return jwt.sign(
    {
      id:         user.id,
      name:       user.name,
      email:      user.email,
      initials:   user.initials,
      colorIndex: user.color_index,
      role:       user.role || 'user',
    },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );
}

function fmtUser(row) {
  return {
    id:         row.id,
    name:       row.name,
    email:      row.email,
    initials:   row.initials,
    colorIndex: row.color_index,
    role:       row.role || 'user',
  };
}

// GET /api/auth/me
router.get('/me', auth, (req, res) => res.json(req.user));

// GET /api/auth/config — lo que el frontend necesita para armar el inicio de
// sesión. Todo es público: el id de cliente y el de inquilino no son secretos.
router.get('/config', (_req, res) => {
  res.json({
    msClientId: entraId.CLIENT_ID,
    msTenantId: process.env.MS_TENANT_ID || null,
    devLogin: DEV_LOGIN_ENABLED, // el front solo muestra el atajo si el server lo tiene activo
    allowedDomain: ALLOWED_DOMAIN.slice(1), // pista en pantalla y filtro de cuentas
  });
});

// POST /api/auth/microsoft — inicio de sesión con la cuenta de Microsoft 365
// de la firma. El frontend consigue el id_token con MSAL; aquí se verifica la
// firma contra las claves del inquilino antes de creer nada de su contenido.
router.post('/microsoft', ipLimiter, async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ error: 'Token de Microsoft requerido' });
  if (!entraId.isConfigured()) {
    return res.status(503).json({ error: 'El inicio de sesión con Microsoft no está configurado en el servidor' });
  }

  let profile;
  try {
    profile = await entraId.verifyIdToken(idToken);
  } catch (err) {
    console.warn('Token de Microsoft rechazado:', err.message);
    return res.status(401).json({ error: 'No se pudo validar tu sesión de Microsoft' });
  }

  try {
    const { email, name } = profile;
    if (!email.endsWith(ALLOWED_DOMAIN)) {
      return res.status(403).json({ error: `Solo se permiten cuentas institucionales ${ALLOWED_DOMAIN}` });
    }

    let user = (await pool.query('SELECT * FROM users WHERE email = $1', [email])).rows[0];

    if (user && user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(429).json({
        error: `Cuenta bloqueada por múltiples intentos fallidos. Intenta de nuevo en ${LOCK_MINUTES} minutos, o contacta al administrador para desbloquearla antes.`,
        locked: true,
      });
    }

    if (!user) {
      // Primera vez: entra como auditor solicitante. La contraseña es aleatoria
      // y nunca se usa — el acceso es siempre por Microsoft.
      const count = await pool.query('SELECT COUNT(*) FROM users');
      const colorIndex = parseInt(count.rows[0].count) % 8;
      const hash = await bcrypt.hash(require('crypto').randomBytes(24).toString('hex'), 12);
      user = (await pool.query(
        'INSERT INTO users (name, email, password, initials, color_index, role) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
        [name, email, hash, genInitials(name), colorIndex, 'user']
      )).rows[0];
    } else {
      await pool.query('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = $1', [user.id]);
    }

    res.json({ token: makeToken(user), user: fmtUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ─────────────────────────── Atajo de desarrollo ───────────────────────────
// El login real es exclusivamente Microsoft Entra ID restringido al dominio
// institucional, así que en localhost no se puede entrar sin registrar
// http://localhost:5173 como URI de redirección en el registro de la
// aplicación. Estas dos rutas permiten entrar como cualquier usuario ya
// existente en la base, sin Microsoft ni clave.
//
// Con NODE_ENV=production (el servidor) el bloque no se ejecuta y las rutas
// caen en el 404 genérico de src/index.js.
// ───────────────────────────────────────────────────────────────────────────
if (DEV_LOGIN_ENABLED) {

  // GET /api/auth/dev-users — poblar el selector de usuarios del login en dev
  router.get('/dev-users', async (_req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT email, name, COALESCE(role, 'engineer') AS role
         FROM users ORDER BY role, name`
      );
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error del servidor' });
    }
  });

  // POST /api/auth/dev-login — emite un JWT para un usuario existente
  router.post('/dev-login', async (req, res) => {
    const email = (req.body?.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Correo requerido' });
    try {
      const user = (await pool.query('SELECT * FROM users WHERE email = $1', [email])).rows[0];
      if (!user) {
        return res.status(404).json({
          error: `No existe el usuario ${email}. Corre "npm run seed:local" para crear los de prueba.`,
        });
      }
      // Un bloqueo por intentos fallidos no debe estorbar en local
      await pool.query(
        'UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = $1',
        [user.id]
      );
      res.json({ token: makeToken(user), user: fmtUser(user) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error del servidor' });
    }
  });
}

module.exports = router;
