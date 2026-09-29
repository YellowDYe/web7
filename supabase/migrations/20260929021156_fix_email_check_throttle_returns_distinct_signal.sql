/*
# Fix email check throttle to return a distinct signal

1. Problem
  - When rate-limited, check_customer_email_exists returns (false, false, false, NULL)
    which is identical to "email not found". This causes:
    a) Email signup falsely says "available"
    b) Google auto-link silently skips linking
    c) Eventual duplicate email error at account creation

2. Changes
  - Drop and recreate function with a 5th output column `is_throttled boolean`.
  - When the rate limit is hit, return (false, false, false, NULL, true) so the
    client can distinguish "throttled" from "not found".
  - Normal (non-throttled) responses return is_throttled = false.

3. Security
  - No policy changes. The throttle mechanism itself is unchanged.
  - The new column only reveals that a rate limit was hit, not any PII.
  - Re-grants EXECUTE to anon and authenticated after recreating.
*/

DROP FUNCTION IF EXISTS public.check_customer_email_exists(text);

CREATE FUNCTION public.check_customer_email_exists(p_email text)
RETURNS TABLE(email_exists boolean, has_auth boolean, has_customer boolean, customer_uuid uuid, is_throttled boolean)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
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
    RETURN QUERY SELECT false, false, false, NULL::uuid, false;
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
    RETURN QUERY SELECT false, false, false, NULL::uuid, true;
    RETURN;
  END IF;

  SELECT EXISTS (SELECT 1 FROM auth.users WHERE lower(auth.users.email) = v_email) INTO v_auth_exists;

  SELECT c.id INTO v_customer_uuid
  FROM customers c
  WHERE lower(c.customer_email) = v_email
  LIMIT 1;

  v_customer_exists := v_customer_uuid IS NOT NULL;

  IF v_auth_exists THEN
    RETURN QUERY SELECT true, true, v_customer_exists, v_customer_uuid, false;
    RETURN;
  END IF;

  IF v_customer_exists THEN
    RETURN QUERY SELECT true, false, true, v_customer_uuid, false;
    RETURN;
  END IF;

  RETURN QUERY SELECT false, false, false, NULL::uuid, false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_customer_email_exists(text) TO anon, authenticated;
