# Mesa de Servicio — entorno local

Cómo levantar el proyecto en un PC Windows.

En producción el acceso es solo Google OAuth, restringido al dominio que
indique `AUTH_ALLOWED_DOMAIN` en el `.env` del backend (por defecto
`russellbedford.com.co`). En local no hace falta: hay un atajo de acceso.

---

## Arranque diario (si ya está configurado)

Dos terminales:

```
cd C:\Autotrack\autotrack\autotrack-backend
npm run dev
```

```
cd C:\Autotrack\autotrack\autotrack-frontend
npm run dev
```

- API → http://localhost:3001
- App → http://localhost:5173

En el login aparece un recuadro **"Acceso local de desarrollo"** con
un selector de usuarios. Elige uno y entra sin Google.

---

## Instalación desde cero

### 1. Requisitos

- Node.js 18+ (probado con v26.7.0)
- PostgreSQL 14+ corriendo en `localhost:5432`

### 2. Rol y base de datos

Una sola vez, como superusuario. **En `cmd.exe`** (con comillas dobles y sin `&`):

```
cd C:\Autotrack\autotrack\autotrack-backend
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h localhost -f db\bootstrap.local.sql
```

En PowerShell la misma línea va con `&` delante y comillas simples:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -U postgres -h localhost -f db\bootstrap.local.sql
```

Crea el rol `autotrack` (clave `autotrack123`, solo para local) y la base
`autotrack`. Es idempotente.

### 3. Backend

```
cd C:\Autotrack\autotrack\autotrack-backend
npm install
npm run db:schema
npm run seed:local
npm run dev
```

- `npm run db:schema` aplica [`db/schema.full.sql`](autotrack-backend/db/schema.full.sql).
- `npm run seed:local` crea los datos de prueba.
- Ambos van por el driver `pg`, así que **no** hace falta `psql` en el PATH.

### 4. Frontend

```
cd C:\Autotrack\autotrack\autotrack-frontend
npm install
npm run dev
```

---

## Usuarios de prueba

Dominio ficticio `@autotrack.local` a propósito: nunca puede chocar con una
cuenta real del dominio institucional.

| Usuario | Correo | Rol | Qué ve |
|---|---|---|---|
| Ana Admin | `admin@autotrack.local` | `admin` | Todo — coordinación de la mesa |
| Luis Líder Analítica | `lider.analitica@autotrack.local` | `leader_analytics` | Todo, gestiona Analítica |
| Mara Miembro Analítica | `miembro.analitica@autotrack.local` | `member_analytics` | Analítica + compartidos |
| Iván Ingeniero | `ingeniero@autotrack.local` | `engineer` | Todo menos Analítica |
| Elena Ingeniera | `ingeniera@autotrack.local` | `engineer` | Todo menos Analítica |
| Sara Solicitante | `solicitante@autotrack.local` | `user` | Solo sus solicitudes |

La semilla es re-ejecutable: `npm run seed:local` no duplica nada.

---

## Cómo funciona el login local

El backend expone `/api/auth/dev-login` y `/api/auth/dev-users` **solo** si se
cumplen las dos condiciones a la vez:

1. `NODE_ENV !== 'production'`
2. `ALLOW_DEV_LOGIN=true`

En el servidor (`NODE_ENV=production`) las rutas ni se registran: responden 404
como cualquier ruta desconocida.

En el frontend, el panel además está envuelto en `import.meta.env.DEV`, que Vite
reemplaza por `false` al compilar, así que Rollup lo elimina del bundle de
producción.

Para usar Google en local en lugar del atajo, hay que registrar
`http://localhost:5173` como origen JavaScript autorizado en el cliente OAuth de
Google Cloud Console y poner el `GOOGLE_CLIENT_ID` en el `.env`.

---

## El `.env`

El `.env` local **no** lleva credenciales de Google, Gmail ni Calendar, y eso es
deliberado: `src/utils/mailer.js` y `src/utils/calendar.js` se desactivan solos
cuando faltan (devuelven `null` y no hacen nada). Así una corrida local nunca
envía correos ni crea eventos de calendario reales.

Si alguna vez copias el `.env` de producción a tu PC, **la app enviará correos de
verdad a usuarios reales**. El de producción está guardado fuera del repo en
`C:\Autotrack\.env.produccion.bak`.

---

## Notas sobre el esquema

`db/schema.sql` (el original) está incompleto: no crea `project_tasks` ni
`solicitudes`, y a `projects` le faltan 10 columnas y los estados `soporte` y
`cancelado`. Una base creada solo con ese archivo falla en el primer
`GET /api/projects`. En producción las tablas existen porque se crearon a mano.

`db/schema.full.sql` es la reconstrucción completa a partir del código. Es
idempotente y se puede correr sobre una base con datos.

Tablas que el código crea en caliente al arrancar (no hace falta hacer nada):

- `project_assignees` — `ensureAssigneesTable()` en `src/routes/projects.js`
- `notifications` — `ensureTable()` en `src/utils/notify.js`
- columnas `assignee_id` y `weight` de `project_tasks` — `ensureTaskColumns()`

---

## Problemas conocidos

**`npm run build` falla con `MODULE_NOT_FOUND` de rollup.**
El `node_modules` se instaló en otra plataforma (aparece
`@rollup/rollup-linux-x64-gnu` en Windows). Solución:

```
cd C:\Autotrack\autotrack\autotrack-frontend
rmdir /s /q node_modules
npm install
```

**Un script que usa `src/config/database.js` nunca termina.**
Ese módulo hace un `pool.connect(cb)` de arranque y no libera el cliente, así que
`pool.end()` espera para siempre. Por eso `db/apply-schema.js` y
`db/seed.local.js` crean su propio `Pool`.
