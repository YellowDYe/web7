/*
# Keep checkout details with each payment session

1. Modified Tables
  - `payment_quotes`
    - `order_snapshot` (jsonb, nullable) - the customer's checkout details (customer
      info, cart, delivery choice) captured right before they pay.

2. Security
  - No change. The table stays service-role only (RLS on, no policies). The
    snapshot is only returned to the same signed-in user who created the session.

3. Notes
  1. Lets the return page register the order after a Mercado Pago redirect even if
     the customer's browser lost its locally saved details.
  2. The charged amount is still taken from `amount`, never from the snapshot.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_quotes' AND column_name = 'order_snapshot'
  ) THEN
    ALTER TABLE public.payment_quotes ADD COLUMN order_snapshot jsonb;
  END IF;
END $$;