-- Campos ES (dirección, alta/baja, régimen y forma de pago, IBAN/BIC, persona de contacto).
-- Idempotente: solo agrega columnas si no existen.

ALTER TABLE ncgeventos.clientes ADD COLUMN IF NOT EXISTS codigo_postal   text;
ALTER TABLE ncgeventos.clientes ADD COLUMN IF NOT EXISTS provincia       text;
ALTER TABLE ncgeventos.clientes ADD COLUMN IF NOT EXISTS contacto_persona text;
ALTER TABLE ncgeventos.clientes ADD COLUMN IF NOT EXISTS fecha_alta      date;
ALTER TABLE ncgeventos.clientes ADD COLUMN IF NOT EXISTS fecha_baja      date;
ALTER TABLE ncgeventos.clientes ADD COLUMN IF NOT EXISTS regimen_fiscal  text;
ALTER TABLE ncgeventos.clientes ADD COLUMN IF NOT EXISTS forma_pago      text;
ALTER TABLE ncgeventos.clientes ADD COLUMN IF NOT EXISTS iban            text;
ALTER TABLE ncgeventos.clientes ADD COLUMN IF NOT EXISTS bic_swift       text;

-- Permitir EUR como moneda_preferida (además de GS/USD heredados).
DO $$
BEGIN
  BEGIN
    ALTER TABLE ncgeventos.clientes DROP CONSTRAINT IF EXISTS clientes_moneda_preferida_check;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
END $$;
