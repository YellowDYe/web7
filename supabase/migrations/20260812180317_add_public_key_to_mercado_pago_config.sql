/*
# Add public_key to mercado_pago_config

1. Modified Tables
   - `mercado_pago_config`
     - Added `public_key` (text, nullable) - The MercadoPago public key needed for the
       client-side SDK to render the embedded payment form (Checkout Bricks).

2. Important Notes
   - Non-destructive, additive change.
   - Existing rows will have public_key = null until admin updates settings.
   - The public key is safe to expose client-side (it's designed for that purpose).
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'mercado_pago_config'
      AND column_name = 'public_key'
  ) THEN
    ALTER TABLE mercado_pago_config ADD COLUMN public_key text;
  END IF;
END $$;
