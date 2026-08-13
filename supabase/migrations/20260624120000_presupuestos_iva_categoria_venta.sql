-- ============================================================================
--  NCG Eventos — Presupuestos: IVA por línea + categoría/unidad/descuento
--                              + condiciones_pago + venta_id (link a venta
--                              generada al aprobar).
--  ----------------------------------------------------------------------------
--  Aditivo/idempotente/defensivo. Solo schema `ncgeventos`.
--  Cambios:
--   evento_presupuestos:
--     + base_imponible   numeric  (suma de subtotales netos, sin IVA)
--     + monto_iva        numeric  (suma del IVA de todas las líneas)
--     + condiciones_pago text     (texto libre visible al pie del PDF)
--     + venta_id         uuid     (FK opcional a ventas cuando se aprueba)
--
--   evento_presupuesto_items:
--     + unidad          text NOT NULL DEFAULT 'u'
--     + categoria       text
--     + descuento_pct   numeric NOT NULL DEFAULT 0  (0-100)
--     + iva_pct         numeric NOT NULL DEFAULT 10 (0, 5 o 10)
--
--  `total` en evento_presupuestos se mantiene y ahora = base_imponible + monto_iva.
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) evento_presupuestos: base_imponible / monto_iva / condiciones_pago / venta_id
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema='ncgeventos' AND table_name='evento_presupuestos'
  ) THEN
    RAISE NOTICE '[presupuestos-iva] evento_presupuestos no existe; skip.';
    RETURN;
  END IF;

  ALTER TABLE ncgeventos.evento_presupuestos
    ADD COLUMN IF NOT EXISTS base_imponible   numeric NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS monto_iva        numeric NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS condiciones_pago text,
    ADD COLUMN IF NOT EXISTS venta_id         uuid;

  -- FK opcional a ventas si esa tabla existe en el mismo schema.
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema='ncgeventos' AND table_name='ventas'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
     WHERE table_schema='ncgeventos' AND table_name='evento_presupuestos'
       AND constraint_name='evento_presupuestos_venta_fk'
  ) THEN
    ALTER TABLE ncgeventos.evento_presupuestos
      ADD CONSTRAINT evento_presupuestos_venta_fk
      FOREIGN KEY (venta_id)
      REFERENCES ncgeventos.ventas(id) ON DELETE SET NULL;
  END IF;

  CREATE INDEX IF NOT EXISTS idx_presupuestos_venta
    ON ncgeventos.evento_presupuestos(venta_id);
END$$;

-- Backfill: para presupuestos existentes donde `total > 0` y base_imponible = 0,
-- asumimos que el total registrado era neto sin IVA (comportamiento anterior).
-- Marcar base_imponible = total y monto_iva = 0 preserva el importe cobrable.
UPDATE ncgeventos.evento_presupuestos
   SET base_imponible = total
 WHERE base_imponible = 0 AND total > 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) evento_presupuesto_items: unidad / categoria / descuento_pct / iva_pct
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema='ncgeventos' AND table_name='evento_presupuesto_items'
  ) THEN
    RAISE NOTICE '[presupuestos-iva] evento_presupuesto_items no existe; skip.';
    RETURN;
  END IF;

  ALTER TABLE ncgeventos.evento_presupuesto_items
    ADD COLUMN IF NOT EXISTS unidad        text    NOT NULL DEFAULT 'u',
    ADD COLUMN IF NOT EXISTS categoria     text,
    ADD COLUMN IF NOT EXISTS descuento_pct numeric NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS iva_pct       numeric NOT NULL DEFAULT 10;

  -- CHECKs: rangos válidos. Solo se crean si no existen.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname='presupuesto_items_descuento_check'
       AND conrelid='ncgeventos.evento_presupuesto_items'::regclass
  ) THEN
    ALTER TABLE ncgeventos.evento_presupuesto_items
      ADD CONSTRAINT presupuesto_items_descuento_check
      CHECK (descuento_pct >= 0 AND descuento_pct <= 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname='presupuesto_items_iva_check'
       AND conrelid='ncgeventos.evento_presupuesto_items'::regclass
  ) THEN
    ALTER TABLE ncgeventos.evento_presupuesto_items
      ADD CONSTRAINT presupuesto_items_iva_check
      CHECK (iva_pct IN (0, 5, 10));
  END IF;
END$$;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- VALIDACIÓN:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema='ncgeventos' AND table_name='evento_presupuestos'
--      AND column_name IN ('base_imponible','monto_iva','condiciones_pago','venta_id');
--
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema='ncgeventos' AND table_name='evento_presupuesto_items'
--      AND column_name IN ('unidad','categoria','descuento_pct','iva_pct');
-- ─────────────────────────────────────────────────────────────────────────────
