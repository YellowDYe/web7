/*
# Track admin alerts for paid sessions without an order

1. Modified Tables
  - `payment_quotes`
    - `admin_alerted_at` (timestamptz, nullable) - when the admin was emailed that a
      payment for this session arrived but no order was registered.

2. Security
  - No change. The table stays service-role only (RLS on, no policies).

3. Notes
  1. Used to send the "payment without order" alert at most once per payment session,
     even though Mercado Pago sends several notifications for the same payment.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_quotes' AND column_name = 'admin_alerted_at'
  ) THEN
    ALTER TABLE public.payment_quotes ADD COLUMN admin_alerted_at timestamptz;
  END IF;
END $$;