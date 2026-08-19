/*
  # Security: email verification tokens are no longer public

  `customer_email_verifications` allowed `anon` to SELECT every row (publishing
  the `token` column) and to UPDATE any unexpired pending row to
  `verified = true` without presenting the token at all.

  1. The anonymous SELECT and UPDATE policies are removed. No application code
     reads or updates this table directly.
  2. `public.verify_customer_email(p_token text)` performs the check and the
     claim atomically in one statement and reports only success or failure, so a
     caller must hold the real token and cannot replay it.
*/

DROP POLICY IF EXISTS "Anyone can verify their token" ON public.customer_email_verifications;
DROP POLICY IF EXISTS "System can update verifications" ON public.customer_email_verifications;

CREATE OR REPLACE FUNCTION public.verify_customer_email(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_email text;
BEGIN
  IF p_token IS NULL OR length(p_token) < 32 THEN
    RETURN json_build_object('success', false, 'message', 'Invalid or expired verification link');
  END IF;

  -- Atomic claim: only an unverified, unexpired row with this exact token moves.
  UPDATE public.customer_email_verifications
  SET verified = true,
      verified_at = now()
  WHERE token = p_token
    AND verified = false
    AND expires_at > now()
  RETURNING email INTO v_email;

  IF v_email IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Invalid or expired verification link');
  END IF;

  RETURN json_build_object('success', true, 'email', v_email);
END;
$$;

REVOKE ALL ON FUNCTION public.verify_customer_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_customer_email(text) TO anon, authenticated;
