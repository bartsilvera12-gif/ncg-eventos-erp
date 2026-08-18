-- ============================================================================
--  NCG Eventos — Cotización: snapshot de datos del cliente
--  ----------------------------------------------------------------------------
--  Permite guardar la cotización con los datos del cliente escritos a mano
--  (sin haberlo creado aún en /clientes). Al aprobar la cotización, el cliente
--  se crea recién ahí y se vincula.
--
--  Cambios en ncgeventos.evento_presupuestos:
--    + cliente_nombre_snapshot   text   — Nombre/razón social a mano.
--    + cliente_telefono_snapshot text
--    + cliente_email_snapshot    text
--
--  cliente_id sigue nullable (ya lo era desde 20260625). Si al crear la
--  cotización el usuario elige un cliente existente, se guarda cliente_id.
--  Si escribe datos a mano, se guardan los snapshot_* y cliente_id=null.
--  Al aprobar, si no hay cliente_id pero sí snapshot, la API crea el cliente
--  y setea cliente_id.
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
    RAISE NOTICE '[cotizacion-snapshot] evento_presupuestos no existe; skip.';
    RETURN;
  END IF;

  ALTER TABLE ncgeventos.evento_presupuestos
    ADD COLUMN IF NOT EXISTS cliente_nombre_snapshot   text,
    ADD COLUMN IF NOT EXISTS cliente_telefono_snapshot text,
    ADD COLUMN IF NOT EXISTS cliente_email_snapshot    text;
END$$;

COMMIT;
