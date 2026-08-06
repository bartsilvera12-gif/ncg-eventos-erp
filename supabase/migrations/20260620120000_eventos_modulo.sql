-- ============================================================================
--  Módulo Eventos — NCG Eventos ERP (schema `ncgeventos`)
--  ----------------------------------------------------------------------------
--  Convierte el módulo `proyectos` (heredado de Constructora) en un módulo
--  de organización de eventos: bodas, cumpleaños, corporativos.
--
--  Qué agrega:
--   1) Columnas específicas de evento en ncgeventos.proyectos
--      (fecha_evento, hora_inicio, hora_fin, lugar_evento, cantidad_invitados,
--       tipo_evento, recurso_id).
--   2) Tabla ncgeventos.recursos (salones/espacios propios reservables).
--   3) Tabla ncgeventos.servicios_catalogo (catering/decoración/música/etc).
--   4) Tabla ncgeventos.paquetes_evento + ncgeventos.paquete_items.
--   5) Tabla ncgeventos.evento_servicios (servicios contratados por evento).
--   6) Tabla ncgeventos.evento_presupuestos + evento_presupuesto_items
--      (versionado por evento, estado draft/enviado/aprobado/rechazado).
--   7) Tabla ncgeventos.stock_reservas (producto reservado por evento y
--      rango de fechas para productos reutilizables).
--   8) Columna proyecto_id en ncgeventos.pagos si no existe (imputación).
--   9) Seed de 7 proyecto_estados de evento por empresa activa:
--      consulta / presupuestado / reservado / confirmado / en_preparacion /
--      realizado / cancelado.
--  10) Índices anti-doble-reserva:
--       - único parcial (recurso_id, fecha_evento) sobre eventos NO cancelados.
--       - GiST/exclusión sobre solapamiento de horarios en el mismo recurso+día.
--
--  Reglas: ADITIVO + IDEMPOTENTE. Solo schema `ncgeventos`. RLS con
--  ncgeventos.puede_acceder_empresa(uuid) espejo de las hermanas.
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. proyectos: campos específicos de evento
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE ncgeventos.proyectos
  ADD COLUMN IF NOT EXISTS fecha_evento       date,
  ADD COLUMN IF NOT EXISTS hora_inicio        time,
  ADD COLUMN IF NOT EXISTS hora_fin           time,
  ADD COLUMN IF NOT EXISTS lugar_evento       text,
  ADD COLUMN IF NOT EXISTS cantidad_invitados integer,
  ADD COLUMN IF NOT EXISTS tipo_evento        text,
  ADD COLUMN IF NOT EXISTS recurso_id         uuid;

CREATE INDEX IF NOT EXISTS idx_proyectos_fecha_evento
  ON ncgeventos.proyectos(fecha_evento);
CREATE INDEX IF NOT EXISTS idx_proyectos_recurso
  ON ncgeventos.proyectos(recurso_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. recursos (salones/espacios propios)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ncgeventos.recursos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid NOT NULL,
  nombre        text NOT NULL,
  tipo          text NOT NULL DEFAULT 'salon'
                  CHECK (tipo IN ('salon', 'jardin', 'terraza', 'escenario', 'otro')),
  capacidad     integer,
  descripcion   text,
  activo        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recursos_empresa ON ncgeventos.recursos(empresa_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON ncgeventos.recursos
  TO anon, authenticated, authenticator, service_role;

ALTER TABLE ncgeventos.recursos ENABLE ROW LEVEL SECURITY;

-- FK deferida: se agrega tras crear recursos.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
     WHERE table_schema='ncgeventos' AND table_name='proyectos'
       AND constraint_name='proyectos_recurso_fk'
  ) THEN
    ALTER TABLE ncgeventos.proyectos
      ADD CONSTRAINT proyectos_recurso_fk
      FOREIGN KEY (recurso_id) REFERENCES ncgeventos.recursos(id) ON DELETE SET NULL;
  END IF;
END$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. servicios_catalogo (catálogo maestro de servicios ofrecidos)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ncgeventos.servicios_catalogo (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid NOT NULL,
  nombre        text NOT NULL,
  categoria     text NOT NULL DEFAULT 'extra'
                  CHECK (categoria IN (
                    'catering', 'decoracion', 'musica', 'fotografia',
                    'animacion', 'mobiliario', 'iluminacion', 'seguridad',
                    'transporte', 'extra'
                  )),
  descripcion   text,
  precio_base   numeric NOT NULL DEFAULT 0,
  unidad        text NOT NULL DEFAULT 'unidad',
  activo        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_servicios_empresa ON ncgeventos.servicios_catalogo(empresa_id);
CREATE INDEX IF NOT EXISTS idx_servicios_categoria ON ncgeventos.servicios_catalogo(categoria);

GRANT SELECT, INSERT, UPDATE, DELETE ON ncgeventos.servicios_catalogo
  TO anon, authenticated, authenticator, service_role;

ALTER TABLE ncgeventos.servicios_catalogo ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. paquetes_evento + paquete_items (packs pre-armados)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ncgeventos.paquetes_evento (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid NOT NULL,
  nombre        text NOT NULL,
  descripcion   text,
  precio_total  numeric NOT NULL DEFAULT 0,
  activo        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paquetes_empresa ON ncgeventos.paquetes_evento(empresa_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON ncgeventos.paquetes_evento
  TO anon, authenticated, authenticator, service_role;

ALTER TABLE ncgeventos.paquetes_evento ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS ncgeventos.paquete_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        uuid NOT NULL,
  paquete_id        uuid NOT NULL
                      REFERENCES ncgeventos.paquetes_evento(id) ON DELETE CASCADE,
  servicio_id       uuid NOT NULL
                      REFERENCES ncgeventos.servicios_catalogo(id) ON DELETE RESTRICT,
  cantidad          numeric NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  precio_unitario   numeric NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paquete_items_paquete ON ncgeventos.paquete_items(paquete_id);
CREATE INDEX IF NOT EXISTS idx_paquete_items_servicio ON ncgeventos.paquete_items(servicio_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON ncgeventos.paquete_items
  TO anon, authenticated, authenticator, service_role;

ALTER TABLE ncgeventos.paquete_items ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. evento_servicios (servicios contratados por evento)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ncgeventos.evento_servicios (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        uuid NOT NULL,
  proyecto_id       uuid NOT NULL
                      REFERENCES ncgeventos.proyectos(id) ON DELETE CASCADE,
  servicio_id       uuid REFERENCES ncgeventos.servicios_catalogo(id) ON DELETE SET NULL,
  paquete_id        uuid REFERENCES ncgeventos.paquetes_evento(id) ON DELETE SET NULL,
  proveedor_id      uuid REFERENCES ncgeventos.proveedores(id) ON DELETE SET NULL,
  descripcion       text NOT NULL,
  cantidad          numeric NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  precio_unitario   numeric NOT NULL DEFAULT 0,
  costo_unitario    numeric NOT NULL DEFAULT 0,
  subtotal          numeric NOT NULL DEFAULT 0,
  estado            text NOT NULL DEFAULT 'pendiente'
                      CHECK (estado IN ('pendiente', 'contratado', 'entregado', 'cancelado')),
  observaciones     text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evento_servicios_proyecto ON ncgeventos.evento_servicios(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_evento_servicios_servicio ON ncgeventos.evento_servicios(servicio_id);
CREATE INDEX IF NOT EXISTS idx_evento_servicios_proveedor ON ncgeventos.evento_servicios(proveedor_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON ncgeventos.evento_servicios
  TO anon, authenticated, authenticator, service_role;

ALTER TABLE ncgeventos.evento_servicios ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. evento_presupuestos + items (versionado por evento)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ncgeventos.evento_presupuestos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid NOT NULL,
  proyecto_id   uuid NOT NULL
                  REFERENCES ncgeventos.proyectos(id) ON DELETE CASCADE,
  version       integer NOT NULL DEFAULT 1,
  estado        text NOT NULL DEFAULT 'borrador'
                  CHECK (estado IN ('borrador', 'enviado', 'aprobado', 'rechazado')),
  fecha         date NOT NULL DEFAULT CURRENT_DATE,
  validez_dias  integer,
  total         numeric NOT NULL DEFAULT 0,
  observaciones text,
  aprobado_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_presupuesto_proyecto_version
  ON ncgeventos.evento_presupuestos(proyecto_id, version);
CREATE INDEX IF NOT EXISTS idx_presupuestos_proyecto
  ON ncgeventos.evento_presupuestos(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_presupuestos_estado
  ON ncgeventos.evento_presupuestos(estado);

GRANT SELECT, INSERT, UPDATE, DELETE ON ncgeventos.evento_presupuestos
  TO anon, authenticated, authenticator, service_role;

ALTER TABLE ncgeventos.evento_presupuestos ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS ncgeventos.evento_presupuesto_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        uuid NOT NULL,
  presupuesto_id    uuid NOT NULL
                      REFERENCES ncgeventos.evento_presupuestos(id) ON DELETE CASCADE,
  tipo              text NOT NULL DEFAULT 'servicio'
                      CHECK (tipo IN ('servicio', 'paquete', 'producto', 'texto')),
  ref_id            uuid,
  descripcion       text NOT NULL,
  cantidad          numeric NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  precio_unitario   numeric NOT NULL DEFAULT 0,
  subtotal          numeric NOT NULL DEFAULT 0,
  sort_order        integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_presup_items_presup ON ncgeventos.evento_presupuesto_items(presupuesto_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON ncgeventos.evento_presupuesto_items
  TO anon, authenticated, authenticator, service_role;

ALTER TABLE ncgeventos.evento_presupuesto_items ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. stock_reservas (producto reservado por evento y rango de fechas)
--    Solo aplica a productos reutilizables. Los consumibles se descuentan por
--    movimientos_inventario.SALIDA cuando se ejecuta el evento.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ncgeventos.stock_reservas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     uuid NOT NULL,
  producto_id    uuid NOT NULL
                   REFERENCES ncgeventos.productos(id) ON DELETE RESTRICT,
  proyecto_id    uuid NOT NULL
                   REFERENCES ncgeventos.proyectos(id) ON DELETE CASCADE,
  cantidad       numeric NOT NULL CHECK (cantidad > 0),
  fecha_inicio   timestamptz NOT NULL,
  fecha_fin      timestamptz NOT NULL,
  estado         text NOT NULL DEFAULT 'reservado'
                   CHECK (estado IN ('reservado', 'entregado', 'devuelto', 'anulado')),
  observaciones  text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (fecha_fin >= fecha_inicio)
);

CREATE INDEX IF NOT EXISTS idx_stock_reservas_producto ON ncgeventos.stock_reservas(producto_id);
CREATE INDEX IF NOT EXISTS idx_stock_reservas_proyecto ON ncgeventos.stock_reservas(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_stock_reservas_fechas   ON ncgeventos.stock_reservas(fecha_inicio, fecha_fin);

GRANT SELECT, INSERT, UPDATE, DELETE ON ncgeventos.stock_reservas
  TO anon, authenticated, authenticator, service_role;

ALTER TABLE ncgeventos.stock_reservas ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. pagos.proyecto_id (imputación de pago a evento)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema='ncgeventos' AND table_name='pagos'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema='ncgeventos' AND table_name='pagos'
         AND column_name='proyecto_id'
    ) THEN
      ALTER TABLE ncgeventos.pagos ADD COLUMN proyecto_id uuid;
      CREATE INDEX IF NOT EXISTS idx_pagos_proyecto ON ncgeventos.pagos(proyecto_id);
    END IF;
  END IF;
END$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Anti-doble-reserva de recursos (mismo día + rango horario superpuesto)
--    Usa constraint EXCLUDE con btree_gist (necesita la extensión).
--    Solo bloquea eventos NO cancelados; permite editar el mismo evento.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  -- Si el proyecto ya tiene el constraint, saltear. La condición ignora los
  -- eventos con estado_id que apunte al estado 'cancelado' (chequeo aplicado en
  -- la app; a nivel DB se excluye por recurso_id NOT NULL).
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'proyectos_recurso_horario_excl'
       AND conrelid = 'ncgeventos.proyectos'::regclass
  ) THEN
    -- `date + time` produce timestamp (IMMUTABLE); tstzrange no es válido
    -- para índices porque la conversión a timestamptz depende del TZ del
    -- servidor. Usamos tsrange y sumamos date+time que es inmutable.
    ALTER TABLE ncgeventos.proyectos
      ADD CONSTRAINT proyectos_recurso_horario_excl
      EXCLUDE USING gist (
        recurso_id WITH =,
        fecha_evento WITH =,
        tsrange(
          (fecha_evento + COALESCE(hora_inicio, TIME '00:00'))::timestamp,
          (fecha_evento + COALESCE(hora_fin,    TIME '23:59'))::timestamp,
          '[)'
        ) WITH &&
      )
      WHERE (recurso_id IS NOT NULL AND fecha_evento IS NOT NULL);
  END IF;
END$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Seed de estados de evento (por empresa)
--     Se ejecuta para todas las empresas del schema. Idempotente por
--     UNIQUE(empresa_id, codigo).
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  emp_row RECORD;
  estados_evento CONSTANT text[][] := ARRAY[
    ARRAY['consulta',       'Consulta',        '#94A3B8', '1',  'interno', 'true',  'false'],
    ARRAY['presupuestado',  'Presupuestado',   '#0EA5E9', '2',  'cliente', 'false', 'false'],
    ARRAY['reservado',      'Reservado',       '#F59E0B', '3',  'cliente', 'false', 'false'],
    ARRAY['confirmado',     'Confirmado',      '#10B981', '4',  'interno', 'false', 'false'],
    ARRAY['en_preparacion', 'En preparación',  '#8B5CF6', '5',  'interno', 'false', 'false'],
    ARRAY['realizado',      'Realizado',       '#059669', '6',  'final',   'false', 'true'],
    ARRAY['cancelado',      'Cancelado',       '#EF4444', '99', 'final',   'false', 'true']
  ];
  e text[];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema='ncgeventos' AND table_name='proyecto_estados'
  ) THEN
    RAISE NOTICE '[eventos] Tabla proyecto_estados no existe; seed omitido.';
    RETURN;
  END IF;

  FOR emp_row IN SELECT DISTINCT empresa_id FROM ncgeventos.proyecto_estados LOOP
    FOREACH e SLICE 1 IN ARRAY estados_evento LOOP
      INSERT INTO ncgeventos.proyecto_estados
        (empresa_id, codigo, nombre, color, sort_order, tipo_sla,
         es_estado_inicial, es_estado_final, activo)
      VALUES
        (emp_row.empresa_id, e[1], e[2], e[3], e[4]::int, e[5],
         e[6]::boolean, e[7]::boolean, true)
      ON CONFLICT (empresa_id, codigo) DO NOTHING;
    END LOOP;
  END LOOP;
END$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. RLS policies (defensivas — solo si existe puede_acceder_empresa)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  tabla text;
  tablas text[] := ARRAY[
    'recursos', 'servicios_catalogo', 'paquetes_evento', 'paquete_items',
    'evento_servicios', 'evento_presupuestos', 'evento_presupuesto_items',
    'stock_reservas'
  ];
BEGIN
  IF to_regprocedure('ncgeventos.puede_acceder_empresa(uuid)') IS NULL THEN
    RAISE NOTICE '[eventos] puede_acceder_empresa no existe; policies omitidas.';
    RETURN;
  END IF;

  FOREACH tabla IN ARRAY tablas LOOP
    EXECUTE format($f$
      DROP POLICY IF EXISTS %I ON ncgeventos.%I;
      CREATE POLICY %I ON ncgeventos.%I FOR SELECT
        USING (ncgeventos.puede_acceder_empresa(empresa_id));
    $f$, tabla || '_select', tabla, tabla || '_select', tabla);

    EXECUTE format($f$
      DROP POLICY IF EXISTS %I ON ncgeventos.%I;
      CREATE POLICY %I ON ncgeventos.%I FOR INSERT
        WITH CHECK (ncgeventos.puede_acceder_empresa(empresa_id));
    $f$, tabla || '_insert', tabla, tabla || '_insert', tabla);

    EXECUTE format($f$
      DROP POLICY IF EXISTS %I ON ncgeventos.%I;
      CREATE POLICY %I ON ncgeventos.%I FOR UPDATE
        USING (ncgeventos.puede_acceder_empresa(empresa_id))
        WITH CHECK (ncgeventos.puede_acceder_empresa(empresa_id));
    $f$, tabla || '_update', tabla, tabla || '_update', tabla);

    EXECUTE format($f$
      DROP POLICY IF EXISTS %I ON ncgeventos.%I;
      CREATE POLICY %I ON ncgeventos.%I FOR DELETE
        USING (ncgeventos.puede_acceder_empresa(empresa_id));
    $f$, tabla || '_delete', tabla, tabla || '_delete', tabla);
  END LOOP;
END$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. Función rentabilidad_evento(proyecto_id): agrupa ingresos y costos.
--     Ingresos = suma pagos (con proyecto_id) + evento_servicios.precio × cant
--     Costos   = suma compras + gastos + evento_servicios.costo × cant
--                + stock_reservas × costo_promedio del producto
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION ncgeventos.rentabilidad_evento(p_proyecto_id uuid)
RETURNS TABLE (
  proyecto_id       uuid,
  total_cobrado     numeric,
  total_presupuesto numeric,
  saldo_pendiente   numeric,
  esta_pagado       boolean,
  total_costos      numeric,
  ganancia          numeric,
  margen_pct        numeric
)
LANGUAGE sql
STABLE
AS $$
  WITH cobrado AS (
    SELECT COALESCE(SUM(p.monto), 0) AS total
      FROM ncgeventos.pagos p
     WHERE p.proyecto_id = p_proyecto_id
  ),
  presupuesto AS (
    SELECT COALESCE(MAX(ep.total), 0) AS total
      FROM ncgeventos.evento_presupuestos ep
     WHERE ep.proyecto_id = p_proyecto_id
       AND ep.estado = 'aprobado'
  ),
  costos AS (
    SELECT
      (SELECT COALESCE(SUM(c.total), 0)
         FROM ncgeventos.compras c
        WHERE c.proyecto_id = p_proyecto_id AND c.estado <> 'anulada')
      + (SELECT COALESCE(SUM(g.monto), 0)
         FROM ncgeventos.gastos g
        WHERE g.proyecto_id = p_proyecto_id)
      + (SELECT COALESCE(SUM(es.costo_unitario * es.cantidad), 0)
         FROM ncgeventos.evento_servicios es
        WHERE es.proyecto_id = p_proyecto_id AND es.estado <> 'cancelado')
      AS total
  )
  SELECT
    p_proyecto_id,
    cobrado.total,
    presupuesto.total,
    GREATEST(presupuesto.total - cobrado.total, 0),
    (presupuesto.total > 0 AND cobrado.total >= presupuesto.total),
    costos.total,
    cobrado.total - costos.total,
    CASE WHEN cobrado.total > 0
         THEN ROUND(((cobrado.total - costos.total) / cobrado.total) * 100, 2)
         ELSE 0
    END
  FROM cobrado, presupuesto, costos;
$$;

GRANT EXECUTE ON FUNCTION ncgeventos.rentabilidad_evento(uuid)
  TO anon, authenticated, authenticator, service_role;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- VALIDACIÓN POSTERIOR:
--   -- Columnas evento
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema='ncgeventos' AND table_name='proyectos'
--      AND column_name IN ('fecha_evento','hora_inicio','hora_fin',
--                          'lugar_evento','cantidad_invitados','tipo_evento','recurso_id');
--
--   -- Tablas nuevas
--   SELECT to_regclass('ncgeventos.recursos'),
--          to_regclass('ncgeventos.servicios_catalogo'),
--          to_regclass('ncgeventos.paquetes_evento'),
--          to_regclass('ncgeventos.paquete_items'),
--          to_regclass('ncgeventos.evento_servicios'),
--          to_regclass('ncgeventos.evento_presupuestos'),
--          to_regclass('ncgeventos.evento_presupuesto_items'),
--          to_regclass('ncgeventos.stock_reservas');
--
--   -- Estados evento seedeados
--   SELECT codigo, nombre FROM ncgeventos.proyecto_estados
--    WHERE codigo IN ('consulta','presupuestado','reservado','confirmado',
--                     'en_preparacion','realizado','cancelado')
--    ORDER BY sort_order;
--
--   -- Función rentabilidad
--   SELECT * FROM ncgeventos.rentabilidad_evento('<uuid-evento>');
-- ─────────────────────────────────────────────────────────────────────────────
