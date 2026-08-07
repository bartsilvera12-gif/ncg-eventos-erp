-- ============================================================================
--  NCG Eventos — Quitar categoría 'Menaje de cocina' del catálogo
--  ----------------------------------------------------------------------------
--  La clienta pidió no manejar alimentos en el inventario. 'Menaje de cocina'
--  quedaba fuera de scope. Solo se elimina si no tiene productos asociados
--  (defensivo: no rompe si algún producto ya está en la categoría).
--  Aditivo/idempotente.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema='ncgeventos' AND table_name='categorias_productos'
  ) THEN
    RAISE NOTICE '[quitar-menaje] categorias_productos no existe; skip.';
    RETURN;
  END IF;

  -- Solo borra las categorías 'Menaje de cocina' que no tengan productos
  -- asociados en producto_categorias (join N:N).
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema='ncgeventos' AND table_name='producto_categorias'
  ) THEN
    DELETE FROM ncgeventos.categorias_productos c
     WHERE lower(c.nombre) = 'menaje de cocina'
       AND NOT EXISTS (
         SELECT 1 FROM ncgeventos.producto_categorias pc
          WHERE pc.categoria_id = c.id
       );
  ELSE
    -- Sin tabla de N:N, borrar directo.
    DELETE FROM ncgeventos.categorias_productos
     WHERE lower(nombre) = 'menaje de cocina';
  END IF;
END$$;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- VALIDACIÓN:
--   SELECT nombre FROM ncgeventos.categorias_productos
--    WHERE lower(nombre) = 'menaje de cocina';
--   -- Esperado: 0 filas (o filas cuyos productos siguen usándola — no las tocamos).
-- ─────────────────────────────────────────────────────────────────────────────
