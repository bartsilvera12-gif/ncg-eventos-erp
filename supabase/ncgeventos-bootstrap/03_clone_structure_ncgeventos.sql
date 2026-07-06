-- ============================================================================
--  03 — CLONADO DE ESTRUCTURA (PROCEDIMIENTO MANUAL — NO ES SQL EJECUTABLE PURO)
--
--  Replicar la estructura completa de `ncgconstructora` en `ncgeventos` (cientos
--  de objetos: tablas, índices, triggers, functions, policies, grants) NO
--  es viable como DDL embebido manual. Se recomienda usar `pg_dump` con
--  `--schema-only` + reescritura de namespace + `psql` aplicador.
--
--  Este archivo contiene SOLO la última query READ-ONLY (detección de
--  literales residuales). El resto son INSTRUCCIONES en comentarios `--`.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 1) Dump de estructura del schema origen (en terminal, NO en SQL Editor):
--
--   pg_dump "<SUPABASE_DB_URL>" \
--     --schema=ncgconstructora \
--     --schema-only \
--     --no-owner \
--     --no-privileges \
--     --no-comments \
--     --file=ncgconstructora_structure.sql
--
--   * --schema-only      → NO copia datos.
--   * --no-owner         → evita OWNER TO roles que no existen en destino.
--   * --no-privileges    → grants ya gobernados por archivo 02.
--   * --no-comments      → evita ruido innecesario.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 2) Reescribir el namespace en el dump (en terminal):
--
--   sed -i 's/\bncgconstructora\b/ncgeventos/g' ncgconstructora_structure.sql
--
--   Revisar el diff antes de aplicar. Confirmar que no se reemplazaron
--   literales de negocio que casualmente contengan "ncgconstructora".
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 3) Eliminar de ncgconstructora_structure.sql cualquier sentencia:
--
--   CREATE SCHEMA ncgeventos;
--
--   porque el schema YA fue creado por 02_create_schema_ncgeventos.sql.
--   Un CREATE SCHEMA duplicado abortaría la transacción (salvo IF NOT EXISTS).
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 4) Aplicar el archivo en la base destino (en terminal, ON_ERROR_STOP):
--
--   psql "<SUPABASE_DB_URL>" -v ON_ERROR_STOP=1 -f ncgconstructora_structure.sql
--
--   Idealmente envolver en BEGIN; ... COMMIT; para rollback ante error.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 5) DESPUÉS DE APLICAR — Ejecutar la query READ-ONLY siguiente para
-- detectar funciones cuya definición todavía referencie literal 'ncgconstructora'.
-- Si aparece alguna, anotarla y proponer CREATE OR REPLACE manual.
-- NO ejecutar DROP automático.
-- ─────────────────────────────────────────────────────────────────────────────

-- prokind='f' filtra agregados ('a'), window ('w') y procedures ('p'): para
-- esas, pg_get_functiondef revienta con 42809.
SELECT n.nspname AS schema,
       p.proname AS function_name
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'ncgeventos'
   AND p.prokind = 'f'
   AND pg_get_functiondef(p.oid) ILIKE '%ncgconstructora%'
 ORDER BY p.proname;

-- Misma detección para triggers de ncgeventos que aún ejecuten action_statement
-- referenciando ncgconstructora:
SELECT event_object_schema AS schema,
       trigger_name,
       event_object_table  AS tabla,
       action_statement
  FROM information_schema.triggers
 WHERE trigger_schema = 'ncgeventos'
   AND action_statement ILIKE '%ncgconstructora%'
 ORDER BY trigger_name;

-- Y para policies de ncgeventos:
SELECT schemaname AS schema,
       tablename,
       policyname,
       qual,
       with_check
  FROM pg_policies
 WHERE schemaname = 'ncgeventos'
   AND (COALESCE(qual, '') ILIKE '%ncgconstructora%' OR COALESCE(with_check, '') ILIKE '%ncgconstructora%')
 ORDER BY tablename, policyname;
