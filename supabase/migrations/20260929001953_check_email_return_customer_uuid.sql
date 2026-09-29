/*
  # Return customer_id from check_customer_email_exists

  1. Changes
    - Drops and recreates `check_customer_email_exists` to add a
      `customer_uuid` column to its return type.
    - When a customer record exists for the given email, its `id` (uuid) is
      returned so the signup flow can pass it as `p_existing_customer_id` to
      `create_customer_account`, which then links instead of inserting a
      duplicate.

  2. Security
    - The function remains SECURITY DEFINER with a pinned search_path.
    - Throttle limits (10/hr per email, 100/10min global) are unchanged.
    - The returned uuid is an opaque primary key; it does not leak PII.
    - EXECUTE grant is re-granted to anon + authenticated.
*/

DROP FUNCTION IF EXISTS public.check_customer_email_exists(text);

CREATE FUNCTION public.check_customer_email_exists(p_email text)
 RETURNS TABLE(email_exists boolean, has_auth boolean, has_customer boolean, customer_uuid uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_customer_exists boolean;
  v_auth_exists boolean;
  v_customer_uuid uuid;
  v_email text;
  v_per_email integer;
  v_global integer;
BEGIN
  v_email := lower(btrim(COALESCE(p_email, '')));

  IF v_email = '' THEN
    RETURN QUERY SELECT false, false, false, NULL::uuid;
    RETURN;
  END IF;

  IF random() < 0.02 THEN
    DELETE FROM public.email_check_attempts WHERE checked_at < now() - interval '1 day';
  END IF;

  SELECT count(*) INTO v_per_email
  FROM public.email_check_attempts
  WHERE email = v_email AND checked_at > now() - interval '1 hour';

  SELECT count(*) INTO v_global
  FROM public.email_check_attempts
  WHERE checked_at > now() - interval '10 minutes';

  INSERT INTO public.email_check_attempts (email) VALUES (v_email);

  IF v_per_email >= 10 OR v_global >= 100 THEN
    RETURN QUERY SELECT false, false, false, NULL::uuid;
    RETURN;
  END IF;

  SELECT EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_email) INTO v_auth_exists;

  SELECT c.id INTO v_customer_uuid
  FROM customers c
  WHERE lower(c.customer_email) = v_email
  LIMIT 1;

  v_customer_exists := v_customer_uuid IS NOT NULL;

  IF v_auth_exists THEN
    RETURN QUERY SELECT true, true, v_customer_exists, v_customer_uuid;
    RETURN;
  END IF;

  IF v_customer_exists THEN
    RETURN QUERY SELECT true, false, true, v_customer_uuid;
    RETURN;
  END IF;

  RETURN QUERY SELECT false, false, false, NULL::uuid;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.check_customer_email_exists(text) TO anon, authenticated;
