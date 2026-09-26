/*
# Add Mercado Pago payment tracking columns to orders

1. Modified Tables
   - `orders`
     - `mp_payment_id` (text, nullable) — Mercado Pago payment ID for tracking
     - `payment_provider` (text, nullable) — Which payment provider was used (mercadopago, stripe, paypal)

2. Important Notes
   - Existing rows keep NULL for both new columns.
   - No data is modified or deleted.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'mp_payment_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN mp_payment_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'payment_provider'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_provider text;
  END IF;
END $$;
