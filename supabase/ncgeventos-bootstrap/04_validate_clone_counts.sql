-- ============================================================================
--  04 — VALIDATE CLONE COUNTS (READ-ONLY)
--  Compara counts entre ncgconstructora y ncgeventos lado a lado.
--  Ejecutar DESPUÉS de haber aplicado el dump del paso 03.
-- ============================================================================

SELECT 'tables' AS tipo,
       (SELECT COUNT(*)::int FROM information_schema.tables
         WHERE table_schema='ncgconstructora' AND table_type='BASE TABLE') AS ncgconstructora,
       (SELECT COUNT(*)::int FROM information_schema.tables
         WHERE table_schema='ncgeventos' AND table_type='BASE TABLE') AS ncgeventos;

SELECT 'views' AS tipo,
       (SELECT COUNT(*)::int FROM information_schema.tables
         WHERE table_schema='ncgconstructora' AND table_type='VIEW') AS ncgconstructora,
       (SELECT COUNT(*)::int FROM information_schema.tables
         WHERE table_schema='ncgeventos' AND table_type='VIEW') AS ncgeventos;

SELECT 'policies' AS tipo,
       (SELECT COUNT(*)::int FROM pg_policies WHERE schemaname='ncgconstructora') AS ncgconstructora,
       (SELECT COUNT(*)::int FROM pg_policies WHERE schemaname='ncgeventos') AS ncgeventos;

SELECT 'functions' AS tipo,
       (SELECT COUNT(*)::int FROM pg_proc p
          JOIN pg_namespace n ON n.oid=p.pronamespace
         WHERE n.nspname='ncgconstructora') AS ncgconstructora,
       (SELECT COUNT(*)::int FROM pg_proc p
          JOIN pg_namespace n ON n.oid=p.pronamespace
         WHERE n.nspname='ncgeventos') AS ncgeventos;

SELECT 'triggers' AS tipo,
       (SELECT COUNT(*)::int FROM information_schema.triggers WHERE trigger_schema='ncgconstructora') AS ncgconstructora,
       (SELECT COUNT(*)::int FROM information_schema.triggers WHERE trigger_schema='ncgeventos') AS ncgeventos;

SELECT 'indexes' AS tipo,
       (SELECT COUNT(*)::int FROM pg_indexes WHERE schemaname='ncgconstructora') AS ncgconstructora,
       (SELECT COUNT(*)::int FROM pg_indexes WHERE schemaname='ncgeventos') AS ncgeventos;

-- Diferencias de tablas (esperado: vacío si el clonado fue íntegro).
SELECT 'tabla_faltante_en_ncgeventos' AS issue, table_name
  FROM information_schema.tables
 WHERE table_schema = 'ncgconstructora'
   AND table_type   = 'BASE TABLE'
   AND table_name NOT IN (
     SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'ncgeventos'
        AND table_type   = 'BASE TABLE'
   )
 ORDER BY table_name;
