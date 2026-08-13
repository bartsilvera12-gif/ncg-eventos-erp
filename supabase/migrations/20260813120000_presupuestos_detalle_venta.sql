-- ============================================================================
--  Presupuestos de eventos: detalle extendido + vínculo con venta.
--
--  Agrega a evento_presupuestos:
--    - base_imponible, monto_iva  (totales fiscales desglosados)
--    - condiciones_pago           (texto libre para el pie del documento)
--    - venta_id                   (la venta creada al aprobar)
--
--  Agrega a evento_presupuesto_items:
--    - unidad                     (u, pax, hora, día, servicio, paquete…)
--    - categoria                  (agrupador visible: CATERING, DECORACIÓN…)
--    - descuento_pct              (0-100)
--    - iva_pct                    (0 | 5 | 10 en PY)
--
--  ADITIVO + IDEMPOTENTE.
-- ============================================================================

BEGIN;

ALTER TABLE ncgeventos.evento_presupuestos
  ADD COLUMN IF NOT EXISTS base_imponible  numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monto_iva       numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS condiciones_pago text,
  ADD COLUMN IF NOT EXISTS venta_id        uuid;

ALTER TABLE ncgeventos.evento_presupuesto_items
  ADD COLUMN IF NOT EXISTS unidad         text NOT NULL DEFAULT 'u',
  ADD COLUMN IF NOT EXISTS categoria      text,
  ADD COLUMN IF NOT EXISTS descuento_pct  numeric NOT NULL DEFAULT 0
                              CHECK (descuento_pct >= 0 AND descuento_pct <= 100),
  ADD COLUMN IF NOT EXISTS iva_pct        numeric NOT NULL DEFAULT 10
                              CHECK (iva_pct IN (0, 5, 10));

COMMIT;
