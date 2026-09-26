/*
# Add payment method toggles and test mode to mercado_pago_config

1. Modified Tables
   - `mercado_pago_config`
     - `test_mode` (boolean, default true) — Whether to show test simulation buttons in checkout
     - `enable_credit_card` (boolean, default true) — Allow credit card payments
     - `enable_debit_card` (boolean, default true) — Allow debit card payments
     - `enable_ticket` (boolean, default true) — Allow OXXO / cash payments
     - `enable_bank_transfer` (boolean, default true) — Allow bank transfers (SPEI)
     - `enable_mercado_pago_wallet` (boolean, default true) — Allow Mercado Pago wallet
     - `max_installments` (integer, default 12) — Maximum installments allowed
     - `statement_descriptor` (text, nullable) — Custom text on card statements
     - `webhook_secret` (text, nullable) — Secret for validating webhook signatures

2. Important Notes
   - All new columns have sensible defaults. Existing rows get defaults automatically.
   - No data is modified or deleted.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mercado_pago_config' AND column_name = 'test_mode'
  ) THEN
    ALTER TABLE mercado_pago_config ADD COLUMN test_mode boolean NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mercado_pago_config' AND column_name = 'enable_credit_card'
  ) THEN
    ALTER TABLE mercado_pago_config ADD COLUMN enable_credit_card boolean NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mercado_pago_config' AND column_name = 'enable_debit_card'
  ) THEN
    ALTER TABLE mercado_pago_config ADD COLUMN enable_debit_card boolean NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mercado_pago_config' AND column_name = 'enable_ticket'
  ) THEN
    ALTER TABLE mercado_pago_config ADD COLUMN enable_ticket boolean NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mercado_pago_config' AND column_name = 'enable_bank_transfer'
  ) THEN
    ALTER TABLE mercado_pago_config ADD COLUMN enable_bank_transfer boolean NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mercado_pago_config' AND column_name = 'enable_mercado_pago_wallet'
  ) THEN
    ALTER TABLE mercado_pago_config ADD COLUMN enable_mercado_pago_wallet boolean NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mercado_pago_config' AND column_name = 'max_installments'
  ) THEN
    ALTER TABLE mercado_pago_config ADD COLUMN max_installments integer NOT NULL DEFAULT 12;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mercado_pago_config' AND column_name = 'statement_descriptor'
  ) THEN
    ALTER TABLE mercado_pago_config ADD COLUMN statement_descriptor text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mercado_pago_config' AND column_name = 'webhook_secret'
  ) THEN
    ALTER TABLE mercado_pago_config ADD COLUMN webhook_secret text;
  END IF;
END $$;
