/*
  # Restrict delivery tracking credentials to administrators

  1. Changes
    - Replace `authenticated_select_delivery_tracking_config` (predicate `true`)
      with an admin-only SELECT policy.

  2. Security
    - The row holds the carrier API key used by the tracking proxy; every
      signed-in account could read it and call the carrier directly.
*/

DROP POLICY IF EXISTS "authenticated_select_delivery_tracking_config" ON public.delivery_tracking_config;

CREATE POLICY "admin_select_delivery_tracking_config"
  ON public.delivery_tracking_config
  FOR SELECT
  TO authenticated
  USING (is_admin_user());
