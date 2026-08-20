/*
# Update check_customer_email_exists to return customer existence separately

## Changes
- Drops and recreates the `check_customer_email_exists` function with an
  additional `has_customer` boolean return field.
- This allows the signup flow to distinguish between:
  - A fully completed signup (auth + customer row both exist)
  - A partially failed signup (auth exists but no customer row)
  
## Security
- Function remains SECURITY DEFINER with fixed search_path.
- Still never exposes customer data to unauthenticated callers.
- Re-grants EXECUTE to anon and authenticated roles.
*/

DROP FUNCTION IF EXISTS public.check_customer_email_exists(text);

CREATE FUNCTION public.check_customer_email_exists(p_email text)
 RETURNS TABLE(email_exists boolean, has_auth boolean, has_customer boolean, customer_data jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_customer_exists boolean;
  v_auth_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM auth.users WHERE email = p_email
  ) INTO v_auth_exists;

  SELECT EXISTS (
    SELECT 1 FROM customers WHERE customer_email = p_email
  ) INTO v_customer_exists;

  IF v_auth_exists THEN
    RETURN QUERY SELECT true, true, v_customer_exists, NULL::jsonb;
    RETURN;
  END IF;

  IF v_customer_exists THEN
    RETURN QUERY SELECT true, false, true, NULL::jsonb;
    RETURN;
  END IF;

  RETURN QUERY SELECT false, false, false, NULL::jsonb;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.check_customer_email_exists(text) TO anon, authenticated;
