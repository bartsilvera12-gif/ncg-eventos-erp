-- ============================================================================
--  NCG Eventos — Cotizaciones standalone (presupuestos sin evento aún)
--  ----------------------------------------------------------------------------
--  Habilita crear presupuestos "sueltos" para cotizar consultas que aún no
--  son un evento firme. Al aprobar la cotización se crea el evento y se
--  vincula (proyecto_id).
--
--  Cambios en ncgeventos.evento_presupuestos:
--    * proyecto_id: NOT NULL → NULLABLE
--    * + cliente_id         uuid FK a clientes (nullable)
--    * + titulo_evento      text  — nombre tentativo del evento
--    * + tipo_evento        text  — Boda / Cumpleaños / etc.
--    * + fecha_evento_aprox date  — fecha tentativa
--    * + cantidad_invitados int
--
--  Aditivo/idempotente/defensivo. Solo schema `ncgeventos`.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema='ncgeventos' AND table_name='evento_presupuestos'
  ) THEN
    RAISE NOTICE '[cotizaciones] evento_presupuestos no existe; skip.';
    RETURN;
  END IF;

  -- 1) proyecto_id NULLABLE (para poder guardar cotizaciones sin evento aún).
  ALTER TABLE ncgeventos.evento_presupuestos
    ALTER COLUMN proyecto_id DROP NOT NULL;

  -- 2) Columnas nuevas para snapshot del evento tentativo.
  ALTER TABLE ncgeventos.evento_presupuestos
    ADD COLUMN IF NOT EXISTS cliente_id         uuid,
    ADD COLUMN IF NOT EXISTS titulo_evento      text,
    ADD COLUMN IF NOT EXISTS tipo_evento        text,
    ADD COLUMN IF NOT EXISTS fecha_evento_aprox date,
    ADD COLUMN IF NOT EXISTS cantidad_invitados integer;

  -- 3) FK a clientes si existe.
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema='ncgeventos' AND table_name='clientes'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
     WHERE table_schema='ncgeventos' AND table_name='evento_presupuestos'
       AND constraint_name='evento_presupuestos_cliente_fk'
  ) THEN
    ALTER TABLE ncgeventos.evento_presupuestos
      ADD CONSTRAINT evento_presupuestos_cliente_fk
      FOREIGN KEY (cliente_id) REFERENCES ncgeventos.clientes(id) ON DELETE SET NULL;
  END IF;

  CREATE INDEX IF NOT EXISTS idx_presupuestos_cliente
    ON ncgeventos.evento_presupuestos(cliente_id);
END$$;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- VALIDACIÓN:
--   SELECT column_name, is_nullable FROM information_schema.columns
--    WHERE table_schema='ncgeventos' AND table_name='evento_presupuestos'
--      AND column_name IN ('proyecto_id','cliente_id','titulo_evento',
--                          'tipo_evento','fecha_evento_aprox','cantidad_invitados');
--   -- Esperado: proyecto_id.is_nullable='YES' y 5 columnas nuevas presentes.
-- ─────────────────────────────────────────────────────────────────────────────
