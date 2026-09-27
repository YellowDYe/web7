-- F6: mp_payment_id is the key the Mercado Pago webhook looks orders up by, and
-- payment_provider records how the order was paid. Neither may be chosen by a
-- customer session; the payment functions run with the service role and are
-- unaffected by this branch.

CREATE OR REPLACE FUNCTION public.enforce_orders_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF current_user IN ('service_role', 'postgres', 'supabase_admin', 'authenticator', 'supabase_storage_admin') THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL OR public.is_staff_user() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.order_status := 'pending';
    NEW.stripe_payment_status := 'pending';
    NEW.stripe_paid_at := NULL;
    NEW.stripe_payment_intent_id := NULL;
    NEW.order_invoice_number := COALESCE(NEW.order_invoice_number, '');
    NEW.driver_id := NULL;
    NEW.invoice_group_id := NULL;
    NEW.is_test := COALESCE(NEW.is_test, false);
    NEW.mp_payment_id := NULL;
    NEW.payment_provider := NULL;

    IF NEW.order_total_price IS NULL OR NEW.order_total_price <= 0 THEN
      RAISE EXCEPTION 'El total del pedido no es valido';
    END IF;

    RETURN NEW;
  END IF;

  -- UPDATE: keep every privileged value as it was.
  NEW.order_id := OLD.order_id;
  NEW.customer_id := OLD.customer_id;
  NEW.order_total_price := OLD.order_total_price;
  NEW.order_status := OLD.order_status;
  NEW.stripe_payment_status := OLD.stripe_payment_status;
  NEW.stripe_paid_at := OLD.stripe_paid_at;
  NEW.stripe_payment_intent_id := OLD.stripe_payment_intent_id;
  NEW.order_invoice_number := OLD.order_invoice_number;
  NEW.driver_id := OLD.driver_id;
  NEW.invoice_group_id := OLD.invoice_group_id;
  NEW.is_test := OLD.is_test;
  NEW.mp_payment_id := OLD.mp_payment_id;
  NEW.payment_provider := OLD.payment_provider;

  RETURN NEW;
END;
$function$;
