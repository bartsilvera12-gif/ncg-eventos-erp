-- ============================================================================
--  CLONADO GENÉRICO: ncgconstructora → ncgeventos (TODO DESDE SQL EDITOR)
--
--  Pega este archivo entero en el SQL Editor de Supabase y ejecutá por
--  bloques en orden (PASO 1, 2, 3, ...). NO necesitás terminal ni pg_dump.
--
--  Estrategia: define una función genérica `public.neura_clone_schema(source, target)`
--  que introspecta el schema fuente con pg_get_* y replica todo en el destino:
--  tablas, columnas, defaults, secuencias propias, PK/UNIQUE/CHECK, índices,
--  FKs, triggers, RLS + policies, vistas, matviews, funciones plpgsql/sql,
--  grants y membresía en supabase_realtime.
--
--  Diferencias clave con la función oficial del repo:
--    * Acepta el schema fuente como parámetro (no hardcodea zentra_erp).
--    * Permite que el schema destino YA EXISTA (no aborta si ya lo creaste).
--    * No exige el prefijo erp_ en el destino.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 1 — Pre-chequeo (READ-ONLY).
-- ─────────────────────────────────────────────────────────────────────────────

SELECT 'fuente_existe'  AS check_name,
       EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'ncgconstructora') AS ok
UNION ALL
SELECT 'destino_existe' AS check_name,
       EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'ncgeventos') AS ok
UNION ALL
SELECT 'destino_vacio'  AS check_name,
       NOT EXISTS (
         SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'ncgeventos' AND table_type = 'BASE TABLE'
       ) AS ok;

-- Esperado:
--   fuente_existe  = true
--   destino_existe = true   (si ya corriste 02_create_schema_ncgeventos.sql)
--   destino_vacio  = true   (si no, abortar y limpiar antes)

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 2 — Crear schema destino si no existe (idempotente, seguro).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS ncgeventos;

GRANT USAGE ON SCHEMA ncgeventos TO authenticator, anon, authenticated, service_role;
GRANT CREATE ON SCHEMA ncgeventos TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA ncgeventos
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA ncgeventos
  GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA ncgeventos
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA ncgeventos
  GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 3 — Definir helpers + función de clonado genérica en `public`.
-- Ejecutar este bloque entero. Crea/reemplaza objetos `neura_clone_*`.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._neura_rewrite_schema_refs(
  p_expr   text,
  p_src    text,
  p_tgt    text,
  p_tables text[]
) RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  r       text := p_expr;
  t       text;
  sorted  text[];
  v_src_q text := quote_ident(p_src);
  v_tgt_q text := quote_ident(p_tgt);
BEGIN
  IF p_expr IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT coalesce(array_agg(x ORDER BY length(x) DESC), '{}')
    INTO sorted
    FROM unnest(p_tables) AS x;

  FOREACH t IN ARRAY sorted
  LOOP
    r := replace(r, p_src || '."' || t || '"', p_tgt || '."' || t || '"');
    r := replace(r, p_src || '.'  || t,         p_tgt || '.'  || t);
    r := replace(r, v_src_q || '."' || t || '"', v_tgt_q || '."' || t || '"');
    r := replace(r, v_src_q || '.'  || t,         v_tgt_q || '.'  || t);
  END LOOP;
  RETURN r;
END;
$$;

CREATE OR REPLACE FUNCTION public._neura_source_table_list(p_src text)
RETURNS text[]
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(array_agg(c.relname::text ORDER BY c.relname), '{}')
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = p_src
     AND c.relkind = 'r';
$$;

CREATE OR REPLACE FUNCTION public.neura_clone_schema(
  p_source_schema text,
  p_target_schema text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_src      text := p_source_schema;
  v_tgt      text := p_target_schema;
  v_src_q    text := quote_ident(p_source_schema);
  v_tgt_q    text := quote_ident(p_target_schema);
  v_tables   text[];
  r          RECORD;
  def        text;
  idef       text;
  tdef       text;
  qual       text;
  chk        text;
  roles_clause text;
  tbl        text;
  v_pub      text := 'supabase_realtime';
  fn_oid     oid;
  fdef       text;
  v_round    int;
  v_now      int;
  v_viewdef  text;
  v_pass     int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = v_src) THEN
    RAISE EXCEPTION 'schema fuente no existe: %', v_src;
  END IF;

  EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', v_tgt);

  v_tables := public._neura_source_table_list(v_src);

  -- Tablas (estructura, defaults, identities, sin constraints/índices todavía)
  FOREACH tbl IN ARRAY v_tables
  LOOP
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I.%I (LIKE %I.%I INCLUDING DEFAULTS INCLUDING GENERATED INCLUDING IDENTITY INCLUDING STATISTICS INCLUDING STORAGE INCLUDING COMMENTS EXCLUDING CONSTRAINTS EXCLUDING INDEXES)',
      v_tgt, tbl, v_src, tbl
    );
  END LOOP;

  -- PK, UNIQUE, CHECK
  FOR r IN
    SELECT c.oid, c.conname::text AS conname, cf.relname::text AS relname, c.contype::text AS ctype
      FROM pg_constraint c
      JOIN pg_class     cf ON cf.oid = c.conrelid
      JOIN pg_namespace nf ON nf.oid = cf.relnamespace
     WHERE nf.nspname = v_src
       AND c.contype IN ('p','u','c')
       AND cf.relname = ANY (v_tables)
     ORDER BY CASE c.contype WHEN 'p' THEN 1 WHEN 'u' THEN 2 WHEN 'c' THEN 3 ELSE 4 END,
              c.conname
  LOOP
    def := pg_get_constraintdef(r.oid);
    def := public._neura_rewrite_schema_refs(def, v_src, v_tgt, v_tables);
    BEGIN
      EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I %s', v_tgt, r.relname, r.conname, def);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'constraint %.% omitido: %', r.relname, r.conname, SQLERRM;
    END;
  END LOOP;

  -- Índices secundarios
  FOR r IN
    SELECT pg_get_indexdef(i.oid) AS idef
      FROM pg_class      i
      JOIN pg_namespace  n  ON n.oid = i.relnamespace
      JOIN pg_index      ix ON ix.indexrelid = i.oid
      JOIN pg_class      tbl ON tbl.oid = ix.indrelid
     WHERE n.nspname = v_src
       AND i.relkind = 'i'
       AND ix.indisprimary IS FALSE
       AND NOT EXISTS (SELECT 1 FROM pg_constraint co WHERE co.conindid = i.oid)
       AND tbl.relname = ANY (v_tables)
  LOOP
    idef := public._neura_rewrite_schema_refs(r.idef, v_src, v_tgt, v_tables);
    BEGIN
      EXECUTE idef;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'índice omitido: %', SQLERRM;
    END;
  END LOOP;

  -- Foreign keys
  FOR r IN
    SELECT c.oid, c.conname::text AS conname, cf.relname::text AS from_table
      FROM pg_constraint c
      JOIN pg_class     cf ON cf.oid = c.conrelid
      JOIN pg_namespace nf ON nf.oid = cf.relnamespace
     WHERE nf.nspname = v_src
       AND c.contype = 'f'
       AND cf.relname = ANY (v_tables)
     ORDER BY c.conname
  LOOP
    def := pg_get_constraintdef(r.oid);
    def := public._neura_rewrite_schema_refs(def, v_src, v_tgt, v_tables);
    BEGIN
      EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I %s', v_tgt, r.from_table, r.conname, def);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'FK %.% omitido: %', r.from_table, r.conname, SQLERRM;
    END;
  END LOOP;

  -- Triggers
  FOR r IN
    SELECT tg.tgname::text AS tgname,
           c.relname::text AS tablename,
           pg_get_triggerdef(tg.oid, true) AS tdef
      FROM pg_trigger   tg
      JOIN pg_class     c ON c.oid = tg.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = v_src
       AND NOT tg.tgisinternal
       AND c.relname = ANY (v_tables)
  LOOP
    tdef := r.tdef;
    tdef := replace(tdef, ' ON ' || v_src || '.' || r.tablename || ' ', ' ON ' || v_tgt || '.' || r.tablename || ' ');
    tdef := replace(tdef, ' ON ' || v_src || '."' || r.tablename || '" ', ' ON ' || v_tgt || '."' || r.tablename || '" ');
    BEGIN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I', r.tgname, v_tgt, r.tablename);
      EXECUTE tdef;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'trigger % en % omitido: %', r.tgname, r.tablename, SQLERRM;
    END;
  END LOOP;

  -- RLS + policies
  FOREACH tbl IN ARRAY v_tables
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', v_tgt, tbl);
  END LOOP;

  FOR r IN
    SELECT pol.polname::text AS polname,
           c.relname::text AS tablename,
           pol.polcmd::text AS cmd,
           pol.polpermissive AS permissive,
           pg_get_expr(pol.polqual,     pol.polrelid) AS polqual,
           pg_get_expr(pol.polwithcheck, pol.polrelid) AS polwithcheck,
           ARRAY(SELECT rolname FROM pg_roles WHERE oid = ANY (pol.polroles)) AS roles
      FROM pg_policy    pol
      JOIN pg_class     c ON c.oid = pol.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = v_src
       AND c.relname = ANY (v_tables)
  LOOP
    BEGIN
      qual := public._neura_rewrite_schema_refs(r.polqual,     v_src, v_tgt, v_tables);
      chk  := public._neura_rewrite_schema_refs(r.polwithcheck, v_src, v_tgt, v_tables);

      IF r.roles IS NULL OR coalesce(cardinality(r.roles), 0) = 0 THEN
        roles_clause := '';
      ELSE
        roles_clause := ' TO ' || (SELECT string_agg(quote_ident(x), ', ') FROM unnest(r.roles) AS x);
      END IF;

      EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.polname, v_tgt, r.tablename);

      IF r.cmd = 'r' THEN
        EXECUTE format('CREATE POLICY %I ON %I.%I AS %s FOR SELECT%s USING (%s)',
          r.polname, v_tgt, r.tablename,
          CASE WHEN r.permissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
          roles_clause, coalesce(qual, 'true'));
      ELSIF r.cmd = 'a' THEN
        EXECUTE format('CREATE POLICY %I ON %I.%I AS %s FOR INSERT%s WITH CHECK (%s)',
          r.polname, v_tgt, r.tablename,
          CASE WHEN r.permissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
          roles_clause, coalesce(chk, qual, 'true'));
      ELSIF r.cmd = 'w' THEN
        EXECUTE format('CREATE POLICY %I ON %I.%I AS %s FOR UPDATE%s USING (%s) WITH CHECK (%s)',
          r.polname, v_tgt, r.tablename,
          CASE WHEN r.permissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
          roles_clause, coalesce(qual, 'true'), coalesce(chk, qual, 'true'));
      ELSIF r.cmd = 'd' THEN
        EXECUTE format('CREATE POLICY %I ON %I.%I AS %s FOR DELETE%s USING (%s)',
          r.polname, v_tgt, r.tablename,
          CASE WHEN r.permissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
          roles_clause, coalesce(qual, 'true'));
      ELSIF r.cmd = '*' THEN
        EXECUTE format('CREATE POLICY %I ON %I.%I AS %s FOR ALL%s USING (%s) WITH CHECK (%s)',
          r.polname, v_tgt, r.tablename,
          CASE WHEN r.permissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
          roles_clause, coalesce(qual, 'true'), coalesce(chk, qual, 'true'));
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'policy % en % omitido: %', r.polname, r.tablename, SQLERRM;
    END;
  END LOOP;

  -- Grants
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO authenticated', v_tgt);
  EXECUTE format('GRANT ALL ON ALL TABLES IN SCHEMA %I TO postgres, service_role', v_tgt);
  EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO authenticated', v_tgt);
  EXECUTE format('GRANT ALL ON ALL SEQUENCES IN SCHEMA %I TO postgres, service_role', v_tgt);

  -- Vistas (varias pasadas por dependencias)
  FOR v_pass IN 1..12 LOOP
    FOR r IN
      SELECT c.relname::text AS vname
        FROM pg_class     c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = v_src
         AND c.relkind = 'v'
    LOOP
      SELECT pg_get_viewdef(format('%I.%I', v_src, r.vname)::regclass, true) INTO v_viewdef;
      IF v_viewdef IS NULL THEN CONTINUE; END IF;
      v_viewdef := public._neura_rewrite_schema_refs(v_viewdef, v_src, v_tgt, v_tables);
      BEGIN
        EXECUTE format('DROP VIEW IF EXISTS %I.%I CASCADE', v_tgt, r.vname);
        EXECUTE format('CREATE VIEW %I.%I AS %s', v_tgt, r.vname, v_viewdef);
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'vista % pasada % omitida: %', r.vname, v_pass, SQLERRM;
      END;
    END LOOP;
  END LOOP;

  -- Materialized views
  FOR r IN
    SELECT c.relname::text AS mname
      FROM pg_class     c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = v_src
       AND c.relkind = 'm'
  LOOP
    SELECT pg_get_viewdef(format('%I.%I', v_src, r.mname)::regclass, true) INTO v_viewdef;
    IF v_viewdef IS NULL THEN CONTINUE; END IF;
    v_viewdef := public._neura_rewrite_schema_refs(v_viewdef, v_src, v_tgt, v_tables);
    BEGIN
      EXECUTE format('DROP MATERIALIZED VIEW IF EXISTS %I.%I CASCADE', v_tgt, r.mname);
      EXECUTE format('CREATE MATERIALIZED VIEW %I.%I AS %s WITH NO DATA', v_tgt, r.mname, v_viewdef);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'matview % omitida: %', r.mname, SQLERRM;
    END;
  END LOOP;

  -- Funciones / procedures: varias rondas para resolver dependencias
  FOR v_round IN 1..20 LOOP
    v_now := 0;
    FOR fn_oid IN
      SELECT p.oid
        FROM pg_proc      p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        JOIN pg_language  l ON p.prolang = l.oid
       WHERE n.nspname = v_src
         AND p.prokind IN ('f','p')
         AND l.lanname IN ('plpgsql','sql')
    LOOP
      fdef := pg_get_functiondef(fn_oid);
      IF fdef IS NULL THEN CONTINUE; END IF;
      IF position('CREATE OR REPLACE FUNCTION ' || v_src || '.' IN fdef) = 0
         AND position('CREATE OR REPLACE PROCEDURE ' || v_src || '.' IN fdef) = 0 THEN
        CONTINUE;
      END IF;
      fdef := replace(fdef, 'CREATE OR REPLACE FUNCTION ' || v_src || '.', 'CREATE OR REPLACE FUNCTION ' || v_tgt || '.');
      fdef := replace(fdef, 'CREATE OR REPLACE PROCEDURE ' || v_src || '.', 'CREATE OR REPLACE PROCEDURE ' || v_tgt || '.');
      fdef := public._neura_rewrite_schema_refs(fdef, v_src, v_tgt, v_tables);
      BEGIN
        EXECUTE fdef;
        v_now := v_now + 1;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END LOOP;
    EXIT WHEN v_now = 0;
  END LOOP;

  EXECUTE format('GRANT EXECUTE ON ALL ROUTINES IN SCHEMA %I TO authenticated, service_role', v_tgt);
  EXECUTE format('GRANT ALL ON ALL ROUTINES IN SCHEMA %I TO postgres, service_role', v_tgt);

  -- Realtime: copiar membresía
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = v_pub) THEN
    FOR r IN
      SELECT pt.tablename::text AS tablename
        FROM pg_publication_tables pt
       WHERE pt.pubname = v_pub
         AND pt.schemaname = v_src
         AND pt.tablename = ANY (v_tables)
    LOOP
      BEGIN
        EXECUTE format('ALTER PUBLICATION %I ADD TABLE %I.%I', v_pub, v_tgt, r.tablename);
      EXCEPTION WHEN duplicate_object THEN NULL;
      WHEN OTHERS THEN
        RAISE NOTICE 'realtime % omitido: %', r.tablename, SQLERRM;
      END;
    END LOOP;
  END IF;

  PERFORM pg_notify('pgrst', 'reload schema');
END;
$$;

REVOKE ALL ON FUNCTION public.neura_clone_schema(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.neura_clone_schema(text, text) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 4 — Ejecutar el clonado. Puede tardar varios segundos.
-- ─────────────────────────────────────────────────────────────────────────────

SELECT public.neura_clone_schema('ncgconstructora', 'ncgeventos');

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 5 — Verificación (READ-ONLY).
-- ─────────────────────────────────────────────────────────────────────────────

SELECT 'tablas' AS tipo,
       (SELECT COUNT(*)::int FROM information_schema.tables
         WHERE table_schema='ncgconstructora' AND table_type='BASE TABLE') AS fuente,
       (SELECT COUNT(*)::int FROM information_schema.tables
         WHERE table_schema='ncgeventos'      AND table_type='BASE TABLE') AS destino
UNION ALL
SELECT 'indices',
       (SELECT COUNT(*)::int FROM pg_indexes WHERE schemaname='ncgconstructora'),
       (SELECT COUNT(*)::int FROM pg_indexes WHERE schemaname='ncgeventos')
UNION ALL
SELECT 'policies',
       (SELECT COUNT(*)::int FROM pg_policies WHERE schemaname='ncgconstructora'),
       (SELECT COUNT(*)::int FROM pg_policies WHERE schemaname='ncgeventos')
UNION ALL
SELECT 'triggers',
       (SELECT COUNT(*)::int FROM information_schema.triggers WHERE trigger_schema='ncgconstructora'),
       (SELECT COUNT(*)::int FROM information_schema.triggers WHERE trigger_schema='ncgeventos')
UNION ALL
SELECT 'funciones',
       (SELECT COUNT(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='ncgconstructora'),
       (SELECT COUNT(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='ncgeventos');

-- Tablas faltantes en destino (si hay alguna, revisar logs del paso 4).
SELECT 'falta_en_destino' AS issue, table_name
  FROM information_schema.tables
 WHERE table_schema = 'ncgconstructora' AND table_type = 'BASE TABLE'
   AND table_name NOT IN (
     SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'ncgeventos' AND table_type = 'BASE TABLE'
   )
 ORDER BY table_name;

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 6 — Agregar `ncgeventos` a pgrst.db_schemas.
-- LEER primero la lista actual, después descomentar el ALTER ROLE.
-- ─────────────────────────────────────────────────────────────────────────────

SELECT unnest(setconfig) AS setting
  FROM pg_db_role_setting s
  JOIN pg_database d ON d.oid = s.setdatabase
  JOIN pg_roles    r ON r.oid = s.setrole
 WHERE r.rolname = 'authenticator'
   AND d.datname = 'postgres';

-- Reemplazar <LISTA_ACTUAL> por el valor exacto que salió arriba:
-- ALTER ROLE authenticator IN DATABASE postgres
--   SET pgrst.db_schemas = '<LISTA_ACTUAL>,ncgeventos';
-- NOTIFY pgrst, 'reload config';
-- NOTIFY pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 7 — Seed empresa y admin (ver archivos 06 y 07 del bootstrap).
-- ─────────────────────────────────────────────────────────────────────────────
