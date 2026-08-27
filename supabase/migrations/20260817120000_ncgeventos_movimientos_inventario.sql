-- Asegurar que ncgeventos.movimientos_inventario exista + columnas de
-- auditoria/atribucion usadas por saveMovimiento del client.
--
-- Sintoma reportado: al cargar un movimiento manual desde
-- /inventario/movimientos/nuevo no se persiste nada; la request supabase
-- fallaba silenciosamente porque la tabla no existia en el schema tenant.

CREATE TABLE IF NOT EXISTS ncgeventos.movimientos_inventario (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL,
  producto_id     uuid NOT NULL,
  producto_nombre text NOT NULL,
  producto_sku    text NOT NULL,
  tipo            text NOT NULL CHECK (tipo IN ('ENTRADA','SALIDA','AJUSTE')),
  cantidad        numeric NOT NULL,
  costo_unitario  numeric NOT NULL DEFAULT 0,
  origen          text NOT NULL CHECK (origen IN ('compra','venta','ajuste_manual','inventario_inicial')),
  referencia      text,
  fecha           timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Auditoria + atribucion (agrego con IF NOT EXISTS para tolerar tabla ya creada).
ALTER TABLE ncgeventos.movimientos_inventario
  ADD COLUMN IF NOT EXISTS created_by       uuid;
ALTER TABLE ncgeventos.movimientos_inventario
  ADD COLUMN IF NOT EXISTS usuario_nombre   text;
ALTER TABLE ncgeventos.movimientos_inventario
  ADD COLUMN IF NOT EXISTS proyecto_id      uuid;
ALTER TABLE ncgeventos.movimientos_inventario
  ADD COLUMN IF NOT EXISTS venta_id         uuid;

CREATE INDEX IF NOT EXISTS idx_mov_inv_empresa   ON ncgeventos.movimientos_inventario(empresa_id);
CREATE INDEX IF NOT EXISTS idx_mov_inv_producto  ON ncgeventos.movimientos_inventario(producto_id);
CREATE INDEX IF NOT EXISTS idx_mov_inv_fecha     ON ncgeventos.movimientos_inventario(fecha);
CREATE INDEX IF NOT EXISTS idx_mov_inv_proyecto  ON ncgeventos.movimientos_inventario(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_mov_inv_venta     ON ncgeventos.movimientos_inventario(venta_id);

-- RLS: misma politica que las otras tablas del schema (solo si la funcion existe).
ALTER TABLE ncgeventos.movimientos_inventario ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'puede_acceder_empresa' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'ncgeventos')) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'ncgeventos' AND tablename = 'movimientos_inventario' AND policyname = 'mov_inv_tenant_rls') THEN
      EXECUTE $POL$
        CREATE POLICY mov_inv_tenant_rls ON ncgeventos.movimientos_inventario
          FOR ALL
          USING (ncgeventos.puede_acceder_empresa(empresa_id))
          WITH CHECK (ncgeventos.puede_acceder_empresa(empresa_id))
      $POL$;
    END IF;
  END IF;
END $$;

-- Refresh cache PostgREST.
NOTIFY pgrst, 'reload schema';
