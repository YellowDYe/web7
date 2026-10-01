/*
# Link payment checkouts to their orders

1. Modified Tables
- `payment_quotes`
  - `order_id` (uuid, nullable, references orders.id) - the order created for this checkout.
    Set only by trusted server functions after verifying the payment with Mercado Pago.

2. Indexes
- Index on `payment_quotes.order_id` and `payment_quotes.payment_id` for webhook lookups.

3. Security
- No policy changes. Customers cannot write this table directly; only server functions do.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_quotes' AND column_name = 'order_id'
  ) THEN
    ALTER TABLE public.payment_quotes ADD COLUMN order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS payment_quotes_order_id_idx ON public.payment_quotes(order_id);
CREATE INDEX IF NOT EXISTS payment_quotes_payment_id_idx ON public.payment_quotes(payment_id);
