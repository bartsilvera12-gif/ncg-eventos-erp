-- Fotos adjuntas al presupuesto (para imprimir con imagen de referencia).
-- Guardamos las URLs publicas del bucket 'proyectos' en un array text[].

ALTER TABLE ncgeventos.evento_presupuestos
  ADD COLUMN IF NOT EXISTS foto_urls text[] NOT NULL DEFAULT '{}';

NOTIFY pgrst, 'reload schema';
