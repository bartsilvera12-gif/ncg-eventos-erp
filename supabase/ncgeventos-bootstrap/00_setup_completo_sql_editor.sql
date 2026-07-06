-- ============================================================================
--  SETUP COMPLETO PARA SQL EDITOR DE SUPABASE
--  Pegar todo este archivo en el SQL Editor y ejecutar.
--
--  Crea el tenant `erp_ncgeventos` clonando la estructura desde `zentra_erp`
--  usando la función oficial del repo (zentra_erp.neura_clone_zentra_erp_to_tenant).
--
--  IMPORTANTE:
--    * El schema DEBE llamarse `erp_ncgeventos` (la función valida el prefijo `erp_`).
--    * Antes de correr esto, asegurate de que `zentra_erp` exista en tu base
--      (es el schema template; debería existir si las migraciones del repo
--      ya están aplicadas).
--    * Este script es IDEMPOTENTE en su parte de grants/schema, pero la
--      función de clonado puede fallar si el schema destino ya tiene tablas.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 1 — Verificar prerequisitos (READ-ONLY).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1.a) `zentra_erp` (template) debe existir.
SELECT nspname FROM pg_namespace WHERE nspname = 'zentra_erp';

-- 1.b) La función de clonado debe existir.
SELECT n.nspname || '.' || p.proname AS funcion_clonado
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'zentra_erp'
   AND p.proname = 'neura_clone_zentra_erp_to_tenant';

-- Si alguno de los dos selects de arriba devuelve VACÍO, parar acá:
-- la base no tiene aplicadas las migraciones del repo y este script no va a funcionar.

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 2 — Crear el schema vacío + grants para PostgREST.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS erp_ncgeventos;

GRANT USAGE ON SCHEMA erp_ncgeventos TO authenticator, anon, authenticated, service_role;
GRANT CREATE ON SCHEMA erp_ncgeventos TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA erp_ncgeventos
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA erp_ncgeventos
  GRANT SELECT ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA erp_ncgeventos
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA erp_ncgeventos
  GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 3 — Clonar la estructura completa desde `zentra_erp`.
-- Esto crea todas las tablas, índices, triggers, policies y funciones del ERP
-- dentro de `erp_ncgeventos`. Puede tardar varios segundos.
-- ─────────────────────────────────────────────────────────────────────────────

SELECT zentra_erp.neura_clone_zentra_erp_to_tenant('erp_ncgeventos');

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 4 — Verificar que el clonado salió bien (READ-ONLY).
-- ─────────────────────────────────────────────────────────────────────────────

-- Cantidad de tablas (debería ser similar a la cantidad en zentra_erp).
SELECT 'tablas_zentra_erp' AS metric,
       COUNT(*)::int AS valor
  FROM information_schema.tables
 WHERE table_schema = 'zentra_erp' AND table_type = 'BASE TABLE'
UNION ALL
SELECT 'tablas_erp_ncgeventos' AS metric,
       COUNT(*)::int AS valor
  FROM information_schema.tables
 WHERE table_schema = 'erp_ncgeventos' AND table_type = 'BASE TABLE';

-- Confirmar que existen las tablas core.
SELECT table_name
  FROM information_schema.tables
 WHERE table_schema = 'erp_ncgeventos'
   AND table_name IN ('empresas', 'usuarios', 'modulos', 'empresa_modulos')
 ORDER BY table_name;

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 5 — Agregar `erp_ncgeventos` a la lista de schemas expuestos por PostgREST.
--
-- ATENCIÓN: este paso es APPEND-ONLY pero modifica configuración global.
-- Primero LEER la lista actual con el siguiente SELECT y COPIAR el valor:
-- ─────────────────────────────────────────────────────────────────────────────

SELECT unnest(setconfig) AS setting
  FROM pg_db_role_setting s
  JOIN pg_database d ON d.oid = s.setdatabase
  JOIN pg_roles    r ON r.oid = s.setrole
 WHERE r.rolname = 'authenticator'
   AND d.datname = 'postgres';

-- Ejemplo del valor que vas a ver: pgrst.db_schemas=public,zentra_erp,enlodemari,...
-- Tomá ESE valor exacto, agregale `,erp_ncgeventos` al final, y descomentá
-- la línea siguiente reemplazando <LISTA_ACTUAL>:

-- ALTER ROLE authenticator IN DATABASE postgres
--   SET pgrst.db_schemas = '<LISTA_ACTUAL>,erp_ncgeventos';

-- Después del ALTER ROLE, recargar PostgREST:
-- NOTIFY pgrst, 'reload config';
-- NOTIFY pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 6 — Crear la empresa NCG Eventos.
-- Si la tabla `empresas` tiene default gen_random_uuid() en `id`, no hace falta
-- pasarlo. Ajustar columnas según introspección si difiere.
-- ─────────────────────────────────────────────────────────────────────────────

-- Introspección previa (READ-ONLY):
SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_schema = 'erp_ncgeventos'
   AND table_name   = 'empresas'
 ORDER BY ordinal_position;

-- INSERT — descomentar después de confirmar columnas:
-- INSERT INTO erp_ncgeventos.empresas (nombre, data_schema, created_at)
-- VALUES ('NCG Eventos', 'erp_ncgeventos', now())
-- RETURNING id;

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 7 — Crear el usuario admin.
--
-- ANTES de ejecutar el INSERT, hay que crear el usuario en auth.users
-- desde el Dashboard de Supabase: Authentication > Users > Add user.
-- Anotar el UUID que te devuelve y usarlo como <AUTH_USER_ID>.
-- Anotar también el id de empresa devuelto en el paso 6 como <EMPRESA_ID>.
-- ─────────────────────────────────────────────────────────────────────────────

-- Verificación previa (READ-ONLY):
SELECT id, email FROM auth.users WHERE id = '<AUTH_USER_ID>'::uuid;
SELECT id, nombre FROM erp_ncgeventos.empresas WHERE id = '<EMPRESA_ID>'::uuid;

-- INSERT — descomentar y completar placeholders:
-- INSERT INTO erp_ncgeventos.usuarios (
--   auth_user_id, empresa_id, email, rol, activo, created_at
-- ) VALUES (
--   '<AUTH_USER_ID>'::uuid,
--   '<EMPRESA_ID>'::uuid,
--   '<ADMIN_EMAIL>',
--   'admin',
--   true,
--   now()
-- );

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 8 — Auditoría final (READ-ONLY).
-- ─────────────────────────────────────────────────────────────────────────────

SELECT 'schema_creado'   AS check_name, EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='erp_ncgeventos') AS ok
UNION ALL
SELECT 'empresa_creada'  AS check_name, EXISTS (SELECT 1 FROM erp_ncgeventos.empresas WHERE nombre = 'NCG Eventos')
UNION ALL
SELECT 'admin_creado'    AS check_name, EXISTS (SELECT 1 FROM erp_ncgeventos.usuarios WHERE rol = 'admin');
