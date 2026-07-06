-- ============================================================================
--  Módulo Alquileres — NCG Eventos ERP (schema `ncgeventos`)
--  ----------------------------------------------------------------------------
--  Qué agrega:
--   1) Columnas tarifa_alquiler_hora / tarifa_alquiler_dia en
--      ncgeventos.productos.
--   2) Tabla ncgeventos.alquileres (cabecera: cliente, fechas, estado, total).
--   3) Tabla ncgeventos.alquiler_items (líneas: producto, cantidad, tarifa,
--      unidad hora/día).
--   4) Función ncgeventos.recupero_producto(uuid) que devuelve:
--        costo_total_invertido  = Σ compras (cantidad × costo_unitario)
--        ingreso_real_alquiler  = Σ alquiler_items.subtotal (excluye anulados)
--        porcentaje_recuperado, monto_faltante.
--
--  Reglas: ADITIVO + IDEMPOTENTE (IF NOT EXISTS / DO blocks defensivos).
--  Solo schema `ncgeventos`. RLS con ncgeventos.puede_acceder_empresa(uuid)
--  espejo de las tablas hermanas (ventas_items, compras_items, productos).
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- VALIDACIÓN PREVIA (READ-ONLY):
--   SELECT to_regclass('ncgeventos.productos')      AS productos_existe,
--          to_regclass('ncgeventos.clientes')       AS clientes_existe,
--          to_regclass('ncgeventos.compras')        AS compras_existe,
--          to_regclass('ncgeventos.alquileres')     AS alquileres_ya,
--          to_regclass('ncgeventos.alquiler_items') AS items_ya;
--   -- Esperado ANTES: productos/clientes/compras NOT NULL; alquileres/items NULL.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. productos: tarifas de alquiler (idempotente)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE ncgeventos.productos
  ADD COLUMN IF NOT EXISTS tarifa_alquiler_hora numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tarifa_alquiler_dia  numeric NOT NULL DEFAULT 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. alquileres (cabecera)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ncgeventos.alquileres (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL,
  cliente_id      uuid NOT NULL
                    REFERENCES ncgeventos.clientes(id) ON DELETE RESTRICT,
  fecha_inicio    timestamptz NOT NULL,
  fecha_fin       timestamptz NOT NULL,
  estado          text NOT NULL DEFAULT 'reservado'
                    CHECK (estado IN ('reservado', 'activo', 'finalizado', 'anulado')),
  total           numeric NOT NULL DEFAULT 0,
  observaciones   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (fecha_fin >= fecha_inicio)
);

CREATE INDEX IF NOT EXISTS idx_alquileres_empresa
  ON ncgeventos.alquileres(empresa_id);
CREATE INDEX IF NOT EXISTS idx_alquileres_cliente
  ON ncgeventos.alquileres(cliente_id);
CREATE INDEX IF NOT EXISTS idx_alquileres_fecha_inicio
  ON ncgeventos.alquileres(fecha_inicio);
CREATE INDEX IF NOT EXISTS idx_alquileres_estado
  ON ncgeventos.alquileres(estado);

GRANT SELECT, INSERT, UPDATE, DELETE ON ncgeventos.alquileres
  TO anon, authenticated, authenticator, service_role;

ALTER TABLE ncgeventos.alquileres ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF to_regprocedure('ncgeventos.puede_acceder_empresa(uuid)') IS NULL THEN
    RAISE NOTICE '[alquileres] ncgeventos.puede_acceder_empresa(uuid) no existe; policies omitidas (RLS queda activo sin policies).';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies
                  WHERE schemaname='ncgeventos' AND tablename='alquileres'
                    AND policyname='alquileres_select') THEN
    CREATE POLICY "alquileres_select" ON ncgeventos.alquileres FOR SELECT
      USING (ncgeventos.puede_acceder_empresa(empresa_id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies
                  WHERE schemaname='ncgeventos' AND tablename='alquileres'
                    AND policyname='alquileres_insert') THEN
    CREATE POLICY "alquileres_insert" ON ncgeventos.alquileres FOR INSERT
      WITH CHECK (ncgeventos.puede_acceder_empresa(empresa_id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies
                  WHERE schemaname='ncgeventos' AND tablename='alquileres'
                    AND policyname='alquileres_update') THEN
    CREATE POLICY "alquileres_update" ON ncgeventos.alquileres FOR UPDATE
      USING (ncgeventos.puede_acceder_empresa(empresa_id))
      WITH CHECK (ncgeventos.puede_acceder_empresa(empresa_id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies
                  WHERE schemaname='ncgeventos' AND tablename='alquileres'
                    AND policyname='alquileres_delete') THEN
    CREATE POLICY "alquileres_delete" ON ncgeventos.alquileres FOR DELETE
      USING (ncgeventos.puede_acceder_empresa(empresa_id));
  END IF;
END$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. alquiler_items (líneas)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ncgeventos.alquiler_items (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id         uuid NOT NULL,
  alquiler_id        uuid NOT NULL
                       REFERENCES ncgeventos.alquileres(id) ON DELETE CASCADE,
  producto_id        uuid NOT NULL
                       REFERENCES ncgeventos.productos(id)  ON DELETE RESTRICT,
  producto_nombre    text    NOT NULL,
  cantidad           numeric NOT NULL CHECK (cantidad > 0),
  unidad             text    NOT NULL CHECK (unidad IN ('hora', 'dia')),
  cantidad_unidades  numeric NOT NULL CHECK (cantidad_unidades > 0),
  tarifa_unitaria    numeric NOT NULL DEFAULT 0,
  subtotal           numeric NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alquiler_items_alquiler
  ON ncgeventos.alquiler_items(alquiler_id);
CREATE INDEX IF NOT EXISTS idx_alquiler_items_producto
  ON ncgeventos.alquiler_items(producto_id);
CREATE INDEX IF NOT EXISTS idx_alquiler_items_empresa
  ON ncgeventos.alquiler_items(empresa_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON ncgeventos.alquiler_items
  TO anon, authenticated, authenticator, service_role;

ALTER TABLE ncgeventos.alquiler_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF to_regprocedure('ncgeventos.puede_acceder_empresa(uuid)') IS NULL THEN
    RAISE NOTICE '[alquiler_items] ncgeventos.puede_acceder_empresa(uuid) no existe; policies omitidas.';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies
                  WHERE schemaname='ncgeventos' AND tablename='alquiler_items'
                    AND policyname='alquiler_items_select') THEN
    CREATE POLICY "alquiler_items_select" ON ncgeventos.alquiler_items FOR SELECT
      USING (ncgeventos.puede_acceder_empresa(empresa_id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies
                  WHERE schemaname='ncgeventos' AND tablename='alquiler_items'
                    AND policyname='alquiler_items_insert') THEN
    CREATE POLICY "alquiler_items_insert" ON ncgeventos.alquiler_items FOR INSERT
      WITH CHECK (ncgeventos.puede_acceder_empresa(empresa_id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies
                  WHERE schemaname='ncgeventos' AND tablename='alquiler_items'
                    AND policyname='alquiler_items_update') THEN
    CREATE POLICY "alquiler_items_update" ON ncgeventos.alquiler_items FOR UPDATE
      USING (ncgeventos.puede_acceder_empresa(empresa_id))
      WITH CHECK (ncgeventos.puede_acceder_empresa(empresa_id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies
                  WHERE schemaname='ncgeventos' AND tablename='alquiler_items'
                    AND policyname='alquiler_items_delete') THEN
    CREATE POLICY "alquiler_items_delete" ON ncgeventos.alquiler_items FOR DELETE
      USING (ncgeventos.puede_acceder_empresa(empresa_id));
  END IF;
END$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Función recupero_producto(producto_id)
--    Devuelve costo invertido (compras no anuladas) vs. ingreso real
--    (alquiler_items de alquileres no anulados).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION ncgeventos.recupero_producto(p_producto_id uuid)
RETURNS TABLE (
  producto_id            uuid,
  costo_total_invertido  numeric,
  ingreso_real_alquiler  numeric,
  porcentaje_recuperado  numeric,
  monto_faltante         numeric
)
LANGUAGE sql
STABLE
AS $$
  WITH costo AS (
    SELECT COALESCE(SUM(c.cantidad * c.costo_unitario), 0) AS total
      FROM ncgeventos.compras c
     WHERE c.producto_id = p_producto_id
       AND c.estado <> 'anulada'
  ),
  ingreso AS (
    SELECT COALESCE(SUM(ai.subtotal), 0) AS total
      FROM ncgeventos.alquiler_items ai
      JOIN ncgeventos.alquileres a ON a.id = ai.alquiler_id
     WHERE ai.producto_id = p_producto_id
       AND a.estado <> 'anulado'
  )
  SELECT
    p_producto_id,
    costo.total,
    ingreso.total,
    CASE WHEN costo.total > 0
         THEN ROUND((ingreso.total / costo.total) * 100, 2)
         ELSE 0
    END,
    GREATEST(costo.total - ingreso.total, 0)
  FROM costo, ingreso;
$$;

GRANT EXECUTE ON FUNCTION ncgeventos.recupero_producto(uuid)
  TO anon, authenticated, authenticator, service_role;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- VALIDACIÓN POSTERIOR (READ-ONLY):
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema='ncgeventos' AND table_name='productos'
--      AND column_name IN ('tarifa_alquiler_hora','tarifa_alquiler_dia');
--   -- Esperado: 2 filas.
--
--   SELECT to_regclass('ncgeventos.alquileres')     AS alquileres,
--          to_regclass('ncgeventos.alquiler_items') AS items;
--   -- Esperado: ambas NOT NULL.
--
--   SELECT * FROM ncgeventos.recupero_producto('<uuid-producto>');
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK LÓGICO (NO destructivo): la app puede dejar de usar el módulo.
-- Para borrado físico (requiere autorización explícita):
--   DROP FUNCTION IF EXISTS ncgeventos.recupero_producto(uuid);
--   DROP TABLE    IF EXISTS ncgeventos.alquiler_items;
--   DROP TABLE    IF EXISTS ncgeventos.alquileres;
--   ALTER TABLE   ncgeventos.productos
--     DROP COLUMN IF EXISTS tarifa_alquiler_hora,
--     DROP COLUMN IF EXISTS tarifa_alquiler_dia;
-- ─────────────────────────────────────────────────────────────────────────────
