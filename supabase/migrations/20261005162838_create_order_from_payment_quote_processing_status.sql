/*
# Use an allowed payment status for unpaid orders created from a checkout

Plain English: orders only accept a fixed list of payment-status words, and "pending"
is not one of them. Orders created for a cash ticket that is not yet paid now record
the payment status as "processing" (the allowed equivalent). Nothing else changes.

1. Modified function: `create_order_from_payment_quote` (payment status for unpaid orders).
2. Security: unchanged; still callable only by the service role.
*/
DO $$
DECLARE def text;
BEGIN
  def := pg_get_functiondef('public.create_order_from_payment_quote(uuid,text,numeric,boolean,boolean)'::regprocedure);
  def := replace(def, '''succeeded'' ELSE ''pending'' END', '''succeeded'' ELSE ''processing'' END');
  EXECUTE def;
END $$;
