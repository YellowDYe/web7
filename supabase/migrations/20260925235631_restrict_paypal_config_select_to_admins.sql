/*
  # Restrict PayPal credentials to administrators

  1. Changes
    - Replace the `authenticated_select_paypal_config` policy, whose predicate was
      `true`, with one requiring `is_admin_user()`.

  2. Security
    - The table holds `client_id`, `client_secret` and `webhook_id`. Any signed-in
      account, including a shopper who just registered, could read them.
    - Edge functions use the service role and are unaffected.
*/

DROP POLICY IF EXISTS "authenticated_select_paypal_config" ON public.paypal_config;

CREATE POLICY "admin_select_paypal_config"
  ON public.paypal_config
  FOR SELECT
  TO authenticated
  USING (is_admin_user());
