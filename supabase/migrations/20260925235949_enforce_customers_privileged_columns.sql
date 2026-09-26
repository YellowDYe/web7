/*
  # Pin privileged customer columns against self-service writes

  1. Problem
    - "Users can update customers" lets a customer update their own row, which
      at row level means every column: `account_status`, `email_verified`,
      `customer_email`, `auth_user_id`, `customer_id`, `is_test` and the legacy
      identity columns (`firebase_uid`, `supabase_uid`).
    - A shopper could mark themselves verified, reactivate a suspended account,
      change the email their receipts are sent to, or re-point the row at
      another auth user.

  2. Changes
    - Add `enforce_customers_privileged_columns()` and a BEFORE INSERT/UPDATE
      trigger that restores those columns for non-staff sessions.
    - On INSERT, a self-registered row is forced to `account_status = 'active'`,
      `email_verified = false` and `auth_user_id = auth.uid()`.

  3. Security
    - Service role connections (edge functions, the verification flow) and staff
      sessions keep full control, so verification and admin tooling still work.
*/

CREATE OR REPLACE FUNCTION public.enforce_customers_privileged_columns()
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
    NEW.account_status := 'active';
    NEW.email_verified := false;
    NEW.auth_user_id := auth.uid();
    NEW.is_test := COALESCE(NEW.is_test, false);
    RETURN NEW;
  END IF;

  -- UPDATE: keep identity, ownership and account state as they were.
  NEW.customer_id := OLD.customer_id;
  NEW.auth_user_id := OLD.auth_user_id;
  NEW.customer_email := OLD.customer_email;
  NEW.account_status := OLD.account_status;
  NEW.email_verified := OLD.email_verified;
  NEW.firebase_uid := OLD.firebase_uid;
  NEW.supabase_uid := OLD.supabase_uid;
  NEW.is_test := OLD.is_test;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_customers_privileged_columns ON public.customers;

CREATE TRIGGER trg_customers_privileged_columns
  BEFORE INSERT OR UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_customers_privileged_columns();
