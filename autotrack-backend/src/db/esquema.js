/**
 * Esquema que la aplicación garantiza al arrancar.
 *
 * Estas tablas y columnas se crean desde el código, no solo desde
 * `db/schema.full.sql`, porque el usuario de la aplicación puede no tener
 * permiso para correr migraciones a mano en el servidor y porque hay bases
 * —la de producción— que nacieron antes de que existieran.
 *
 * Vive aquí, y no dentro de cada ruta, porque antes estaba duplicado en
 * `routes/projects.js` y `routes/analyticsReport.js`: dos definiciones de la
 * misma tabla que había que recordar cambiar a la vez. Una ya se había
 * quedado atrás.
 *
 * Cada función devuelve una promesa que se resuelve una sola vez por proceso;
 * si falla, se olvida el resultado para que el siguiente intento lo reintente
 * en lugar de arrastrar el error para siempre.
 *
 * Lo que se declare aquí tiene que estar también en `db/schema.full.sql`, que
 * es lo que describe la base para quien la instala de cero.
 */

const pool = require('../config/database');

/** Memoiza una promesa, pero olvida los fallos para poder reintentar. */
function unaVez(fn) {
  let pendiente = null;
  return () => {
    if (!pendiente) {
      pendiente = fn().catch(err => { pendiente = null; throw err; });
    }
    return pendiente;
  };
}

/* ── Responsables múltiples ────────────────────────────────────────────── */

const asegurarResponsables = unaVez(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS project_assignees (
      project_id VARCHAR(60) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (project_id, user_id)
    )
  `);
  // Los proyectos anteriores guardaban un único responsable en una columna.
  await pool.query(`
    INSERT INTO project_assignees (project_id, user_id)
    SELECT id, assignee_id FROM projects WHERE assignee_id IS NOT NULL
    ON CONFLICT DO NOTHING
  `);
});

/* ── Catálogo de clientes y su relación con los proyectos ──────────────── */

const asegurarClientes = unaVez(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS analytics_clients (
      id         SERIAL PRIMARY KEY,
      name       VARCHAR(150) NOT NULL UNIQUE,
      active     BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
});

const asegurarClientesDeProyecto = unaVez(async () => {
  await asegurarClientes();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS project_clients (
      project_id    VARCHAR(60) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      client_id     INTEGER     NOT NULL REFERENCES analytics_clients(id) ON DELETE CASCADE,
      section_title VARCHAR(200),
      PRIMARY KEY (project_id, client_id)
    )
  `);
  // Para bases donde la tabla ya existía sin este campo.
  await pool.query('ALTER TABLE project_clients ADD COLUMN IF NOT EXISTS section_title VARCHAR(200)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_project_clients_client ON project_clients(client_id)');

  // Proyectos que guardaban el cliente como texto libre pasan a la relación,
  // pero solo si ese texto coincide con un cliente del catálogo: lo demás son
  // áreas internas de la etapa anterior y no son clientes.
  await pool.query(`
    INSERT INTO project_clients (project_id, client_id)
    SELECT p.id, ac.id
    FROM projects p
    JOIN analytics_clients ac ON lower(ac.name) = lower(trim(p.client))
    WHERE p.tipo = 'analitica' AND p.client IS NOT NULL AND p.client <> ''
    ON CONFLICT DO NOTHING
  `);
});

/* ── Columnas de las tareas ────────────────────────────────────────────── */

/* `client_id` referencia analytics_clients, así que el catálogo tiene que
   existir antes: por eso se espera a `asegurarClientes` y no se confía en el
   orden de arranque. */
const asegurarColumnasDeTarea = unaVez(async () => {
  await asegurarClientes();
  await pool.query(`
    ALTER TABLE project_tasks
      ADD COLUMN IF NOT EXISTS assignee_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS weight            SMALLINT NOT NULL DEFAULT 2,
      ADD COLUMN IF NOT EXISTS priority          VARCHAR(10) NOT NULL DEFAULT 'mid',
      ADD COLUMN IF NOT EXISTS client_id         INTEGER REFERENCES analytics_clients(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS platform_uploaded BOOLEAN NOT NULL DEFAULT FALSE
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_tasks_client ON project_tasks(client_id)');
});

module.exports = {
  asegurarResponsables,
  asegurarClientes,
  asegurarClientesDeProyecto,
  asegurarColumnasDeTarea,
};
