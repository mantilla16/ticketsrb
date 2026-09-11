-- Crea el rol y la base para el entorno LOCAL. Se corre UNA vez, como superusuario:
--
--   & 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -U postgres -h localhost -f db\bootstrap.local.sql
--
-- (psql pedirá la contraseña del usuario `postgres`)
--
-- Es idempotente: si el rol o la base ya existen, no hace nada. La contraseña
-- `autotrack123` es solo para esta máquina — es la misma que ya usa el
-- docker-compose.yml del repo, y coincide con el DATABASE_URL del .env local.
--
-- Después de esto, ya sin superusuario:
--   npm run db:schema
--   npm run seed:local

SELECT 'CREATE ROLE autotrack LOGIN PASSWORD ''autotrack123'' CREATEDB'
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'autotrack')\gexec

SELECT 'CREATE DATABASE autotrack OWNER autotrack'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'autotrack')\gexec

\echo '--- rol y base listos ---'
SELECT rolname AS rol, rolcreatedb AS puede_crear_bases FROM pg_roles WHERE rolname = 'autotrack';
SELECT d.datname AS base, pg_get_userbyid(d.datdba) AS dueno FROM pg_database d WHERE d.datname = 'autotrack';
