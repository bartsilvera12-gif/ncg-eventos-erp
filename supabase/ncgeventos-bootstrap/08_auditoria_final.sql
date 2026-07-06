-- ============================================================================
--  08 — AUDITORÍA FINAL (READ-ONLY)
--  Verificación end-to-end del bootstrap de ncgeventos.
-- ============================================================================

-- Schema existe.
SELECT nspname
  FROM pg_namespace
 WHERE nspname = 'ncgeventos';

-- Counts comparativos (resumen).
SELECT 'tables'    AS tipo,
       (SELECT COUNT(*)::int FROM information_schema.tables
         WHERE table_schema='ncgconstructora' AND table_type='BASE TABLE') AS ncgconstructora,
       (SELECT COUNT(*)::int FROM information_schema.tables
         WHERE table_schema='ncgeventos' AND table_type='BASE TABLE') AS ncgeventos
UNION ALL
SELECT 'functions' AS tipo,
       (SELECT COUNT(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='ncgconstructora') AS ncgconstructora,
       (SELECT COUNT(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='ncgeventos') AS ncgeventos
UNION ALL
SELECT 'policies'  AS tipo,
       (SELECT COUNT(*)::int FROM pg_policies WHERE schemaname='ncgconstructora') AS ncgconstructora,
       (SELECT COUNT(*)::int FROM pg_policies WHERE schemaname='ncgeventos') AS ncgeventos
UNION ALL
SELECT 'triggers'  AS tipo,
       (SELECT COUNT(*)::int FROM information_schema.triggers WHERE trigger_schema='ncgconstructora') AS ncgconstructora,
       (SELECT COUNT(*)::int FROM information_schema.triggers WHERE trigger_schema='ncgeventos') AS ncgeventos
UNION ALL
SELECT 'indexes'   AS tipo,
       (SELECT COUNT(*)::int FROM pg_indexes WHERE schemaname='ncgconstructora') AS ncgconstructora,
       (SELECT COUNT(*)::int FROM pg_indexes WHERE schemaname='ncgeventos') AS ncgeventos;

-- ncgeventos.empresas debe tener al menos "NCG Eventos".
SELECT id, nombre
  FROM ncgeventos.empresas
 ORDER BY nombre;

-- ncgeventos.usuarios — admin esperado si se ejecutó 07_seed_admin_ncgeventos.sql.
SELECT id, email, rol, empresa_id, auth_user_id, activo
  FROM ncgeventos.usuarios
 ORDER BY created_at NULLS LAST, email;

-- No debe haber inserciones nuevas en ncgconstructora como efecto colateral.
-- Comparar contra el baseline tomado en 01_preflight_readonly.sql.
SELECT 'ncgconstructora.usuarios.count' AS metric,
       COUNT(*)::int AS valor
  FROM ncgconstructora.usuarios;

SELECT 'ncgconstructora.empresas.count' AS metric,
       COUNT(*)::int AS valor
  FROM ncgconstructora.empresas;

-- Módulos activos para la empresa NCG Eventos.
-- Reemplazar <EMPRESA_ID> por el id real.
SELECT m.slug, m.nombre, em.activo
  FROM ncgeventos.empresa_modulos em
  JOIN ncgeventos.modulos m ON m.id = em.modulo_id
 WHERE em.empresa_id = '<EMPRESA_ID>'::uuid
 ORDER BY m.slug;

-- Referencias residuales a 'ncgconstructora' en objetos de ncgeventos.
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

SELECT event_object_schema AS schema,
       trigger_name,
       event_object_table  AS tabla
  FROM information_schema.triggers
 WHERE trigger_schema = 'ncgeventos'
   AND action_statement ILIKE '%ncgconstructora%'
 ORDER BY trigger_name;

SELECT schemaname AS schema,
       tablename,
       policyname
  FROM pg_policies
 WHERE schemaname = 'ncgeventos'
   AND (COALESCE(qual, '') ILIKE '%ncgconstructora%' OR COALESCE(with_check, '') ILIKE '%ncgconstructora%')
 ORDER BY tablename, policyname;
