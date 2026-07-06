-- ============================================================================
--  02 — CREATE SCHEMA NCGEVENTOS (MODIFICADOR — bajo riesgo)
--  Crea el schema vacío y otorga grants mínimos para PostgREST.
--  NO toca ncgconstructora, public ni otros schemas.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS ncgeventos;

GRANT USAGE ON SCHEMA ncgeventos TO authenticator;
GRANT USAGE ON SCHEMA ncgeventos TO anon;
GRANT USAGE ON SCHEMA ncgeventos TO authenticated;
GRANT USAGE ON SCHEMA ncgeventos TO service_role;

GRANT CREATE ON SCHEMA ncgeventos TO service_role;

-- Default privileges: objetos futuros creados por service_role ya quedan
-- accesibles para roles operativos (PostgREST + clientes anon/authenticated).
ALTER DEFAULT PRIVILEGES IN SCHEMA ncgeventos
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA ncgeventos
  GRANT SELECT ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA ncgeventos
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA ncgeventos
  GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;

-- Verificación inmediata (READ-ONLY):
SELECT nspname FROM pg_namespace WHERE nspname = 'ncgeventos';
