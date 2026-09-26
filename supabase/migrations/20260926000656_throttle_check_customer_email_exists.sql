/*
  # Throttle the account-existence check

  1. Problem
    - `check_customer_email_exists` is a SECURITY DEFINER function callable with
      the published anon key. It answers "does this address have an account"
      for any address, so the whole customer list can be enumerated by asking
      about candidate emails one after another.

  2. New Tables
    - `email_check_attempts` (`id`, `email`, `checked_at`) records each probe so
      the function can rate-limit itself. RLS is on with no policies, so only
      the definer function and the service role touch it.

  3. Changes
    - `check_customer_email_exists` now records every call and returns the
      neutral "no account" answer once a single address has been probed more
      than 5 times in an hour, or once more than 100 probes have been made in
      the last 10 minutes overall. Normal signup traffic (a couple of checks per
      registration) is unaffected; bulk enumeration stops getting real answers.
    - Old rows are pruned opportunistically.
*/

CREATE TABLE IF NOT EXISTS public.email_check_attempts (
  id bigserial PRIMARY KEY,
  email text NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_check_attempts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS email_check_attempts_email_time_idx
  ON public.email_check_attempts (email, checked_at DESC);

CREATE INDEX IF NOT EXISTS email_check_attempts_time_idx
  ON public.email_check_attempts (checked_at DESC);

REVOKE ALL ON public.email_check_attempts FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.email_check_attempts_id_seq FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.check_customer_email_exists(p_email text)
RETURNS TABLE(email_exists boolean, has_auth boolean, has_customer boolean, customer_data jsonb)
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
    RETURN QUERY SELECT false, false, false, NULL::jsonb;
    RETURN;
  END IF;

  -- Prune old rows now and then so the table stays small.
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

  -- Throttled callers get the neutral answer, so the endpoint cannot be used to
  -- enumerate accounts in bulk.
  IF v_per_email >= 5 OR v_global >= 100 THEN
    RETURN QUERY SELECT false, false, false, NULL::jsonb;
    RETURN;
  END IF;

  SELECT EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_email) INTO v_auth_exists;
  SELECT EXISTS (SELECT 1 FROM customers WHERE lower(customer_email) = v_email) INTO v_customer_exists;

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
