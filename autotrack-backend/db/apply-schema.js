/**
 * Aplica db/schema.full.sql sobre la base del DATABASE_URL.
 *
 *   cd autotrack-backend && npm run db:schema
 *
 * Va por el driver `pg` en vez de psql a propósito: psql no está en el PATH de
 * Windows y así el comando funciona igual en cualquier máquina. El SQL es
 * idempotente, se puede correr las veces que sea.
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Pool propio en vez de src/config/database.js: ese módulo hace un
// pool.connect(cb) de arranque y nunca libera el cliente, así que pool.end()
// se queda esperando para siempre y el script nunca termina.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const FILE = path.join(__dirname, 'schema.full.sql');

(async () => {
  try {
    const sql = fs.readFileSync(FILE, 'utf8');
    await pool.query(sql); // multi-statement: sin parámetros, va por simple query
    const { rows } = await pool.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' ORDER BY table_name`
    );
    console.log(`✔ Esquema aplicado. Tablas en public (${rows.length}):`);
    rows.forEach(r => console.log(`   · ${r.table_name}`));
  } catch (err) {
    console.error('✖ No se pudo aplicar el esquema:', err.message);
    if (err.code === 'ECONNREFUSED') {
      console.error('  PostgreSQL no responde en el host/puerto del DATABASE_URL.');
    }
    if (err.code === '28P01') console.error('  Usuario o contraseña incorrectos.');
    if (err.code === '3D000') console.error('  La base de datos no existe todavía.');
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
