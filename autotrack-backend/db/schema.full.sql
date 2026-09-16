-- AutoTrack — Esquema COMPLETO e idempotente
--
-- Reconstruido a partir del código (src/routes/*.js, src/utils/notify.js) porque
-- schema.sql quedó desactualizado: no crea project_tasks ni solicitudes, y a
-- projects le faltan 10 columnas. Una base creada solo con schema.sql revienta
-- en el primer GET /api/projects.
--
-- Es seguro correrlo varias veces y también sobre una base que ya tenga datos.
--   psql -U autotrack -d autotrack -f db/schema.full.sql

-- ─────────────────────────── users ───────────────────────────
-- Roles usados por el código: admin, coordinator, leader_analytics,
-- member_analytics, engineer, manager, user. Sus permisos se declaran en
-- src/config/roles.js; la columna no lleva CHECK para no tener que migrar
-- cada vez que se añade uno. El acceso real es vía Google; `password` guarda
-- un hash aleatorio que nunca se usa para autenticar.
CREATE TABLE IF NOT EXISTS users (
  id               SERIAL PRIMARY KEY,
  name             VARCHAR(100) NOT NULL,
  email            VARCHAR(255) UNIQUE NOT NULL,
  password         VARCHAR(255) NOT NULL,
  initials         VARCHAR(5)   NOT NULL,
  color_index      INTEGER      DEFAULT 0,
  role             VARCHAR(20)  DEFAULT 'engineer',
  failed_attempts  INTEGER      DEFAULT 0,
  locked_until     TIMESTAMP,
  created_at       TIMESTAMP    DEFAULT NOW()
);

-- ─────────────────────────── projects ───────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id           VARCHAR(50) PRIMARY KEY,
  name         VARCHAR(255) NOT NULL,
  description  TEXT,
  client       VARCHAR(100),
  status       VARCHAR(20) DEFAULT 'backlog',
  priority     VARCHAR(10) DEFAULT 'mid',
  assignee_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  start_date   DATE,
  due_date     DATE,
  progress     INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMP DEFAULT NOW(),
  updated_at   TIMESTAMP DEFAULT NOW()
);

-- Columnas que el código usa pero schema.sql nunca creó
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS tipo                    VARCHAR(20) DEFAULT 'automatizacion',
  ADD COLUMN IF NOT EXISTS doc_url                 TEXT,
  ADD COLUMN IF NOT EXISTS co_assignee_id          INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS general_assignee_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS participation_auto      TEXT,
  ADD COLUMN IF NOT EXISTS participation_analitica TEXT,
  ADD COLUMN IF NOT EXISTS progress_auto           INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS progress_analitica      INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS was_soporte             BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS support_closed          BOOLEAN DEFAULT FALSE;

-- Los CHECK se recrean porque el original no aceptaba 'soporte' ni 'cancelado',
-- que sí son estados válidos según los validators de src/routes/projects.js.
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE projects ADD  CONSTRAINT projects_status_check
  CHECK (status IN ('backlog','progress','standby','testing','done','soporte','cancelado'));

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_priority_check;
ALTER TABLE projects ADD  CONSTRAINT projects_priority_check
  CHECK (priority IN ('high','mid','low'));

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_tipo_check;
ALTER TABLE projects ADD  CONSTRAINT projects_tipo_check
  CHECK (tipo IN ('automatizacion','analitica','compartido','asignacion_flash'));

-- ─────────────────────────── project_logs ───────────────────────────
CREATE TABLE IF NOT EXISTS project_logs (
  id           SERIAL PRIMARY KEY,
  project_id   VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
  author_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  text         TEXT NOT NULL,
  progress     INTEGER,
  created_at   TIMESTAMP DEFAULT NOW()
);

-- ─────────────────────────── project_tasks ───────────────────────────
-- El código solo hace ALTER TABLE ... ADD COLUMN IF NOT EXISTS sobre esta tabla
-- (ensureTaskColumns), nunca la crea. En producción existe porque se creó a mano.
CREATE TABLE IF NOT EXISTS project_tasks (
  id           SERIAL PRIMARY KEY,
  project_id   VARCHAR(60) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  done         BOOLEAN NOT NULL DEFAULT FALSE,
  due_date     DATE,
  created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Mismas dos columnas que agrega ensureTaskColumns() en caliente
ALTER TABLE project_tasks
  ADD COLUMN IF NOT EXISTS assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS weight      SMALLINT NOT NULL DEFAULT 2;

-- ─────────────────────────── project_assignees ───────────────────────────
-- Idéntica a la que crea ensureAssigneesTable() en src/routes/projects.js
CREATE TABLE IF NOT EXISTS project_assignees (
  project_id VARCHAR(60) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    INTEGER     NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  PRIMARY KEY (project_id, user_id)
);

-- ─────────────────────────── notifications ───────────────────────────
-- Idéntica a la que crea ensureTable() en src/utils/notify.js
CREATE TABLE IF NOT EXISTS notifications (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  project_id VARCHAR(60),
  type       VARCHAR(30) NOT NULL,
  message    TEXT NOT NULL,
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─────────────────────────── solicitudes ───────────────────────────
-- Sin CHECK en `status`: el flujo vive en el código, no en la base. Estados
-- actuales, en orden: recibido, en_revision, reunion_agendada, aceptado,
-- convertido (= en ejecución), cerrado; más rechazado (= no procede).
-- Se toleran los legacy: nueva, en_proceso, completada, rechazada.
-- Solo `cerrado` y `rechazado` cuentan como ticket cerrado.
-- fecha_reunion es TIMESTAMP sin zona a propósito: src/index.js fija TZ=UTC y
-- guarda la hora "de pared" literal (ver el comentario ahí).
CREATE TABLE IF NOT EXISTS solicitudes (
  id                  SERIAL PRIMARY KEY,
  title               VARCHAR(255) NOT NULL,
  description         TEXT,
  type                VARCHAR(30)  DEFAULT 'requerimiento',
  priority            VARCHAR(10)  DEFAULT 'media',
  area                VARCHAR(120),
  due_date            DATE,
  file_name           VARCHAR(255),
  file_path           VARCHAR(255),
  user_id             INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assignee_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status              VARCHAR(30)  NOT NULL DEFAULT 'recibido',
  notes               TEXT,
  project_created     BOOLEAN      NOT NULL DEFAULT FALSE,
  frecuencia          TEXT,
  herramientas        TEXT,
  impacto             TEXT,
  urgencia            VARCHAR(10)  DEFAULT 'media',
  nombre_solicitante  VARCHAR(150),
  correo_solicitante  VARCHAR(255),
  info_adicional      TEXT,
  fecha_reunion       TIMESTAMP,
  equipo              VARCHAR(20)  DEFAULT 'automatizacion',
  created_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ─────────────────────────── índices ───────────────────────────
CREATE INDEX IF NOT EXISTS idx_projects_status     ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_assignee   ON projects(assignee_id);
CREATE INDEX IF NOT EXISTS idx_projects_tipo       ON projects(tipo);
CREATE INDEX IF NOT EXISTS idx_logs_project        ON project_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project       ON project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee      ON project_tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_notif_user_unread   ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_solicitudes_user    ON solicitudes(user_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_status  ON solicitudes(status);
CREATE INDEX IF NOT EXISTS idx_solicitudes_equipo  ON solicitudes(equipo);

-- ──────────────────── analytics_client_snapshots ─────────────────────────
-- Snapshots del estado consolidado de proyectos de analítica por cliente.
-- Permiten ver tendencias de avance sin depender de que se registren avances.
CREATE TABLE IF NOT EXISTS analytics_client_snapshots (
  id                 SERIAL PRIMARY KEY,
  snapshot_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  client_name        VARCHAR(100) NOT NULL,
  total_projects     INTEGER DEFAULT 0,
  active_projects    INTEGER DEFAULT 0,
  completed_projects INTEGER DEFAULT 0,
  standby_projects   INTEGER DEFAULT 0,
  testing_projects   INTEGER DEFAULT 0,
  avg_progress       INTEGER DEFAULT 0,
  recorded_by        INTEGER REFERENCES users(id),
  created_at         TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_client_date
  ON analytics_client_snapshots(client_name, snapshot_date DESC);

-- ──────────────────── analytics_clients ────────────────────────────────
-- Catálogo de clientes del proyecto de analítica.
-- Permite crear, renombrar, activar/desactivar y borrar desde la UI.
CREATE TABLE IF NOT EXISTS analytics_clients (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(150) NOT NULL UNIQUE,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ──────────────────── project_clients ──────────────────────────────────
-- Relación N a M entre proyectos de analítica y su catálogo de clientes:
-- un proyecto puede atender a varios clientes a la vez.
-- `section_title` es el encabezado con que ese cliente aparece dentro del
-- proyecto; vive en la relación y no en el cliente porque el mismo cliente
-- puede titularse distinto en dos proyectos.
CREATE TABLE IF NOT EXISTS project_clients (
  project_id    VARCHAR(60) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_id     INTEGER     NOT NULL REFERENCES analytics_clients(id) ON DELETE CASCADE,
  section_title VARCHAR(200),
  PRIMARY KEY (project_id, client_id)
);

-- Para bases que ya tenían la tabla sin esta columna.
ALTER TABLE project_clients ADD COLUMN IF NOT EXISTS section_title VARCHAR(200);

CREATE INDEX IF NOT EXISTS idx_project_clients_client ON project_clients(client_id);

-- Las tareas pueden pertenecer a un cliente concreto del proyecto o al
-- proyecto completo (client_id NULL). También ganan prioridad alta/media/baja.
-- Esta lista tiene que coincidir con `ensureTaskColumns` en
-- src/routes/projects.js, que la vuelve a aplicar al arrancar. Si se añade una
-- columna allí y no aquí, el esquema deja de describir la base real.
ALTER TABLE project_tasks
  ADD COLUMN IF NOT EXISTS assignee_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS weight            SMALLINT NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS client_id         INTEGER REFERENCES analytics_clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS priority          VARCHAR(10) NOT NULL DEFAULT 'mid',
  ADD COLUMN IF NOT EXISTS platform_uploaded BOOLEAN NOT NULL DEFAULT FALSE;

-- Indices y valores de prioridad
UPDATE project_tasks SET priority = 'mid' WHERE priority NOT IN ('high','mid','low');
ALTER TABLE project_tasks DROP CONSTRAINT IF EXISTS project_tasks_priority_check;
ALTER TABLE project_tasks ADD  CONSTRAINT project_tasks_priority_check
  CHECK (priority IN ('high','mid','low'));
CREATE INDEX IF NOT EXISTS idx_tasks_client ON project_tasks(client_id);
