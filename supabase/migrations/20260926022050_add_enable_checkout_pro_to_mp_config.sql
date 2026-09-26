/*
# Add enable_checkout_pro column to mercado_pago_config

1. Modified Tables
   - `mercado_pago_config`
     - `enable_checkout_pro` (boolean, default true) - controls whether the
       "Pay with Mercado Pago account" redirect button appears at checkout,
       allowing customers to pay with their MP wallet balance.

2. Notes
   - Idempotent: uses DO block with IF NOT EXISTS check.
   - No data loss.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'mercado_pago_config'
      AND column_name = 'enable_checkout_pro'
  ) THEN
    ALTER TABLE mercado_pago_config
      ADD COLUMN enable_checkout_pro boolean NOT NULL DEFAULT true;
  END IF;
END $$;
