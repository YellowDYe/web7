/*
# Mark bills of paid online (Mercado Pago) orders as paid, with the real payment date

1. Changes
- New function `invoice_paid_values_for_order(order_id)`: returns the payment time
  and receiving account ("Mercado Pago") for an order whose online payment is
  confirmed, or nothing if the order is not paid online.
- New BEFORE INSERT trigger `trg_mark_invoice_paid_from_order` on `invoices`:
  when a bill is created for an order already paid online, it is saved as `paid`
  with that payment time and the Mercado Pago account. Runs after the existing
  privileged-column guard (trigger names fire alphabetically).
- New AFTER INSERT/UPDATE trigger `trg_sync_invoice_paid_from_order` on `orders`:
  when an order's online payment becomes confirmed later, its `draft`/`pending`
  bills become `paid` with the same values.

2. Data fix
- Existing `draft`/`pending` bills (no payment date) of orders paid via Mercado
  Pago are set to `paid` with the order's recorded payment time and the Mercado
  Pago account.

3. Security
- Functions run as the database owner so they can set fields customers cannot
  change themselves. They only read server-controlled payment fields on orders,
  which customers cannot write. EXECUTE revoked from public roles.
- Cancelled or already-paid bills are never touched.
*/

CREATE OR REPLACE FUNCTION public.invoice_paid_values_for_order(p_order_id text)
RETURNS TABLE (paid_at timestamptz, account_id text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE(o.stripe_paid_at, o.updated_at, o.created_at),
         (SELECT b.account_id FROM bank_accounts b
           WHERE lower(b.account_name) = 'mercado pago'
           ORDER BY b.account_id LIMIT 1)
    FROM orders o
   WHERE o.order_id = p_order_id
     AND (o.stripe_payment_status = 'succeeded' OR o.stripe_paid_at IS NOT NULL)
     AND (o.payment_provider = 'mercadopago' OR o.mp_payment_id IS NOT NULL)
   LIMIT 1;
$function$;

REVOKE EXECUTE ON FUNCTION public.invoice_paid_values_for_order(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.mark_invoice_paid_from_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v record;
BEGIN
  IF NEW.invoice_status NOT IN ('draft', 'pending') OR NEW.payment_date IS NOT NULL OR NEW.order_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v FROM invoice_paid_values_for_order(NEW.order_id);
  IF v.paid_at IS NULL OR COALESCE(NEW.bank_account_id, v.account_id) IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.invoice_status := 'paid';
  NEW.payment_date := v.paid_at;
  NEW.bank_account_id := COALESCE(NEW.bank_account_id, v.account_id);
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.mark_invoice_paid_from_order() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_mark_invoice_paid_from_order ON public.invoices;
CREATE TRIGGER trg_mark_invoice_paid_from_order
BEFORE INSERT ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.mark_invoice_paid_from_order();

CREATE OR REPLACE FUNCTION public.sync_invoice_paid_from_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v record;
BEGIN
  SELECT * INTO v FROM invoice_paid_values_for_order(NEW.order_id);
  IF v.paid_at IS NULL OR v.account_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE invoices
     SET invoice_status = 'paid',
         payment_date = v.paid_at,
         bank_account_id = COALESCE(bank_account_id, v.account_id)
   WHERE order_id = NEW.order_id
     AND invoice_status IN ('draft', 'pending')
     AND payment_date IS NULL;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.sync_invoice_paid_from_order() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_invoice_paid_from_order ON public.orders;
CREATE TRIGGER trg_sync_invoice_paid_from_order
AFTER INSERT OR UPDATE OF stripe_payment_status, stripe_paid_at, payment_provider, mp_payment_id ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.sync_invoice_paid_from_order();

UPDATE invoices i
   SET invoice_status = 'paid',
       payment_date = v.paid_at,
       bank_account_id = COALESCE(i.bank_account_id, v.account_id)
  FROM orders o
  CROSS JOIN LATERAL invoice_paid_values_for_order(o.order_id) v
 WHERE o.order_id = i.order_id
   AND v.account_id IS NOT NULL
   AND i.invoice_status IN ('draft', 'pending')
   AND i.payment_date IS NULL;
