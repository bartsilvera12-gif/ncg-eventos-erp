-- ============================================================================
--  NCG Eventos — Gastos: proyecto_id + comprobante (metadata + archivo)
--  ----------------------------------------------------------------------------
--  Aditivo/idempotente. Solo schema `ncgeventos`. Agrega:
--    - proyecto_id (FK opcional al evento asociado)
--    - comprobante_path / comprobante_nombre / comprobante_mime
--      (archivo del comprobante subido al bucket 'gastos')
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema='ncgeventos' AND table_name='gastos'
  ) THEN
    RAISE NOTICE '[gastos-evento] tabla gastos no existe; skip.';
    RETURN;
  END IF;

  -- Columnas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='ncgeventos' AND table_name='gastos'
       AND column_name='proyecto_id'
  ) THEN
    ALTER TABLE ncgeventos.gastos ADD COLUMN proyecto_id uuid;
    CREATE INDEX IF NOT EXISTS idx_gastos_proyecto ON ncgeventos.gastos(proyecto_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='ncgeventos' AND table_name='gastos'
       AND column_name='comprobante_path'
  ) THEN
    ALTER TABLE ncgeventos.gastos
      ADD COLUMN comprobante_path   text,
      ADD COLUMN comprobante_nombre text,
      ADD COLUMN comprobante_mime   text;
  END IF;

  -- FK a proyectos si no está y la tabla existe
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema='ncgeventos' AND table_name='proyectos'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
     WHERE table_schema='ncgeventos' AND table_name='gastos'
       AND constraint_name='gastos_proyecto_fk'
  ) THEN
    ALTER TABLE ncgeventos.gastos
      ADD CONSTRAINT gastos_proyecto_fk
      FOREIGN KEY (proyecto_id) REFERENCES ncgeventos.proyectos(id) ON DELETE SET NULL;
  END IF;
END$$;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- VALIDACIÓN:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema='ncgeventos' AND table_name='gastos'
--      AND column_name IN ('proyecto_id','comprobante_path','comprobante_nombre','comprobante_mime');
--   -- Esperado: 4 filas.
-- ─────────────────────────────────────────────────────────────────────────────
