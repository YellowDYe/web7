/*
# Fix reverted invoice-status and payment-status in create_order_from_payment_quote

## Problem
The migration `20261009234605_add_week_count_validation_to_payment_quote` replaced the
entire `create_order_from_payment_quote` function. The replacement text was based on the
*original* version from `20261005162709` and unknowingly reverted two later surgical fixes:

1. Migration `20261005162838` changed the `stripe_payment_status` for unpaid orders from
   `'pending'` to `'processing'`, because orders only accepts a fixed list of payment-status
   words and `'pending'` is not one of them.
2. Migrations `20261005170019` / `20261005170038` changed the invoice `invoice_status` to
   always `'draft'` and `payment_date` to always NULL. A BEFORE INSERT trigger
   (`mark_invoice_paid_from_order`) then upgrades the invoice to `'paid'` with the correct
   Mercado Pago bank account. The reverted code inserted `'paid'` directly, which skips the
   trigger, leaves `bank_account_id` NULL, and causes the AFTER INSERT
   `record_invoice_balance_change` trigger to crash with a NULL account_id.

This caused a real customer payment ($1,377, MP payment 182363666579) to be received with
no order created.

## Fix
Three surgical string replacements on the current function definition, restoring the exact
values that the two earlier migrations had established. The week-count validation added in
`20261009234605` is preserved.

## Security
- Function privileges unchanged; still callable only by service_role.
*/

DO $$
DECLARE def text;
BEGIN
  def := pg_get_functiondef('public.create_order_from_payment_quote(uuid,text,numeric,boolean,boolean)'::regprocedure);

  -- 1. Restore 'processing' for unpaid orders (was reverted to 'pending')
  def := replace(def, '''succeeded'' ELSE ''pending'' END', '''succeeded'' ELSE ''processing'' END');

  -- 2. Restore always-'draft' invoice status (was reverted to paid/draft conditional)
  def := replace(def, 'CASE WHEN p_paid THEN ''paid'' ELSE ''draft'' END', '''draft''');

  -- 3. Restore NULL payment_date (was reverted to conditional now()/NULL)
  def := replace(def, 'CASE WHEN p_paid THEN now() ELSE NULL END', 'NULL');

  EXECUTE def;
END $$;
