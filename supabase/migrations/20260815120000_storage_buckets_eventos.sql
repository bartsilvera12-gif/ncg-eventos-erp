-- Buckets de Storage requeridos por NCG Eventos.
-- Idempotente: ON CONFLICT no rompe si el bucket ya existe.
--
--   proyectos      → fotos y galería de eventos (público, para poder mostrar <img src>).
--   certificados   → certificados de empresa (privado; se sirven con signed URL).
--   gastos         → comprobantes de gastos (privado).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'proyectos',
  'proyectos',
  true,
  20971520, -- 20 MB
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('certificados', 'certificados', false, 20971520)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('gastos', 'gastos', false, 20971520)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;

-- Policies mínimas para 'proyectos' (autenticados pueden leer/subir/borrar sus objetos).
DO $$
BEGIN
  -- SELECT (público al bucket público igual, pero definimos por consistencia).
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND policyname='ncg_proyectos_select') THEN
    CREATE POLICY "ncg_proyectos_select"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'proyectos');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND policyname='ncg_proyectos_insert') THEN
    CREATE POLICY "ncg_proyectos_insert"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'proyectos' AND auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND policyname='ncg_proyectos_delete') THEN
    CREATE POLICY "ncg_proyectos_delete"
      ON storage.objects FOR DELETE
      USING (bucket_id = 'proyectos' AND auth.role() = 'authenticated');
  END IF;

  -- Certificados: solo autenticados; el signed URL cubre el download.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND policyname='ncg_certificados_all') THEN
    CREATE POLICY "ncg_certificados_all"
      ON storage.objects FOR ALL
      USING (bucket_id = 'certificados' AND auth.role() = 'authenticated')
      WITH CHECK (bucket_id = 'certificados' AND auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND policyname='ncg_gastos_all') THEN
    CREATE POLICY "ncg_gastos_all"
      ON storage.objects FOR ALL
      USING (bucket_id = 'gastos' AND auth.role() = 'authenticated')
      WITH CHECK (bucket_id = 'gastos' AND auth.role() = 'authenticated');
  END IF;
END $$;
