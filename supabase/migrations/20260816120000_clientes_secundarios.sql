-- Campos secundarios de contacto para clientes (heredados del template public
-- pero no existian en ncgeventos.clientes, por lo que el edit los guardaba y
-- Supabase los dropeaba silenciosamente).

ALTER TABLE ncgeventos.clientes ADD COLUMN IF NOT EXISTS telefono_secundario text;
ALTER TABLE ncgeventos.clientes ADD COLUMN IF NOT EXISTS email_secundario    text;
ALTER TABLE ncgeventos.clientes ADD COLUMN IF NOT EXISTS documento           text;

-- Forzar refresh del schema cache de PostgREST para que aparezcan sin esperar.
NOTIFY pgrst, 'reload schema';
