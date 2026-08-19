/*
  # Security: stop returning customer personal data to anonymous callers

  `check_customer_email_exists` is anon-executable (the signup form needs it) and
  returned a jsonb payload with the customer's name, phone, full street address,
  delivery notes, dietary restrictions and RFC/billing details for any email that
  had a customer record but no login yet. Anyone could walk a list of addresses
  and harvest that.

  The signature is unchanged so existing callers keep working, but
  `customer_data` is now always NULL: only the two existence booleans the signup
  flow actually needs are returned.
*/

CREATE OR REPLACE FUNCTION public.check_customer_email_exists(p_email text)
RETURNS TABLE(email_exists boolean, has_auth boolean, customer_data jsonb)
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
RETURN QUERY SELECT true, true, NULL::jsonb;
RETURN;
END IF;

IF v_customer_exists THEN
-- Never expose the stored customer record to an unauthenticated caller.
RETURN QUERY SELECT true, false, NULL::jsonb;
RETURN;
END IF;

RETURN QUERY SELECT false, false, NULL::jsonb;
END;
$function$;

REVOKE ALL ON FUNCTION public.check_customer_email_exists(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_customer_email_exists(text) TO anon, authenticated;
