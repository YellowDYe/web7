/*
  # Raise email-check throttle from 5 to 10 per email per hour

  1. Changes
    - Replaces `check_customer_email_exists` with an identical function except
      the per-email throttle is raised from 5 to 10 checks per hour.
    - The global throttle (100 per 10 min) stays the same.

  2. Security
    - Still blocks bulk enumeration (10/hr per email, 100/10min global).
    - Gives real users enough room to retry signup a few times without
      being silently throttled.
*/

CREATE OR REPLACE FUNCTION public.check_customer_email_exists(p_email text)
 RETURNS TABLE(email_exists boolean, has_auth boolean, has_customer boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_customer_exists boolean;
  v_auth_exists boolean;
  v_email text;
  v_per_email integer;
  v_global integer;
BEGIN
  v_email := lower(btrim(COALESCE(p_email, '')));

  IF v_email = '' THEN
    RETURN QUERY SELECT false, false, false;
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
    RETURN QUERY SELECT false, false, false;
    RETURN;
  END IF;

  SELECT EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_email) INTO v_auth_exists;
  SELECT EXISTS (SELECT 1 FROM customers WHERE lower(customer_email) = v_email) INTO v_customer_exists;

  IF v_auth_exists THEN
    RETURN QUERY SELECT true, true, v_customer_exists;
    RETURN;
  END IF;

  IF v_customer_exists THEN
    RETURN QUERY SELECT true, false, true;
    RETURN;
  END IF;

  RETURN QUERY SELECT false, false, false;
END;
$function$;
