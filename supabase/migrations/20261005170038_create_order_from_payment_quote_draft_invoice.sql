/*
# Always create a draft invoice for orders built from a checkout

Plain English: a "paid" invoice must be tied to a bank account so the account balance
can be updated. Orders created automatically after a Mercado Pago payment have no
bank account chosen, so creating them with a paid invoice failed and no order was made.
These invoices are now created as drafts (no payment date), exactly like orders placed
from the website, and the team marks them paid against the right account when reconciling.

1. Modified function: `create_order_from_payment_quote` (invoice is always created as draft).
2. Security: unchanged; still callable only by the service role.
*/
DO $$
DECLARE def text;
BEGIN
  def := pg_get_functiondef('public.create_order_from_payment_quote(uuid,text,numeric,boolean,boolean)'::regprocedure);
  def := replace(def, 'CASE WHEN p_paid THEN ''paid'' ELSE ''draft'' END', '''draft''');
  def := replace(def, E'''draft'',\nCASE WHEN p_paid THEN now() ELSE NULL END', E'''draft'',\nNULL');
  EXECUTE def;
END $$;