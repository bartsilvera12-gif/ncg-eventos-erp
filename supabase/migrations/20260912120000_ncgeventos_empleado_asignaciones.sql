-- Asignaciones de personal a eventos.
-- Soporta empleados registrados (empleado_id) O empleados ad-hoc del evento
-- (nombre_ad_hoc + total_pago). Karen no siempre quiere dar de alta a alguien
-- en RRHH solo porque ayudo en un evento puntual.

CREATE TABLE IF NOT EXISTS ncgeventos.empleado_asignaciones (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid NOT NULL,
  proyecto_id   uuid NOT NULL,
  empleado_id   uuid,
  nombre_ad_hoc text,
  fecha         date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  horas         numeric NOT NULL DEFAULT 0,
  costo_total   numeric NOT NULL DEFAULT 0,
  observacion   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  -- Uno de los dos tiene que estar cargado.
  CONSTRAINT chk_empleado_o_ad_hoc CHECK (
    empleado_id IS NOT NULL OR (nombre_ad_hoc IS NOT NULL AND btrim(nombre_ad_hoc) <> '')
  )
);

-- Si la tabla ya existía, aseguro columnas nuevas y que empleado_id sea nullable.
ALTER TABLE ncgeventos.empleado_asignaciones
  ADD COLUMN IF NOT EXISTS nombre_ad_hoc text;
ALTER TABLE ncgeventos.empleado_asignaciones
  ALTER COLUMN empleado_id DROP NOT NULL;

-- Eliminar el CHECK anterior si existía con otro nombre y garantizar el actual.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'ncgeventos'
      AND table_name = 'empleado_asignaciones'
      AND constraint_name = 'chk_empleado_o_ad_hoc'
  ) THEN
    ALTER TABLE ncgeventos.empleado_asignaciones
      ADD CONSTRAINT chk_empleado_o_ad_hoc CHECK (
        empleado_id IS NOT NULL OR (nombre_ad_hoc IS NOT NULL AND btrim(nombre_ad_hoc) <> '')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_asig_emp_empresa   ON ncgeventos.empleado_asignaciones(empresa_id);
CREATE INDEX IF NOT EXISTS idx_asig_emp_proyecto  ON ncgeventos.empleado_asignaciones(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_asig_emp_empleado  ON ncgeventos.empleado_asignaciones(empleado_id);
CREATE INDEX IF NOT EXISTS idx_asig_emp_fecha     ON ncgeventos.empleado_asignaciones(fecha);

ALTER TABLE ncgeventos.empleado_asignaciones ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'puede_acceder_empresa' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'ncgeventos')) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='ncgeventos' AND tablename='empleado_asignaciones' AND policyname='asig_emp_tenant_rls') THEN
      EXECUTE $POL$
        CREATE POLICY asig_emp_tenant_rls ON ncgeventos.empleado_asignaciones
          FOR ALL
          USING (ncgeventos.puede_acceder_empresa(empresa_id))
          WITH CHECK (ncgeventos.puede_acceder_empresa(empresa_id))
      $POL$;
    END IF;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
