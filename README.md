# Mesa de Servicio — Russell Bedford Barranquilla

Sistema interno de tickets. Los auditores radican solicitudes de apoyo (papeles
de trabajo, analítica de datos, automatización, extracción de información) y la
mesa las clasifica, las compromete con un SLA y las ejecuta.

El objeto central es el **ticket**. Cuando un ticket se acepta y se le asigna
responsable, se abre automáticamente el **trabajo** (proyecto) que lo
materializa, con su tablero, cronograma y bitácora de avance.

## Stack

- **Backend** — Node.js + Express + PostgreSQL
- **Frontend** — React 18 + Vite (CSS propio, sin framework de UI)
- **Acceso** — Microsoft Entra ID (Microsoft 365) restringido al dominio institucional, sesión JWT

---

## Estructura

```
autotrack/
├── autotrack-backend/          API REST
│   ├── src/routes/             auth · users · projects · solicitudes · notifications
│   ├── src/utils/              correo, notificaciones, calendario
│   └── db/                     schema.full.sql, bootstrap y seed local
└── autotrack-frontend/         SPA
    └── src/
        ├── lib/tickets.js      modelo de dominio: estados, prioridades, SLA, roles
        ├── styles/tokens.css   ← toda la identidad visual vive aquí
        ├── styles/             base · ui · shell · tickets · login · legacy
        ├── components/ui/      primitivas (botón, campo, badge, modal, panel…)
        ├── components/tickets/ bandeja, detalle, formulario, tablero, reportes
        └── components/         vistas de ejecución (proyectos, cronograma, panel)
```

### Identidad visual

Aplicada según el manual «Lineamientos de Diseño» de Russell Bedford. Todo el
color, la tipografía, los radios y las sombras salen de
`autotrack-frontend/src/styles/tokens.css`; no hay colores de marca escritos en
los componentes, así que ese archivo reviste la aplicación completa, incluidas
las vistas heredadas.

**Paleta oficial**

| Color | HEX | Uso en la interfaz |
|---|---|---|
| Azul marino | `#001871` | Color principal: barra lateral, acciones primarias, estado «Aceptado» |
| Cian | `#00A9CE` | Acentos, estado «Recibido» |
| Turquesa | `#00BFB3` | Estado «En ejecución», resultados favorables |
| Magenta | `#981D97` | Estado «Reunión agendada» |
| Naranja | `#ED8B00` | Estado «En revisión», advertencias |
| Gris | `#8F9393` | Estado «No procede», elementos neutros |

De cada color se derivan un tono oscuro (`-ink`) para texto pequeño y un tinte
claro (`-tint`) para fondos de etiqueta: los planos no alcanzan contraste AA
sobre blanco. Es una derivación del mismo matiz, no un color nuevo.

**Única desviación del manual.** El manual no define un color de alerta y la
mesa necesita señalar un SLA vencido de forma inequívoca. Se usa un rojo
(`--rb-alert: #C4122F`) declarado aparte en `tokens.css` y marcado como
pendiente de aprobación; si la dirección de marca prefiere resolverlo con
magenta, basta reapuntar esas tres variables.

**Tipografía.** Lato en todas las aplicaciones, sin excepciones. Como solo trae
400/700/900, la jerarquía se apoya en tamaño y color — que es justamente lo que
pide el manual: «la jerarquía se define mediante tamaño, peso tipográfico y
color, no por capitalización». Por eso no hay mayúsculas sostenidas en ningún
título, etiqueta ni encabezado de tabla.

**Logo.** Extraído del manual como vector y guardado en `public/`:
`logo-russell-bedford.svg` (lockup horizontal) y `logo-symbol.svg` (símbolo),
cada uno con su variante `-white` para fondo oscuro. Va siempre arriba a la
izquierda, con área de seguridad y sin alterar proporciones ni color. Los
favicons se generan del mismo símbolo.

**Otras reglas aplicadas.** Diseño plano: sin degradados, sin sombras duras ni
efectos tridimensionales; la estructura la dan los bordes. Alineación a la
izquierda, nunca justificada. Animaciones sutiles.

El nombre de la firma y la ciudad salen de `ORG` en `src/lib/tickets.js`; el
dominio institucional, de la variable `AUTH_ALLOWED_DOMAIN` del backend.

---

## Puesta en marcha

Requisitos: Node.js 18+, PostgreSQL 14+.

Para el entorno local paso a paso —incluido el atajo de acceso sin Google—
consulta **[DESARROLLO-LOCAL.md](DESARROLLO-LOCAL.md)**.

Resumen:

```bash
# 1. Base de datos
psql -U postgres -f autotrack-backend/db/bootstrap.local.sql
psql -U autotrack -d autotrack -f autotrack-backend/db/schema.full.sql

# 2. Backend
cd autotrack-backend && npm install && cp .env.example .env && npm run dev

# 3. Frontend
cd autotrack-frontend && npm install && npm run dev
```

- API → http://localhost:3001
- App → http://localhost:5173

---

## Roles

| Rol interno        | En la interfaz         | Qué puede hacer                                        |
|--------------------|------------------------|--------------------------------------------------------|
| `user`             | Auditor solicitante    | Radicar tickets, seguirlos y aportar información        |
| `engineer`         | Analista               | Ver la bandeja y ejecutar los trabajos a su nombre      |
| `member_analytics` | Analista de Datos      | Igual, más triage de los tickets de analítica           |
| `leader_analytics` | Líder de Analítica     | Triage completo, asignación y respuesta                 |
| `admin`            | Coordinador de Mesa    | Todo lo anterior, más eliminar tickets y gestionar usuarios |
| `manager`          | Gerencia               | Lectura de bandeja, reportes y cronograma               |

Un correo del dominio institucional que entra por primera vez se crea como
**auditor solicitante**; el coordinador lo promueve desde *Usuarios*.

---

## Acceso y correo (Microsoft 365)

No se usa Google en ninguna parte: la firma trabaja con Microsoft 365.

**Inicio de sesión — Microsoft Entra ID.** Registra la aplicación en
*portal.azure.com → Microsoft Entra ID → App registrations*:

| Campo | Valor |
|---|---|
| Tipos de cuenta | Solo este directorio organizativo (inquilino único) |
| Plataforma | **SPA** |
| URI de redirección | `http://localhost:5173` y la URL de producción |
| Permisos de API | `User.Read` (delegado, viene por defecto) |
| Secreto de cliente | **Ninguno** — una SPA usa PKCE |

De ahí salen `MS_CLIENT_ID` (Id. de aplicación) y `MS_TENANT_ID` (Id. de
directorio). Ninguno es secreto; el backend los publica en `/api/auth/config`
para que el frontend arme el inicio de sesión sin recompilarse.

El backend **verifica la firma** del `id_token` contra las claves públicas del
inquilino y comprueba emisor, audiencia, `tid` y dominio del correo. Un
`id_token` sin verificar es texto que manda el navegador.

**Correo saliente — SMTP.** `SMTP_USER` / `SMTP_PASS` de un buzón de la firma.
Todos los avisos salen de ese buzón y el `Reply-To` apunta a quien hizo el
cambio: Exchange solo permite enviar en nombre de otra persona si se concedió
«Enviar como» explícitamente. Si el inquilino tiene SMTP AUTH deshabilitado,
hay que habilitarlo para ese buzón en el centro de administración de Exchange.

**Invitación a la reunión — archivo .ics.** En vez de Microsoft Graph, que
exige permisos de aplicación y consentimiento del administrador, la
convocatoria viaja adjunta al correo. Outlook la reconoce como invitación y
ofrece aceptarla; el identificador se deriva del ticket, así que reagendar
actualiza la cita en lugar de crear otra.

---

## Ciclo de vida del ticket

```
Recibido → En revisión → Reunión agendada → Aceptado → En ejecución
                                                    ↘ No procede
```

Cada ticket nace con un **compromiso de atención** según su prioridad —alta 1
día hábil, media 3, baja 5— que se muestra en la bandeja y alimenta el
cumplimiento de SLA en Reportes.

---

## Endpoints principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET    | /api/auth/config | Client ID de Google y dominio permitido |
| POST   | /api/auth/google | Login con Google |
| GET    | /api/auth/me | Usuario actual |
| GET    | /api/solicitudes | Tickets visibles según el rol |
| POST   | /api/solicitudes | Radicar un ticket (multipart, admite adjunto) |
| PUT    | /api/solicitudes/:id/status | Triage: estado, responsable, reunión, respuesta |
| PUT    | /api/solicitudes/:id/info | El solicitante añade información |
| DELETE | /api/solicitudes/:id | Eliminar ticket |
| GET    | /api/projects | Trabajos en ejecución |
| POST   | /api/projects | Crear trabajo |
| PUT    | /api/projects/:id | Actualizar trabajo |
| POST   | /api/projects/:id/logs | Registrar avance |
| GET    | /api/users | Directorio del equipo |
| GET    | /api/notifications | Notificaciones en la aplicación |
