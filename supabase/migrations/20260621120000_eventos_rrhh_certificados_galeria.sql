-- ============================================================================
--  NCG Eventos — RRHH mínimo + Certificados empresa + Galería evento + Seed
--  ----------------------------------------------------------------------------
--  Aditivo + idempotente. Solo schema `ncgeventos`.
--
--  Qué agrega:
--   1) RRHH mínimo:
--        - ncgeventos.tipos_empleado (catálogo: chofer, mozo, decorador, DJ…)
--        - ncgeventos.empleados
--        - ncgeventos.empleado_vacaciones
--        (Sin fichaje/control-horario ni nómina compleja.)
--   2) Certificados de empresa (con vencimiento + alerta N días antes).
--   3) proyecto_archivos.tipo (foto | documento | otro) + orden — para servir
--        de galería del evento sin crear tabla nueva.
--   4) Seed de categorías de inventario típicas de eventos (mantelería,
--        muebles, juguetería, decoración, vajilla, iluminación, sonido) por
--        cada empresa activa.
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. RRHH mínimo
--    Defensivo: si las tablas ya existen (clonadas de constructora) con
--    columnas distintas, agrega solo las faltantes.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ncgeventos.tipos_empleado (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   uuid NOT NULL,
  nombre       text NOT NULL,
  descripcion  text,
  activo       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
-- Columnas por si la tabla ya existía con otro schema.
ALTER TABLE ncgeventos.tipos_empleado
  ADD COLUMN IF NOT EXISTS empresa_id  uuid,
  ADD COLUMN IF NOT EXISTS nombre      text,
  ADD COLUMN IF NOT EXISTS descripcion text,
  ADD COLUMN IF NOT EXISTS activo      boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at  timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at  timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS uq_tipos_empleado_nombre
  ON ncgeventos.tipos_empleado(empresa_id, lower(nombre));

CREATE TABLE IF NOT EXISTS ncgeventos.empleados (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        uuid NOT NULL,
  nombre_completo   text NOT NULL,
  activo            boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
-- Columnas por si la tabla ya existía con otro schema (clonado constructora).
ALTER TABLE ncgeventos.empleados
  ADD COLUMN IF NOT EXISTS empresa_id       uuid,
  ADD COLUMN IF NOT EXISTS tipo_empleado_id uuid,
  ADD COLUMN IF NOT EXISTS nombre_completo  text,
  ADD COLUMN IF NOT EXISTS documento        text,
  ADD COLUMN IF NOT EXISTS telefono         text,
  ADD COLUMN IF NOT EXISTS email            text,
  ADD COLUMN IF NOT EXISTS direccion        text,
  ADD COLUMN IF NOT EXISTS fecha_ingreso    date,
  ADD COLUMN IF NOT EXISTS fecha_nacimiento date,
  ADD COLUMN IF NOT EXISTS cargo            text,
  ADD COLUMN IF NOT EXISTS salario_base     numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS activo           boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS observaciones    text,
  ADD COLUMN IF NOT EXISTS created_at       timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at       timestamptz NOT NULL DEFAULT now();

-- FK a tipos_empleado si aún no existe.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
     WHERE table_schema='ncgeventos' AND table_name='empleados'
       AND constraint_name='empleados_tipo_empleado_fk'
  ) THEN
    ALTER TABLE ncgeventos.empleados
      ADD CONSTRAINT empleados_tipo_empleado_fk
      FOREIGN KEY (tipo_empleado_id)
      REFERENCES ncgeventos.tipos_empleado(id) ON DELETE SET NULL;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_empleados_empresa ON ncgeventos.empleados(empresa_id);
CREATE INDEX IF NOT EXISTS idx_empleados_tipo    ON ncgeventos.empleados(tipo_empleado_id);

CREATE TABLE IF NOT EXISTS ncgeventos.empleado_vacaciones (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid NOT NULL,
  empleado_id   uuid NOT NULL,
  fecha_desde   date NOT NULL,
  fecha_hasta   date NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE ncgeventos.empleado_vacaciones
  ADD COLUMN IF NOT EXISTS empresa_id    uuid,
  ADD COLUMN IF NOT EXISTS empleado_id   uuid,
  ADD COLUMN IF NOT EXISTS fecha_desde   date,
  ADD COLUMN IF NOT EXISTS fecha_hasta   date,
  ADD COLUMN IF NOT EXISTS dias          integer,
  ADD COLUMN IF NOT EXISTS motivo        text,
  ADD COLUMN IF NOT EXISTS aprobado      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS observaciones text,
  ADD COLUMN IF NOT EXISTS created_at    timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
     WHERE table_schema='ncgeventos' AND table_name='empleado_vacaciones'
       AND constraint_name='empleado_vacaciones_empleado_fk'
  ) THEN
    ALTER TABLE ncgeventos.empleado_vacaciones
      ADD CONSTRAINT empleado_vacaciones_empleado_fk
      FOREIGN KEY (empleado_id)
      REFERENCES ncgeventos.empleados(id) ON DELETE CASCADE;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_vacaciones_empleado ON ncgeventos.empleado_vacaciones(empleado_id);
CREATE INDEX IF NOT EXISTS idx_vacaciones_empresa  ON ncgeventos.empleado_vacaciones(empresa_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Certificados de empresa
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ncgeventos.certificados_empresa (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id            uuid NOT NULL,
  nombre                text NOT NULL,
  activo                boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
-- Defensivo: por si la tabla ya existía con otro schema.
ALTER TABLE ncgeventos.certificados_empresa
  ADD COLUMN IF NOT EXISTS empresa_id        uuid,
  ADD COLUMN IF NOT EXISTS nombre            text,
  ADD COLUMN IF NOT EXISTS categoria         text NOT NULL DEFAULT 'otro',
  ADD COLUMN IF NOT EXISTS descripcion       text,
  ADD COLUMN IF NOT EXISTS emitido_por       text,
  ADD COLUMN IF NOT EXISTS numero            text,
  ADD COLUMN IF NOT EXISTS fecha_emision     date,
  ADD COLUMN IF NOT EXISTS fecha_vencimiento date,
  ADD COLUMN IF NOT EXISTS alerta_dias_antes integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS storage_bucket    text DEFAULT 'certificados',
  ADD COLUMN IF NOT EXISTS storage_path      text,
  ADD COLUMN IF NOT EXISTS archivo_nombre    text,
  ADD COLUMN IF NOT EXISTS archivo_mime      text,
  ADD COLUMN IF NOT EXISTS archivo_tamano    bigint,
  ADD COLUMN IF NOT EXISTS activo            boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS observaciones     text,
  ADD COLUMN IF NOT EXISTS created_at        timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at        timestamptz NOT NULL DEFAULT now();

-- CHECK constraint sobre categoria (crear solo si no existe).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'certificados_categoria_check'
       AND conrelid = 'ncgeventos.certificados_empresa'::regclass
  ) THEN
    ALTER TABLE ncgeventos.certificados_empresa
      ADD CONSTRAINT certificados_categoria_check
      CHECK (categoria IN (
        'habilitacion', 'seguro', 'certificado', 'licencia',
        'permiso', 'contrato', 'otro'
      ));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_certificados_empresa    ON ncgeventos.certificados_empresa(empresa_id);
CREATE INDEX IF NOT EXISTS idx_certificados_venc       ON ncgeventos.certificados_empresa(fecha_vencimiento);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. proyecto_archivos: tipo + orden (para galería de evento)
--    Solo si la tabla existe en ncgeventos (fue creada por el bootstrap).
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema='ncgeventos' AND table_name='proyecto_archivos'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema='ncgeventos' AND table_name='proyecto_archivos'
         AND column_name='tipo'
    ) THEN
      ALTER TABLE ncgeventos.proyecto_archivos
        ADD COLUMN tipo text NOT NULL DEFAULT 'documento'
          CHECK (tipo IN ('foto', 'documento', 'otro'));
      -- Backfill: si el mime empieza con 'image/' marcarlo como foto.
      UPDATE ncgeventos.proyecto_archivos
         SET tipo = 'foto'
       WHERE mime_type LIKE 'image/%';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema='ncgeventos' AND table_name='proyecto_archivos'
         AND column_name='orden'
    ) THEN
      ALTER TABLE ncgeventos.proyecto_archivos
        ADD COLUMN orden integer NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema='ncgeventos' AND table_name='proyecto_archivos'
         AND column_name='descripcion'
    ) THEN
      ALTER TABLE ncgeventos.proyecto_archivos
        ADD COLUMN descripcion text;
    END IF;

    CREATE INDEX IF NOT EXISTS idx_proyecto_archivos_tipo
      ON ncgeventos.proyecto_archivos(proyecto_id, tipo);
  END IF;
END$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. GRANTs + RLS defensivos
-- ─────────────────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON ncgeventos.tipos_empleado,
       ncgeventos.empleados, ncgeventos.empleado_vacaciones,
       ncgeventos.certificados_empresa
  TO anon, authenticated, authenticator, service_role;

ALTER TABLE ncgeventos.tipos_empleado       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ncgeventos.empleados            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ncgeventos.empleado_vacaciones  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ncgeventos.certificados_empresa ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tabla text;
  tablas text[] := ARRAY[
    'tipos_empleado', 'empleados', 'empleado_vacaciones', 'certificados_empresa'
  ];
BEGIN
  IF to_regprocedure('ncgeventos.puede_acceder_empresa(uuid)') IS NULL THEN
    RAISE NOTICE '[eventos-rrhh] puede_acceder_empresa no existe; policies omitidas.';
    RETURN;
  END IF;

  FOREACH tabla IN ARRAY tablas LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON ncgeventos.%I', tabla || '_select', tabla);
    EXECUTE format(
      'CREATE POLICY %I ON ncgeventos.%I FOR SELECT USING (ncgeventos.puede_acceder_empresa(empresa_id))',
      tabla || '_select', tabla
    );
    EXECUTE format('DROP POLICY IF EXISTS %I ON ncgeventos.%I', tabla || '_insert', tabla);
    EXECUTE format(
      'CREATE POLICY %I ON ncgeventos.%I FOR INSERT WITH CHECK (ncgeventos.puede_acceder_empresa(empresa_id))',
      tabla || '_insert', tabla
    );
    EXECUTE format('DROP POLICY IF EXISTS %I ON ncgeventos.%I', tabla || '_update', tabla);
    EXECUTE format(
      'CREATE POLICY %I ON ncgeventos.%I FOR UPDATE USING (ncgeventos.puede_acceder_empresa(empresa_id)) WITH CHECK (ncgeventos.puede_acceder_empresa(empresa_id))',
      tabla || '_update', tabla
    );
    EXECUTE format('DROP POLICY IF EXISTS %I ON ncgeventos.%I', tabla || '_delete', tabla);
    EXECUTE format(
      'CREATE POLICY %I ON ncgeventos.%I FOR DELETE USING (ncgeventos.puede_acceder_empresa(empresa_id))',
      tabla || '_delete', tabla
    );
  END LOOP;
END$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Seed de categorías típicas de eventos (por empresa existente)
--    Idempotente: ON CONFLICT no re-crea.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  emp_row RECORD;
  categorias CONSTANT text[] := ARRAY[
    'Mantelería', 'Muebles', 'Juguetería', 'Decoración',
    'Vajilla y cubertería', 'Iluminación', 'Sonido',
    'Textil y sillones', 'Extras'
  ];
  cat text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema='ncgeventos' AND table_name='categorias_productos'
  ) THEN
    RAISE NOTICE '[eventos-seed] categorias_productos no existe; seed omitido.';
    RETURN;
  END IF;

  FOR emp_row IN SELECT DISTINCT empresa_id FROM ncgeventos.productos LOOP
    FOREACH cat IN ARRAY categorias LOOP
      BEGIN
        INSERT INTO ncgeventos.categorias_productos (empresa_id, nombre)
        VALUES (emp_row.empresa_id, cat)
        ON CONFLICT DO NOTHING;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '[eventos-seed] no se pudo insertar %: %', cat, SQLERRM;
      END;
    END LOOP;
  END LOOP;
END$$;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- VALIDACIÓN POSTERIOR:
--   SELECT to_regclass('ncgeventos.empleados'),
--          to_regclass('ncgeventos.tipos_empleado'),
--          to_regclass('ncgeventos.empleado_vacaciones'),
--          to_regclass('ncgeventos.certificados_empresa');
--
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema='ncgeventos' AND table_name='proyecto_archivos'
--      AND column_name IN ('tipo','orden','descripcion');
--
--   SELECT nombre FROM ncgeventos.categorias_productos
--    WHERE nombre IN ('Mantelería','Muebles','Juguetería') LIMIT 5;
-- ─────────────────────────────────────────────────────────────────────────────
