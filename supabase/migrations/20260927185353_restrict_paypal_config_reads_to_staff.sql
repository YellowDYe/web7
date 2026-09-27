-- F3: paypal_config holds client_id/client_secret and was readable by every
-- authenticated user. Restrict to active staff.

DROP POLICY IF EXISTS "authenticated_select_paypal_config" ON paypal_config;

CREATE POLICY "staff_select_paypal_config"
  ON paypal_config FOR SELECT TO authenticated
  USING (is_staff_user());
