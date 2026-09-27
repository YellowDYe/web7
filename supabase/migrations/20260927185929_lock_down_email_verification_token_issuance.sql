-- F16: request_email_verification returns the verification token to its caller.
-- Only the send-verification-email edge function (service role) may call it.
REVOKE EXECUTE ON FUNCTION public.request_email_verification(uuid, text) FROM anon, authenticated, PUBLIC;

-- F17: anyone could insert a verification row with a token of their choosing
-- and then redeem it. The only legitimate writer is the edge function, which
-- runs with the service role and bypasses RLS.
DROP POLICY IF EXISTS "Anyone can request email verification" ON customer_email_verifications;
