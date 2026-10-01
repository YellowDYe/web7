/*
# Record why a card payment attempt was rejected

1. Modified Tables
- `payment_quotes`
  - `last_error` (text, nullable): plain-language reason Mercado Pago gave for the most recent rejected attempt.
  - `last_error_code` (text, nullable): raw Mercado Pago cause/status code, for support.
  - `last_error_at` (timestamptz, nullable): when that rejection happened.

2. Security
- No policy changes. Only the payment server function (service role) writes these columns; staff read them through that same function.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_quotes' AND column_name = 'last_error') THEN
    ALTER TABLE payment_quotes ADD COLUMN last_error text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_quotes' AND column_name = 'last_error_code') THEN
    ALTER TABLE payment_quotes ADD COLUMN last_error_code text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_quotes' AND column_name = 'last_error_at') THEN
    ALTER TABLE payment_quotes ADD COLUMN last_error_at timestamptz;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payment_quotes_last_error_at ON payment_quotes (last_error_at DESC) WHERE last_error_at IS NOT NULL;
