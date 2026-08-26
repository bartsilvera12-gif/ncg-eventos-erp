-- Reemplaza las policies del bucket 'proyectos' (y 'certificados'/'gastos') por
-- versiones que usan `TO authenticated` en lugar de `auth.role() = 'authenticated'`.
-- Sintoma anterior: 403 al subir aun estando logueado, aunque el bucket exista.

DROP POLICY IF EXISTS "ncg_proyectos_select"    ON storage.objects;
DROP POLICY IF EXISTS "ncg_proyectos_insert"    ON storage.objects;
DROP POLICY IF EXISTS "ncg_proyectos_delete"    ON storage.objects;
DROP POLICY IF EXISTS "ncg_proyectos_update"    ON storage.objects;
DROP POLICY IF EXISTS "ncg_certificados_all"    ON storage.objects;
DROP POLICY IF EXISTS "ncg_gastos_all"          ON storage.objects;

-- proyectos: SELECT publico (bucket publico), INSERT/UPDATE/DELETE solo autenticados.
CREATE POLICY "ncg_proyectos_select" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'proyectos');

CREATE POLICY "ncg_proyectos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'proyectos');

CREATE POLICY "ncg_proyectos_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'proyectos')
  WITH CHECK (bucket_id = 'proyectos');

CREATE POLICY "ncg_proyectos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'proyectos');

-- certificados: privado; todo requiere autenticacion.
CREATE POLICY "ncg_certificados_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'certificados');
CREATE POLICY "ncg_certificados_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'certificados');
CREATE POLICY "ncg_certificados_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'certificados')
  WITH CHECK (bucket_id = 'certificados');
CREATE POLICY "ncg_certificados_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'certificados');

-- gastos: privado; todo requiere autenticacion.
CREATE POLICY "ncg_gastos_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'gastos');
CREATE POLICY "ncg_gastos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'gastos');
CREATE POLICY "ncg_gastos_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'gastos')
  WITH CHECK (bucket_id = 'gastos');
CREATE POLICY "ncg_gastos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'gastos');
